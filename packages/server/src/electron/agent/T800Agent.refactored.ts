/**
 * T800Agent - Direct execution agent with comprehensive tool suite
 *
 * Refactored to senior-level craft with:
 * - Separated concerns (conversation, prompts, execution, config)
 * - Strongly typed interfaces
 * - Single responsibility principle
 * - Dependency injection
 * - Comprehensive error handling
 * - Performance optimizations
 */

// Type imports
import type { AgentResult, StepEvent, LLMResponse, ToolCall } from '../../core/types';
import type { LLMProvider } from '../../llm/provider';
import type { BaseMemoryStrategy } from '../../memory/strategy';
import type { SkillEngine } from '../../skills/engine';
import type { SkillSearchEngine } from '../../skills/search';
import type { ToolBus } from '../../agent/tools/bus';
import type { AgentLoop } from '../../agent/loop';

// Local type imports
import type {
  T800AgentOpts,
  AgentMessage,
  SystemPromptContext,
  LLMChatResponse,
  AgentInternalState,
} from './types';

// Utility imports
import { ConversationManager } from './utils/conversation';
import { buildSystemPrompt, buildErrorRecoveryPrompt } from './utils/prompts';
import {
  executeToolCall,
  createStepFromToolCall,
  shouldTriggerErrorRecovery,
  buildAgentResult,
  buildErrorResult,
  buildCancelledResult,
  buildMaxIterationsResult,
  isSuccessfulResult,
} from './utils/execution';
import {
  resolveAgentOptions,
  calculateMaxIterations,
  buildToolConfig,
  validateWorkingDirectory,
} from './utils/config';

// Constants
import {
  ERROR_MESSAGES,
  LOG_CONTEXTS,
  STRATEGIES,
  DEFAULTS,
  TOOL_CATEGORIES,
} from './constants';

// Core imports
import { loadSoul } from '../../agent/prompts/soul';
import { initializeT800Tools } from '../tools';
import logger from '../../core/logging';

/**
 * T800Agent - Comprehensive agent for direct task execution
 *
 * This agent provides a unified interface for task execution with:
 * - All tools (Browser, Shell, File, Web, Skills, Document, Coding)
 * - Intelligent error recovery
 * - Memory integration
 * - Skill execution
 * - Proper cancellation support
 *
 * @example
 * ```typescript
 * const agent = new T800Agent({
 *   llmProvider: myProvider,
 *   memory: myMemory,
 *   workingDirectory: '/workspace',
 * });
 *
 * const result = await agent.run('Analyze the code in src/');
 * console.log(result.result);
 * ```
 */
export class T800Agent {
  private readonly state: AgentInternalState;
  private readonly conversation: ConversationManager;
  private readonly startTime: number = 0;

  constructor(opts: T800AgentOpts) {
    // Resolve options with defaults
    const resolvedOpts = resolveAgentOptions(opts);

    // Initialize internal state
    this.state = {
      llmProvider: resolvedOpts.llmProvider,
      memory: resolvedOpts.memory,
      skillEngine: resolvedOpts.skillEngine,
      skillSearch: resolvedOpts.skillSearch,
      agentLoop: resolvedOpts.agentLoop,
      toolBus: resolvedOpts.toolBus,
      conversation: [],
      maxIterations: calculateMaxIterations(),
      soul: '',
      workingDirectory: resolvedOpts.workingDirectory,
      headless: resolvedOpts.headless,
      toolsInitialized: false,
      cancelled: false,
    };

    // Initialize conversation manager
    this.conversation = new ConversationManager();

    // Initialize tools
    this.initializeTools(buildToolConfig(resolvedOpts));
  }

  /**
   * Execute a task and return the result
   *
   * @param task - The task to execute
   * @returns Agent result with steps, actions taken, and outcome
   */
  async run(task: string): Promise<AgentResult> {
    const startTime = Date.now();
    const steps: StepEvent[] = [];
    const actionsTaken: string[] = [];
    let finalResult = '';
    let success = false;
    let iteration = 0;
    this.state.cancelled = false;

    try {
      await this.initializeExecution();

      this.conversation.addUserMessage(task);

      let done = false;

      while (!this.isExecutionComplete(done, iteration) && !this.state.cancelled) {
        iteration++;

        const context = this.buildSystemPromptContext(task, iteration);
        const response = await this.executeLLM(context);

        if (response.tool_calls?.length) {
          const results = await this.executeToolCalls(response.tool_calls, steps);
          actionsTaken.push(...results.actions);

          if (response.text) {
            this.conversation.addAssistantMessage(response.text);
          }
        } else {
          finalResult = response.text ?? '';
          done = true;

          this.conversation.addAssistantMessage(finalResult);

          steps.push({
            phase: 'done',
            action: 'response',
            detail: finalResult,
          });
        }

        if (!done && this.shouldAttemptRecovery(steps)) {
          this.conversation.addSystemMessage(buildErrorRecoveryPrompt(2));
        }
      }

      if (!done && !finalResult && !this.state.cancelled) {
        finalResult = ERROR_MESSAGES.MAX_ITERATIONS;
      }

      success = this.determineSuccess(finalResult);

      await this.finalizeExecution(task, finalResult, success);
    } catch (error) {
      if (this.state.cancelled) {
        return buildCancelledResult(task, steps, actionsTaken, iteration, this.getElapsedSeconds());
      }

      logger.error(
        { err: error instanceof Error ? error.message : String(error) },
        LOG_CONTEXTS.LOOP_ERROR
      );

      return buildErrorResult(
        task,
        error instanceof Error ? error : new Error(String(error)),
        steps,
        actionsTaken,
        iteration,
        this.getElapsedSeconds()
      );
    }

    return buildAgentResult(
      task,
      finalResult,
      success,
      steps,
      actionsTaken,
      iteration,
      this.getElapsedSeconds()
    );
  }

