import type { RPCServer } from "../server.js";
import type { RPCHandlerDeps } from "../deps.js";
import { getOpenbrowserAdapter, takeBrowserScreenshot } from "../../agent/tools/browser-tools.js";

export function registerBrowserHandlers(
  server: RPCServer,
  deps: RPCHandlerDeps,
): void {
  // === Legacy Browser Handlers (Backward Compatible) ===

  server.register("browser.configure", async (params) => {
    const headless = (params.headless as boolean) ?? true;
    deps.browserSession.headless = headless;
    deps.headless = headless;
    return { configured: true, headless };
  });

  server.register("browser.goto", async (params) => {
    const url = params.url as string;
    if (!url) return { success: false, error: "Missing url parameter" };
    if (!deps.browserSession.isStarted) {
      await deps.browserSession.start();
    }
    try {
      const msg = await deps.browserController.navigate(url);
      const success = !msg.startsWith("Failed");
      return { success, url: success ? url : undefined, error: success ? undefined : msg };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  server.register("browser.click", async (params) => {
    const selector = params.selector as string;
    const refId = params.ref_id as number | undefined;
    if (!deps.browserSession.isStarted) {
      return { success: false, error: "Browser not started" };
    }
    try {
      if (refId !== undefined) {
        const msg = await deps.browserController.click(refId);
        return { success: !msg.startsWith("Failed"), selector, error: msg.startsWith("Failed") ? msg : undefined };
      }
      return { success: false, selector, error: "No selector or ref_id provided" };
    } catch (err) {
      return { success: false, selector, error: (err as Error).message };
    }
  });

  server.register("browser.fill", async (params) => {
    const selector = params.selector as string;
    const value = params.value as string;
    const refId = params.ref_id as number | undefined;
    if (!deps.browserSession.isStarted) {
      return { success: false, error: "Browser not started" };
    }
    try {
      if (refId !== undefined) {
        const submit = params.submit as boolean | undefined;
        const msg = await deps.browserController.typeText(refId, value, submit);
        return { success: !msg.startsWith("Failed"), selector, error: msg.startsWith("Failed") ? msg : undefined };
      }
      return { success: false, selector, error: "No ref_id provided" };
    } catch (err) {
      return { success: false, selector, error: (err as Error).message };
    }
  });

  server.register("browser.wait", async (params) => {
    const selector = params.selector as string;
    const timeout = params.timeout as number | undefined;
    if (!deps.browserSession.isStarted) {
      return { success: false, error: "Browser not started" };
    }
    try {
      const msg = await deps.browserController.waitForSelector(selector, timeout);
      const success = !msg.startsWith("Timeout");
      return { success, selector, error: success ? undefined : msg };
    } catch (err) {
      return { success: false, selector, error: (err as Error).message };
    }
  });

  // === New Openbrowser-based Handlers ===

  // Get list of active browser instances
  server.register("browser.list_instances", async () => {
    const adapter = getOpenbrowserAdapter();
    if (!adapter) {
      return { instances: [], error: "Browser adapter not initialized" };
    }

    const manager = adapter.getBrowserManager();
    const instances = manager.listInstances();

    return {
      instances: instances.map(inst => ({
        id: inst.id,
        connected: inst.connected,
        url: inst.url,
        port: inst.port,
      })),
    };
  });

  // Create new browser instance with Openbrowser
  server.register("browser.create_instance", async (params) => {
    const adapter = getOpenbrowserAdapter();
    if (!adapter) {
      return { success: false, error: "Browser adapter not initialized" };
    }

    try {
      const result = await adapter.executeTool("browser_new", {
        instance_id: params.instanceId || undefined,
        proxy: params.proxy || undefined,
        timeout: params.timeout || undefined,
      });

      return {
        success: result.success,
        instanceId: params.instanceId,
        output: result.output,
        error: result.error,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create browser",
      };
    }
  });

  // Navigate using Openbrowser
  server.register("browser.navigate2", async (params) => {
    const adapter = getOpenbrowserAdapter();
    if (!adapter) {
      return { success: false, error: "Browser adapter not initialized" };
    }

    try {
      const result = await adapter.executeTool("browser_navigate", {
        instance_id: params.instanceId,
        url: params.url,
        wait_ms: params.waitMs || 3000,
      });

      return {
        success: result.success,
        output: result.output,
        error: result.error,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Navigation failed",
      };
    }
  });

  // Take screenshot with Openbrowser
  server.register("browser.screenshot2", async (params) => {
    const instanceId = params.instanceId as string | undefined;

    // Try Openbrowser screenshot first, fall back to browser session
    let screenshot = await takeBrowserScreenshot(instanceId);
    if (!screenshot && deps.browserSession.isStarted) {
      screenshot = await deps.browserSession.takeScreenshot();
    }

    return {
      success: !!screenshot,
      screenshot: screenshot || "",
      error: screenshot ? undefined : "Screenshot failed",
    };
  });

  // Extract page text using Openbrowser
  server.register("browser.extract_text", async (params) => {
    const adapter = getOpenbrowserAdapter();
    if (!adapter) {
      return { success: false, error: "Browser adapter not initialized" };
    }

    try {
      const result = await adapter.executeTool("browser_extract_text", {
        instance_id: params.instanceId,
        selector: params.selector || undefined,
      });

      return {
        success: result.success,
        output: result.output,
        error: result.error,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Extract text failed",
      };
    }
  });

  // Close browser instance
  server.register("browser.close_instance", async (params) => {
    const adapter = getOpenbrowserAdapter();
    if (!adapter) {
      return { success: false, error: "Browser adapter not initialized" };
    }

    try {
      const result = await adapter.executeTool("browser_close", {
        instance_id: params.instanceId,
      });

      return {
        success: result.success,
        output: result.output,
        error: result.error,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Close failed",
      };
    }
  });

  // Get page state using Openbrowser
  server.register("browser.get_state", async (params) => {
    const adapter = getOpenbrowserAdapter();
    if (!adapter) {
      return { success: false, error: "Browser adapter not initialized" };
    }

    try {
      const result = await adapter.executeTool("browser_get_state", {
        instance_id: params.instanceId,
      });

      return {
        success: result.success,
        output: result.output,
        error: result.error,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Get state failed",
      };
    }
  });
}

