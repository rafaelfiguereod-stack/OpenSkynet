export { RPCServer, type RPCHandler, type NotifyFn } from "./server.js";
export { ERROR_CODES } from "./protocol.js";
export type { RPCHandlerDeps } from "./deps.js";

import { RPCServer } from "./server.js";
import type { RPCHandlerDeps } from "./deps.js";
import type { RPCHandler } from "./server.js";

async function loadAndRegister(
  fakeServer: { register: (m: string, h: RPCHandler) => void; handlers: Map<string, RPCHandler>; getUptimeSecs: () => number },
  deps: RPCHandlerDeps,
): Promise<void> {
  const mods = await Promise.all([
    import("./handlers/system.js"),
    import("./handlers/agent.js"),
    import("./handlers/browser.js"),
    import("./handlers/skills.js"),
    import("./handlers/hub.js"),
    import("./handlers/memory.js"),
    import("./handlers/sessions.js"),
    import("./handlers/schedule.js"),
    import("./handlers/model.js"),
    import("./handlers/auth.js"),
    import("./handlers/terminal.js"),
    import("./handlers/record.js"),
    import("./handlers/integration.js"),
    import("./handlers/checkpoint.js"),
    import("./handlers/sandbox.js"),
  ]);

  mods[0].registerSystemHandlers(fakeServer as any, deps);
  mods[1].registerAgentHandlers(fakeServer as any, deps);
  mods[2].registerBrowserHandlers(fakeServer as any, deps);
  mods[3].registerSkillHandlers(fakeServer as any, deps);
  mods[4].registerHubHandlers(fakeServer as any, deps);
  mods[5].registerMemoryHandlers(fakeServer as any, deps);
  mods[6].registerSessionHandlers(fakeServer as any, deps);
  mods[7].registerScheduleHandlers(fakeServer as any, deps);
  mods[8].registerModelHandlers(fakeServer as any, deps);
  mods[9].registerAuthHandlers(fakeServer as any, deps);
  mods[10].registerTerminalHandlers(fakeServer as any, deps);
  mods[11].registerRecordHandlers(fakeServer as any, deps);
  mods[12].registerIntegrationHandlers(fakeServer as any, deps);
  mods[13].registerCheckpointHandlers(fakeServer as any, deps);
  mods[14].registerSandboxHandlers(fakeServer as any, deps);
}

export async function createRPCServerAsync(deps: RPCHandlerDeps): Promise<RPCServer> {
  const server = new RPCServer();
  const handlerMap = new Map<string, RPCHandler>();
  const register = (method: string, handler: RPCHandler) => {
    handlerMap.set(method, handler);
  };
  const fakeServer = {
    register,
    handlers: handlerMap,
    getUptimeSecs: () => server.getUptimeSecs(),
  };

  await loadAndRegister(fakeServer, deps);

  for (const [method, handler] of handlerMap) {
    server.register(method, handler);
  }
  return server;
}

import { registerSystemHandlers } from "./handlers/system.js";
import { registerAgentHandlers } from "./handlers/agent.js";
import { registerBrowserHandlers } from "./handlers/browser.js";
import { registerSkillHandlers } from "./handlers/skills.js";
import { registerHubHandlers } from "./handlers/hub.js";
import { registerMemoryHandlers } from "./handlers/memory.js";
import { registerSessionHandlers } from "./handlers/sessions.js";
import { registerScheduleHandlers } from "./handlers/schedule.js";
import { registerModelHandlers } from "./handlers/model.js";
import { registerAuthHandlers } from "./handlers/auth.js";
import { registerTerminalHandlers } from "./handlers/terminal.js";
import { registerRecordHandlers } from "./handlers/record.js";
import { registerIntegrationHandlers } from "./handlers/integration.js";
import { registerCheckpointHandlers } from "./handlers/checkpoint.js";
import { registerSandboxHandlers } from "./handlers/sandbox.js";

export function createRPCServer(deps: RPCHandlerDeps): RPCServer {
  const server = new RPCServer();
  const handlerMap = new Map<string, RPCHandler>();
  const register = (method: string, handler: RPCHandler) => {
    handlerMap.set(method, handler);
  };
  const fakeServer = {
    register,
    handlers: handlerMap,
    getUptimeSecs: () => server.getUptimeSecs(),
  } as unknown as RPCServer;

  registerSystemHandlers(fakeServer, deps);
  registerAgentHandlers(fakeServer, deps);
  registerBrowserHandlers(fakeServer, deps);
  registerSkillHandlers(fakeServer, deps);
  registerHubHandlers(fakeServer, deps);
  registerMemoryHandlers(fakeServer, deps);
  registerSessionHandlers(fakeServer, deps);
  registerScheduleHandlers(fakeServer, deps);
  registerModelHandlers(fakeServer, deps);
  registerAuthHandlers(fakeServer, deps);
  registerTerminalHandlers(fakeServer, deps);
  registerRecordHandlers(fakeServer, deps);
  registerIntegrationHandlers(fakeServer, deps);
  registerCheckpointHandlers(fakeServer, deps);
  registerSandboxHandlers(fakeServer, deps);

  for (const [method, handler] of handlerMap) {
    server.register(method, handler);
  }
  return server;
}

/**
 * Build a handler map for WebSocket RPC connections
 * @param deps - RPC handler dependencies
 * @param getUptimeSecs - Function to get server uptime in seconds
 * @returns Map of method names to RPC handlers
 */
export function buildHandlerMap(
  deps: RPCHandlerDeps,
  getUptimeSecs: () => number,
): Map<string, RPCHandler> {
  const handlerMap = new Map<string, RPCHandler>();
  const register = (method: string, handler: RPCHandler) => {
    handlerMap.set(method, handler);
  };
  const fakeServer = {
    register,
    handlers: handlerMap,
    getUptimeSecs,
  } as unknown as RPCServer;

  registerSystemHandlers(fakeServer, deps);
  registerAgentHandlers(fakeServer, deps);
  registerBrowserHandlers(fakeServer, deps);
  registerSkillHandlers(fakeServer, deps);
  registerHubHandlers(fakeServer, deps);
  registerMemoryHandlers(fakeServer, deps);
  registerSessionHandlers(fakeServer, deps);
  registerScheduleHandlers(fakeServer, deps);
  registerModelHandlers(fakeServer, deps);
  registerAuthHandlers(fakeServer, deps);
  registerTerminalHandlers(fakeServer, deps);
  registerRecordHandlers(fakeServer, deps);
  registerIntegrationHandlers(fakeServer, deps);
  registerCheckpointHandlers(fakeServer, deps);
  registerSandboxHandlers(fakeServer, deps);

  return handlerMap;
}
