/**
 * Password policy validation shared by validate-password and change-password.
 */

export interface PasswordPolicyResult {
  valid: boolean;
  score: number;
  errors: string[];
  warnings: string[];
  hibpCompromised?: boolean;
  hibpCount?: number;
}

const MIN_LENGTH = 8;

export function validatePasswordPolicy(password: string): PasswordPolicyResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let score = 0;

  if (!password || password.length < MIN_LENGTH) {
    errors.push(`Password must be at least ${MIN_LENGTH} characters`);
  } else {
    score += 20;
  }

  if (/[a-z]/.test(password)) score += 15;
  else errors.push("Password must include a lowercase letter");

  if (/[A-Z]/.test(password)) score += 15;
  else errors.push("Password must include an uppercase letter");

  if (/[0-9]/.test(password)) score += 15;
  else errors.push("Password must include a number");

  if (/[^A-Za-z0-9]/.test(password)) score += 15;
  else warnings.push("Add a special character for stronger security");

  if (password.length >= 16) score += 10;
  if (password.length >= 20) score += 10;

  const commonPatterns = ["password", "123456", "qwerty", "letmein", "welcome"];
  const lower = password.toLowerCase();
  if (commonPatterns.some((p) => lower.includes(p))) {
    errors.push("Password contains a commonly used phrase");
    score = Math.max(0, score - 30);
  }

  score = Math.min(100, score);

  return {
    valid: errors.length === 0,
    score,
    errors,
    warnings,
  };
}

export async function checkHibpPassword(password: string): Promise<{ compromised: boolean; count: number }> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-1", data);
  const hashHex = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).toUpperCase().padStart(2, "0"))
    .join("");
  const prefix = hashHex.slice(0, 5);
  const suffix = hashHex.slice(5);

  const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
    headers: { "Add-Padding": "true" },
  });

  if (!response.ok) {
    throw new Error(`HIBP API error: ${response.status}`);
  }

  const body = await response.text();
  for (const line of body.split("\n")) {
    const [hashSuffix, countStr] = line.trim().split(":");
    if (hashSuffix === suffix) {
      return { compromised: true, count: parseInt(countStr, 10) || 0 };
    }
  }

  return { compromised: false, count: 0 };
}
