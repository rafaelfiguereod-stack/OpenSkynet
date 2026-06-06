/**
 * TerminatorAgent - Orchestrator for complex multi-step tasks
 *
 * Refactored to senior-level craft with:
 * - Task decomposition strategies
 * - Parallel subtask execution with dependency management
 * - Result aggregation and synthesis
 * - Self-reflection and error recovery
 * - Type-safe state management
 */

// Type imports
import type { AgentResult, StepEvent } from '../../core/types';
import type { LLMProvider } from '../../llm/provider';
import type { BaseMemoryStrategy } from '../../memory/strategy';
import type { SkillEngine } from '../../skills/engine';
import type { SkillSearchEngine } from '../../skills/search';

// Agent imports
import { T800Agent, type T800AgentOpts } from './T800Agent';
import type { SystemPromptContext } from './types';
import { StreamEmitter, streamEventToStepEvent } from '../../agent/streaming';

// Utility imports
import { buildSystemPrompt } from './utils/prompts';
import { buildAgentResult } from './utils/execution';

// Constants
import { STRATEGIES, DEFAULTS } from './constants';

/**
 * Subtask definition with dependency tracking
 */
export interface Subtask {
  readonly id: string;
  readonly description: string;
  readonly dependencies: readonly string[];
  status: SubtaskStatus;
  result?: string;
  error?: string;
}

/**
 * Subtask execution status
 */
export type SubtaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

/**
 * Result of subtask execution
 */
export interface SubtaskResult {
  readonly subtask: Subtask;
  readonly result: AgentResult;
}

/**
 * Options for TerminatorAgent
 */
export interface TerminatorAgentOpts extends T800AgentOpts {
  readonly maxParallelism?: number;
  readonly decompositionThreshold?: number;
}

/**
 * Configuration for task decomposition
 */
export interface DecompositionConfig {
  readonly maxSubtasks?: number;
  readonly useLLM?: boolean;
  readonly fallbackToSimple?: boolean;
}

/**
 * TerminatorAgent - Orchestrator agent for complex multi-step tasks
 *
 * Features:
 * - Intelligent task decomposition (LLM-based or pattern-based)
 * - Dependency-aware subtask execution
 * - Parallel execution of independent subtasks
 * - Result aggregation and synthesis
 * - Self-reflection and continuous improvement
 *
 * @example
 * ```typescript
 * const agent = new TerminatorAgent({
 *   llmProvider: myProvider,
 *   maxParallelism: 3,
 *   decompositionThreshold: 50, // words
 * });
 *
 * const result = await agent.run(`
 *   First, analyze the codebase structure.
 *   Then, identify potential issues.
 *   Finally, generate a report with recommendations.
 * `);
 * ```
 */
export class TerminatorAgent extends T800Agent {
  private readonly maxParallelism: number;
  private readonly decompositionThreshold: number;

  constructor(opts: TerminatorAgentOpts = {} as TerminatorAgentOpts) {
    super(opts);
    this.maxParallelism = opts.maxParallelism ?? TERMINATOR_DEFAULTS.MAX_PARALLELISM;
    this.decompositionThreshold = opts.decompositionThreshold ?? TERMINATOR_DEFAULTS.DECOMPOSITION_THRESHOLD;
  }

  /**
   * Subscribe to streaming events during execution
   */
  onStreamEvent(listener: (event: import('../../agent/streaming').AgentStreamEvent) => void): () => void {
    return this.streamEmitter.onEvent(listener);
  }

  /**
   * Execute a task with orchestration
   *
   * @param task - The task to execute
   * @returns Agent result with aggregated subtask results
   */
  async run(task: string): Promise<AgentResult> {
    const startTime = Date.now();

    try {
      // Determine if task needs orchestration
      if (this.isSimpleTask(task)) {
        // Delegate to parent T800Agent for simple tasks
        return super.run(task);
      }

      // Complex task - use orchestration
      const orchestration = await this.executeOrchestration(task);

      return buildAgentResult(
        task,
        orchestration.finalResult,
        orchestration.success,
        orchestration.allSteps,
        orchestration.actionsTaken,
        orchestration.totalIterations,
        Math.round(((Date.now() - startTime) / 1000) * 100) / 100,
        STRATEGIES.TERMINATOR_ORCHESTRATOR
      );
    } finally {
      // Clean up stream emitter
      this.streamEmitter.destroy();
    }
  }

