/**
 * Electron Tool Types
 *
 * Based on kimi-code's tool system with proper:
 * - ExecutableTool interface
 * - ToolExecution with approval rules
 * - Display metadata for UI
 * - Signal handling for cancellation
 */

import type { ToolAccesses } from './tool-access';

export type { ToolAccesses };

export interface ToolUpdate {
  kind: 'stdout' | 'stderr' | 'progress' | 'status' | 'custom';
  text?: string;
  percent?: number;
  customKind?: string;
  customData?: unknown;
}

export interface ExecutableToolContext {
  readonly turnId: string;
  readonly toolCallId: string;
  readonly signal: AbortSignal;
  readonly onUpdate?: (update: ToolUpdate) => void;
}

export interface ToolInputDisplay {
  readonly kind: string;
  readonly [key: string]: unknown;
}

export interface RunnableToolExecution {
  readonly accesses?: ToolAccesses;
  readonly display?: ToolInputDisplay;
  readonly description?: string;
  readonly stopBatchAfterThis?: boolean;
  readonly approvalRule: string;
  readonly matchesRule?: (ruleArgs: string) => boolean;
  readonly execute: (ctx: ExecutableToolContext) => Promise<ExecutableToolResult>;
}

export interface ExecutableToolErrorResult {
  readonly output: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
  readonly isError: true;
  readonly message?: string;
  readonly stopTurn?: boolean;
}

export interface ExecutableToolSuccessResult {
  readonly output: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
  readonly isError?: false;
  readonly message?: string;
  readonly stopTurn?: boolean;
}

export type ExecutableToolResult = ExecutableToolSuccessResult | ExecutableToolErrorResult;

export type ToolExecution = RunnableToolExecution | ExecutableToolErrorResult;

/**
 * Base interface for all tools in the Electron agent
 */
export interface BuiltinTool<TInput = unknown> {
  readonly name: string;
  readonly description: string;
  readonly parameters: Record<string, unknown>;
  resolveExecution(input: TInput): ToolExecution | Promise<ToolExecution>;
}

/**
 * Convert ExecutableToolResult to simple result format for ToolBus
 */
export function toToolBusResult(result: ExecutableToolResult): {
  success: boolean;
  output: unknown;
  error?: string;
} {
  if (result.isError) {
    return {
      success: false,
      output: result.output,
      error: typeof result.output === 'string' ? result.output : 'Tool execution failed'
    };
  }
  return {
    success: true,
    output: result.output
  };
}

/**
 * Create approval rule pattern for tool names
 */
export function literalRulePattern(toolName: string, subject: string): string {
  return `${toolName}:${subject}`;
}

/**
 * Check if rule args match subject (for glob patterns)
 */
export function matchesGlobRuleSubject(ruleArgs: string, subject: string): boolean {
  // Simple glob matching - can be enhanced with picomatch
  const pattern = ruleArgs.replace(/\*/g, '.*');
  const regex = new RegExp(`^${pattern}$`);
  return regex.test(subject);
}
