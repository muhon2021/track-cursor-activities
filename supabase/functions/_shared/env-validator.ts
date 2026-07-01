/**
 * Shared environment variable validation utilities
 */

export class EnvValidationError extends Error {
  constructor(varName: string) {
    super(`Missing required environment variable: ${varName}`);
    this.name = "EnvValidationError";
  }
}

export function requireEnv(varName: string): string {
  const value = Deno.env.get(varName);
  if (!value) {
    throw new EnvValidationError(varName);
  }
  return value;
}

export function requireEnvVars(varNames: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  const missing: string[] = [];

  for (const varName of varNames) {
    const value = Deno.env.get(varName);
    if (!value) {
      missing.push(varName);
    } else {
      result[varName] = value;
    }
  }

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  return result;
}

export function getEnv(varName: string, defaultValue: string): string {
  return Deno.env.get(varName) ?? defaultValue;
}
