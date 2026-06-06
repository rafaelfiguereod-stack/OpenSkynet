export interface Budget {
  maxTokens: number;
  maxIterations: number;
  maxTimeMs: number;
  usedTokens: number;
  usedIterations: number;
  usedTimeMs: number;
}

export interface RiskAssessment {
  level: "low" | "medium" | "high";
  reasons: string[];
}

export interface AuditEntry {
  timestamp: string;
  action: string;
  details: string;
  risk: RiskAssessment;
}

export class AuditLog {
  private entries: AuditEntry[] = [];

  add(action: string, details: string, risk: RiskAssessment): void {
    this.entries.push({
      timestamp: new Date().toISOString(),
      action,
      details,
      risk,
    });
  }

  getEntries(): AuditEntry[] {
    return [...this.entries];
  }

  clear(): void {
    this.entries = [];
  }
}

export class SharedScratchpad {
  private data: Map<string, string> = new Map();

  set(key: string, value: string): void {
    this.data.set(key, value);
  }

  get(key: string): string | undefined {
    return this.data.get(key);
  }

  delete(key: string): boolean {
    return this.data.delete(key);
  }

  clear(): void {
    this.data.clear();
  }
}

const HIGH_RISK_PATTERNS = [
  /rm\s+-rf/,
  /delete\s+all/i,
  /drop\s+table/i,
  /format\s+[a-z]:/i,
  /\bsudo\b/,
  /\bchmod\s+777\b/,
  /\bdd\s+if=/,
  /\bmkfs\b/,
  />\/dev\/sd/,
  /\bshutdown\b/,
  /\breboot\b/,
];

const MEDIUM_RISK_PATTERNS = [
  /\brm\b/,
  /\bdelete\b/i,
  /\bremove\b/i,
  /\boverwrite\b/i,
  /\bexec\b/i,
  /\beval\b/i,
  /\bsystem\s*\(/i,
  /\bsubprocess\b/i,
  /\.env/,
  /api[_-]?key/i,
  /secret/i,
  /password/i,
  /token/i,
];

export function assessRisk(
  action: string,
  args: Record<string, unknown>,
): RiskAssessment {
  const combined = `${action} ${Object.values(args).join(" ")}`;
  const reasons: string[] = [];

  for (const pattern of HIGH_RISK_PATTERNS) {
    if (pattern.test(combined)) {
      reasons.push(`Matched high-risk pattern: ${pattern.source}`);
    }
  }

  if (reasons.length > 0) {
    return { level: "high", reasons };
  }

  for (const pattern of MEDIUM_RISK_PATTERNS) {
    if (pattern.test(combined)) {
      reasons.push(`Matched medium-risk pattern: ${pattern.source}`);
    }
  }

  if (reasons.length > 0) {
    return { level: "medium", reasons };
  }

  return { level: "low", reasons: [] };
}

export function checkBudget(budget: Budget): {
  exceeded: boolean;
  reason?: string;
} {
  if (budget.usedTokens >= budget.maxTokens) {
    return { exceeded: true, reason: "Token budget exceeded" };
  }

  if (budget.usedIterations >= budget.maxIterations) {
    return { exceeded: true, reason: "Iteration budget exceeded" };
  }

  if (budget.usedTimeMs >= budget.maxTimeMs) {
    return { exceeded: true, reason: "Time budget exceeded" };
  }

  return { exceeded: false };
}
