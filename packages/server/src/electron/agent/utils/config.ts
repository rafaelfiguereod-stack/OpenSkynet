/**
 * Configuration management utilities
 *
 * Handles agent configuration with defaults and validation.
 */

import type { T800AgentOpts, ToolConfig } from '../types';
import { DEFAULTS } from '../constants';
import type { BaseMemoryStrategy } from '../../../memory/strategy';
import type { SkillEngine } from '../../../skills/engine';
import type { SkillSearchEngine } from '../../../skills/search';
import type { AgentLoop } from '../../../agent/loop';
import { ToolBus } from '../../../agent/tools/bus';
import { getConfig } from '../../../core/config';

/**
 * Resolve agent options with defaults
 */
export function resolveAgentOptions(opts: T800AgentOpts): Required<
  Omit<T800AgentOpts, 'memory' | 'skillEngine' | 'skillSearch' | 'agentLoop' | 'toolBus'>
> & {
  memory: BaseMemoryStrategy | null;
  skillEngine: SkillEngine | null;
  skillSearch: SkillSearchEngine | null;
  agentLoop: AgentLoop | null;
  toolBus: ToolBus;
} {
  const config = getConfig();

  return {
    llmProvider: opts.llmProvider,
    memory: opts.memory ?? null,
    skillEngine: opts.skillEngine ?? null,
    skillSearch: opts.skillSearch ?? null,
    agentLoop: opts.agentLoop ?? null,
    toolBus: opts.toolBus ?? new ToolBus(),
    headless: opts.headless ?? DEFAULTS.HEADLESS,
    workingDirectory: opts.workingDirectory ?? process.cwd(),
    enableShellTools: opts.enableShellTools ?? true,
    enableBrowserTools: opts.enableBrowserTools ?? true,
    enableFileTools: opts.enableFileTools ?? true,
    enableWebTools: opts.enableWebTools ?? true,
    enableSkillsTools: opts.enableSkillsTools ?? true,
    enableDocumentTools: opts.enableDocumentTools ?? true,
    enableCodingTools: opts.enableCodingTools ?? true,
  };
}

/**
 * Calculate max iterations from config
 */
export function calculateMaxIterations(): number {
  const config = getConfig();
  return config.compressThreshold * DEFAULTS.MAX_ITERATIONS_MULTIPLIER + DEFAULTS.MAX_ITERATIONS_BASE;
}

/**
 * Build tool configuration from agent options
 */
export function buildToolConfig(opts: ReturnType<typeof resolveAgentOptions>): ToolConfig {
  return {
    cwd: opts.workingDirectory,
    enableShellTools: opts.enableShellTools,
    enableBrowserTools: opts.enableBrowserTools,
    enableFileTools: opts.enableFileTools,
    enableWebTools: opts.enableWebTools,
    enableSkillsTools: opts.enableSkillsTools,
    enableDocumentTools: opts.enableDocumentTools,
    enableCodingTools: opts.enableCodingTools,
    skillDeps: {
      skillEngine: opts.skillEngine ?? undefined,
      skillSearch: opts.skillSearch ?? undefined,
      runSkill: opts.agentLoop
        ? (name: string) => {
            const skill = opts.skillEngine?.getSkill(name);
            if (!skill) {
              return Promise.reject(new Error(`Skill "${name}" not found`));
            }
            return opts.agentLoop!.run(
              (skill.description as string) ?? name
            );
          }
        : undefined,
    },
  };
}

/**
 * Validate working directory exists
 */
export async function validateWorkingDirectory(dir: string): Promise<void> {
  const { exec } = await import('node:child_process');

  return new Promise((resolve, reject) => {
    exec(`test -d "${dir}"`, (error: any) => {
      if (error) {
        reject(new Error(`Directory does not exist: ${dir}`));
      } else {
        resolve();
      }
    });
  });
}
