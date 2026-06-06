/**
 * Discord bot listener - handles incoming messages via WebSocket Gateway.
 * Forwards messages to the adapter for processing.
 */

import { Client, GatewayIntentBits, type Message as DiscordMessage } from "discord.js";
import type { MessageEvent } from "../../gateway/events";
import logger from "../../core/logging";

export interface DiscordListenerConfig {
  token: string;
  maxRetries?: number;
  onMessage?: (event: MessageEvent) => void;
  onError?: (error: Error) => void;
}

export class DiscordListener {
  private token: string;
  private maxRetries: number;
  private client: Client | null = null;
  private onMessage?: (event: MessageEvent) => void;
  private onError?: (error: Error) => void;
  private isListening = false;
  private reconnectAttempts = 0;

  constructor(config: DiscordListenerConfig) {
    this.token = config.token;
    this.maxRetries = config.maxRetries ?? 5;
    this.onMessage = config.onMessage;
    this.onError = config.onError;
  }

  setOnMessage(handler: (event: MessageEvent) => void): void {
    this.onMessage = handler;
    if (this.client) {
      this.client.removeAllListeners("messageCreate");
      this._setupMessageHandler();
    }
  }

  setOnError(handler: (error: Error) => void): void {
    this.onError = handler;
  }

  private _setupMessageHandler(): void {
    if (!this.client) return;

    this.client.on("messageCreate", (msg: DiscordMessage) => {
      if (msg.author.bot) return;

      const event: MessageEvent = {
        channelId: msg.channelId,
        channelName: msg.inGuild() ? msg.guild?.name ?? "DM" : "DM",
        userId: msg.author.id,
        userName: msg.author.username,
        content: msg.content,
        platform: "discord",
        isCommand: msg.content.startsWith("/"),
        timestamp: msg.createdTimestamp.toString(),
        attachments: msg.attachments.map((a) => ({
          url: a.url,
          name: a.name,
          type: a.contentType ?? "unknown",
        })),
      };

      this.onMessage?.(event);
    });
  }

  async listen(): Promise<void> {
    if (!this.token) {
      logger.warn("discord_token_not_configured");
      throw new Error("Discord token not configured");
    }

    this.isListening = true;

    for (let attempt = 0; attempt < this.maxRetries && this.isListening; attempt++) {
      try {
        logger.info({ attempt }, "discord_listener_starting");

        this.client = new Client({
          intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent,
            GatewayIntentBits.DirectMessages,
          ],
        });

        this._setupMessageHandler();

        this.client.on("ready", () => {
          logger.info(
            { username: this.client?.user?.username },
            "discord_listener_ready"
          );
          this.reconnectAttempts = 0;
        });

        this.client.on("error", (err) => {
          logger.error({ err: err.message }, "discord_client_error");
          this.onError?.(err);
        });

        this.client.on("disconnect", () => {
          logger.warn("discord_client_disconnected");
        });

        await this.client.login(this.token);

        // If we get here, we're connected
        break;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        logger.error({ attempt, error: error.message }, "discord_listener_failed");

        this.onError?.(error);

        if (attempt === this.maxRetries - 1) {
          throw new Error(
            `Failed to start Discord listener after ${this.maxRetries} attempts: ${error.message}`
          );
        }

        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
        await new Promise((resolve) => setTimeout(resolve, delay));
        this.reconnectAttempts++;
      }
    }
  }

  async stop(): Promise<void> {
    this.isListening = false;

    if (this.client) {
      try {
        this.client.destroy();
        logger.info("discord_listener_stopped");
      } catch (err) {
        logger.error({ err: err instanceof Error ? err.message : String(err) }, "discord_listener_stop_error");
      }
      this.client = null;
    }
  }

  getStatus(): {
    listening: boolean;
    connected: boolean;
    reconnectAttempts: number;
  } {
    return {
      listening: this.isListening,
      connected: this.client?.isReady() ?? false,
      reconnectAttempts: this.reconnectAttempts,
    };
  }

  getClient(): Client | null {
    return this.client;
  }
}
