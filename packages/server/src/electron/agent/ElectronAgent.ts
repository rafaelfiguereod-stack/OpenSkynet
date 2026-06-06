/**
 * Electron Agent - Browser-focused automation agent
 *
 * @deprecated Use T800Agent with browser tools enabled instead.
 *
 * This browser-focused agent has been superseded by T800Agent which provides
 * the same browser automation capabilities along with all other tools (file, web,
 * skills, document, coding) in a unified interface.
 *
 * Based on kimi-code's architecture with:
 * - Tool-based execution system
 * - Proper tool registration
 * - Browser-focused capabilities
 * - Shell command integration
 */

import type { AgentResult, StepEvent } from '../../core/types';
import type { LLMProvider } from '../../llm/provider';
import type { BaseMemoryStrategy } from '../../memory/strategy';
import type { SkillEngine } from '../../skills/engine';
import { ToolBus } from '../../agent/tools/bus';
import { loadSoul } from '../../agent/prompts/soul';
import logger from '../../core/logging';
import { getConfig } from '../../core/config';
import { initializeElectronTools } from '../tools';

type Message = { role: string; content: string };

export interface ElectronAgentOpts {
  llmProvider: LLMProvider;
  memory?: BaseMemoryStrategy;
  skillEngine?: SkillEngine;
  toolBus?: ToolBus;
  headless?: boolean;
  workingDirectory?: string;
  enableShellTools?: boolean;
  enableBrowserTools?: boolean;
}

/**
 * Electron Agent - Specialized for browser automation and computer control
 *
 * This agent follows kimi-code's architecture:
 * - Tool-based execution system
 * - Proper tool lifecycle management
 * - Browser-focused capabilities
 * - Shell command integration
 */
export class ElectronAgent {
  private llmProvider: LLMProvider;
  private memory: BaseMemoryStrategy | null;
  private skillEngine: SkillEngine | null;
  private toolBus: ToolBus;
  private conversation: Message[];
  private maxIterations: number;
  private soul: string;
  private workingDirectory: string;
  private toolsInitialized = false;

  constructor(opts: ElectronAgentOpts) {
    const config = getConfig();
    this.llmProvider = opts.llmProvider;
    this.memory = opts.memory ?? null;
    this.skillEngine = opts.skillEngine ?? null;
    this.toolBus = opts.toolBus ?? new ToolBus();
    this.conversation = [];
    this.maxIterations = config.compressThreshold * 2 + 10;
    this.soul = "";
    this.workingDirectory = opts.workingDirectory ?? process.cwd();

    // Initialize tools following kimi-code pattern
    this.initializeTools(opts);
  }

  private initializeTools(opts: ElectronAgentOpts): void {
    if (this.toolsInitialized) return;

    initializeElectronTools(this.toolBus, {
      cwd: this.workingDirectory,
      enableShellTools: opts.enableShellTools ?? true,
      enableBrowserTools: opts.enableBrowserTools ?? true,
    });

    this.toolsInitialized = true;
  }

  async run(task: string): Promise<AgentResult> {
    const startTime = Date.now();
    const steps: StepEvent[] = [];
    const actionsTaken: string[] = [];
    let finalResult = "";
    let success = false;
    let iteration = 0;

    try {
      this.soul = loadSoul();

      if (this.memory) {
        await this.memory.onTurnStart();
      }

      this.addUserMessage(task);

      let done = false;

      while (iteration < this.maxIterations && !done) {
        iteration++;

        const systemPrompt = this.buildSystemPrompt(task, iteration);
        const messages = this.conversation.slice(-50); // Keep last 50 messages
        const tools = this.toolBus.getDefinitions();

        let response;
        try {
          response = await this.llmProvider.chat(messages, tools, systemPrompt);
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          logger.error({ err: errorMsg, iteration }, "electron_agent_llm_failed");
          steps.push({
            phase: "executing",
            action: "llm_error",
            detail: errorMsg
          });
          finalResult = `LLM error: ${errorMsg}`;
          break;
        }

        if (response.tool_calls.length > 0) {
          for (const tc of response.tool_calls) {
            const step: StepEvent = {
              phase: "executing",
              action: tc.name,
              detail: JSON.stringify(tc.arguments),
            };
            steps.push(step);
            actionsTaken.push(tc.name);

            try {
              const result = await this.toolBus.execute(tc.name, tc.arguments);
              step.observation = result.success ? result.output : result.error;
              this.addToolResult(tc.id, tc.name,
                result.success ? result.output : result.error ?? "Tool failed"
              );
            } catch (err) {
              const errMsg = err instanceof Error ? err.message : String(err);
              step.observation = errMsg;
              this.addToolResult(tc.id, tc.name, `Error: ${errMsg}`);
            }
          }

          if (response.text) {
            this.addAssistantMessage(response.text);
          }
        } else {
          const text = response.text ?? "";
          finalResult = text;
          done = true;

          this.addAssistantMessage(text);

          steps.push({
            phase: "done",
            action: "response",
            detail: finalResult,
          });
        }

        if (!done && iteration < this.maxIterations) {
          // Simple reflection logic
          const recentSteps = steps.slice(-3);
          const failedSteps = recentSteps.filter((s) =>
            s.observation && typeof s.observation === 'string' && s.observation.includes("Error")
          );

          if (failedSteps.length >= 2) {
            this.addSystemMessage("Multiple errors detected. Consider trying alternative approach.");
          }
        }
      }

      if (!done && !finalResult) {
        finalResult = "Max iterations reached without completion.";
      }

      success = finalResult.length > 0 &&
                !finalResult.startsWith("Stopped:") &&
                !finalResult.startsWith("LLM error:");

      await this.runPostTask(task, finalResult, success);

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error({ err: errorMsg }, "electron_agent_loop_error");
      finalResult = `Error: ${errorMsg}`;
      success = false;
    }

    const elapsedSecs = (Date.now() - startTime) / 1000;

    return {
      task,
      result: finalResult,
      success,
      steps,
      actions_taken: actionsTaken,
      iterations: iteration,
      strategy_used: "electron_browser_agent",
      elapsed_secs: Math.round(elapsedSecs * 100) / 100,
    };
  }

