export class SkillAuditor {
  constructor(private llmProvider: any, private skillEngine: any) {}

  async audit(name: string): Promise<{
    valid: boolean;
    issues: string[];
    fixes: string[];
  }> {
    const skill = await this.skillEngine.get(name);
    if (!skill) {
      return { valid: false, issues: ["Skill not found"], fixes: [] };
    }

    const prompt = `Audit this skill definition for correctness, completeness, and potential issues.

Skill: ${JSON.stringify(skill, null, 2)}

Respond in JSON format:
{
  "valid": boolean,
  "issues": ["issue1", ...],
  "fixes": ["fix1", ...]
}`;

    try {
      const response = await this.llmProvider.complete(prompt);
      const parsed = JSON.parse(response);
      return {
        valid: parsed.valid ?? true,
        issues: Array.isArray(parsed.issues) ? parsed.issues : [],
        fixes: Array.isArray(parsed.fixes) ? parsed.fixes : [],
      };
    } catch {
      return { valid: false, issues: ["Audit failed"], fixes: [] };
    }
  }

  async auditAll(): Promise<Array<{ name: string; valid: boolean; issues: number }>> {
    const skills = await this.skillEngine.list();
    const results: Array<{ name: string; valid: boolean; issues: number }> = [];

    for (const skill of skills) {
      const audit = await this.audit(skill.name);
      results.push({
        name: skill.name,
        valid: audit.valid,
        issues: audit.issues.length,
      });
    }

    return results;
  }
}
