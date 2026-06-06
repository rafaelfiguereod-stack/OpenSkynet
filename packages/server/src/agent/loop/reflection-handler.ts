/**
 * ReflectionHandler - Handles self-reflection and recovery logic
 * Extracted from agent/loop.ts for better modularity
 */

import type { StepEvent } from "../../core/types";

export interface ReflectionResult {
  success: boolean;
  recoveryHint?: string;
  shouldRetry: boolean;
}

export class ReflectionHandler {
  /**
   * Perform reflection on current execution state
   */
  reflect(
    task: string,
    steps: StepEvent[],
    iteration: number
  ): ReflectionResult {
    // Check if there were errors in the steps
    const hasErrors = steps.some((step) =>
      step.observation && (
        typeof step.observation === 'string' &&
        (step.observation.includes('Error') ||
         step.observation.includes('failed') ||
         step.observation.includes('Tool failed'))
      )
    );

    if (!hasErrors) {
      return { success: true, shouldRetry: false };
    }

    // Analyze errors and provide recovery hints
    const errorSteps = steps.filter((step) =>
      step.observation && (
        typeof step.observation === 'string' &&
        (step.observation.includes('Error') ||
         step.observation.includes('failed'))
      )
    );

    if (errorSteps.length > 0) {
      const lastError = errorSteps[errorSteps.length - 1];
      const errorMessage = typeof lastError.observation === 'string' ? lastError.observation : '';

      // Provide specific recovery hints based on error type
      let recoveryHint = this.getRecoveryHint(errorMessage, lastError.action);

      return {
        success: false,
        recoveryHint,
        shouldRetry: iteration < 3, // Limit retries
      };
    }

    return { success: true, shouldRetry: false };
  }

  /**
   * Get recovery hint based on error message and action
   */
  private getRecoveryHint(errorMessage: string, action: string): string {
    if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
      return 'The operation timed out. Consider waiting longer or breaking down the task into smaller steps.';
    }

    if (errorMessage.includes('not found') || errorMessage.includes('404')) {
      return 'The requested resource was not found. Verify the location or try an alternative approach.';
    }

    if (errorMessage.includes('permission') || errorMessage.includes('access')) {
      return 'Permission denied. Check if you have the necessary access rights or try an alternative method.';
    }

    if (errorMessage.includes('syntax') || errorMessage.includes('parse')) {
      return 'There was a syntax or parsing error. Review the input format and try again.';
    }

    // Default recovery hint
    return `The ${action} operation failed. Consider an alternative approach or breaking down the task.`;
  }

  /**
   * Check if reflection should be performed
   */
  shouldReflect(iteration: number, maxIterations: number, done: boolean): boolean {
    return !done && iteration < maxIterations;
  }

  /**
   * Determine if retry is worthwhile
   */
  shouldRetry(iteration: number, maxIterations: number, hasErrors: boolean): boolean {
    if (iteration >= maxIterations) {
      return false;
    }

    // Only retry if there were errors and we haven't retried too many times
    return hasErrors && iteration < 3;
  }
}