  /**
   * Cancel the current execution
   */
  cancel(): void {
    this.state.cancelled = true;
  }

  /**
   * Get the conversation history
   */
  getConversation(): AgentMessage[] {
    return this.conversation.getAllMessages();
  }

  /**
   * Get the current working directory
   */
  getWorkingDirectory(): string {
    return this.state.workingDirectory;
  }

  /**
   * Set a new working directory
   *
   * @param dir - New working directory path
   */
  async setWorkingDirectory(dir: string): Promise<void> {
    await validateWorkingDirectory(dir);
    this.state.workingDirectory = dir;
  }

  // Private methods

  /**
   * Initialize tools if not already done
   */
  private initializeTools(config: ReturnType<typeof buildToolConfig>): void {
    if (this.state.toolsInitialized) return;

    initializeT800Tools(this.state.toolBus, config);
    this.state.toolsInitialized = true;
  }

  /**
   * Initialize execution state
   */
  private async initializeExecution(): Promise<void> {
    this.state.soul = loadSoul();

    if (this.state.memory) {
      await this.state.memory.onTurnStart();
    }
  }

  /**
   * Build system prompt context
   */
  private buildSystemPromptContext(task: string, iteration: number): SystemPromptContext {
    const memoryContext = this.state.memory?.context(task) ?? '';
    const skillSummaries = this.state.skillEngine?.getSkillSummaries() ?? '';

    return {
      task,
      iteration,
      maxIterations: this.state.maxIterations,
      workspace: this.state.workingDirectory,
      soul: this.state.soul || undefined,
      memoryContext: memoryContext || undefined,
      skillSummaries: skillSummaries || undefined,
    };
  }

  /**
   * Execute LLM chat
   */
  private async executeLLM(context: SystemPromptContext): Promise<LLMResponse> {
    const systemPrompt = buildSystemPrompt(context);
    const messages = this.conversation.getRecentMessages(DEFAULTS.CONVERSATION_WINDOW_SIZE);
    const tools = this.state.toolBus.getDefinitions();

    try {
      return await this.state.llmProvider.chat(messages, tools, systemPrompt);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);

      logger.error({ err: errorMsg, iteration: context.iteration }, LOG_CONTEXTS.LLM_FAILED);

      return { text: `${ERROR_MESSAGES.LLM_ERROR}: ${errorMsg}`, tool_calls: [], done: true };
    }
  }

  /**
   * Execute tool calls
   */
  private async executeToolCalls(
    toolCalls: Array<{ id: string; name: string; arguments: Record<string, unknown> }>,
    steps: StepEvent[]
  ): Promise<{ success: boolean; actions: string[] }> {
    const actions: string[] = [];

    for (const toolCall of toolCalls) {
      if (this.state.cancelled) break;

      const result = await executeToolCall(
        this.state.toolBus,
        toolCall.name,
        toolCall.arguments,
        toolCall.id
      );

      steps.push(createStepFromToolCall(toolCall.name, toolCall.arguments, result));

      this.conversation.addToolResult(
        toolCall.id,
        toolCall.name,
        result.success ? (result.output ?? '') : (result.error ?? ERROR_MESSAGES.TOOL_ERROR)
      );

      actions.push(toolCall.name);
    }

    return { success: true, actions };
  }

  /**
   * Check if execution is complete
   */
  private isExecutionComplete(done: boolean, iteration: number): boolean {
    return done || iteration >= this.state.maxIterations;
  }

  /**
   * Check if error recovery should be attempted
   */
  private shouldAttemptRecovery(steps: StepEvent[]): boolean {
    return shouldTriggerErrorRecovery(steps);
  }

  /**
   * Determine if execution was successful
   */
  private determineSuccess(result: string): boolean {
    return (
      !this.state.cancelled &&
      result.length > 0 &&
      isSuccessfulResult(result)
    );
  }

  /**
   * Finalize execution (save to memory, cleanup)
   */
  private async finalizeExecution(
    task: string,
    result: string,
    success: boolean
  ): Promise<void> {
    try {
      if (this.state.memory && success) {
        this.state.memory.write(
          'memory',
          `Task: ${task}\nResult: ${result.slice(0, DEFAULTS.MAX_OUTPUT_LENGTH_FOR_MEMORY)}`,
          { category: 't800_task', success }
        );
      }

      if (this.state.memory) {
        await this.state.memory.onSessionEnd();
      }
    } catch (err) {
      logger.warn(
        { err: (err as Error).message },
        LOG_CONTEXTS.POST_TASK_ERROR
      );
    }
  }

  /**
   * Get elapsed time in seconds
   */
  private getElapsedSeconds(): number {
    return Math.round(((Date.now() - this.startTime) / 1000) * 100) / 100;
  }
}

// Re-export types for convenience
export type { T800AgentOpts, AgentMessage } from './types';
