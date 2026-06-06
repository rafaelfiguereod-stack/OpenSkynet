/**
 * Slack-specific tools for the agent.
 * Provides functionality to interact with Slack channels, users, and messages.
 */

import type { ToolDefinition } from "../../core/types";
import type { ToolResult } from "../../agent/tools/interfaces";
import type { ToolBus } from "../../agent/tools/bus";
import type { SlackAdapter } from "./adapter";

export interface SlackToolsConfig {
  adapter?: SlackAdapter;
}

export class SlackTools {
  private adapter?: SlackAdapter;

  constructor(config: SlackToolsConfig = {}) {
    this.adapter = config.adapter;
  }

  setAdapter(adapter: SlackAdapter): void {
    this.adapter = adapter;
  }

  register(bus: ToolBus): void {
    // List Slack channels
    const listChannelsTool: ToolDefinition = {
      name: "slack_list_channels",
      description: "List all Slack channels the bot has access to",
      parameters: {
        type: "object",
        properties: {
          excludeArchived: {
            type: "boolean",
            description: "Exclude archived channels (default true)",
          },
        },
      },
      toolset: "slack",
    };

    bus.register(listChannelsTool, async (_name: string, args: Record<string, unknown>) => {
      if (!this.adapter) {
        return {
          success: false,
          output: "",
          error: "Slack adapter not configured",
        };
      }

      try {
        const excludeArchived = args.excludeArchived as boolean | undefined;
        const channels = await this.adapter.listChannels(excludeArchived);
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

    // Send Slack message
    const sendMessageTool: ToolDefinition = {
      name: "slack_send_message",
      description: "Send a message to a Slack channel or user",
      parameters: {
        type: "object",
        properties: {
          channelId: {
            type: "string",
            description: "Slack channel ID or user ID to send message to",
          },
          content: {
            type: "string",
            description: "Message content to send",
          },
          blocks: {
            type: "array",
            description: "Optional block kit blocks for formatted messages",
          },
          threadTs: {
            type: "string",
            description: "Optional thread timestamp to reply in a thread",
          },
        },
        required: ["channelId", "content"],
      },
      toolset: "slack",
    };

    bus.register(sendMessageTool, async (_name: string, args: Record<string, unknown>) => {
      if (!this.adapter) {
        return {
          success: false,
          output: "",
          error: "Slack adapter not configured",
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

      const blocks = args.blocks as unknown[] | undefined;
      const threadTs = args.threadTs as string | undefined;

      try {
        const result = await this.adapter.sendMessage(channelId, content, {
          blocks,
          threadTs,
        });
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
      name: "slack_get_messages",
      description: "Get recent messages from a Slack channel",
      parameters: {
        type: "object",
        properties: {
          channelId: {
            type: "string",
            description: "Slack channel ID",
          },
          limit: {
            type: "number",
            description: "Number of messages to retrieve (default 50, max 200)",
          },
        },
        required: ["channelId"],
      },
      toolset: "slack",
    };

    bus.register(getMessagesTool, async (_name: string, args: Record<string, unknown>) => {
      if (!this.adapter) {
        return {
          success: false,
          output: "",
          error: "Slack adapter not configured",
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

    // Get channel info
    const getChannelInfoTool: ToolDefinition = {
      name: "slack_get_channel_info",
      description: "Get detailed information about a Slack channel",
      parameters: {
        type: "object",
        properties: {
          channelId: {
            type: "string",
            description: "Slack channel ID",
          },
        },
        required: ["channelId"],
      },
      toolset: "slack",
    };

    bus.register(getChannelInfoTool, async (_name: string, args: Record<string, unknown>) => {
      if (!this.adapter) {
        return {
          success: false,
          output: "",
          error: "Slack adapter not configured",
        };
      }

      const channelId = args.channelId as string;

      try {
        const info = await this.adapter.getChannelInfo(channelId);
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
  blocks?: unknown[];
  threadTs?: string;
}
