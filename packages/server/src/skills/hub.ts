import { join } from "node:path";
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import type { SkillData } from "./format.js";
import { SkillDataSchema } from "./format.js";
import type { SkillEngine } from "./engine.js";
import { SkillError } from "../core/errors.js";
import logger from "../core/logging.js";

const HUB_URL =
  process.env.SEDIMAN_HUB_URL ?? "https://hub.sediman.ai";

interface HubSkill {
  name: string;
  description: string;
  category: string;
  author: string;
  version: number;
  trust: string;
  installed: boolean;
  scope: string;
}

export class HubClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl ?? HUB_URL;
  }

  async browse(category?: string): Promise<HubSkill[]> {
    const url = category
      ? `${this.baseUrl}/api/skills?category=${encodeURIComponent(category)}`
      : `${this.baseUrl}/api/skills`;
    const res = await fetch(url);
    if (!res.ok) throw new SkillError(`Hub browse failed: ${res.status}`, "HUB_ERROR");
    const data = (await res.json()) as { skills: HubSkill[] };
    return data.skills ?? [];
  }

  async search(query: string): Promise<HubSkill[]> {
    const url = `${this.baseUrl}/api/skills/search?q=${encodeURIComponent(query)}`;
    const res = await fetch(url);
    if (!res.ok) throw new SkillError(`Hub search failed: ${res.status}`, "HUB_ERROR");
    const data = (await res.json()) as { skills: HubSkill[] };
    return data.skills ?? [];
  }

  async info(name: string): Promise<Record<string, unknown>> {
    const url = `${this.baseUrl}/api/skills/${encodeURIComponent(name)}`;
    const res = await fetch(url);
    if (!res.ok) throw new SkillError(`Hub info failed: ${res.status}`, "HUB_ERROR");
    return (await res.json()) as Record<string, unknown>;
  }

  async install(
    name: string,
    engine: SkillEngine,
    force = false,
  ): Promise<{ installed: string; message: string }> {
    const url = `${this.baseUrl}/api/skills/${encodeURIComponent(name)}`;
    const res = await fetch(url);
    if (!res.ok) throw new SkillError(`Hub install failed: ${res.status}`, "HUB_ERROR");
    const data = (await res.json()) as Record<string, unknown>;
    const skillData = SkillDataSchema.parse({ ...data, source: "hub" });
    const existing = engine.read(name);
    if (existing && !force) {
      return { installed: name, message: "Skill already installed. Use force=true to overwrite." };
    }
    engine.install(skillData);
    logger.info({ skill: name }, "skill_installed_from_hub");
    return { installed: name, message: `Installed ${name} from hub.` };
  }

  async publish(
    name: string,
    engine: SkillEngine,
  ): Promise<{ published: string; message: string }> {
    const data = engine.read(name);
    if (!data) throw new SkillError(`Skill "${name}" not found`, "NOT_FOUND");
    const url = `${this.baseUrl}/api/skills`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new SkillError(`Hub publish failed: ${res.status}`, "HUB_ERROR");
    logger.info({ skill: name }, "skill_published_to_hub");
    return { published: name, message: `Published ${name} to hub.` };
  }
}

export interface LockEntry {
  source: string;
  ref: string;
  installed_at: string;
  version: number;
}

export class SkillLockFile {
  private filePath: string;

  constructor(skillsDir: string) {
    this.filePath = join(skillsDir, "skills.lock.json");
  }

  private read(): Record<string, LockEntry> {
    if (!existsSync(this.filePath)) return {};
    try {
      return JSON.parse(readFileSync(this.filePath, "utf-8"));
    } catch {
      return {};
    }
  }

  private write(data: Record<string, LockEntry>): void {
    mkdirSync(join(this.filePath, ".."), { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
  }

  get(name: string): LockEntry | null {
    return this.read()[name] ?? null;
  }

  set(name: string, entry: LockEntry): void {
    const data = this.read();
    data[name] = entry;
    this.write(data);
  }

  remove(name: string): boolean {
    const data = this.read();
    if (!(name in data)) return false;
    delete data[name];
    this.write(data);
    return true;
  }

  list(): Record<string, LockEntry> {
    return this.read();
  }
}

export class GitHubInstaller {
  private lockFile: SkillLockFile;

  constructor(skillsDir: string) {
    this.lockFile = new SkillLockFile(skillsDir);
  }

  async install(
    ref: string,
    engine: SkillEngine,
    force = false,
  ): Promise<{ installed: string; message: string }> {
    const match = ref.match(/^(?:https?:\/\/github\.com\/)?([^/]+)\/([^/]+?)(?:\.git)?(?:\/(.+))?$/);
    if (!match) throw new SkillError(`Invalid GitHub ref: ${ref}`, "INVALID_REF");

    const [, owner, repo, subpath] = match;
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${subpath ? `${subpath}/skill.json` : "skill.json"}`;
    const res = await fetch(apiUrl, {
      headers: { Accept: "application/vnd.github.v3.raw" },
    });
    if (!res.ok) throw new SkillError(`GitHub fetch failed: ${res.status}`, "GITHUB_ERROR");

    const raw = await res.json() as Record<string, unknown>;
    const skillData = SkillDataSchema.parse({ ...raw, source: `github:${owner}/${repo}` });
    const name = skillData.name;

    const existing = engine.read(name);
    if (existing && !force) {
      return { installed: name, message: "Already installed. Use force=true to overwrite." };
    }

    engine.install(skillData);
    this.lockFile.set(name, {
      source: `github:${owner}/${repo}`,
      ref: subpath ?? "main",
      installed_at: new Date().toISOString(),
      version: skillData.version,
    });

    logger.info({ skill: name, ref }, "skill_installed_from_github");
    return { installed: name, message: `Installed ${name} from GitHub.` };
  }

  async checkUpdate(
    name: string,
    engine: SkillEngine,
  ): Promise<{ hasUpdate: boolean; message: string }> {
    const entry = this.lockFile.get(name);
    if (!entry || !entry.source.startsWith("github:")) {
      return { hasUpdate: false, message: "Not a GitHub-installed skill." };
    }

    const [, repoPart] = entry.source.split("github:");
    const apiUrl = `https://api.github.com/repos/${repoPart}/contents/skill.json`;
    const res = await fetch(apiUrl, {
      headers: { Accept: "application/vnd.github.v3.raw" },
    });
    if (!res.ok) return { hasUpdate: false, message: "Could not check remote." };

    const remote = await res.json() as { version?: number };
    const remoteVersion = remote.version ?? 0;
    const local = engine.read(name);
    const localVersion = (local?.version as number) ?? 0;

    if (remoteVersion > localVersion) {
      return { hasUpdate: true, message: `Update available: v${localVersion} -> v${remoteVersion}` };
    }
    return { hasUpdate: false, message: "Up to date." };
  }

  async updateSkill(
    name: string,
    engine: SkillEngine,
  ): Promise<{ updated: boolean; message: string }> {
    const entry = this.lockFile.get(name);
    if (!entry) return { updated: false, message: "No lock entry found." };
    try {
      const result = await this.install(entry.source, engine, true);
      this.lockFile.set(name, {
        ...entry,
        installed_at: new Date().toISOString(),
      });
      return { updated: true, message: result.message };
    } catch (err) {
      return {
        updated: false,
        message: `Update failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }
}
