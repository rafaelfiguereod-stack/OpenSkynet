/**
 * System prompt generation utilities
 *
 * Builds context-aware system prompts for the agent.
 */

import type { SystemPromptContext } from '../types';
import { TOOL_CATEGORIES, STRATEGIES } from '../constants';

/**
 * Generate system prompt for T-800 agent
 */
export function buildSystemPrompt(context: SystemPromptContext): string {
  const parts: string[] = [];

  // Add soul/personality if available
  if (context.soul) {
    parts.push(context.soul);
  }

  // Add agent header and iteration info
  parts.push(buildHeader(context));

  // Add tool descriptions
  parts.push(buildToolDescriptions());

  // Add memory context if available
  if (context.memoryContext) {
    parts.push(buildMemorySection(context.memoryContext));
  }

  // Add skill summaries if available
  if (context.skillSummaries) {
    parts.push(buildSkillsSection(context.skillSummaries));
  }

  // Add execution guidance
  parts.push(buildExecutionGuidance());

  return parts.join('\n');
}

/**
 * Build agent header section
 */
function buildHeader(context: SystemPromptContext): string {
  return `
T-800 Agent - Direct Task Execution
Iteration: ${context.iteration}/${context.maxIterations}
Workspace: ${context.workspace}
`.trim();
}

/**
 * Build tool descriptions section
 */
function buildToolDescriptions(): string {
  const tools = Object.values(TOOL_CATEGORIES);
  return '\nAvailable Tools:\n' + tools.join('\n');
}

/**
 * Build memory context section
 */
function buildMemorySection(memoryContext: string): string {
  return `\nRelevant memories:\n${memoryContext}`;
}

/**
 * Build skills section
 */
function buildSkillsSection(skillSummaries: string): string {
  return `\nAvailable skills:\n${skillSummaries}`;
}

/**
 * Build execution guidance section
 */
function buildExecutionGuidance(): string {
  return '\nSelect the appropriate tool for each step of the task. Use tools efficiently to complete the task.';
}

/**
 * Build error recovery prompt
 */
export function buildErrorRecoveryPrompt(errorCount: number): string {
  if (errorCount >= 2) {
    return 'Multiple errors detected. Consider trying alternative approach.';
  }
  return '';
}

/**
 * Build completion message
 */
export function buildCompletionMessage(task: string, result: string): string {
  return `Task completed: ${task}\nResult: ${result.slice(0, 100)}${result.length > 100 ? '...' : ''}`;
}

/**
 * Build error message
 */
export function buildErrorMessage(error: Error): string {
  return `Error: ${error.message}`;
}
