export interface AgentConfig {
  maxIterations: number;
  compressThreshold: number;
  maxNestedDepth: number;
  headless: boolean;
  provider: string;
  model?: string;
  baseUrl?: string;
}

export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  maxIterations: 50,
  compressThreshold: 20,
  maxNestedDepth: 2,
  headless: true,
  provider: "openai",
};

// Legacy types for backward compatibility
export type AgentPhase = "planning" | "executing" | "validating" | "completed" | "failed";
export type Strategy = "direct" | "decompose" | "iterate" | "parallel";

export interface Observation {
  timestamp: number;
  type: string;
  content: string;
}

export interface Reflection {
  timestamp: number;
  confidence: number;
  issues: string[];
}

export interface PlanStep {
  id: string;
  description: string;
  status: "pending" | "in_progress" | "completed" | "failed";
}

export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: number;
}
