/**
 * ARIA Security utilities
 * Guards against code injection, path traversal, and input abuse.
 */

import { resolve, relative } from "node:path";
import { writeFileSync, renameSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// ============================================================================
// Name sanitization (CWE-94 — code injection prevention)
// ============================================================================

const SAFE_NAME_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/**
 * Validate that a name is safe for interpolation into generated source code.
 * Rejects names containing semicolons, quotes, parentheses, or other
 * characters that could break out of identifier context.
 */
export function safeName(name: string): string {
  if (!name || !SAFE_NAME_RE.test(name)) {
    throw new Error(
      `Unsafe identifier "${name}" — names must match [a-zA-Z_][a-zA-Z0-9_]*`
    );
  }
  return name;
}

/**
 * Check if a name is safe without throwing.
 */
export function isNameSafe(name: string): boolean {
  return !!name && SAFE_NAME_RE.test(name);
}

// ============================================================================
// Regex safety (CWE-1333 — ReDoS prevention)
// ============================================================================

/**
 * Reject regex patterns with nested quantifiers that could cause catastrophic
 * backtracking (ReDoS). Checks for patterns like (a+)+, (a|b)*, etc.
 */
export function isSafeRegex(pattern: string): boolean {
  // Detect nested quantifiers: a quantifier applied to a group that contains a quantifier
  // This catches (a+)+, (a*)+, (a+)*, ([a-z]+)+ etc.
  if (/\([^)]*[+*][^)]*\)[+*{]/.test(pattern)) return false;
  // Detect overlapping alternation with quantifiers: (a|a)+
  if (/\([^)]*\|[^)]*\)[+*{]/.test(pattern) && /[+*]/.test(pattern)) return false;
  // Max length guard
  if (pattern.length > 500) return false;
  return true;
}

// ============================================================================
// Path traversal prevention (CWE-22)
// ============================================================================

/**
 * Validate that a resolved path is within the allowed root directory.
 * Prevents path traversal via ../../ in import paths or output directories.
 */
export function validatePathWithinRoot(
  targetPath: string,
  rootDir: string,
  context: string = "path"
): void {
  const resolved = resolve(targetPath);
  const root = resolve(rootDir);
  const rel = relative(root, resolved);
  if (rel.startsWith("..") || resolve(root, rel) !== resolved) {
    throw new Error(
      `Path traversal blocked: ${context} "${targetPath}" resolves outside project root "${root}"`
    );
  }
}

// ============================================================================
// Input size guard (CWE-400 — DoS prevention)
// ============================================================================

const MAX_INPUT_SIZE = 1_000_000; // 1 MB

export function validateInputSize(input: string, label: string = "input"): void {
  if (input.length > MAX_INPUT_SIZE) {
    throw new Error(
      `${label} too large (${(input.length / 1024).toFixed(0)} KB). Maximum: ${(MAX_INPUT_SIZE / 1024).toFixed(0)} KB`
    );
  }
}

// ============================================================================
// Atomic file write (data corruption prevention)
// ============================================================================

let tmpCounter = 0;

/**
 * Write a file atomically: write to a temp file in the same directory,
 * then rename to the final path. renameSync is atomic on the same filesystem.
 */
export function writeFileAtomic(filePath: string, content: string): void {
  const dir = resolve(filePath, "..");
  const tmpPath = join(dir, `.aria-tmp-${process.pid}-${++tmpCounter}`);
  try {
    writeFileSync(tmpPath, content, "utf-8");
    renameSync(tmpPath, filePath);
  } catch (err) {
    // Clean up temp file on failure
    try { writeFileSync(tmpPath, ""); renameSync(tmpPath, tmpPath); } catch {}
    throw err;
  }
}

// ============================================================================
// Error handling utility
// ============================================================================

/**
 * Extract a human-readable error message from an unknown thrown value.
 */
export function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

// ============================================================================
// AI output sanitization
// ============================================================================

const DANGEROUS_PATTERNS = [
  /require\s*\(\s*['"]child_process['"]\s*\)/,
  /require\s*\(\s*['"]fs['"]\s*\)/,
  /import\s+.*from\s+['"]child_process['"]/,
  /import\s+.*from\s+['"]fs['"]/,
  /\beval\s*\(/,
  /\bFunction\s*\(/,
  /process\.exit/,
  /process\.env/,
  /execSync|spawnSync|exec\s*\(/,
];

/**
 * Check AI-generated code for dangerous patterns.
 * Returns list of warnings (does not block — user decides).
 */
export function detectDangerousPatterns(code: string): string[] {
  const warnings: string[] = [];
  for (const pattern of DANGEROUS_PATTERNS) {
    const match = code.match(pattern);
    if (match) {
      warnings.push(`Suspicious pattern in AI output: ${match[0]}`);
    }
  }
  return warnings;
}
