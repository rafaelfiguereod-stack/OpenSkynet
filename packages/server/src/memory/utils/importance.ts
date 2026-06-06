/**
 * Memory entry importance scoring.
 * Used to determine which entries to keep during consolidation.
 */

const HIGH_IMPORTANCE_PATTERNS = [
  /\b(always|never|must|important|critical|essential)\b/i,
  /\b(preferences?|prefers?|favorites?|defaults?)\b/i,
  /\b(password|api.?key|token|secret|credential)\b/i,
  /\b(error|failed|bug|fix|workaround)\b/i,
  /\b(rule|policy|constraint|requirement)\b/i,
];

const LOW_IMPORTANCE_PATTERNS = [
  /\b(okay|ok|sure|fine|whatever)\b/i,
  /\b(test|testing|tmp|temp)\b/i,
  /\b(maybe|perhaps|might|could)\b/i,
];

const FACT_PATTERN = /^(the|this|that|it|there|our|my|user|system|sediman)\b/i;
const PROCEDURE_PATTERN = /\b(step|first|then|next|after|before|click|navigate|type|scroll|search|open)\b/i;

export interface ImportanceScore {
  score: number;
  confidence: "high" | "medium" | "low";
  reasons: string[];
}

export function scoreImportance(content: string): ImportanceScore {
  if (!content || !content.trim()) {
    return { score: 0, confidence: "low", reasons: ["empty_content"] };
  }

  let score = 0.5;
  const reasons: string[] = [];
  const lower = content.toLowerCase();

  // Check high importance patterns
  for (const pattern of HIGH_IMPORTANCE_PATTERNS) {
    pattern.lastIndex = 0; // Reset regex state
    const matches = content.match(pattern);
    if (matches && matches.length > 0) {
      score += 0.15 * matches.length;
      reasons.push(`high_importance_pattern: ${matches[0]}`);
    }
  }

  // Check low importance patterns
  for (const pattern of LOW_IMPORTANCE_PATTERNS) {
    pattern.lastIndex = 0; // Reset regex state
    const matches = content.match(pattern);
    if (matches && matches.length > 0) {
      score -= 0.1 * matches.length;
      reasons.push(`low_importance_pattern: ${matches[0]}`);
    }
  }

  // Length-based scoring
  if (content.length < 20) {
    score -= 0.1;
    reasons.push("short_content");
  } else if (content.length > 200) {
    score += 0.1;
    reasons.push("long_content");
  }

  // Structure-based scoring
  const newlineCount = (content.match(/\n/g) || []).length;
  if (newlineCount > 3) {
    score += 0.05;
    reasons.push("structured_content");
  }

  // Content type detection
  FACT_PATTERN.lastIndex = 0; // Reset regex state
  if (FACT_PATTERN.test(content)) {
    score += 0.05;
    reasons.push("factual_statement");
  }

  PROCEDURE_PATTERN.lastIndex = 0; // Reset regex state
  if (PROCEDURE_PATTERN.test(content)) {
    score += 0.05;
    reasons.push("procedural_content");
  }

  // Clamp score between 0.1 and 1.0
  score = Math.max(0.1, Math.min(1.0, score));

  // Determine confidence based on reasons count
  let confidence: "high" | "medium" | "low";
  if (reasons.length >= 3) {
    confidence = "high";
  } else if (reasons.length >= 1) {
    confidence = "medium";
  } else {
    confidence = "low";
  }

  return { score, confidence, reasons };
}

export class ImportanceScorer {
  score(content: string): ImportanceScore {
    return scoreImportance(content);
  }

  compare(a: string, b: string): number {
    const scoreA = this.score(a).score;
    const scoreB = this.score(b).score;
    return scoreA - scoreB;
  }

  rank(contents: string[]): Array<{ content: string; rank: number }> {
    return contents
      .map((content) => ({
        content,
        rank: this.score(content).score,
      }))
      .sort((a, b) => b.rank - a.rank);
  }
}
