import type {
  AgentPhase,
  Strategy,
  Observation,
  Reflection,
  PlanStep,
} from "../core/types";

export interface AgentState {
  phase: AgentPhase;
  currentStrategy: Strategy;
  steps: PlanStep[];
  observations: Observation[];
  reflections: Reflection[];
  iterationCount: number;
  startTime: number;
}

export function createInitialState(): AgentState {
  return {
    phase: "planning",
    currentStrategy: "direct",
    steps: [],
    observations: [],
    reflections: [],
    iterationCount: 0,
    startTime: Date.now(),
  };
}

export function transitionPhase(
  state: AgentState,
  newPhase: AgentPhase,
): AgentState {
  return { ...state, phase: newPhase };
}

export function addObservation(
  state: AgentState,
  obs: Observation,
): AgentState {
  return { ...state, observations: [...state.observations, obs] };
}

export function addReflection(
  state: AgentState,
  ref: Reflection,
): AgentState {
  return { ...state, reflections: [...state.reflections, ref] };
}

export function addPlanStep(state: AgentState, step: PlanStep): AgentState {
  return { ...state, steps: [...state.steps, step] };
}
