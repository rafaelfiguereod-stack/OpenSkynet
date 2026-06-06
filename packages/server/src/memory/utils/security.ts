/**
 * Security scanner for memory content — pure regex, no LLM calls.
 */

const THREAT_PATTERNS: Array<[RegExp, string]> = [
  // Prompt injection
  [/ignore\s+(all\s+)?previous\s+instructions/gi, "prompt_injection"],
  [/you\s+are\s+now\s+/gi, "role_hijack"],
  [/do\s+not\s+tell\s+the\s+user/gi, "deception_hide"],
  [/act\s+as\s+if\s+you\s+have\s+no\s+restrictions/gi, "bypass_restrictions"],
  [/system\s*:\s*/gi, "system_prefix"],
  // Data exfiltration
  [/curl\s+.*\$(?:KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|API)/gi, "exfil_curl"],
  [/wget\s+.*\$(?:KEY|TOKEN|SECRET)/gi, "exfil_wget"],
  [/(?:cat|type)\s+(?:\.env|credentials|\.netrc|\.pgpass|\.npmrc|\.pypirc)/gi, "read_secrets"],
  [/(?:api[_-]?key|token|secret|password|credential)\s*[:=]\s*\S{8,}/gi, "credential_leak"],
  // Backdoor
  [/authorized_keys|~\/\.ssh/gi, "ssh_backdoor"],
  // Destructive
  [/rm\s+-rf\s+\//gi, "destructive_rm"],
  [/drop\s+table/gi, "destructive_sql"],
];

const INVISIBLE_UNICODE_RANGES: Array<[string, string]> = [
  ["​", "‏"], // zero-width space, non-joiner, joiner, LRE, RLE, PDF, LRO, RLO
  [" ", " "], // line/paragraph separator
  ["‪", "‮"], // bidi controls
  ["⁠", "⁩"], // word joiner, invisible sep, LRI, RLI, FSI, PDI
  ["󠄀", "󠄏"], // variation selectors
  ["￹", "￻"], // interlinear annotation
];

function hasInvisibleUnicode(text: string): boolean {
  for (const char of text) {
    for (const [lo, hi] of INVISIBLE_UNICODE_RANGES) {
      if (char >= lo && char <= hi) {
        return true;
      }
    }
    const code = char.codePointAt(0) ?? 0;
    const category = String.fromCharCode(code);
    // Check for general category "Cf" (format characters) except soft hyphen
    if (category === "­" && char !== "­") {
      return true;
    }
  }
  return false;
}

export interface SecurityScanResult {
  threats: string[];
  safe: boolean;
}

export function scanContent(content: string): SecurityScanResult {
  const threats: string[] = [];

  for (const [pattern, name] of THREAT_PATTERNS) {
    pattern.lastIndex = 0; // Reset regex state
    if (pattern.test(content)) {
      threats.push(name);
    }
  }

  if (hasInvisibleUnicode(content)) {
    threats.push("invisible_unicode");
  }

  return {
    threats,
    safe: threats.length === 0,
  };
}

export function sanitizeContent(content: string): string {
  // Remove invisible unicode characters
  let sanitized = "";
  for (const char of content) {
    let isInvisible = false;
    for (const [lo, hi] of INVISIBLE_UNICODE_RANGES) {
      if (char >= lo && char <= hi) {
        isInvisible = true;
        break;
      }
    }
    if (!isInvisible) {
      sanitized += char;
    }
  }
  return sanitized;
}

export class MemorySecurityScanner {
  scan(content: string): SecurityScanResult {
    return scanContent(content);
  }

  sanitize(content: string): string {
    return sanitizeContent(content);
  }
}
