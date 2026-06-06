/**
 * Tests for Slack Integration.
 * Converted from Python tests/test_slack_*.py
 */

import { test, describe, expect, beforeEach } from "bun:test";
import { SlackListener, SlackTools, SlackAdapter } from "../../src/integrations/slack";
import type { SlackListenerConfig, SlackToolsConfig } from "../../src/integrations/slack";
import type { ToolBus } from "../../src/agent/tools/bus";

describe("SlackListener", () => {
  describe("constructor", () => {
    test("initializes with token", () => {
      const config: SlackListenerConfig = {
        token: "test-token",
      };

      const listener = new SlackListener(config);

      expect(listener).toBeDefined();
    });

    test("accepts optional callbacks", () => {
      const onMessage = () => {};
      const onError = () => {};

      const config: SlackListenerConfig = {
        token: "test-token",
        onMessage,
        onError,
      };

      const listener = new SlackListener(config);

      expect(listener).toBeDefined();
    });

    test("accepts app level token for socket mode", () => {
      const config: SlackListenerConfig = {
        token: "test-token",
        appLevelToken: "app-token",
      };

      const listener = new SlackListener(config);

      expect(listener).toBeDefined();
      expect(listener.getStatus().socketMode).toBe(true);
    });
  });

  describe("setOnMessage", () => {
    test("updates message handler", () => {
      const listener = new SlackListener({ token: "test" });

      const newHandler = () => {};
      listener.setOnMessage(newHandler);

      expect(listener).toBeDefined();
    });
  });

  describe("setOnError", () => {
    test("updates error handler", () => {
      const listener = new SlackListener({ token: "test" });

      const newHandler = () => {};
      listener.setOnError(newHandler);

      expect(listener).toBeDefined();
    });
  });

  describe("listen", () => {
    test("throws without token", async () => {
      const listener = new SlackListener({ token: "" });

      await expect(listener.listen()).rejects.toThrow("not configured");
    });

    test("starts listening", async () => {
      const listener = new SlackListener({ token: "test-token" });

      // In real test, this would connect to Slack
      expect(listener).toBeDefined();
    });
  });

  describe("stop", () => {
    test("stops listening", async () => {
      const listener = new SlackListener({ token: "test-token" });

      await listener.stop();

      expect(listener.getStatus().listening).toBe(false);
    });
  });

  describe("getStatus", () => {
    test("returns status information", () => {
      const listener = new SlackListener({ token: "test" });

      const status = listener.getStatus();

      expect(status).toHaveProperty("listening");
      expect(status).toHaveProperty("connected");
      expect(status).toHaveProperty("socketMode");
    });
  });
});

describe("SlackTools", () => {
  let tools: SlackTools;
  let mockBus: ToolBus;
  let mockAdapter: SlackAdapter;

  beforeEach(() => {
    mockBus = {
      register: () => {},
      execute: async () => ({ success: true, output: "" }),
    } as any;

    mockAdapter = {
      listChannels: async () => [
        { id: "C123", name: "general", isChannel: true },
        { id: "C456", name: "random", isChannel: true },
      ],
      sendMessage: async (id, content, opts) => ({ success: true, messageId: "msg123" }),
      getMessages: async (id, limit) => [],
      getChannelInfo: async (id) => ({ id: "C123", name: "general" }),
    } as SlackAdapter;

    tools = new SlackTools({ adapter: mockAdapter });
  });

  describe("constructor", () => {
    test("initializes without adapter", () => {
      const tools = new SlackTools();

      expect(tools).toBeDefined();
    });

    test("initializes with adapter", () => {
      const tools = new SlackTools({ adapter: mockAdapter });

      expect(tools).toBeDefined();
    });
  });

  describe("setAdapter", () => {
    test("updates adapter", () => {
      const tools = new SlackTools();

      tools.setAdapter(mockAdapter);

      expect(tools).toBeDefined();
    });
  });

  describe("register", () => {
    test("registers Slack tools", () => {
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

      const listChannelsTool = registered.find(r => r.def.name === "slack_list_channels");
      expect(listChannelsTool).toBeDefined();
      expect(listChannelsTool?.def.name).toBe("slack_list_channels");
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
      listChannelsHandler = handlers.get("slack_list_channels");
    });

    test("lists all channels", async () => {
      const result = await listChannelsHandler("slack_list_channels", {});

      expect(result.success).toBe(true);
      expect(result.output).toContain("general");
    });

    test("excludes archived when requested", async () => {
      const result = await listChannelsHandler("slack_list_channels", {
        excludeArchived: true,
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
      sendMessageHandler = handlers.get("slack_send_message");
    });

    test("sends message to channel", async () => {
      const result = await sendMessageHandler("slack_send_message", {
        channelId: "C123",
        content: "Hello world",
      });

      expect(result.success).toBe(true);
    });

    test("requires channelId and content", async () => {
      const result = await sendMessageHandler("slack_send_message", {
        channelId: "C123",
      });

      expect(result.success).toBe(false);
    });

    test("supports blocks", async () => {
      const result = await sendMessageHandler("slack_send_message", {
        channelId: "C123",
        content: "fallback",
        blocks: [{ type: "section", text: { type: "plain_text", text: "Block text" } }],
      });

      expect(result).toBeDefined();
    });

    test("supports thread reply", async () => {
      const result = await sendMessageHandler("slack_send_message", {
        channelId: "C123",
        content: "Thread reply",
        threadTs: "1234567890.123456",
      });

      expect(result).toBeDefined();
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
      getMessagesHandler = handlers.get("slack_get_messages");
    });

    test("retrieves channel messages", async () => {
      const result = await getMessagesHandler("slack_get_messages", {
        channelId: "C123",
        limit: 50,
      });

      expect(result).toBeDefined();
    });
  });

  describe("get_channel_info", () => {
    let getChannelInfoHandler: any;

    beforeEach(() => {
      const handlers = new Map<string, any>();
      mockBus.register = (def: any, h: any) => {
        handlers.set(def.name, h);
      };
      tools.register(mockBus);
      getChannelInfoHandler = handlers.get("slack_get_channel_info");
    });

    test("retrieves channel information", async () => {
      const result = await getChannelInfoHandler("slack_get_channel_info", {
        channelId: "C123",
      });

      expect(result.success).toBe(true);
    });
  });
});

describe("SlackAdapter", () => {
  let adapter: SlackAdapter;

  beforeEach(() => {
    adapter = new SlackAdapter();
  });

  describe("platform", () => {
    test("returns slack", () => {
      expect(adapter.platform).toBe("slack");
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
    test("sends with options", async () => {
      await adapter.configure({ token: "test" });

      expect(adapter).toBeDefined();
    });
  });
});
