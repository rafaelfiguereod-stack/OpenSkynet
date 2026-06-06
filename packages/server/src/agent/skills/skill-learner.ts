export interface StepEvent {
  action: string;
  observation: string;
  timestamp: number;
}

export class SkillLearnerAgent {
  constructor(private llmProvider: any, private skillEngine: any) {}

  async learnFromExecution(
    task: string,
    steps: StepEvent[],
    result: string
  ): Promise<{ created: boolean; skillName?: string }> {
    if (steps.length < 2) return { created: false };

    const stepSummary = steps
      .map(
        (s, i) =>
          `${i + 1}. Action: ${s.action} -> ${s.observation.slice(0, 100)}`
      )
      .join("\n");

    const prompt = `Analyze this task execution and determine if it contains a reusable pattern worth saving as a skill.

Task: ${task}
Steps:
${stepSummary}
Result: ${result.slice(0, 200)}

If this is a generic, reusable pattern respond with JSON:
{"shouldCreate": true, "name": "skill_name", "description": "what it does", "steps": ["step1", "step2"]}

If it's too specific or not reusable, respond with:
{"shouldCreate": false}`;

    try {
      const response = await this.llmProvider.complete(prompt);
      const parsed = JSON.parse(response);

      if (!parsed.shouldCreate) return { created: false };

      await this.skillEngine.register({
        name: parsed.name,
        description: parsed.description,
        steps: parsed.steps,
      });

      return { created: true, skillName: parsed.name };
    } catch {
      return { created: false };
    }
  }
}
