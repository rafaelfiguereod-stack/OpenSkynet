/**
 * Execution utilities
 *
 * Handles tool execution, error detection, and step tracking.
 */

import type { StepEvent, AgentResult } from '../../../core/types';
import type { ToolBus } from '../../../agent/tools/bus';
import { ERROR_MESSAGES, DEFAULTS, LOG_CONTEXTS, STRATEGIES } from '../constants';
import logger from '../../../core/logging';

/**
 * Result of a tool execution attempt
 */
export interface ToolExecutionAttempt {
  readonly success: boolean;
  readonly output?: string;
  readonly error?: string;
}

/**
 * Execute a tool call and return the result
 */
export async function executeToolCall(
  toolBus: ToolBus,
  toolName: string,
  toolArgs: Record<string, unknown>,
  toolCallId: string
): Promise<ToolExecutionAttempt> {
  try {
    const result = await toolBus.execute(toolName, toolArgs);

    return {
      success: result.success,
      output: result.output,
      error: result.error,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(
      { err: errorMessage, tool: toolName },
      'tool_execution_failed'
    );

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Create a step event from tool execution
 */
export function createStepFromToolCall(
  toolName: string,
  toolArgs: Record<string, unknown>,
  result: ToolExecutionAttempt
): StepEvent {
  return {
    phase: 'executing',
    action: toolName,
    detail: JSON.stringify(toolArgs),
    observation: result.success ? result.output : result.error,
  };
}

/**
 * Detect errors in recent steps
 */
export function detectErrorsInSteps(steps: StepEvent[]): number {
  const recentSteps = steps.slice(-DEFAULTS.ERROR_DETECTION_WINDOW);

  return recentSteps.filter((step) => {
    const observation = step.observation;
    return (
      typeof observation === 'string' &&
      (observation.includes('Error') || observation.includes('failed'))
    );
  }).length;
}

/**
 * Check if should trigger error recovery
 */
export function shouldTriggerErrorRecovery(steps: StepEvent[]): boolean {
  return detectErrorsInSteps(steps) >= DEFAULTS.ERROR_DETECTION_THRESHOLD;
}

/**
 * Build final agent result
 */
export function buildAgentResult(
  task: string,
  finalResult: string,
  success: boolean,
  steps: StepEvent[],
  actionsTaken: string[],
  iterations: number,
  elapsedSecs: number,
  strategy: string = STRATEGIES.T800_AGENT
): AgentResult {
  return {
    task,
    result: finalResult,
    success,
    steps,
    actions_taken: actionsTaken,
    iterations,
    strategy_used: strategy,
    elapsed_secs: Math.round(elapsedSecs * 100) / 100,
  };
}

/**
 * Build error result
 */
export function buildErrorResult(
  task: string,
  error: Error,
  steps: StepEvent[],
  actionsTaken: string[],
  iterations: number,
  elapsedSecs: number
): AgentResult {
  const errorMessage = error instanceof Error ? error.message : String(error);

  return {
    task,
    result: `${ERROR_MESSAGES.AGENT_ERROR}: ${errorMessage}`,
    success: false,
    steps,
    actions_taken: actionsTaken,
    iterations,
    strategy_used: STRATEGIES.T800_AGENT,
    elapsed_secs: Math.round(elapsedSecs * 100) / 100,
  };
}

/**
 * Build cancelled result
 */
export function buildCancelledResult(
  task: string,
  steps: StepEvent[],
  actionsTaken: string[],
  iterations: number,
  elapsedSecs: number
): AgentResult {
  return {
    task,
    result: ERROR_MESSAGES.AGENT_CANCELLED,
    success: false,
    steps,
    actions_taken: actionsTaken,
    iterations,
    strategy_used: STRATEGIES.T800_AGENT,
    elapsed_secs: Math.round(elapsedSecs * 100) / 100,
  };
}

/**
 * Build max iterations result
 */
export function buildMaxIterationsResult(
  task: string,
  steps: StepEvent[],
  actionsTaken: string[],
  iterations: number,
  elapsedSecs: number
): AgentResult {
  return {
    task,
    result: ERROR_MESSAGES.MAX_ITERATIONS,
    success: false,
    steps,
    actions_taken: actionsTaken,
    iterations,
    strategy_used: STRATEGIES.T800_AGENT,
    elapsed_secs: Math.round(elapsedSecs * 100) / 100,
  };
}

/**
 * Validate result success
 */
export function isSuccessfulResult(result: string): boolean {
  return (
    result.length > 0 &&
    !result.startsWith(`${ERROR_MESSAGES.AGENT_CANCELLED}:`) &&
    !result.startsWith(`${ERROR_MESSAGES.LLM_ERROR}:`)
  );
}
