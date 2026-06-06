import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  statSync,
  renameSync,
  unlinkSync,
} from "node:fs";
import { join, resolve, relative } from "node:path";
import type { SkillData } from "./format.js";
import { loadSkill, SkillDataSchema, skillToJson } from "./format.js";
import { SkillError } from "../core/errors.js";
import { getConfig } from "../core/config.js";
import logger from "../core/logging.js";

interface CacheEntry {
  mtime: number;
  data: Record<string, unknown>;
}

export class SkillEngine {
  private skillsDir: string;
  private projectDir: string | null;
  private useCache: boolean;
  private cache: Map<string, CacheEntry> = new Map();
  private repoSkillsDir: string | null;
  private _lazyInitDone = false;

  constructor(skillsDir?: string, useCache = true) {
    const config = getConfig();
    this.skillsDir = skillsDir ?? config.skillsDir;
    this.useCache = useCache;
    this.projectDir = null;
    this.repoSkillsDir = null;
  }

  private _ensureInit(): void {
    if (this._lazyInitDone) return;
    this._lazyInitDone = true;
    this.projectDir = this.findProjectSkillsDir();
    this.repoSkillsDir = this.findRepoSkillsDir();
    this.ensureDir(this.skillsDir);
    this.loadRepoSkillsIndex();
  }

  private findProjectSkillsDir(): string | null {
    const cwd = process.cwd();
    const candidate = join(cwd, ".terminator", "skills");
    if (existsSync(candidate)) return candidate;
    return null;
  }

  private findRepoSkillsDir(): string | null {
    // Try to find the repository's skills directory
    const cwd = process.cwd();
    let current = cwd;
    for (let i = 0; i < 5; i++) {
      const candidate = join(current, "skills");
      if (existsSync(candidate) && existsSync(join(candidate, "data", "index.json"))) {
        return candidate;
      }
      const parent = join(current, "..");
      if (parent === current) break;
      current = resolve(parent);
    }
    return null;
  }

  private ensureDir(dir: string): void {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }

  private safeName(name: string): boolean {
    const config = getConfig();
    return config.safeNameRe.test(name) && name.length <= config.maxNameLength;
  }

  private validatePath(dir: string): void {
    const resolved = resolve(dir);
    const allowedRoots = [this.skillsDir];
    if (this.projectDir) allowedRoots.push(this.projectDir);
    if (this.repoSkillsDir) allowedRoots.push(this.repoSkillsDir);
    const ok = allowedRoots.some(
      (root) => resolved === root || resolved.startsWith(root + "/"),
    );
    if (!ok) {
      throw new SkillError(`Path traversal detected: ${resolved}`, "PATH_TRAVERSAL");
    }
  }

  private skillDir(name: string, preferProject = false): string {
    if (preferProject && this.projectDir) {
      const pDir = join(this.projectDir, name);
      if (existsSync(pDir)) return pDir;
    }
    return join(this.skillsDir, name);
  }

  private readCached(dir: string): Record<string, unknown> | null {
    const filePath = join(dir, "skill.json");
    if (!existsSync(filePath)) return null;
    const mtime = statSync(filePath).mtimeMs;
    if (this.useCache) {
      const cached = this.cache.get(dir);
      if (cached && cached.mtime === mtime) return cached.data;
    }
    const data = loadSkill(dir);
    if (!data) return null;
    const json = skillToJson(data);
    if (this.useCache) {
      this.cache.set(dir, { mtime, data: json });
    }
    return json;
  }

  private atomicWrite(filePath: string, data: string): void {
    const tmp = `${filePath}.tmp`;
    writeFileSync(tmp, data, "utf-8");
    renameSync(tmp, filePath);
  }

  private searchDirs(): string[] {
    const dirs = [this.skillsDir];
    if (this.projectDir) dirs.push(this.projectDir);
    if (this.repoSkillsDir) dirs.push(this.repoSkillsDir);
    return dirs;
  }

  private repoSkillsIndex: Map<string, {
    name: string;
    description: string;
    category?: string;
    source: string;
    path: string;
    keywords: string[];
  }> = new Map();

  loadRepoSkillsIndex(): void {
    if (!this.repoSkillsDir) return;
    const indexPath = join(this.repoSkillsDir, "data", "index.json");
    if (!existsSync(indexPath)) {
      logger.debug("No repository skills index found");
      return;
    }

    try {
      const content = readFileSync(indexPath, "utf-8");
      const data = JSON.parse(content) as {
        skills?: Array<{
          name: string;
          description: string;
          category?: string;
          source: string;
          path: string;
          keywords: string[];
        }>;
      };

      if (data.skills) {
        for (const skill of data.skills) {
          this.repoSkillsIndex.set(skill.name, skill);
        }
        logger.info({ count: data.skills.length }, "repo_skills_index_loaded");
      }
    } catch (err) {
      logger.warn({ error: String(err) }, "failed_to_load_repo_skills_index");
    }
  }

