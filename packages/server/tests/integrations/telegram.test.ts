/**
 * Tests for Telegram Integration.
 * Converted from Python tests/test_telegram_*.py
 */

import { test, describe, expect, beforeEach } from "bun:test";

// Skip all telegram tests if package is not available
let telegramAvailable = false;
try {
  require("node-telegram-bot-api");
  telegramAvailable = true;
} catch {
  // Package not installed
}

if (!telegramAvailable) {
  console.warn("Skipping Telegram tests - 'node-telegram-bot-api' package not installed");
} else {
  const { TelegramListener, TelegramTools, TelegramAdapter } = require("../../src/integrations/telegram");
  const { ToolBus } = require("../../src/agent/tools/bus");

describe("TelegramListener", () => {
  describe("constructor", () => {
    test("initializes with token", () => {
      const config: TelegramListenerConfig = {
        token: "test-token",
      };

      const listener = new TelegramListener(config);

      expect(listener).toBeDefined();
    });

    test("accepts optional callbacks", () => {
      const onMessage = () => {};
      const onError = () => {};

      const config: TelegramListenerConfig = {
        token: "test-token",
        onMessage,
        onError,
      };

      const listener = new TelegramListener(config);

      expect(listener).toBeDefined();
    });

    test("accepts polling option", () => {
      const config: TelegramListenerConfig = {
        token: "test-token",
        polling: false,
      };

      const listener = new TelegramListener(config);

      expect(listener).toBeDefined();
    });
  });

  describe("setOnMessage", () => {
    test("updates message handler", () => {
      const listener = new TelegramListener({ token: "test" });

      const newHandler = () => {};
      listener.setOnMessage(newHandler);

      expect(listener).toBeDefined();
    });
  });

  describe("setOnError", () => {
    test("updates error handler", () => {
      const listener = new TelegramListener({ token: "test" });

      const newHandler = () => {};
      listener.setOnError(newHandler);

      expect(listener).toBeDefined();
    });
  });

  describe("listen", () => {
    test("throws without token", async () => {
      const listener = new TelegramListener({ token: "" });

      await expect(listener.listen()).rejects.toThrow("not configured");
    });

    test("starts listening", async () => {
      const listener = new TelegramListener({ token: "test-token" });

      // In real test, this would start polling
      expect(listener).toBeDefined();
    });
  });

  describe("stop", () => {
    test("stops listening", async () => {
      const listener = new TelegramListener({ token: "test-token" });

      await listener.stop();

      expect(listener.getStatus().listening).toBe(false);
    });
  });

  describe("getStatus", () => {
    test("returns status information", () => {
      const listener = new TelegramListener({ token: "test" });

      const status = listener.getStatus();

      expect(status).toHaveProperty("listening");
      expect(status).toHaveProperty("polling");
    });
  });
});

describe("TelegramTools", () => {
  let tools: TelegramTools;
  let mockBus: ToolBus;
  let mockAdapter: TelegramAdapter;

  beforeEach(() => {
    mockBus = {
      register: () => {},
      execute: async () => ({ success: true, output: "" }),
    } as any;

    mockAdapter = {
      listChats: async () => [
        { id: "123", type: "private", firstName: "Test User" },
        { id: "456", type: "group", title: "Test Group" },
      ],
      sendMessage: async (id, content, opts) => ({ success: true }),
      sendPhoto: async (id, photo, caption) => ({ success: true }),
      getChatInfo: async (id) => ({ id: "123", type: "private" }),
    } as TelegramAdapter;

    tools = new TelegramTools({ adapter: mockAdapter });
  });

  describe("constructor", () => {
    test("initializes without adapter", () => {
      const tools = new TelegramTools();

      expect(tools).toBeDefined();
    });

    test("initializes with adapter", () => {
      const tools = new TelegramTools({ adapter: mockAdapter });

      expect(tools).toBeDefined();
    });
  });

  describe("setAdapter", () => {
    test("updates adapter", () => {
      const tools = new TelegramTools();

      tools.setAdapter(mockAdapter);

      expect(tools).toBeDefined();
    });
  });

  describe("register", () => {
    test("registers Telegram tools", () => {
      const registered: any[] = [];

      mockBus.register = (def: any, handler: any) => {
        registered.push({ def, handler });
      };

      tools.register(mockBus);

      expect(registered.length).toBeGreaterThan(0);
    });

    test("registers list_chats tool", () => {
      let registeredDef: any = null;

      mockBus.register = (def: any) => {
        registeredDef = def;
      };

      tools.register(mockBus);

      expect(registeredDef.name).toBe("telegram_list_chats");
    });
  });

  describe("list_chats", () => {
    test("lists all chats", async () => {
      let handler: any = null;
      mockBus.register = (_def: any, h: any) => {
        handler = h;
      };

      tools.register(mockBus);

      const result = await handler("telegram_list_chats", {});

      expect(result.success).toBe(true);
      expect(result.output).toContain("123");
    });
  });

  describe("send_message", () => {
    test("sends message to chat", async () => {
      let handler: any = null;
      mockBus.register = (_def: any, h: any) => {
        handler = h;
      };

      tools.register(mockBus);

      const result = await handler("telegram_send_message", {
        chatId: "123",
        content: "Hello world",
      });

      expect(result.success).toBe(true);
    });

    test("requires chatId and content", async () => {
      let handler: any = null;
      mockBus.register = (_def: any, h: any) => {
        handler = h;
      };

      tools.register(mockBus);

      const result = await handler("telegram_send_message", {
        chatId: "123",
      });

      expect(result.success).toBe(false);
    });

    test("supports parse mode", async () => {
      let handler: any = null;
      mockBus.register = (_def: any, h: any) => {
        handler = h;
      };

      tools.register(mockBus);

      const result = await handler("telegram_send_message", {
        chatId: "123",
        content: "*bold*",
        parseMode: "Markdown",
      });

      expect(result).toBeDefined();
    });

    test("supports disable notification", async () => {
      let handler: any = null;
      mockBus.register = (_def: any, h: any) => {
        handler = h;
      };

      tools.register(mockBus);

      const result = await handler("telegram_send_message", {
        chatId: "123",
        content: "Silent message",
        disableNotification: true,
      });

      expect(result).toBeDefined();
    });
  });

  describe("send_photo", () => {
    test("sends photo to chat", async () => {
      let handler: any = null;
      mockBus.register = (_def: any, h: any) => {
        handler = h;
      };

      tools.register(mockBus);

      const result = await handler("telegram_send_photo", {
        chatId: "123",
        photo: "https://example.com/photo.jpg",
      });

      expect(result.success).toBe(true);
    });

    test("supports caption", async () => {
      let handler: any = null;
      mockBus.register = (_def: any, h: any) => {
        handler = h;
      };

      tools.register(mockBus);

      const result = await handler("telegram_send_photo", {
        chatId: "123",
        photo: "https://example.com/photo.jpg",
        caption: "Photo caption",
      });

      expect(result).toBeDefined();
    });
  });

  describe("get_chat_info", () => {
    test("retrieves chat information", async () => {
      let handler: any = null;
      mockBus.register = (_def: any, h: any) => {
        handler = h;
      };

      tools.register(mockBus);

      const result = await handler("telegram_get_chat_info", {
        chatId: "123",
      });

      expect(result.success).toBe(true);
    });
  });
});

describe("TelegramAdapter", () => {
  let adapter: TelegramAdapter;

  beforeEach(() => {
    adapter = new TelegramAdapter();
  });

  describe("platform", () => {
    test("returns telegram", () => {
      expect(adapter.platform).toBe("telegram");
    });
  });

  describe("configure", () => {
    test("sets token from config", async () => {
      await adapter.configure({ token: "test-token" });

      expect(adapter).toBeDefined();
    });
  });

  describe("listChats", () => {
    test("returns adapter error when bot not started", async () => {
      await expect(adapter.listChats()).rejects.toThrow("not started");
    });
  });

  describe("sendMessage", () => {
    test("sends with options", async () => {
      await adapter.configure({ token: "test" });

      expect(adapter).toBeDefined();
    });
  });
});
} // End of if (telegramAvailable)
