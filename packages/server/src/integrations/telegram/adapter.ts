import { BaseAdapter, type SendResult } from "../../gateway/base";
import { TelegramBot } from "./bot";
import type { SendMessageOptions } from "./tools";

export interface TelegramChat {
  id: string;
  type: string;
  title?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  description?: string;
  memberCount?: number;
}

export interface TelegramChatInfo {
  id: string;
  type: string;
  title?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  description?: string;
  inviteLink?: string;
  memberCount?: number;
  administrators?: Array<{ id: string; username?: string }>;
}

export class TelegramAdapter extends BaseAdapter {
  private bot: TelegramBot | null = null;
  private token: string | null = null;
  private _connected = false;

  get platform(): string {
    return "telegram";
  }

  async configure(config: Record<string, unknown>): Promise<void> {
    this.token = config.token as string;
  }

  async start(): Promise<void> {
    if (!this.token) throw new Error("Telegram token not configured");
    this.bot = new TelegramBot(this.token, () => {});
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
   * List all chats the bot has access to.
   */
  async listChats(): Promise<TelegramChat[]> {
    if (!this.bot) throw new Error("Bot not started");

    const botInstance = this.bot.getBot();
    if (!botInstance) throw new Error("Telegram bot instance not available");

    // Get updates to find recent chats
    const chats = new Map<string, TelegramChat>();

    try {
      // Try to get chat info from recent updates
      // This is a simplified version - in production you'd cache this
      const updates = await botInstance.api.getUpdates();
      for (const update of updates) {
        const chat = update.message?.chat || update.callback_query?.message?.chat;
        if (chat) {
          chats.set(chat.id.toString(), {
            id: chat.id.toString(),
            type: chat.type,
            title: chat.title,
            username: chat.username,
            firstName: chat.first_name,
            lastName: chat.last_name,
          });
        }
      }
    } catch {
      // Ignore errors fetching updates
    }

    return Array.from(chats.values());
  }

  /**
   * Send a message with options.
   */
  async sendMessage(
    chatId: string,
    content: string,
    options?: SendMessageOptions
  ): Promise<SendResult> {
    if (!this.bot) return { success: false, error: "Bot not started" };

    const botInstance = this.bot.getBot();
    if (!botInstance) return { success: false, error: "Telegram bot instance not available" };

    try {
      const sendOptions: {
        parse_mode?: "Markdown" | "HTML";
        disable_notification?: boolean;
        reply_to_message_id?: number;
      } = {};

      if (options?.parseMode && options.parseMode !== "None") {
        sendOptions.parse_mode = options.parseMode;
      }
      if (options?.disableNotification) {
        sendOptions.disable_notification = true;
      }
      if (options?.replyToMessageId) {
        sendOptions.reply_to_message_id = parseInt(options.replyToMessageId, 10);
      }

      await botInstance.api.sendMessage(chatId, content, sendOptions);
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Send a photo to a chat.
   */
  async sendPhoto(
    chatId: string,
    photo: string,
    caption?: string
  ): Promise<SendResult> {
    if (!this.bot) return { success: false, error: "Bot not started" };

    const botInstance = this.bot.getBot();
    if (!botInstance) return { success: false, error: "Telegram bot instance not available" };

    try {
      await botInstance.api.sendPhoto(chatId, photo, { caption });
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Get detailed information about a chat.
   */
  async getChatInfo(chatId: string): Promise<TelegramChatInfo> {
    if (!this.bot) throw new Error("Bot not started");

    const botInstance = this.bot.getBot();
    if (!botInstance) throw new Error("Telegram bot instance not available");

    const chat = await botInstance.api.getChat(chatId);

    return {
      id: chat.id.toString(),
      type: chat.type,
      title: chat.title,
      username: chat.username,
      firstName: chat.first_name,
      lastName: chat.last_name,
      description: chat.description,
      inviteLink: chat.invite_link,
    };
  }
}
