/**
 * File Tools Provider
 * Provides file system tools to the agent for working with user files
 */

import type { ToolDefinition, ToolResult } from "./interfaces.js";

const FILE_TOOLS: ToolDefinition[] = [
  {
    name: "file_read",
    description: "Read the content of a file from the workspace",
    type: "function",
    parameters: {
      type: "object",
      properties: {
        fileName: {
          type: "string",
          description: "Name of the file to read",
        },
        sessionId: {
          type: "string",
          description: "Session ID for workspace (default: 'default')",
        },
      },
      required: ["fileName"],
    },
  },
  {
    name: "file_list",
    description: "List all files in the workspace directory",
    type: "function",
    parameters: {
      type: "object",
      properties: {
        sessionId: {
          type: "string",
          description: "Session ID for workspace (default: 'default')",
        },
      },
    },
  },
  {
    name: "file_write",
    description: "Write content to a file in the workspace",
    type: "function",
    parameters: {
      type: "object",
      properties: {
        fileName: {
          type: "string",
          description: "Name of the file to write",
        },
        content: {
          type: "string",
          description: "Content to write to the file",
        },
        sessionId: {
          type: "string",
          description: "Session ID for workspace (default: 'default')",
        },
      },
      required: ["fileName", "content"],
    },
  },
  {
    name: "file_delete",
    description: "Delete a file from the workspace",
    type: "function",
    parameters: {
      type: "object",
      properties: {
        fileName: {
          type: "string",
          description: "Name of the file to delete",
        },
        sessionId: {
          type: "string",
          description: "Session ID for workspace (default: 'default')",
        },
      },
      required: ["fileName"],
    },
  },
];

export class FileToolsProvider {
  private apiBaseUrl: string;

  constructor(apiBaseUrl = "http://localhost:3001") {
    this.apiBaseUrl = apiBaseUrl;
  }

  register(toolBus: any): void {
    for (const tool of FILE_TOOLS) {
      toolBus.register(tool, this.createExecutor(tool.name));
    }
  }

  private createExecutor(toolName: string): (name: string, args: Record<string, unknown>) => Promise<ToolResult> {
    return async (name: string, args: Record<string, unknown>) => {
      try {
        let url = `${this.apiBaseUrl}/api/files/${name.replace("file_", "")}`;
        const options: RequestInit = {
          method: "GET",
        };

        if (name === "file_read") {
          url += `?sessionId=${args.sessionId || "default"}&fileName=${encodeURIComponent(args.fileName as string)}`;
        } else if (name === "file_list") {
          url += `?sessionId=${args.sessionId || "default"}`;
        } else if (name === "file_delete") {
          url += `?sessionId=${args.sessionId || "default"}&fileName=${encodeURIComponent(args.fileName as string)}`;
          options.method = "DELETE";
        } else if (name === "file_write") {
          options.method = "POST";
          options.headers = { "Content-Type": "application/json" };
          options.body = JSON.stringify({
            sessionId: args.sessionId || "default",
            fileName: args.fileName,
            content: args.content,
          });
        }

        const response = await fetch(url, options);
        const data = await response.json();

        if (data.success) {
          let output = "";
          if (data.content) {
            output = `File content:\n${data.content}`;
          } else if (data.files) {
            output = `Files in workspace:\n${data.files.map((f: any) => `  - ${f.name} (${f.size} bytes)`).join("\n")}`;
          } else if (data.path) {
            output = `Operation successful. Path: ${data.path}`;
          } else {
            output = "Operation successful";
          }

          return {
            success: true,
            output,
          };
        } else {
          return {
            success: false,
            output: "",
            error: data.error || "Operation failed",
          };
        }
      } catch (error) {
        return {
          success: false,
          output: "",
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    };
  }
}
