export interface Milestone {
  description: string;
  completed: boolean;
  timestamp?: string;
}

export class ProgressTracker {
  private milestones: Milestone[] = [];

  addMilestone(description: string): void {
    this.milestones.push({ description, completed: false });
  }

  completeMilestone(index: number): void {
    if (index >= 0 && index < this.milestones.length) {
      this.milestones[index].completed = true;
      this.milestones[index].timestamp = new Date().toISOString();
    }
  }

  getMilestones(): Milestone[] {
    return [...this.milestones];
  }

  getProgress(): { total: number; completed: number; percentage: number } {
    const total = this.milestones.length;
    const completed = this.milestones.filter((m) => m.completed).length;
    const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);
    return { total, completed, percentage };
  }
}

export function generateMilestonesPrompt(task: string): string {
  return `Given the task: "${task}", generate a list of milestones to track progress. Return only the milestones, one per line, prefixed with a dash (-). Do not include numbering or extra formatting.`;
}

export function parseMilestones(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^[-*•]\s+/.test(line))
    .map((line) => line.replace(/^[-*•]\s+/, "").trim())
    .filter(Boolean);
}
