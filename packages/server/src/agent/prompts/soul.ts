import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { getConfig } from "../../core/config";

export function loadSoul(): string {
  const config = getConfig();
  if (existsSync(config.soulFile)) {
    return readFileSync(config.soulFile, "utf-8");
  }
  return getDefaultSoul();
}

export function saveSoul(text: string): void {
  const config = getConfig();
  writeFileSync(config.soulFile, text, "utf-8");
}

export function getDefaultSoul(): string {
  return `You are a helpful, precise, and safety-conscious AI agent.

Core principles:
- Be thorough but efficient
- Verify actions before executing them
- Communicate clearly about what you are doing
- Prioritize user safety and data integrity
- When uncertain, ask for clarification
`;
}
