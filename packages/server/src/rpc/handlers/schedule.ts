import type { RPCServer } from "../server.js";
import type { RPCHandlerDeps } from "../deps.js";

export function registerScheduleHandlers(
  server: RPCServer,
  deps: RPCHandlerDeps,
): void {
  server.register("schedule.list", async () => {
    return deps.cronManager.listJobs();
  });

  server.register("schedule.add", async (params) => {
    const cronExpr = params.cron as string;
    const task = params.task as string;
    const skillName = params.skill_name as string | undefined;
    const provider = params.provider as string | undefined;
    const model = params.model as string | undefined;
    const baseUrl = params.base_url as string | undefined;
    const notify = params.notify as string | undefined;
    const id = deps.cronManager.addJob(
      cronExpr,
      task,
      skillName,
      provider,
      model,
      baseUrl,
      notify,
    );
    return { job_id: id };
  });

  server.register("schedule.remove", async (params) => {
    const id = (params.job_id ?? params.id) as string;
    const removed = deps.cronManager.removeJob(id);
    return { removed };
  });
}
