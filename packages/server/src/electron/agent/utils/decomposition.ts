/**
 * Task decomposition strategies
 *
 * Provides different strategies for breaking down complex tasks
 * into manageable subtasks.
 */

import type { Subtask } from '../TerminatorAgent';
import type { LLMProvider } from '../../../llm/provider';

/**
 * Result of a task decomposition
 */
export interface DecompositionResult {
  readonly subtasks: Subtask[];
  readonly strategy: DecompositionStrategy;
  readonly confidence: number;
}

/**
 * Decomposition strategy types
 */
export type DecompositionStrategy = 'llm' | 'pattern' | 'hybrid';

/**
 * Decompose a task into subtasks using the specified strategy
 */
export async function decomposeTask(
  task: string,
  llmProvider: LLMProvider,
  strategy: DecompositionStrategy = 'hybrid'
): Promise<DecompositionResult> {
  switch (strategy) {
    case 'llm':
      return decomposeViaLLM(task, llmProvider);
    case 'pattern':
      return decomposeViaPattern(task);
    case 'hybrid':
      return decomposeHybrid(task, llmProvider);
  }
}

/**
 * Decompose task using LLM
 */
async function decomposeViaLLM(
  task: string,
  llmProvider: LLMProvider
): Promise<DecompositionResult> {
  const systemPrompt = `You are a task decomposition expert. Break down the given task into clear, actionable subtasks.

Return a JSON array of subtasks with:
- id: short identifier (e.g., "step1", "step2")
- description: clear action description
- dependencies: array of subtask IDs this depends on (empty array if no dependencies)

Rules:
- Each subtask should be independently executable once dependencies are met
- Subtasks should be ordered logically
- Keep descriptions concise but clear
- Aim for 2-6 subtasks
- Avoid overlapping work between subtasks
- Output ONLY valid JSON, no explanation text`;

  try {
    const response = await llmProvider.chat(
      [{ role: 'user', content: `Decompose this task:\n${task}` }],
      [],
      systemPrompt
    );

    const text = response.text ?? '';
    const jsonMatch = text.match(/\[[\s\S]*\]/);

    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const subtasks = normalizeSubtasks(parsed);
      return {
        subtasks,
        strategy: 'llm',
        confidence: 0.9,
      };
    }

    throw new Error('Failed to parse LLM response');
  } catch (error) {
    // Fall back to pattern-based decomposition
    return decomposeViaPattern(task);
  }
}

/**
 * Decompose task using pattern matching
 */
function decomposeViaPattern(task: string): DecompositionResult {
  const delimiters = [
    [/[.;]\s+/, 'period or semicolon'],
    [/\n+/, 'newlines'],
    [/ then /i, 'then keyword'],
    [/ and /i, 'and keyword'],
  ];

  let parts = [task];

  for (const [pattern, name] of delimiters) {
    const newParts: string[] = [];
    for (const part of parts) {
      newParts.push(...part.split(pattern).filter(Boolean));
    }
    parts = newParts.length > 1 ? newParts : parts;
  }

  if (parts.length <= 1) {
    return {
      subtasks: [createSubtask('step1', task.trim(), [])],
      strategy: 'pattern',
      confidence: 0.5,
    };
  }

  const subtasks = parts.map((part, i) =>
    createSubtask(
      `step${i + 1}`,
      part.trim(),
      i > 0 ? [`step${i}`] : []
    )
  );

  return {
    subtasks,
    strategy: 'pattern',
    confidence: 0.7,
  };
}

/**
 * Decompose task using hybrid approach (LLM with pattern fallback)
 */
async function decomposeHybrid(
  task: string,
  llmProvider: LLMProvider
): Promise<DecompositionResult> {
  try {
    // First try LLM decomposition
    const llmResult = await decomposeViaLLM(task, llmProvider);

    // Validate LLM result quality
    if (llmResult.subtasks.length >= 2 && llmResult.subtasks.length <= 6) {
      return llmResult;
    }

    // If LLM result is poor quality, fall back to pattern
    return decomposeViaPattern(task);
  } catch {
    // On any error, use pattern decomposition
    return decomposeViaPattern(task);
  }
}

/**
 * Normalize subtasks from various sources
 */
function normalizeSubtasks(parsed: unknown[]): Subtask[] {
  if (!Array.isArray(parsed)) {
    throw new Error('Invalid decomposition format');
  }

  return parsed.map((s: any, i: number) =>
    createSubtask(
      s.id ?? `step${i + 1}`,
      s.description ?? `Step ${i + 1}`,
      Array.isArray(s?.dependencies) ? s.dependencies : []
    )
  );
}

/**
 * Create a subtask with proper validation
 */
function createSubtask(
  id: string,
  description: string,
  dependencies: string[]
): Subtask {
  // Validate inputs
  if (!id || typeof id !== 'string') {
    id = `step${Date.now()}`;
  }

  if (!description || typeof description !== 'string') {
    description = 'Unnamed task';
  }

  if (!Array.isArray(dependencies)) {
    dependencies = [];
  }

  return {
    id,
    description: description.trim(),
    dependencies: dependencies.filter((d) => typeof d === 'string' && d.length > 0),
    status: 'pending',
  };
}

/**
 * Validate subtask dependencies for cycles
 */
export function validateDependencies(subtasks: Subtask[]): boolean {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  const hasCycle = (subtaskId: string): boolean => {
    if (recursionStack.has(subtaskId)) {
      return true; // Cycle detected
    }

    if (visited.has(subtaskId)) {
      return false; // Already checked
    }

    visited.add(subtaskId);
    recursionStack.add(subtaskId);

    const subtask = subtasks.find((s) => s.id === subtaskId);
    if (!subtask) return false;

    for (const depId of subtask.dependencies) {
      if (hasCycle(depId)) {
        return true;
      }
    }

    recursionStack.delete(subtaskId);
    return false;
  };

  for (const subtask of subtasks) {
    if (hasCycle(subtask.id)) {
      return false;
    }
  }

  return true;
}

/**
 * Sort subtasks topologically by dependencies
 */
export function sortSubtasksByDependencies(subtasks: Subtask[]): Subtask[] {
  const sorted: Subtask[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  const visit = (subtaskId: string): void => {
    if (visited.has(subtaskId)) return;
    if (visiting.has(subtaskId)) {
      throw new Error('Circular dependency detected');
    }

    visiting.add(subtaskId);

    const subtask = subtasks.find((s) => s.id === subtaskId);
    if (!subtask) return;

    // Visit dependencies first
    for (const depId of subtask.dependencies) {
      visit(depId);
    }

    visiting.delete(subtaskId);
    visited.add(subtaskId);
    sorted.push(subtask);
  };

  for (const subtask of subtasks) {
    if (!visited.has(subtask.id)) {
      visit(subtask.id);
    }
  }

  return sorted;
}
