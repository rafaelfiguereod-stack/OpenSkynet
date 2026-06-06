/**
 * Discord-specific tools for the agent.
 * Provides functionality to interact with Discord channels, users, and messages.
 */

import type { ToolDefinition } from "../../core/types";
import type { ToolResult } from "../../agent/tools/interfaces";
import type { ToolBus } from "../../agent/tools/bus";
import type { DiscordAdapter } from "./adapter";

export interface DiscordToolsConfig {
  adapter?: DiscordAdapter;
}

export class DiscordTools {
  private adapter?: DiscordAdapter;

  constructor(config: DiscordToolsConfig = {}) {
    this.adapter = config.adapter;
  }

  setAdapter(adapter: DiscordAdapter): void {
    this.adapter = adapter;
  }

  register(bus: ToolBus): void {
    // List Discord channels
    const listChannelsTool: ToolDefinition = {
      name: "discord_list_channels",
      description: "List all Discord channels the bot has access to",
      parameters: {
        type: "object",
        properties: {
          guildId: {
            type: "string",
            description: "Optional guild (server) ID to filter channels",
          },
        },
      },
      toolset: "discord",
    };

    bus.register(listChannelsTool, async (_name: string, args: Record<string, unknown>) => {
      if (!this.adapter) {
        return {
          success: false,
          output: "",
          error: "Discord adapter not configured",
        };
      }

      try {
        const channels = await this.adapter.listChannels(args.guildId as string | undefined);
        return {
          success: true,
          output: JSON.stringify(channels, null, 2),
        };
      } catch (err) {
        return {
          success: false,
          output: "",
          error: err instanceof Error ? err.message : String(err),
        };
      }
    });

    // Send Discord message
    const sendMessageTool: ToolDefinition = {
      name: "discord_send_message",
      description: "Send a message to a Discord channel",
      parameters: {
        type: "object",
        properties: {
          channelId: {
            type: "string",
            description: "Discord channel ID to send message to",
          },
          content: {
            type: "string",
            description: "Message content to send",
          },
          embed: {
            type: "object",
            description: "Optional embed object (title, description, fields, etc.)",
          },
        },
        required: ["channelId", "content"],
      },
      toolset: "discord",
    };

    bus.register(sendMessageTool, async (_name: string, args: Record<string, unknown>) => {
      if (!this.adapter) {
        return {
          success: false,
          output: "",
          error: "Discord adapter not configured",
        };
      }

      const channelId = args.channelId as string;
      const content = args.content as string;

      // Validate required fields
      if (!channelId || !content) {
        return {
          success: false,
          output: "",
          error: "Missing required fields: channelId and content",
        };
      }

      const embed = args.embed as Record<string, unknown> | undefined;

      try {
        const result = await this.adapter.sendMessage(channelId, content, embed);
        return {
          success: result.success,
          output: result.success
            ? `Message sent to ${channelId}`
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

    // Get channel messages
    const getMessagesTool: ToolDefinition = {
      name: "discord_get_messages",
      description: "Get recent messages from a Discord channel",
      parameters: {
        type: "object",
        properties: {
          channelId: {
            type: "string",
            description: "Discord channel ID",
          },
          limit: {
            type: "number",
            description: "Number of messages to retrieve (default 50, max 100)",
          },
        },
        required: ["channelId"],
      },
      toolset: "discord",
    };

    bus.register(getMessagesTool, async (_name: string, args: Record<string, unknown>) => {
      if (!this.adapter) {
        return {
          success: false,
          output: "",
          error: "Discord adapter not configured",
        };
      }

      const channelId = args.channelId as string;
      const limit = (args.limit as number) ?? 50;

      try {
        const messages = await this.adapter.getMessages(channelId, limit);
        return {
          success: true,
          output: JSON.stringify(messages, null, 2),
        };
      } catch (err) {
        return {
          success: false,
          output: "",
          error: err instanceof Error ? err.message : String(err),
        };
      }
    });

    // Create thread
    const createThreadTool: ToolDefinition = {
      name: "discord_create_thread",
      description: "Create a new thread in a Discord channel",
      parameters: {
        type: "object",
        properties: {
          channelId: {
            type: "string",
            description: "Parent channel ID",
          },
          name: {
            type: "string",
            description: "Thread name",
          },
          message: {
            type: "string",
            description: "Initial message content",
          },
        },
        required: ["channelId", "name", "message"],
      },
      toolset: "discord",
    };

    bus.register(createThreadTool, async (_name: string, args: Record<string, unknown>) => {
      if (!this.adapter) {
        return {
          success: false,
          output: "",
          error: "Discord adapter not configured",
        };
      }

      const channelId = args.channelId as string;
      const name = args.name as string;
      const message = args.message as string;

      try {
        const result = await this.adapter.createThread(channelId, name, message);
        return {
          success: result.success,
          output: result.success
            ? `Thread created: ${result.threadId}`
            : `Failed to create thread: ${result.error}`,
        };
      } catch (err) {
        return {
          success: false,
          output: "",
          error: err instanceof Error ? err.message : String(err),
        };
      }
    });

    // Add reaction
    const addReactionTool: ToolDefinition = {
      name: "discord_add_reaction",
      description: "Add a reaction emoji to a message",
      parameters: {
        type: "object",
        properties: {
          channelId: {
            type: "string",
            description: "Channel ID",
          },
          messageId: {
            type: "string",
            description: "Message ID",
          },
          emoji: {
            type: "string",
            description: "Emoji to react with (e.g., '👍', '🎉')",
          },
        },
        required: ["channelId", "messageId", "emoji"],
      },
      toolset: "discord",
    };

    bus.register(addReactionTool, async (_name: string, args: Record<string, unknown>) => {
      if (!this.adapter) {
        return {
          success: false,
          output: "",
          error: "Discord adapter not configured",
        };
      }

      const channelId = args.channelId as string;
      const messageId = args.messageId as string;
      const emoji = args.emoji as string;

      try {
        const result = await this.adapter.addReaction(channelId, messageId, emoji);
        return {
          success: result.success,
          output: result.success
            ? `Added reaction ${emoji}`
            : `Failed to add reaction: ${result.error}`,
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

export interface ThreadResult {
  success: boolean;
  threadId?: string;
  error?: string;
}

export interface ReactionResult {
  success: boolean;
  error?: string;
}
