interface RecordedFrame {
  action?: {
    timestamp: number;
    type: string;
    target?: string;
    value?: string;
  };
}

export class TraceToSkill {
  constructor(private llmProvider: any) {}

  async convert(
    frames: RecordedFrame[],
    name: string
  ): Promise<{ name: string; description: string; steps: string[] } | null> {
    if (frames.length === 0) return null;

    const actions = frames
      .filter((f) => f.action)
      .map(
        (f) =>
          `[${new Date(f.action!.timestamp).toISOString()}] ${f.action!.type}` +
          (f.action!.target ? ` on ${f.action!.target}` : "") +
          (f.action!.value ? ` value="${f.action!.value}"` : "")
      );

    const prompt = `Analyze the following recorded browser actions and generate a reusable skill definition.

Skill name: ${name}
Recorded actions:
${actions.join("\n")}

Respond in JSON format:
{
  "name": "string",
  "description": "string",
  "steps": ["step 1", "step 2", ...]
}`;

    try {
      const response = await this.llmProvider.complete(prompt);
      const parsed = JSON.parse(response);
      return {
        name: parsed.name ?? name,
        description: parsed.description ?? "",
        steps: Array.isArray(parsed.steps) ? parsed.steps : [],
      };
    } catch {
      return null;
    }
  }
}
