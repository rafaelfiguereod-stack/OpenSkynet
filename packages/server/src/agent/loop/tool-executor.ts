/**
 * ToolExecutor - Handles tool execution logic
 * Extracted from agent/loop.ts for better modularity
 */

import type { StepEvent } from "../../core/types";
import { ToolBus } from "../tools/bus";
import { AuditLog } from "../monitoring/guardrails";
import { InterruptSignal } from "../core/interrupt";

export interface ToolExecutionResult {
  steps: StepEvent[];
  actionsTaken: string[];
  toolResults: Map<string, { name: string; result: string }>;
}

export class ToolExecutor {
  constructor(
    private toolBus: ToolBus,
    private auditLog: AuditLog,
    private interrupt: InterruptSignal
  ) {}

  /**
   * Execute tool calls from LLM response
   */
  async executeToolCalls(
    toolCalls: Array<{ id: string; name: string; arguments: Record<string, unknown> }>,
    addToolResult: (id: string, name: string, result: string) => void
  ): Promise<ToolExecutionResult> {
    const steps: StepEvent[] = [];
    const actionsTaken: string[] = [];
    const toolResults = new Map();

    for (const tc of toolCalls) {
      this.interrupt.check();

      const step: StepEvent = {
        phase: "executing",
        action: tc.name,
        detail: JSON.stringify(tc.arguments),
      };
      steps.push(step);
      actionsTaken.push(tc.name);

      this.auditLog.add(tc.name, JSON.stringify(tc.arguments), { level: "low", reasons: [] });

      try {
        const result = await this.toolBus.execute(tc.name, tc.arguments);
        const output = result.success ? result.output : result.error ?? "Tool failed";
        step.observation = output;
        addToolResult(tc.id, tc.name, output);
        toolResults.set(tc.id, { name: tc.name, result: output });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        step.observation = errMsg;
        const errorResult = `Error: ${errMsg}`;
        addToolResult(tc.id, tc.name, errorResult);
        toolResults.set(tc.id, { name: tc.name, result: errorResult });
      }
    }

    return { steps, actionsTaken, toolResults };
  }

  /**
   * Execute a single tool call
   */
  async executeSingleTool(
    toolName: string,
    toolArgs: Record<string, unknown>
  ): Promise<{ success: boolean; output?: string; error?: string }> {
    try {
      const result = await this.toolBus.execute(toolName, toolArgs);
      return {
        success: result.success,
        output: result.output,
        error: result.error,
      };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: errMsg,
      };
    }
  }
}
