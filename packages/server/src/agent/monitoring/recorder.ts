export class SkillRecorder {
  private steps: Array<{ action: string; observation: string }> = [];

  recordStep(action: string, observation: string): void {
    this.steps.push({ action, observation });
  }

  getSteps(): Array<{ action: string; observation: string }> {
    return this.steps;
  }

  clear(): void {
    this.steps = [];
  }
}
