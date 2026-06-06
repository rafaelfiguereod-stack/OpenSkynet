/**
 * Telegram-specific tools for the agent.
 * Provides functionality to interact with Telegram chats, users, and messages.
 */

import type { ToolDefinition } from "../../core/types";
import type { ToolResult } from "../../agent/tools/interfaces";
import type { ToolBus } from "../../agent/tools/bus";
import type { TelegramAdapter } from "./adapter";

export interface TelegramToolsConfig {
  adapter?: TelegramAdapter;
}

export class TelegramTools {
  private adapter?: TelegramAdapter;

  constructor(config: TelegramToolsConfig = {}) {
    this.adapter = config.adapter;
  }

  setAdapter(adapter: TelegramAdapter): void {
    this.adapter = adapter;
  }

  register(bus: ToolBus): void {
    // List Telegram chats
    const listChatsTool: ToolDefinition = {
      name: "telegram_list_chats",
      description: "List all Telegram chats the bot has access to",
      parameters: {
        type: "object",
        properties: {},
      },
      toolset: "telegram",
    };

    bus.register(listChatsTool, async (_name: string, _args: Record<string, unknown>) => {
      if (!this.adapter) {
        return {
          success: false,
          output: "",
          error: "Telegram adapter not configured",
        };
      }

      try {
        const chats = await this.adapter.listChats();
        return {
          success: true,
          output: JSON.stringify(chats, null, 2),
        };
      } catch (err) {
        return {
          success: false,
          output: "",
          error: err instanceof Error ? err.message : String(err),
        };
      }
    });

    // Send Telegram message
    const sendMessageTool: ToolDefinition = {
      name: "telegram_send_message",
      description: "Send a message to a Telegram chat",
      parameters: {
        type: "object",
        properties: {
          chatId: {
            type: "string",
            description: "Telegram chat ID to send message to",
          },
          content: {
            type: "string",
            description: "Message content to send",
          },
          parseMode: {
            type: "string",
            enum: ["Markdown", "HTML", "None"],
            description: "Optional parse mode for formatting",
          },
          disableNotification: {
            type: "boolean",
            description: "Send silently without notification",
          },
        },
        required: ["chatId", "content"],
      },
      toolset: "telegram",
    };

    bus.register(sendMessageTool, async (_name: string, args: Record<string, unknown>) => {
      if (!this.adapter) {
        return {
          success: false,
          output: "",
          error: "Telegram adapter not configured",
        };
      }

      const chatId = args.chatId as string;
      const content = args.content as string;

      // Validate required fields
      if (!chatId || !content) {
        return {
          success: false,
          output: "",
          error: "Missing required fields: chatId and content",
        };
      }

      const parseMode = args.parseMode as "Markdown" | "HTML" | "None" | undefined;
      const disableNotification = args.disableNotification as boolean | undefined;

      try {
        const result = await this.adapter.sendMessage(chatId, content, {
          parseMode,
          disableNotification,
        });
        return {
          success: result.success,
          output: result.success
            ? `Message sent to ${chatId}`
            : `Failed to send message: ${result.error}`,
        };
      } catch (err) {
        return {
          success: false,
          output: "",
          error: err instanceof Error ? err.message : String(err),
        };
      }
    });

    // Send photo
    const sendPhotoTool: ToolDefinition = {
      name: "telegram_send_photo",
      description: "Send a photo to a Telegram chat",
      parameters: {
        type: "object",
        properties: {
          chatId: {
            type: "string",
            description: "Telegram chat ID",
          },
          photo: {
            type: "string",
            description: "Photo URL or file path",
          },
          caption: {
            type: "string",
            description: "Optional caption for the photo",
          },
        },
        required: ["chatId", "photo"],
      },
      toolset: "telegram",
    };

    bus.register(sendPhotoTool, async (_name: string, args: Record<string, unknown>) => {
      if (!this.adapter) {
        return {
          success: false,
          output: "",
          error: "Telegram adapter not configured",
        };
      }

      const chatId = args.chatId as string;
      const photo = args.photo as string;
      const caption = args.caption as string | undefined;

      try {
        const result = await this.adapter.sendPhoto(chatId, photo, caption);
        return {
          success: result.success,
          output: result.success
            ? `Photo sent to ${chatId}`
            : `Failed to send photo: ${result.error}`,
        };
      } catch (err) {
        return {
          success: false,
          output: "",
          error: err instanceof Error ? err.message : String(err),
        };
      }
    });

    // Get chat info
    const getChatInfoTool: ToolDefinition = {
      name: "telegram_get_chat_info",
      description: "Get information about a Telegram chat",
      parameters: {
        type: "object",
        properties: {
          chatId: {
            type: "string",
            description: "Telegram chat ID",
          },
        },
        required: ["chatId"],
      },
      toolset: "telegram",
    };

    bus.register(getChatInfoTool, async (_name: string, args: Record<string, unknown>) => {
      if (!this.adapter) {
        return {
          success: false,
          output: "",
          error: "Telegram adapter not configured",
        };
      }

      const chatId = args.chatId as string;

      try {
        const info = await this.adapter.getChatInfo(chatId);
        return {
          success: true,
          output: JSON.stringify(info, null, 2),
        };
      } catch (err) {
        return {
          success: false,
          output: "",
          error: err instanceof Error ? err.message : String(err),
        };
      }
    });
  }
}

export interface SendMessageOptions {
  parseMode?: "Markdown" | "HTML" | "None";
  disableNotification?: boolean;
  replyToMessageId?: string;
}
