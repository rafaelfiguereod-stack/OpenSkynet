import type { InterruptSignal } from "./interrupt";

export interface AgentContext {
  llmProvider: any;
  browserSession: any;
  memory: any;
  skillEngine: any;
  toolBus: any;
  conversation: Array<{ role: string; content: string }>;
  interruptSignal: InterruptSignal;
}