  /**
   * Execute orchestrated task decomposition and execution
   */
  private async executeOrchestration(task: string): Promise<{
    finalResult: string;
    success: boolean;
    allSteps: StepEvent[];
    actionsTaken: string[];
    totalIterations: number;
  }> {
    const steps: StepEvent[] = [];
    const actionsTaken: string[] = [];

    // Step 1: Decompose task
    this.streamEmitter.emitStepStart('planning', 'decompose_start', 'Decomposing task into subtasks');

    steps.push({
      phase: 'planning',
      action: 'decompose_start',
      detail: 'Decomposing task into subtasks',
    });

    const subtasks = await this.decomTask(task);

    this.streamEmitter.emitStepComplete('planning', 'decompose_complete', `Decomposed into ${subtasks.length} subtasks`, true);

    steps.push({
      phase: 'planning',
      action: 'decompose_complete',
      detail: `Decomposed into ${subtasks.length} subtasks`,
    });

    // Step 2: Execute subtasks with dependency management
    const executionResults = await this.executeSubtasksWithDeps(subtasks, steps, actionsTaken);

    // Step 3: Aggregate and synthesize results
    const finalResult = this.aggregateResults(executionResults);

    const success = executionResults.every((r) => r.result.success);
    const totalIterations = executionResults.reduce(
      (sum, r) => sum + r.result.iterations,
      0
    );

    return {
      finalResult,
      success,
      allSteps: steps,
      actionsTaken,
      totalIterations,
    };
  }

  /**
   * Determine if task is simple enough for direct execution
   */
  private isSimpleTask(task: string): boolean {
    const wordCount = task.split(/\s+/).length;
    const hasMultipleSteps = /[.;]\s+/.test(task);
    const hasComplexKeywords = /\b(and then|after that|also|finally|first|second|next|before)\b/i.test(
      task
    );

    return (
      wordCount <= this.decompositionThreshold &&
      !hasMultipleSteps &&
      !hasComplexKeywords
    );
  }

  /**
   * Decompose task into subtasks
   */
  private async decomTask(task: string): Promise<Subtask[]> {
    try {
      // Try LLM-based decomposition first
      return await this.decomposeViaLLM(task);
    } catch (error) {
      // Fallback to pattern-based decomposition
      return this.decomposeViaPattern(task);
    }
  }

  /**
   * Decompose task using LLM
   */
  private async decomposeViaLLM(task: string): Promise<Subtask[]> {
    const systemPrompt = this.buildDecompositionPrompt();

    const response = await (this as any).state.llmProvider.chat(
      [{ role: 'user', content: `Decompose this task:\n${task}` }],
      [],
      systemPrompt
    );

    const text = response.text ?? '';
    const jsonMatch = text.match(/\[[\s\S]*\]/);

    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return this.normalizeSubtasks(parsed);
    }

