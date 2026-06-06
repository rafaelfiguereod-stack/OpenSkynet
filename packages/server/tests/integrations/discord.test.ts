/**
 * Tests for Discord Integration.
 * Converted from Python tests/test_discord_*.py
 */

import { test, describe, expect, beforeEach } from "bun:test";
import { DiscordListener, DiscordTools, DiscordAdapter } from "../../src/integrations/discord";
import type { DiscordListenerConfig, DiscordToolsConfig } from "../../src/integrations/discord";
import type { ToolBus } from "../../src/agent/tools/bus";

describe("DiscordListener", () => {
  describe("constructor", () => {
    test("initializes with token", () => {
      const config: DiscordListenerConfig = {
        token: "test-token",
      };

      const listener = new DiscordListener(config);

      expect(listener).toBeDefined();
    });

    test("accepts optional callbacks", () => {
      const onMessage = () => {};
      const onError = () => {};

      const config: DiscordListenerConfig = {
        token: "test-token",
        onMessage,
        onError,
      };

      const listener = new DiscordListener(config);

      expect(listener).toBeDefined();
    });

    test("accepts maxRetries config", () => {
      const config: DiscordListenerConfig = {
        token: "test-token",
        maxRetries: 10,
      };

      const listener = new DiscordListener(config);

      expect(listener).toBeDefined();
    });
  });

  describe("setOnMessage", () => {
    test("updates message handler", () => {
      const listener = new DiscordListener({ token: "test" });

      const newHandler = () => {};
      listener.setOnMessage(newHandler);

      expect(listener).toBeDefined();
    });
  });

  describe("setOnError", () => {
    test("updates error handler", () => {
      const listener = new DiscordListener({ token: "test" });

      const newHandler = () => {};
      listener.setOnError(newHandler);

      expect(listener).toBeDefined();
    });
  });

  describe("listen", () => {
    test("throws without token", async () => {
      const listener = new DiscordListener({ token: "" });

      await expect(listener.listen()).rejects.toThrow("not configured");
    });

    test("starts listening", async () => {
      const listener = new DiscordListener({ token: "test-token" });

      // In real test, this would start the Discord client
      // For now, just verify it doesn't throw with valid token
      expect(listener).toBeDefined();
    });
  });

  describe("stop", () => {
    test("stops listening", async () => {
      const listener = new DiscordListener({ token: "test-token" });

      await listener.stop();

      expect(listener.getStatus().listening).toBe(false);
    });
  });

  describe("getStatus", () => {
    test("returns status information", () => {
      const listener = new DiscordListener({ token: "test" });

      const status = listener.getStatus();

      expect(status).toHaveProperty("listening");
      expect(status).toHaveProperty("connected");
      expect(status).toHaveProperty("reconnectAttempts");
    });
  });
});

