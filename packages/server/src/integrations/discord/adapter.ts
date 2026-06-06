import { BaseAdapter, type SendResult } from "../../gateway/base";
import { DiscordBot } from "./bot";
import type { Channel, Message, APIEmbed } from "discord.js";
import type { ThreadResult, ReactionResult } from "./tools";

export interface DiscordChannel {
  id: string;
  name: string;
  type: string;
  guildId?: string;
  guildName?: string;
}

export interface DiscordMessageInfo {
  id: string;
  channelId: string;
  author: string;
  content: string;
  timestamp: string;
}

export class DiscordAdapter extends BaseAdapter {
  private bot: DiscordBot | null = null;
  private token: string | null = null;
  private _connected = false;

  get platform(): string {
    return "discord";
  }

  async configure(config: Record<string, unknown>): Promise<void> {
    this.token = config.token as string;
  }

  async start(): Promise<void> {
    if (!this.token) throw new Error("Discord token not configured");
    this.bot = new DiscordBot(this.token, () => {});
    await this.bot.start();
    this._connected = true;
  }

  async stop(): Promise<void> {
    await this.bot?.stop();
    this.bot = null;
    this._connected = false;
  }

  async send(target: string, content: string): Promise<SendResult> {
    if (!this.bot) return { success: false, error: "Bot not started" };
    return this.bot.send(target, content);
  }

  isConnected(): boolean {
    return this._connected;
  }

  /**
   * List all channels the bot has access to.
   */
  async listChannels(guildId?: string): Promise<DiscordChannel[]> {
    if (!this.bot) throw new Error("Bot not started");

    const client = this.bot.getClient();
    if (!client) throw new Error("Discord client not available");

    const channels: DiscordChannel[] = [];

    if (guildId) {
      const guild = await client.guilds.fetch(guildId);
      const guildChannels = await guild.channels.fetch();
      for (const [, channel] of guildChannels) {
        if (channel && ("name" in channel)) {
          channels.push({
            id: channel.id,
            name: (channel as any).name ?? "unknown",
            type: String(channel.type),
            guildId: guild.id,
            guildName: guild.name,
          });
        }
      }
    } else {
      for (const guild of client.guilds.cache.values()) {
        const guildChannels = await guild.channels.fetch();
        for (const [, channel] of guildChannels) {
          if (channel && ("name" in channel)) {
            channels.push({
              id: channel.id,
              name: (channel as any).name ?? "unknown",
              type: String(channel.type),
              guildId: guild.id,
              guildName: guild.name,
            });
          }
        }
      }
    }

    return channels;
  }

  /**
   * Send a message with optional embed.
   */
  async sendMessage(
    channelId: string,
    content: string,
    embed?: Record<string, unknown>
  ): Promise<SendResult> {
    if (!this.bot) return { success: false, error: "Bot not started" };

    const client = this.bot.getClient();
    if (!client) return { success: false, error: "Discord client not available" };

    try {
      const channel = await client.channels.fetch(channelId);
      if (!channel || !channel.isSendable()) {
        return { success: false, error: "Channel not found or not sendable" };
      }

      const options: { content: string; embeds?: APIEmbed[] } = { content };
      if (embed) {
        options.embeds = [embed as APIEmbed];
      }

      const message = await channel.send(options);
      return { success: true, messageId: message.id };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Get recent messages from a channel.
   */
  async getMessages(channelId: string, limit = 50): Promise<DiscordMessageInfo[]> {
    if (!this.bot) throw new Error("Bot not started");

    const client = this.bot.getClient();
    if (!client) throw new Error("Discord client not available");

    const channel = await client.channels.fetch(channelId);
    if (!channel || !channel.isTextBased()) {
      throw new Error("Channel not found or not text-based");
    }

    const messages = await channel.messages.fetch({ limit: Math.min(limit, 100) });

    return Array.from(messages.values()).map((msg) => ({
      id: msg.id,
      channelId: msg.channelId,
      author: msg.author.username,
      content: msg.content,
      timestamp: msg.createdTimestamp.toString(),
    }));
  }

  /**
   * Create a new thread in a channel.
   */
  async createThread(
    channelId: string,
    name: string,
    message: string
  ): Promise<ThreadResult> {
    if (!this.bot) throw new Error("Bot not started");

    const client = this.bot.getClient();
    if (!client) return { success: false, error: "Discord client not available" };

    try {
      const channel = await client.channels.fetch(channelId);
      if (!channel || !channel.isSendable()) {
        return { success: false, error: "Channel not found or not sendable" };
      }

      // Send the message first
      const sentMessage = await channel.send(message);

      // Create thread from message
      const thread = await sentMessage.startThread({
        name,
        autoArchiveDuration: 1440, // 24 hours
      });

      return { success: true, threadId: thread.id };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Add a reaction emoji to a message.
   */
  async addReaction(
    channelId: string,
    messageId: string,
    emoji: string
  ): Promise<ReactionResult> {
    if (!this.bot) throw new Error("Bot not started");

    const client = this.bot.getClient();
    if (!client) return { success: false, error: "Discord client not available" };

    try {
      const channel = await client.channels.fetch(channelId);
      if (!channel || !channel.isTextBased()) {
        return { success: false, error: "Channel not found or not text-based" };
      }

      const message = await channel.messages.fetch(messageId);
      await message.react(emoji);

      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