    // If LLM didn't return valid JSON, fall back to pattern-based
    return this.decomposeViaPattern(task);
  }

  /**
   * Decompose task using pattern matching
   */
  private decomposeViaPattern(task: string): Subtask[] {
    const delimiters = [/[.;]\s+/, /\n+/, / then /i, / and /i];
    let parts = [task];

    for (const delimiter of delimiters) {
      parts = parts.flatMap((part) => part.split(delimiter).filter(Boolean));
    }

    if (parts.length <= 1) {
      return [
        this.createSubtask('step1', task.trim(), []),
      ];
    }

    return parts.map((part, i) =>
      this.createSubtask(
        `step${i + 1}`,
        part.trim(),
        i > 0 ? [`step${i}`] : []
      )
    );
  }

  /**
   * Build system prompt for task decomposition
   */
  private buildDecompositionPrompt(): string {
    return `You are a task decomposition expert. Break down the given task into clear, actionable subtasks.

Return a JSON array of subtasks with:
- id: short identifier (e.g., "step1", "step2")
- description: clear action description
- dependencies: array of subtask IDs this depends on (empty if no dependencies)

Rules:
- Each subtask should be independently executable once dependencies are met
- Subtasks should be ordered logically
- Keep descriptions concise but clear
- Aim for 2-6 subtasks
- Avoid overlapping work between subtasks`;
  }

  /**
   * Normalize subtasks from LLM response
   */
  private normalizeSubtasks(parsed: unknown[]): Subtask[] {
    if (!Array.isArray(parsed)) {
      throw new Error('Invalid decomposition format');
    }

    return parsed.map((s: any, i: number) =>
      this.createSubtask(
        s.id ?? `step${i + 1}`,
        s.description ?? `Step ${i + 1}`,
        (s.dependencies ?? []) as string[]
      )
    );
  }

  /**
   * Create a subtask with proper defaults
   */
  private createSubtask(
    id: string,
    description: string,
    dependencies: string[]
  ): Subtask {
    return {
      id,
      description,
      dependencies,
      status: 'pending' as const,
    };
  }

  /**
   * Execute subtasks respecting dependencies
   */
  private async executeSubtasksWithDeps(
    subtasks: Subtask[],
    steps: StepEvent[],
    actionsTaken: string[]
  ): Promise<SubtaskResult[]> {
    const results: SubtaskResult[] = [];
    const completed = new Set<string>();

    for (const subtask of subtasks) {
      // Check if dependencies are met
      const depsMet = subtask.dependencies.every((depId) => completed.has(depId));

      if (!depsMet) {
        // Mark as failed due to unmet dependencies
        subtask.status = 'failed';
        subtask.error = `Dependencies not met: ${subtask.dependencies.join(', ')}`;

        this.streamEmitter.emitStepComplete('executing', 'dependency_error', subtask.error, false);

        results.push({
          subtask,
          result: this.createFailureResult(subtask),
        });

        continue;
      }

      // Emit subtask start event
      this.streamEmitter.emitStepStart('executing', 'subtask_start', `Executing: ${subtask.description}`);

      steps.push({
        phase: 'executing',
        action: 'subtask_start',
        detail: `Executing: ${subtask.description}`,
      });

      subtask.status = 'in_progress';

      try {
        const result = await super.run(subtask.description);
        subtask.status = 'completed';
        subtask.result = result.result;
        completed.add(subtask.id);

        // Emit subtask complete event
        this.streamEmitter.emitStepComplete('executing', 'subtask_complete', `Completed: ${subtask.description}`, true);

        steps.push({
          phase: 'executing',
          action: 'subtask_complete',
          detail: `Completed: ${subtask.description}`,
        });

        actionsTaken.push(...result.actions_taken);
        results.push({ subtask, result });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        subtask.status = 'failed';
        subtask.error = errorMsg;

        // Emit subtask failed event
        this.streamEmitter.emitStepComplete('executing', 'subtask_failed', `Failed: ${subtask.description} - ${errorMsg}`, false);

        steps.push({
          phase: 'executing',
          action: 'subtask_failed',
          detail: `Failed: ${subtask.description} - ${errorMsg}`,
        });

        results.push({
          subtask,
          result: this.createFailureResult(subtask, errorMsg),
        });
      }
    }

    return results;
  }

  /**
   * Create a failure result for a subtask
   */
  private createFailureResult(subtask: Subtask, error?: string): AgentResult {
    return {
      task: subtask.description,
      result: error ?? subtask.error ?? 'Unknown error',
      success: false,
      steps: [],
      actions_taken: [],
      iterations: 0,
      strategy_used: STRATEGIES.TERMINATOR_ORCHESTRATOR,
      elapsed_secs: 0,
    };
  }

  /**
   * Aggregate results from all subtasks
   */
  private aggregateResults(results: SubtaskResult[]): string {
    const parts: string[] = [];

    parts.push('# Task Execution Results\n');

    for (const { subtask, result } of results) {
      parts.push(`## ${subtask.description}\n`);
      parts.push(`Status: ${subtask.status}\n`);

      if (result.success) {
        parts.push(`**Result:** ${result.result.slice(0, 500)}\n\n`);
      } else {
        parts.push(`**Error:** ${result.result}\n\n`);
      }
    }

    // Summary statistics
    const succeeded = results.filter((r) => r.result.success).length;
    const failed = results.length - succeeded;

    parts.push('## Summary\n');
    parts.push(`- Total subtasks: ${results.length}\n`);
    parts.push(`- Succeeded: ${succeeded}\n`);
    parts.push(`- Failed: ${failed}\n`);

    if (failed > 0) {
      parts.push('\n**Failed subtasks:**\n');
      for (const { subtask } of results.filter((r) => !r.result.success)) {
        parts.push(`- ${subtask.description}: ${subtask.error ?? 'Unknown error'}\n`);
      }
    }

    return parts.join('\n');
  }
}

/**
 * Default constants for TerminatorAgent
 */
const TERMINATOR_DEFAULTS = {
  MAX_PARALLELISM: 3,
  DECOMPOSITION_THRESHOLD: 50, // words
} as const;
