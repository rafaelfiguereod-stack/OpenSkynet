/**
 * Constants for T-800 Agent
 *
 * Centralized configuration values to avoid magic strings/numbers
 * and provide easy configuration points.
 */

/** Default configuration values */
export const DEFAULTS = {
  /** Default maximum iterations before timeout */
  MAX_ITERATIONS_MULTIPLIER: 2,
  MAX_ITERATIONS_BASE: 10,

  /** Default browser mode */
  HEADLESS: true,

  /** Conversation history size */
  CONVERSATION_WINDOW_SIZE: 50,

  /** Error detection threshold */
  ERROR_DETECTION_WINDOW: 3,
  ERROR_DETECTION_THRESHOLD: 2,

  /** Output truncation limit for memory */
  MAX_OUTPUT_LENGTH_FOR_MEMORY: 500,
} as const;

/** Agent strategy identifiers */
export const STRATEGIES = {
  T800_AGENT: 't800_agent',
  TERMINATOR_ORCHESTRATOR: 'terminator_orchestrator',
} as const;

/** Message role constants */
export const MESSAGE_ROLES = {
  USER: 'user',
  ASSISTANT: 'assistant',
  SYSTEM: 'system',
  TOOL: 'tool',
} as const;

/** Tool categories for system prompt */
export const TOOL_CATEGORIES = {
  BROWSER: '1. Browser - Web automation (navigate, click, fill forms, screenshots)',
  SHELL: '2. Shell - Execute shell commands',
  FILE: '3. File - Read, write, list, create, delete, move, search files',
  WEB: '4. Web - Fetch URLs, search the web',
  SKILLS: '5. Skills - Manage and execute skills',
  DOCUMENT: '6. Document - Extract text from PDF, DOCX, images; convert documents',
  CODING: '7. Coding - Edit files, search code, find references, verify syntax',
} as const;

/** Error message templates */
export const ERROR_MESSAGES = {
  LLM_ERROR: 'LLM error',
  TOOL_ERROR: 'Tool failed',
  AGENT_CANCELLED: 'Task was cancelled',
  MAX_ITERATIONS: 'Max iterations reached without completion',
  AGENT_ERROR: 'Error',
} as const;

/** Log contexts */
export const LOG_CONTEXTS = {
  LLM_FAILED: 't800_agent_llm_failed',
  POST_TASK_ERROR: 't800_agent_post_task_error',
  LOOP_ERROR: 't800_agent_loop_error',
} as const;

/** Type imports for commonly used types */
export type { AgentResult, StepEvent } from '../../core/types';
export type { LLMProvider } from '../../llm/provider';
export type { BaseMemoryStrategy } from '../../memory/strategy';
export type { SkillEngine } from '../../skills/engine';
export type { SkillSearchEngine } from '../../skills/search';
export type { AgentLoop } from '../../agent/loop';
