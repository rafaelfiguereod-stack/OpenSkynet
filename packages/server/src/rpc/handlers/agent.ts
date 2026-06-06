import type { RPCServer, NotifyFn } from "../server.js";
import type { RPCHandlerDeps } from "../deps.js";
import type { StepEvent } from "../../core/types.js";
import { T800Agent, TerminatorAgent } from "../../electron/index.js";
import { streamEventToNotification, type AgentStreamEvent } from "../../agent/streaming.js";

export function registerAgentHandlers(
  server: RPCServer,
  deps: RPCHandlerDeps,
): void {
  server.register("agent.run", async (params, notify) => {
    return runStreaming(params, notify, deps, (task, mode) =>
      runAgentTask(task, mode, deps),
    );
  });

  server.register("agent.cancel", async () => {
    deps.agentLoop.cancel();
    return { cancelled: true };
  });

  server.register("agent.terminator", async (params, notify) => {
    const task = (params.task as string) ?? "";
    const mode = "terminator";

    return runStreaming(params, notify, deps, (task, mode) =>
      runAgentTask(task, mode, deps),
    );
  });

  server.register("agent.dispatch", async (params, notify) => {
    const task = (params.task as string) ?? "";
    const mode = params.mode as string ?? "t800";

    return runStreaming(params, notify, deps, (task, mode) =>
      runAgentTask(task, mode, deps),
    );
  });
}

async function runAgentTask(
  task: string,
  mode: string | undefined,
  deps: RPCHandlerDeps,
  notify?: NotifyFn,
): Promise<import("../../core/types.js").AgentResult> {
  // Create agent with streaming support
  const agent = createAgentWithStreaming(mode ?? "t800", deps, notify);
  return agent.run(task);
}

async function runStreaming(
  params: Record<string, unknown>,
  notify: NotifyFn | undefined,
  deps: RPCHandlerDeps,
  runFn: (task: string, mode?: string) => Promise<import("../../core/types.js").AgentResult>,
): Promise<import("../../core/types.js").AgentResult> {
  const task = (params.task as string) ?? "";
  const mode = params.mode as string | undefined;

  // Notify about task start
  notify?.("chat.progress", { phase: "planning", action: "run_start", detail: task });

  try {
    const result = await runFn(task, mode);

    // Note: Steps are now streamed during execution via the agent's stream emitter
    // The result.steps are kept for backward compatibility and for final summary

    return result;
  } catch (err) {
    // Emit error notification
    notify?.("chat.error", {
      error: err instanceof Error ? err.message : String(err),
      recoverable: false,
    });
    throw err;
  }
}

/**
 * Create an agent instance with streaming support
 */
function createAgentWithStreaming(
  mode: string,
  deps: RPCHandlerDeps,
  notify: NotifyFn | undefined
): T800Agent | TerminatorAgent {
  const agentMode = mode === "terminator" ? "terminator" : "t800";

  let agent: T800Agent | TerminatorAgent;

  if (agentMode === "terminator") {
    agent = new TerminatorAgent({
      llmProvider: deps.llmProvider,
      memory: deps.memory,
      skillEngine: deps.skillEngine,
      skillSearch: deps.skillSearch,
      agentLoop: deps.agentLoop,
      toolBus: deps.agentLoop["toolBus"] ?? undefined,
      headless: deps.headless,
      workingDirectory: process.cwd(),
    });
  } else {
    agent = new T800Agent({
      llmProvider: deps.llmProvider,
      memory: deps.memory,
      skillEngine: deps.skillEngine,
      skillSearch: deps.skillSearch,
      agentLoop: deps.agentLoop,
      toolBus: deps.agentLoop["toolBus"] ?? undefined,
      headless: deps.headless,
      workingDirectory: process.cwd(),
    });
  }

  // Subscribe to streaming events and forward to TUI
  if (notify) {
    agent.onStreamEvent((event: AgentStreamEvent) => {
      const notification = streamEventToNotification(event);

      // Map event types to TUI notification methods
      switch (event.type) {
        case 'step_start':
        case 'step_complete':
          notify?.("chat.progress", notification);
          break;
        case 'thinking':
          notify?.("chat.thinking", notification);
          break;
        case 'content':
          notify?.("chat.content", notification);
          break;
        case 'progress':
          notify?.("chat.progress", notification);
          break;
        case 'error':
          notify?.("chat.error", notification);
          break;
      }
    });
  }

  return agent;
}
