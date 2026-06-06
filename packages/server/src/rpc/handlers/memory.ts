import type { RPCServer } from "../server.js";
import type { RPCHandlerDeps } from "../deps.js";

export function registerMemoryHandlers(
  server: RPCServer,
  deps: RPCHandlerDeps,
): void {
  server.register("memory.get", async (params) => {
    const allMemory = deps.memory.search("", 10000);
    return {
      memory: allMemory.map((e) => String((e as unknown as Record<string, unknown>).content ?? "")).join("\n"),
      user: allMemory.map((e) => String((e as unknown as Record<string, unknown>).content ?? "")).join("\n"),
      memory_entries: allMemory.length,
      user_entries: allMemory.length,
    };
  });

  server.register("memory.add", async (params) => {
    const content = params.content as string;
    const target = (params.target as string) ?? "memory";
    const type = (params.type as string) ?? "fact";
    const success = deps.memory.write(target, content, { type });
    deps.changelog.addChange("add", target, content);
    return { success };
  });

  server.register("memory.replace", async (params) => {
    const target = (params.target as string) ?? "memory";
    const oldContent = params.old_content as string;
    const newContent = params.new_content as string;
    const success = deps.memory.replace(target, oldContent, newContent);
    deps.changelog.addChange("replace", target, newContent);
    return { success };
  });

  server.register("memory.remove", async (params) => {
    const target = (params.target as string) ?? "memory";
    const content = params.content as string;
    const success = deps.memory.remove(target, content);
    deps.changelog.addChange("remove", target, content);
    return { success };
  });

  server.register("memory.search", async (params) => {
    const query = params.query as string;
    const limit = (params.limit as number) ?? 10;
    const results = deps.memory.search(query, limit);
    return { results };
  });

  server.register("memory.changelog", async (params) => {
    const target = params.target as string | undefined;
    const limit = (params.limit as number) ?? 50;
    const changes = deps.changelog.getRecentChanges(target, limit);
    return { changes };
  });

  server.register("memory.switch_system", async (params) => {
    const system = params.system as "file" | "hy";
    process.env.SEDIMAN_MEMORY_SYSTEM = system;
    return { switched: true, system };
  });

  server.register("memory.get_system", async () => {
    const { getConfig } = await import("../../core/config.js");
    return { system: getConfig().memorySystem };
  });

  server.register("memory.get_stats", async () => {
    const all = deps.memory.search("", 10000);
    return {
      total_entries: all.length,
      version: deps.memory.version,
    };
  });
}
