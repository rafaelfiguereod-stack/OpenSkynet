import type { RPCServer } from "../server.js";
import type { RPCHandlerDeps } from "../deps.js";
import { takeBrowserScreenshot } from "../../agent/tools/browser-tools.js";

export function registerSandboxHandlers(
  server: RPCServer,
  deps: RPCHandlerDeps,
): void {
  server.register("sandbox.start", async (params) => {
    const image = (params.image as string) ?? "default";
    return { started: true, container_id: `sandbox_${Date.now()}`, image };
  });

  server.register("sandbox.stop", async () => {
    return { stopped: true };
  });

  server.register("sandbox.status", async () => {
    return { running: false, mode: deps.sandboxMode };
  });

  server.register("sandbox.set_mode", async (params) => {
    const mode = params.mode as string;
    deps.sandboxMode = mode;
    return { set: true, mode };
  });

  server.register("sandbox.control", async (params) => {
    const action = params.action as string;
    return { success: true, action, output: "" };
  });

  server.register("sandbox.test_browser", async () => {
    if (!deps.browserSession.isStarted) {
      return { success: false, error: "Browser not started" };
    }
    try {
      // Try Openbrowser screenshot first, fall back to browser session
      let screenshot = await takeBrowserScreenshot();
      if (!screenshot) {
        screenshot = await deps.browserSession.takeScreenshot();
      }
      return { success: true, has_screenshot: !!screenshot };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  server.register("sandbox.screenshot", async (params) => {
    const instanceId = params.instanceId as string | undefined;
    // Try Openbrowser screenshot first, fall back to browser session
    let screenshot = await takeBrowserScreenshot(instanceId);
    if (!screenshot && deps.browserSession.isStarted) {
      screenshot = await deps.browserSession.takeScreenshot();
    }
    return { screenshot: screenshot ?? "" };
  });
}
