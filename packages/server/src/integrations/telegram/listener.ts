/**
 * Telegram bot listener - handles incoming messages via long polling.
 * Forwards messages to the adapter for processing.
 *
 * Note: This requires the optional 'node-telegram-bot-api' package.
 * Install with: bun add node-telegram-bot-api
 */

// Dynamically import to handle optional dependency
let TelegramBot: any;
try {
  TelegramBot = require("node-telegram-bot-api");
} catch {
  // Package not installed, will be handled in class constructor
}

import type { MessageEvent } from "../../gateway/events";
import logger from "../../core/logging";

export interface TelegramListenerConfig {
  token: string;
  polling?: boolean;
  onMessage?: (event: MessageEvent) => void;
  onError?: (error: Error) => void;
}

export class TelegramListener {
  private token: string;
  private polling: boolean;
  private bot: any;
  private onMessage?: (event: MessageEvent) => void;
  private onError?: (error: Error) => void;
  private isListening = false;

  constructor(config: TelegramListenerConfig) {
    if (!TelegramBot) {
      throw new Error(
        "Telegram integration requires 'node-telegram-bot-api' package. Install with: bun add node-telegram-bot-api"
      );
    }

    this.token = config.token;
    this.polling = config.polling ?? true;
    this.onMessage = config.onMessage;
    this.onError = config.onError;
    this.bot = null;
  }

  setOnMessage(handler: (event: MessageEvent) => void): void {
    this.onMessage = handler;
    if (this.bot) {
      this._setupMessageHandler();
    }
  }

  setOnError(handler: (error: Error) => void): void {
    this.onError = handler;
  }

  private _setupMessageHandler(): void {
    if (!this.bot) return;

    this.bot.on("message", (msg: any) => {
      if (!msg.text) return;

      const event: MessageEvent = {
        channelId: msg.chat.id.toString(),
        channelName: msg.chat.title ?? msg.chat.type,
        userId: msg.from?.id.toString() ?? "unknown",
        userName: msg.from?.username ?? msg.from?.first_name ?? "User",
        content: msg.text,
        platform: "telegram",
        isCommand: msg.text?.startsWith("/") ?? false,
        timestamp: msg.date * 1000 + "",
        attachments: msg.photo
          ? msg.photo.map((p: any) => ({
              url: `https://api.telegram.org/file/bot${this.token}/${p.file_id}`,
              name: "photo.jpg",
              type: "image/jpeg",
            }))
          : [],
      };

      this.onMessage?.(event);
    });

    this.bot.on("callback_query", (query: any) => {
      const event: MessageEvent = {
        channelId: query.message.chat.id.toString(),
        channelName: query.message.chat.title ?? query.message.chat.type,
        userId: query.from.id.toString(),
        userName: query.from.username ?? query.from.first_name ?? "User",
        content: `[Callback: ${query.data}]`,
        platform: "telegram",
        isCommand: false,
        timestamp: Math.floor(Date.now() / 1000).toString(),
      };

      this.onMessage?.(event);
    });
  }

  async listen(): Promise<void> {
    if (!this.token) {
      logger.warn("telegram_token_not_configured");
      throw new Error("Telegram token not configured");
    }

    this.isListening = true;

    try {
      logger.info("telegram_listener_starting");

      this.bot = new TelegramBot(this.token, { polling: this.polling });

      this._setupMessageHandler();

      this.bot.on("polling_error", (err: Error) => {
        logger.error({ err: err.message }, "telegram_polling_error");
        this.onError?.(err);
      });

      // Start polling
      if (this.polling) {
        await this.bot.startPolling();
      }

      logger.info("telegram_listener_started");
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error({ error: error.message }, "telegram_listener_failed");
      this.onError?.(error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    this.isListening = false;

    if (this.bot) {
      try {
        if (this.polling) {
          await this.bot.stopPolling();
        }
        logger.info("telegram_listener_stopped");
      } catch (err) {
        logger.error({ err: err instanceof Error ? err.message : String(err) }, "telegram_listener_stop_error");
      }
      this.bot = null;
    }
  }

  getStatus(): {
    listening: boolean;
    polling: boolean;
  } {
    return {
      listening: this.isListening,
      polling: this.polling && this.bot !== null,
    };
  }

  getBot(): any | null {
    return this.bot;
  }
}
