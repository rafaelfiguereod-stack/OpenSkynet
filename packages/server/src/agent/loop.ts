/**
 * Agent Loop - Main execution loop for agents
 *
 * This module re-exports the AgentLoop from the execution directory
 * to maintain backward compatibility with existing imports.
 */

export { AgentLoop } from './execution/loop.js';
export type { AgentLoopOpts } from './execution/loop.js';