  create(
    name: string,
    description: string,
    steps: string[],
    extra: Partial<SkillData> = {},
  ): Record<string, unknown> {
    this._ensureInit();
    if (!this.safeName(name)) {
      throw new SkillError(
        `Invalid skill name: "${name}". Use lowercase alphanumeric with hyphens.`,
        "INVALID_NAME",
      );
    }
    const dir = this.skillDir(name);
    this.validatePath(dir);
    if (existsSync(dir)) {
      throw new SkillError(`Skill "${name}" already exists`, "ALREADY_EXISTS");
    }
    mkdirSync(dir, { recursive: true });

    const now = new Date().toISOString();
    const data: SkillData = SkillDataSchema.parse({
      name,
      description,
      steps,
      version: 1,
      created_at: now,
      updated_at: now,
      ...extra,
    });

    const filePath = join(dir, "skill.json");
    this.atomicWrite(filePath, JSON.stringify(data, null, 2) + "\n");
    this.cache.delete(dir);
    logger.info({ skill: name }, "skill_created");
    return skillToJson(data);
  }

  read(name: string): Record<string, unknown> | null {
    this._ensureInit();
    const dir = this.skillDir(name, true);
    this.validatePath(dir);
    return this.readCached(dir);
  }

  getSkill(name: string): Record<string, unknown> | null {
    return this.read(name);
  }

