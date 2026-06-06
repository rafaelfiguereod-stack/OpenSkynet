/**
 * IterationManager - Handles iteration logic and budget checking
 * Extracted from agent/loop.ts for better modularity
 */

import type { Budget } from "../monitoring/guardrails";
import { checkBudget } from "../monitoring/guardrails";
import { InterruptSignal } from "../core/interrupt";

export interface IterationState {
  iteration: number;
  done: boolean;
  finalResult: string;
}

export class IterationManager {
  private maxIterations: number;
  private budget: Budget;

  constructor(maxIterations: number, budget: Budget) {
    this.maxIterations = maxIterations;
    this.budget = budget;
  }

  /**
   * Check if the iteration should continue
   */
  shouldContinue(state: IterationState): boolean {
    if (state.iteration >= this.maxIterations) {
      return false;
    }
    if (state.done) {
      return false;
    }
    return true;
  }

  /**
   * Check if budget is exceeded
   */
  checkBudget(): { exceeded: boolean; reason?: string } {
    const result = checkBudget(this.budget);
    this.budget.usedIterations++;
    return result;
  }

  /**
   * Update budget with time used
   */
  updateTimeUsed(startTime: number): void {
    this.budget.usedTimeMs = Date.now() - startTime;
  }

  /**
   * Check interrupt signal
   */
  checkInterrupt(interrupt: InterruptSignal): void {
    interrupt.check();
  }

  /**
   * Get current iteration count
   */
  getCurrentIteration(): number {
    return this.budget.usedIterations;
  }

  /**
   * Increment iteration counter
   */
  incrementIteration(): void {
    this.budget.usedIterations++;
  }

  /**
   * Reset iteration state
   */
  reset(): void {
    this.budget.usedIterations = 0;
    this.budget.usedTimeMs = 0;
  }
}