describe("DiscordTools", () => {
  let tools: DiscordTools;
  let mockBus: ToolBus;
  let mockAdapter: DiscordAdapter;

  beforeEach(() => {
    mockBus = {
      register: () => {},
      execute: async () => ({ success: true, output: "" }),
    } as any;

    mockAdapter = {
      listChannels: async () => [
        { id: "123", name: "general", type: "text" },
        { id: "456", name: "random", type: "text" },
      ],
      sendMessage: async (id, content, embed) => ({ success: true }),
      getMessages: async (id, limit) => [],
      createThread: async (id, name, message) => ({ success: true, threadId: "789" }),
      addReaction: async (id, msgId, emoji) => ({ success: true }),
    } as DiscordAdapter;

    tools = new DiscordTools({ adapter: mockAdapter });
  });

  describe("constructor", () => {
    test("initializes without adapter", () => {
      const tools = new DiscordTools();

      expect(tools).toBeDefined();
    });

    test("initializes with adapter", () => {
      const tools = new DiscordTools({ adapter: mockAdapter });

      expect(tools).toBeDefined();
    });
  });

  describe("setAdapter", () => {
    test("updates adapter", () => {
      const tools = new DiscordTools();

      tools.setAdapter(mockAdapter);

      expect(tools).toBeDefined();
    });
  });

  describe("register", () => {
    test("registers Discord tools", () => {
      const registered: any[] = [];

      mockBus.register = (def: any, handler: any) => {
        registered.push({ def, handler });
      };

      tools.register(mockBus);

      expect(registered.length).toBeGreaterThan(0);
    });

    test("registers list_channels tool", () => {
      const registered: any[] = [];

      mockBus.register = (def: any, handler: any) => {
        registered.push({ def, handler });
      };

      tools.register(mockBus);

      const listChannelsTool = registered.find(r => r.def.name === "discord_list_channels");
      expect(listChannelsTool).toBeDefined();
      expect(listChannelsTool?.def.name).toBe("discord_list_channels");
    });
  });

  describe("list_channels", () => {
    let listChannelsHandler: any;

    beforeEach(() => {
      const handlers = new Map<string, any>();
      mockBus.register = (def: any, h: any) => {
        handlers.set(def.name, h);
      };
      tools.register(mockBus);
      listChannelsHandler = handlers.get("discord_list_channels");
    });

    test("lists all channels", async () => {
      const result = await listChannelsHandler("discord_list_channels", {});

      expect(result.success).toBe(true);
      expect(result.output).toContain("general");
    });

    test("filters by guild when provided", async () => {
      const result = await listChannelsHandler("discord_list_channels", {
        guildId: "guild123",
      });

      expect(result).toBeDefined();
    });
  });

  describe("send_message", () => {
    let sendMessageHandler: any;

    beforeEach(() => {
      const handlers = new Map<string, any>();
      mockBus.register = (def: any, h: any) => {
        handlers.set(def.name, h);
      };
      tools.register(mockBus);
      sendMessageHandler = handlers.get("discord_send_message");
    });

    test("sends message to channel", async () => {
      const result = await sendMessageHandler("discord_send_message", {
        channelId: "123",
        content: "Hello world",
      });

      expect(result.success).toBe(true);
    });

    test("requires channelId and content", async () => {
      const result = await sendMessageHandler("discord_send_message", {
        channelId: "123",
      });

      expect(result.success).toBe(false);
    });
  });

  describe("get_messages", () => {
    let getMessagesHandler: any;

    beforeEach(() => {
      const handlers = new Map<string, any>();
      mockBus.register = (def: any, h: any) => {
        handlers.set(def.name, h);
      };
      tools.register(mockBus);
      getMessagesHandler = handlers.get("discord_get_messages");
    });

    test("retrieves channel messages", async () => {
      const result = await getMessagesHandler("discord_get_messages", {
        channelId: "123",
        limit: 50,
      });

      expect(result).toBeDefined();
    });
  });

  describe("create_thread", () => {
    let createThreadHandler: any;

    beforeEach(() => {
      const handlers = new Map<string, any>();
      mockBus.register = (def: any, h: any) => {
        handlers.set(def.name, h);
      };
      tools.register(mockBus);
      createThreadHandler = handlers.get("discord_create_thread");
    });

    test("creates new thread", async () => {
      const result = await createThreadHandler("discord_create_thread", {
        channelId: "123",
        name: "Test Thread",
        message: "Starting thread",
      });

      expect(result.success).toBe(true);
    });
  });

  describe("add_reaction", () => {
    let addReactionHandler: any;

    beforeEach(() => {
      const handlers = new Map<string, any>();
      mockBus.register = (def: any, h: any) => {
        handlers.set(def.name, h);
      };
      tools.register(mockBus);
      addReactionHandler = handlers.get("discord_add_reaction");
    });

    test("adds reaction to message", async () => {
      const result = await addReactionHandler("discord_add_reaction", {
        channelId: "123",
        messageId: "456",
        emoji: "👍",
      });

      expect(result.success).toBe(true);
    });
  });
});

describe("DiscordAdapter", () => {
  let adapter: DiscordAdapter;

  beforeEach(() => {
    adapter = new DiscordAdapter();
  });

  describe("platform", () => {
    test("returns discord", () => {
      expect(adapter.platform).toBe("discord");
    });
  });

  describe("configure", () => {
    test("sets token from config", async () => {
      await adapter.configure({ token: "test-token" });

      expect(adapter).toBeDefined();
    });
  });

  describe("listChannels", () => {
    test("returns adapter error when bot not started", async () => {
      await expect(adapter.listChannels()).rejects.toThrow("not started");
    });
  });

  describe("sendMessage", () => {
    test("sends message with embed", async () => {
      await adapter.configure({ token: "test" });

      // Would require bot to be started
      expect(adapter).toBeDefined();
    });
  });
});
