/**
 * Type definitions for T-800 Agent
 *
 * Centralized type definitions to improve type safety
 * and provide better IDE support.
 */

import type { AgentResult, StepEvent } from '../../core/types';
import type { LLMProvider } from '../../llm/provider';
import type { BaseMemoryStrategy } from '../../memory/strategy';
import type { SkillEngine } from '../../skills/engine';
import type { SkillSearchEngine } from '../../skills/search';
import type { AgentLoop } from '../../agent/loop';
import type { ToolBus } from '../../agent/tools/bus';

/**
 * Message format for conversation history
 * Compatible with OpenAI message format
 */
export interface AgentMessage {
  readonly role: 'user' | 'assistant' | 'system' | 'tool';
  readonly content: string;
  readonly toolCallId?: string;
  readonly toolName?: string;
}

/**
 * Configuration options for T800Agent
 */
export interface T800AgentOpts {
  /** LLM provider for chat completions */
  llmProvider: LLMProvider;

  /** Optional memory strategy for context management */
  memory?: BaseMemoryStrategy;

  /** Optional skill engine for skill operations */
  skillEngine?: SkillEngine;

  /** Optional skill search for skill discovery */
  skillSearch?: SkillSearchEngine;

  /** Optional agent loop for skill execution */
  agentLoop?: AgentLoop;

  /** Optional tool bus (creates new one if not provided) */
  toolBus?: ToolBus;

  /** Browser headless mode (default: true) */
  headless?: boolean;

  /** Working directory for file operations (default: process.cwd()) */
  workingDirectory?: string;

  /** Tool enablement flags (default: all enabled) */
  enableShellTools?: boolean;
  enableBrowserTools?: boolean;
  enableFileTools?: boolean;
  enableWebTools?: boolean;
  enableSkillsTools?: boolean;
  enableDocumentTools?: boolean;
  enableCodingTools?: boolean;
}

/**
 * Internal agent state (not exposed externally)
 */
export interface AgentInternalState {
  readonly llmProvider: LLMProvider;
  readonly memory: BaseMemoryStrategy | null;
  readonly skillEngine: SkillEngine | null;
  readonly skillSearch: SkillSearchEngine | null;
  readonly agentLoop: AgentLoop | null;
  toolBus: ToolBus;
  conversation: AgentMessage[];
  maxIterations: number;
  soul: string;
  workingDirectory: string;
  headless: boolean;
  toolsInitialized: boolean;
  cancelled: boolean;
}

/**
 * Result of an agent execution step
 */
export interface ExecutionStep {
  result: AgentResult;
  error?: Error;
}

/**
 * Tool execution result with metadata
 */
export interface ToolExecutionResult {
  readonly success: boolean;
  readonly output: string;
  readonly error?: string;
  readonly toolName: string;
  readonly duration?: number;
}

/**
 * Configuration for tool initialization
 */
export interface ToolConfig {
  cwd: string;
  enableShellTools: boolean;
  enableBrowserTools: boolean;
  enableFileTools: boolean;
  enableWebTools: boolean;
  enableSkillsTools: boolean;
  enableDocumentTools: boolean;
  enableCodingTools: boolean;
  skillDeps?: {
    skillEngine?: SkillEngine;
    skillSearch?: SkillSearchEngine;
    runSkill?: (name: string) => Promise<unknown>;
  };
}

/**
 * System prompt components
 */
export interface SystemPromptContext {
  readonly task: string;
  readonly iteration: number;
  readonly maxIterations: number;
  readonly workspace: string;
  readonly soul?: string;
  readonly memoryContext?: string;
  readonly skillSummaries?: string;
}

/**
 * LLM chat response
 */
export interface LLMChatResponse {
  readonly text?: string;
  readonly tool_calls?: Array<{
    readonly id: string;
    readonly name: string;
    readonly arguments: Record<string, unknown>;
  }>;
}
