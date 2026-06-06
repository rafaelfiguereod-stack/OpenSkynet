import type { RPCServer } from "../server.js";
import type { RPCHandlerDeps } from "../deps.js";

export function registerHubHandlers(
  server: RPCServer,
  deps: RPCHandlerDeps,
): void {
  server.register("hub.browse", async (params) => {
    const category = params.category as string | undefined;
    return deps.hubClient.browse(category);
  });

  server.register("hub.search", async (params) => {
    const query = params.query as string;
    return deps.hubClient.search(query);
  });

  server.register("hub.info", async (params) => {
    const name = params.name as string;
    const info = await deps.hubClient.info(name);
    return info;
  });

  server.register("hub.install", async (params) => {
    const name = params.name as string;
    const force = (params.force as boolean) ?? false;
    const result = await deps.hubClient.install(name, deps.skillEngine, force);
    return result;
  });

  server.register("hub.install_github", async (params) => {
    const ref = params.ref as string;
    const force = (params.force as boolean) ?? false;
    const result = await deps.gitHubInstaller.install(ref, deps.skillEngine, force);
    return result;
  });

  server.register("hub.check_update", async (params) => {
    const name = params.name as string;
    const result = await deps.gitHubInstaller.checkUpdate(name, deps.skillEngine);
    return result;
  });

  server.register("hub.update_skill", async (params) => {
    const name = params.name as string;
    const result = await deps.gitHubInstaller.updateSkill(name, deps.skillEngine);
    return result;
  });

  server.register("hub.remove", async (params) => {
    const name = params.name as string;
    const deleted = deps.skillEngine.delete(name);
    return { removed: deleted, name };
  });

  server.register("hub.get_lock_info", async (params) => {
    const name = params.name as string;
    const { SkillLockFile } = await import("../../skills/hub.js");
    const { getConfig } = await import("../../core/config.js");
    const lockFile = new SkillLockFile(getConfig().skillsDir);
    const entry = lockFile.get(name);
    return { entry };
  });

  server.register("hub.publish", async (params) => {
    const name = params.name as string;
    const result = await deps.hubClient.publish(name, deps.skillEngine);
    return result;
  });
}
