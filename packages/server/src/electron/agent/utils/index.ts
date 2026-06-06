/**
 * Utility modules for T-800 Agent
 *
 * Organized by concern for maintainability.
 */

export { ConversationManager, formatMessage, toLLMMessages } from './conversation';
export {
  buildSystemPrompt,
  buildErrorRecoveryPrompt,
  buildCompletionMessage,
  buildErrorMessage,
} from './prompts';
export {
  executeToolCall,
  createStepFromToolCall,
  detectErrorsInSteps,
  shouldTriggerErrorRecovery,
  buildAgentResult,
  buildErrorResult,
  buildCancelledResult,
  buildMaxIterationsResult,
  isSuccessfulResult,
} from './execution';
export {
  resolveAgentOptions,
  calculateMaxIterations,
  buildToolConfig,
  validateWorkingDirectory,
} from './config';
