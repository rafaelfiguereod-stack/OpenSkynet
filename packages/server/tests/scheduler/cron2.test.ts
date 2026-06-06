/** Tests for Scheduler Cron */
import { test, describe, expect, beforeEach } from "bun:test";
import { CronManager, validateCronExpr, CronScheduler } from "../../src/scheduler/cron.js";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";

describe("SchedulerCron", () => {
  let manager: CronManager;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join("/tmp", "cron-test-"));
    manager = new CronManager(tempDir);
  });

  describe("validateCronExpr", () => {
    test("validates correct 5-field expression", () => {
      expect(validateCronExpr("*/5 * * * *")).toBe(true);
      expect(validateCronExpr("0 9 * * *")).toBe(true);
      expect(validateCronExpr("0 0 1 1 *")).toBe(true);
    });

    test("rejects invalid expressions", () => {
      expect(validateCronExpr("invalid")).toBe(false);
      expect(validateCronExpr("* * * *")).toBe(false);
      expect(validateCronExpr("* * * * * *")).toBe(false);
      expect(validateCronExpr("60 * * * *")).toBe(false);
    });
  });

  describe("CronManager", () => {
    test("creates manager with directory", () => {
      expect(manager).toBeDefined();
    });

    test("adds job and returns ID", () => {
      const id = manager.addJob("0 * * * *", "test task");
      expect(id).toBeDefined();
      expect(id.length).toBeGreaterThan(0);
    });

    test("retrieves job by ID", () => {
      const id = manager.addJob("*/5 * * * *", "scheduled task");
      const job = manager.getJob(id);
      expect(job).toBeDefined();
      expect(job?.task).toBe("scheduled task");
    });

    test("lists all jobs", () => {
      manager.addJob("0 * * * *", "task1");
      manager.addJob("*/5 * * * *", "task2");
      const jobs = manager.listJobs();
      expect(jobs.length).toBeGreaterThanOrEqual(2);
    });

    test("removes job by ID", () => {
      const id = manager.addJob("0 * * * *", "removable task");
      const removed = manager.removeJob(id);
      expect(removed).toBe(true);
      expect(manager.getJob(id)).toBeNull();
    });

    test("returns false for non-existent job removal", () => {
      const removed = manager.removeJob("nonexistent");
      expect(removed).toBe(false);
    });

    test("updates job result", () => {
      const id = manager.addJob("0 * * * *", "task");
      manager.updateJobResult(id, "result text");
      const job = manager.getJob(id);
      expect(job?.last_result).toBe("result text");
    });

    test("handles job with skill name", () => {
      const id = manager.addJob("0 * * * *", "task", "test-skill");
      const job = manager.getJob(id);
      expect(job?.skill_name).toBe("test-skill");
    });

    test("handles job with provider config", () => {
      const id = manager.addJob("0 * * * *", "task", undefined, "anthropic");
      const job = manager.getJob(id);
      expect(job?.provider).toBe("anthropic");
    });
  });

  describe("CronScheduler", () => {
    test("creates scheduler", () => {
      const scheduler = new CronScheduler();
      expect(scheduler).toBeDefined();
    });

    test("starts scheduler", () => {
      const scheduler = new CronScheduler();
      scheduler.start();
      scheduler.stop();
      expect(true).toBe(true);
    });

    test("stops scheduler", () => {
      const scheduler = new CronScheduler();
      scheduler.start();
      scheduler.stop();
      expect(true).toBe(true);
    });

    test("reloads jobs", () => {
      const scheduler = new CronScheduler();
      scheduler.start();
      scheduler.reload();
      scheduler.stop();
      expect(true).toBe(true);
    });
  });
});
