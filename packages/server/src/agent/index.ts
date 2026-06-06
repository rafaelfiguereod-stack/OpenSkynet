/**
 * @deprecated Old agent system. Use T800Agent and TerminatorAgent from src/electron/agent instead.
 *
 * This module contains the legacy agent architecture that has been replaced by:
 * - T800Agent: Direct execution agent with all tools
 * - TerminatorAgent: Orchestrator for complex multi-step tasks
 *
 * The old agents (ManagerAgent, AgentRunner, etc.) have been removed.
 * Only core infrastructure, monitoring, and utilities are kept for backward compatibility.
 */

// Core infrastructure
export { AgentContext } from "./core/base";
export { AgentConfig, DEFAULT_AGENT_CONFIG } from "./core/types";
export {
  AgentState,
  createInitialState,
  transitionPhase,
  addObservation,
  addReflection,
  addPlanStep,
} from "./core/state";
export { InterruptSignal, AgentInterruptedError } from "./core/interrupt";

// Monitoring and safety
export {
  AuditLog,
  SharedScratchpad,
  assessRisk,
  checkBudget,
} from "./monitoring/guardrails";
export type { Budget, RiskAssessment, AuditEntry } from "./monitoring/guardrails";
export { ContextCompressor } from "./memory/compressor";

// Progress tracking
export {
  ProgressTracker,
  generateMilestonesPrompt,
  parseMilestones,
} from "./memory/progress";
export type { Milestone } from "./memory/progress";

// Checkpoint management
export { CheckpointManager } from "./memory/checkpoint";
export type { Checkpoint } from "./memory/checkpoint";

// Prompts and personality
export { loadSoul, saveSoul, getDefaultSoul } from "./prompts/soul";
export { ContainerManager } from "./utils/container";

// Locales
export {
  SCHEDULE_KEYWORDS,
  CHAT_KEYWORDS,
  ACTION_VERBS,
} from "./prompts/locales";

// Skills
export { SkillAuditor } from "./skills/skill-auditor";
export { SkillLearnerAgent as SkillLearner } from "./skills/skill-learner";
export { TraceToSkill as traceToSkill } from "./skills/trace-to-skill";