  listSkills(): Array<Record<string, unknown>> {
    this._ensureInit();
    const results: Array<Record<string, unknown>> = [];
    const seen = new Set<string>();

    // First, load skills from directories (user and project skills)
    for (const baseDir of this.searchDirs()) {
      if (!existsSync(baseDir)) continue;
      for (const entry of readdirSync(baseDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        if (seen.has(entry.name)) continue;
        seen.add(entry.name);
        const dir = join(baseDir, entry.name);
        const data = this.readCached(dir);
        if (data) results.push(data);
      }
    }

    // Then, add repository skills from index (these are external/embedded skills)
    for (const [name, skill] of this.repoSkillsIndex) {
      if (seen.has(name)) continue;
      seen.add(name);
      results.push({
        name: skill.name,
        description: skill.description,
        category: skill.category,
        source: skill.source,
        path: skill.path,
        keywords: skill.keywords,
        scope: "external",
      });
    }

    return results;
  }

  ensureSkill(
    name: string,
    data: SkillData | Record<string, unknown>,
  ): Record<string, unknown> {
    const existing = this.read(name);
    if (existing) return existing;
    const parsed = SkillDataSchema.parse({ ...data, name });
    return this.create(parsed.name, parsed.description, parsed.steps, parsed);
  }

  install(data: SkillData): Record<string, unknown> {
    const parsed = SkillDataSchema.parse({ ...data, source: data.source ?? "hub" });
    const existing = this.read(parsed.name);
    if (existing) {
      return this.patch(parsed.name, {
        ...parsed,
        version: ((existing.version as number) ?? 0) + 1,
      })!;
    }
    return this.create(parsed.name, parsed.description, parsed.steps, parsed);
  }

  delete(name: string): boolean {
    this._ensureInit();
    const dir = this.skillDir(name, true);
    this.validatePath(dir);
    if (!existsSync(dir)) return false;
    try {
      const entries = readdirSync(dir, { recursive: true });
      for (const entry of entries) {
        unlinkSync(join(dir, String(entry)));
      }
      for (const entry of readdirSync(dir)) {
        unlinkSync(join(dir, entry));
      }
      const historyDir = join(dir, "history");
      if (existsSync(historyDir)) {
        for (const f of readdirSync(historyDir)) {
          unlinkSync(join(historyDir, f));
        }
      }
      unlinkSync(join(dir, "skill.json"));
      try { readdirSync(dir).length === 0 && unlinkSync(dir); } catch {}
      this.cache.delete(dir);
      logger.info({ skill: name }, "skill_deleted");
      return true;
    } catch (err) {
      throw new SkillError(`Failed to delete skill "${name}": ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  patch(
    name: string,
    updates: Record<string, unknown>,
  ): Record<string, unknown> | null {
    this._ensureInit();
    const dir = this.skillDir(name, true);
    this.validatePath(dir);
    const existing = this.readCached(dir);
    if (!existing) return null;

    this.archiveVersion(name);

    const merged = { ...existing, ...updates, updated_at: new Date().toISOString() };
    const parsed = SkillDataSchema.parse(merged);
    const filePath = join(dir, "skill.json");
    this.atomicWrite(filePath, JSON.stringify(parsed, null, 2) + "\n");
    this.cache.delete(dir);
    logger.info({ skill: name }, "skill_patched");
    return skillToJson(parsed);
  }

  private archiveVersion(name: string): void {
    const dir = this.skillDir(name, true);
    const current = this.readCached(dir);
    if (!current) return;
    const version = (current.version as number) ?? 1;
    const historyDir = join(dir, "history");
    this.ensureDir(historyDir);
    const archivePath = join(historyDir, `skill.json.v${version}`);
    if (!existsSync(archivePath)) {
      writeFileSync(archivePath, JSON.stringify(current, null, 2) + "\n", "utf-8");
    }
  }

  rollback(name: string, version?: number): Record<string, unknown> | null {
    this._ensureInit();
    const dir = this.skillDir(name, true);
    this.validatePath(dir);
    const historyDir = join(dir, "history");
    if (!existsSync(historyDir)) return null;

    const files = readdirSync(historyDir)
      .filter((f) => f.startsWith("skill.json.v"))
      .sort();

    if (files.length === 0) return null;

    let target: string;
    if (version !== undefined) {
      target = `skill.json.v${version}`;
      if (!files.includes(target)) {
        throw new SkillError(`Version ${version} not found for skill "${name}"`, "VERSION_NOT_FOUND");
      }
    } else {
      target = files[files.length - 1];
    }

    const archivePath = join(historyDir, target);
    const raw = readFileSync(archivePath, "utf-8");
    const parsed = SkillDataSchema.parse(JSON.parse(raw));
    const filePath = join(dir, "skill.json");
    this.atomicWrite(filePath, JSON.stringify(parsed, null, 2) + "\n");
    this.cache.delete(dir);
    logger.info({ skill: name, version: parsed.version }, "skill_rolled_back");
    return skillToJson(parsed);
  }

  listHistory(name: string): Array<{ version: number; modified: string }> {
    this._ensureInit();
    const dir = this.skillDir(name, true);
    const historyDir = join(dir, "history");
    if (!existsSync(historyDir)) return [];
    const results: Array<{ version: number; modified: string }> = [];
    for (const f of readdirSync(historyDir)) {
      const match = f.match(/^skill\.json\.v(\d+)$/);
      if (!match) continue;
      const stat = statSync(join(historyDir, f));
      results.push({ version: parseInt(match[1], 10), modified: stat.mtime.toISOString() });
    }
    return results.sort((a, b) => a.version - b.version);
  }

  recordUsage(name: string): void {
    this._ensureInit();
    const dir = this.skillDir(name, true);
    this.validatePath(dir);
    const data = this.readCached(dir);
    if (!data) return;
    const now = new Date().toISOString();
    const useCount = ((data.use_count as number) ?? 0) + 1;
    const merged = {
      ...data,
      use_count: useCount,
      last_used_at: now,
      execution_count: ((data.execution_count as number) ?? 0) + 1,
    };
    const parsed = SkillDataSchema.parse(merged);
    const filePath = join(dir, "skill.json");
    this.atomicWrite(filePath, JSON.stringify(parsed, null, 2) + "\n");
    this.cache.delete(dir);
  }

  async findSimilar(
    description: string,
    limit = 5,
  ): Promise<Array<Record<string, unknown>>> {
    const all = this.listSkills();
    const queryLower = description.toLowerCase();
    const queryTokens = new Set(queryLower.split(/\s+/).filter(Boolean));

    const scored = all.map((skill) => {
      const desc = (skill.description as string ?? "").toLowerCase();
      const name = (skill.name as string ?? "").toLowerCase();
      const steps = (skill.steps as string[] ?? []).join(" ").toLowerCase();
      const text = `${name} ${desc} ${steps}`;
      const tokens = text.split(/\s+/).filter(Boolean);
      let overlap = 0;
      for (const t of tokens) {
        if (queryTokens.has(t)) overlap++;
      }
      const score = overlap / Math.max(queryTokens.size, 1);
      return { skill, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map((s) => s.skill);
  }

  getSkillSummaries(): string {
    const skills = this.listSkills();
    if (skills.length === 0) return "No skills available.";
    const lines: string[] = [];
    for (const s of skills) {
      const name = s.name as string;
      const desc = s.description as string;
      const cat = s.category as string ?? "general";
      lines.push(`- **${name}** (${cat}): ${desc}`);
    }
    return lines.join("\n");
  }
}
