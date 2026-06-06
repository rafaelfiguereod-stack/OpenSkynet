import type { RPCServer } from "../server.js";
import type { RPCHandlerDeps } from "../deps.js";
import {
  getRecentSessions,
  searchSessions,
  saveSession,
  getSessionById,
  deleteSession,
} from "../../memory/sessions.js";

export function registerSessionHandlers(
  server: RPCServer,
  deps: RPCHandlerDeps,
): void {
  server.register("sessions.list", async (params) => {
    const limit = (params.limit as number) ?? 20;
    const sessions = await getRecentSessions(limit);
    return sessions;
  });

  server.register("sessions.search", async (params) => {
    const query = params.query as string;
    const limit = (params.limit as number) ?? 10;
    const sessions = await searchSessions(query, limit);
    return { sessions };
  });

  server.register("sessions.save", async (params) => {
    const task = params.task as string;
    const steps = params.steps as Array<import("../../core/types.js").StepEvent> | undefined;
    const result = params.result as string | undefined;
    const id = await saveSession({ task, steps, result });
    return { id };
  });

  server.register("sessions.get", async (params) => {
    const id = (params.session_id ?? params.id) as string;
    const session = await getSessionById(id);
    if (!session) return { error: `Session "${id}" not found` };
    return session;
  });

  server.register("sessions.delete", async (params) => {
    const id = (params.session_id ?? params.id) as string;
    const deleted = await deleteSession(id);
    return { deleted };
  });
}
