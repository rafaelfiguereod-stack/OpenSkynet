import { homedir } from "node:os";
import { join } from "node:path";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";

export type PermissionMode = "ask" | "allow" | "deny";

export interface TUIConfigData {
  theme: string;
  permissionMode: PermissionMode;
  showSidePanel: boolean;
  headless: boolean;
  updateFrequency: number;
  provider: string;
  model: string;
  baseUrl: string;
  onboardingComplete: boolean;
}

const CONFIG_PATH = join(homedir(), ".terminator", "tui.toml");

const DEFAULTS: TUIConfigData = {
  theme: "tokyo-night",
  permissionMode: "ask",
  showSidePanel: false,
  headless: false,
  updateFrequency: 30,
  provider: "openai",
  model: "",
  baseUrl: "",
  onboardingComplete: false,
};

function parseTomlValue(raw: string): any {
  const v = raw.trim();
  if (v === "true") return true;
  if (v === "false") return false;
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1);
  }
  if (/^-?\d+(\.\d+)?$/.test(v)) return parseFloat(v);
  return v;
}

function toTomlValue(val: any): string {
  if (typeof val === "boolean") return val ? "true" : "false";
  if (typeof val === "number") return String(val);
  return `"${String(val).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function parseToml(content: string): Record<string, any> {
  const result: Record<string, any> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (key) result[key] = parseTomlValue(value);
  }
  return result;
}

function serializeToml(obj: Record<string, any>): string {
  const lines: string[] = ["# OpenSkynet TUI Configuration", ""];
  for (const [key, value] of Object.entries(obj)) {
    lines.push(`${key} = ${toTomlValue(value)}`);
  }
  return lines.join("\n") + "\n";
}

export class TUIConfig {
  theme: string;
  permissionMode: PermissionMode;
  showSidePanel: boolean;
  headless: boolean;
  updateFrequency: number;
  provider: string;
  model: string;
  baseUrl: string;
  onboardingComplete: boolean;

  constructor(data?: Partial<TUIConfigData>) {
    const merged = { ...DEFAULTS, ...data };
    this.theme = merged.theme;
    this.permissionMode = merged.permissionMode;
    this.showSidePanel = merged.showSidePanel;
    this.headless = merged.headless;
    this.updateFrequency = merged.updateFrequency;
    this.provider = merged.provider;
    this.model = merged.model;
    this.baseUrl = merged.baseUrl;
    this.onboardingComplete = merged.onboardingComplete;
  }

  static load(): TUIConfig {
    try {
      if (existsSync(CONFIG_PATH)) {
        const content = readFileSync(CONFIG_PATH, "utf-8");
        const data = parseToml(content);
        return new TUIConfig(data as Partial<TUIConfigData>);
      }
    } catch {
      // use defaults on parse error
    }
    return new TUIConfig();
  }

  save(): void {
    const dir = join(homedir(), ".terminator");
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(
      CONFIG_PATH,
      serializeToml({
        theme: this.theme,
        permissionMode: this.permissionMode,
        showSidePanel: this.showSidePanel,
        headless: this.headless,
        updateFrequency: this.updateFrequency,
        provider: this.provider,
        model: this.model,
        baseUrl: this.baseUrl,
        onboardingComplete: this.onboardingComplete,
      }),
      "utf-8",
    );
  }
}
