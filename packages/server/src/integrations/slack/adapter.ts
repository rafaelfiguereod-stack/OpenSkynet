import { BaseAdapter, type SendResult } from "../../gateway/base";
import { SlackBot } from "./bot";
import type { SendMessageOptions } from "./tools";

export interface SlackChannel {
  id: string;
  name: string;
  isChannel: boolean;
  isPrivate: boolean;
  isArchived: boolean;
  topic?: string;
  purpose?: string;
  memberCount?: number;
}

export interface SlackMessageInfo {
  ts: string;
  userId: string;
  username: string;
  text: string;
  threadTs?: string;
  reactions?: Array<{ name: string; count: number }>;
}

export interface SlackChannelInfo {
  id: string;
  name: string;
  topic?: string;
  purpose?: string;
  isPrivate: boolean;
  isArchived: boolean;
  created: number;
  creator: string;
  members?: string[];
  memberCount?: number;
}

export class SlackAdapter extends BaseAdapter {
  private bot: SlackBot | null = null;
  private token: string | null = null;
  private _connected = false;

  get platform(): string {
    return "slack";
  }

  async configure(config: Record<string, unknown>): Promise<void> {
    this.token = config.token as string;
  }

  async start(): Promise<void> {
    if (!this.token) throw new Error("Slack token not configured");
    this.bot = new SlackBot(this.token, () => {});
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
  async listChannels(excludeArchived = true): Promise<SlackChannel[]> {
    if (!this.bot) throw new Error("Bot not started");

    const client = this.bot.getClient();
    if (!client) throw new Error("Slack client not available");

    try {
      const result = await client.conversations.list({
        types: "public_channel,private_channel",
        exclude_archived: excludeArchived,
      });

      return result.channels?.map((channel: any) => ({
        id: channel.id,
        name: channel.name,
        isChannel: channel.is_channel,
        isPrivate: channel.is_private,
        isArchived: channel.is_archived,
        topic: channel.topic?.value,
        purpose: channel.purpose?.value,
        memberCount: channel.num_members,
      })) ?? [];
    } catch (err) {
      throw new Error(`Failed to list channels: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Send a message with options.
   */
  async sendMessage(
    channelId: string,
    content: string,
    options?: SendMessageOptions
  ): Promise<SendResult> {
    if (!this.bot) return { success: false, error: "Bot not started" };

    const client = this.bot.getClient();
    if (!client) return { success: false, error: "Slack client not available" };

    try {
      const postMessageOptions: {
        text: string;
        channel: string;
        blocks?: unknown[];
        thread_ts?: string;
      } = {
        text: content,
        channel: channelId,
      };

      if (options?.blocks) {
        postMessageOptions.blocks = options.blocks as any;
      }

      if (options?.threadTs) {
        postMessageOptions.thread_ts = options.threadTs;
      }

      const result = await client.chat.postMessage(postMessageOptions);
      return {
        success: true,
        messageId: result.ts,
      };
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
  async getMessages(channelId: string, limit = 50): Promise<SlackMessageInfo[]> {
    if (!this.bot) throw new Error("Bot not started");

    const client = this.bot.getClient();
    if (!client) throw new Error("Slack client not available");

    try {
      const result = await client.conversations.history({
        channel: channelId,
        limit: Math.min(limit, 200),
      });

      return result.messages?.map((msg: any) => ({
        ts: msg.ts,
        userId: msg.user,
        username: msg.username,
        text: msg.text,
        threadTs: msg.thread_ts,
        reactions: msg.reactions?.map((r: any) => ({
          name: r.name,
          count: r.count,
        })),
      })) ?? [];
    } catch (err) {
      throw new Error(`Failed to get messages: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Get detailed information about a channel.
   */
  async getChannelInfo(channelId: string): Promise<SlackChannelInfo> {
    if (!this.bot) throw new Error("Bot not started");

    const client = this.bot.getClient();
    if (!client) throw new Error("Slack client not available");

    try {
      const result = await client.conversations.info({ channel: channelId });

      const channel = result.channel as any;
      return {
        id: channel.id,
        name: channel.name,
        topic: channel.topic?.value,
        purpose: channel.purpose?.value,
        isPrivate: channel.is_private,
        isArchived: channel.is_archived,
        created: channel.created,
        creator: channel.creator,
        memberCount: channel.num_members,
      };
    } catch (err) {
      throw new Error(`Failed to get channel info: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