  cancel(): void {
    // Signal cancellation to any running operations
  }

  getConversation(): Message[] {
    return [...this.conversation];
  }

  getWorkingDirectory(): string {
    return this.workingDirectory;
  }

  async setWorkingDirectory(dir: string): Promise<void> {
    const { exec } = require("node:child_process");
    await new Promise((resolve, reject) => {
      exec(`test -d "${dir}"`, (error: any) => {
        if (error) reject(new Error(`Directory does not exist: ${dir}`));
        else resolve(void 0);
      });
    });
    this.workingDirectory = dir;
  }

  private buildSystemPrompt(task: string, iteration: number): string {
    const parts: string[] = [];

    if (this.soul) {
      parts.push(this.soul);
    }

    parts.push(`\nElectron Agent - Browser Automation & Computer Control`);
    parts.push(`Iteration: ${iteration}/${this.maxIterations}`);
    parts.push(`Workspace: ${this.workingDirectory}`);

    parts.push(`\nPrimary Capabilities:`);
    parts.push(`1. Browser Automation (via Browser tool):`);
    parts.push(`   - navigate_and_screenshot: Navigate to URL and capture screenshot`);
    parts.push(`   - navigate_and_extract: Navigate and extract text content`);
    parts.push(`   - click_and_wait: Click elements and wait for page load`);
    parts.push(`   - fill_and_submit: Fill forms and submit`);
    parts.push(`   - scroll_and_capture: Scroll page and capture`);

    parts.push(`\n2. Computer Control (via Shell tool):`);
    parts.push(`   - Execute shell commands`);
    parts.push(`   - Manage files and directories`);
    parts.push(`   - Control system processes`);
    parts.push(`   - Get system information`);

    if (this.memory) {
      const memoryContext = this.memory.context(task);
      if (memoryContext) {
        parts.push(`\nRelevant memories:\n${memoryContext}`);
      }
    }

    if (this.skillEngine) {
      const skillSummaries = this.skillEngine.getSkillSummaries();
      if (skillSummaries && skillSummaries !== "No skills available.") {
        parts.push(`\nAvailable skills:\n${skillSummaries}`);
      }
    }

    parts.push(`\nFor browser automation tasks, prefer using the Browser tool with specific actions.`);

    return parts.join("\n");
  }

  private async runPostTask(
    task: string,
    result: string,
    success: boolean
  ): Promise<void> {
    try {
      if (this.memory && success) {
        this.memory.write("memory", `Task: ${task}\nResult: ${result.slice(0, 500)}`, {
          category: "electron_task",
          success
        });
      }

      if (this.memory) {
        await this.memory.onSessionEnd();
      }
    } catch (err) {
      logger.warn({ err: (err as Error).message }, "electron_agent_post_task_error");
    }
  }

  private addUserMessage(content: string): void {
    this.conversation.push({ role: "user", content });
  }

  private addAssistantMessage(content: string): void {
    this.conversation.push({ role: "assistant", content });
  }

  private addSystemMessage(content: string): void {
    this.conversation.push({ role: "system", content });
  }

  private addToolResult(toolCallId: string, toolName: string, content: string): void {
    this.conversation.push({
      role: "tool",
      content: JSON.stringify({ tool_call_id: toolCallId, name: toolName, content }),
    } as any);
  }
}
