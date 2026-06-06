/**
 * T-800 Agent Module
 *
 * Organized exports for the agent system.
 *
 * Architecture:
 * - constants.ts: Configuration constants and shared values
 * - types.ts: Type definitions for the agent system
 * - T800Agent.ts: Main direct execution agent
 * - TerminatorAgent.ts: Orchestrator agent for complex tasks
 * - utils/: Utility modules organized by concern
 */

// Main agents
export { T800Agent } from './T800Agent';
export type { T800AgentOpts } from './T800Agent';

export { TerminatorAgent } from './TerminatorAgent';

// Deprecated: Old browser-focused agent
/** @deprecated Use T800Agent with browser tools enabled instead */
export { ElectronAgent } from './ElectronAgent';
export type { ElectronAgentOpts } from './ElectronAgent';

// Types and constants
export * from './types';
export * from './constants';

// Utilities
export * from './utils/index';
