import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";

export interface FormatOptions {
  check?: boolean;
}

export interface FormatResult {
  path: string;
  changed: boolean;
  original: string;
  formatted: string;
}

/**
 * Line-based formatter for .aria files.
 * Rules:
 * - 2-space indentation
 * - Trim trailing whitespace
 * - Max 1 consecutive blank line
 * - No leading blank lines
 * - Final newline
 */
export function formatAria(source: string): string {
  const lines = source.split("\n");
  const result: string[] = [];
  let blankCount = 0;
  let seenContent = false;

  for (const rawLine of lines) {
    // Trim trailing whitespace
    const line = rawLine.replace(/\s+$/, "");

    // Normalize tabs to 2 spaces
    const normalized = line.replace(/\t/g, "  ");

    if (normalized.trim() === "") {
      if (seenContent) blankCount++;
      continue;
    }

    // Emit up to 1 blank line before content
    if (seenContent && blankCount > 0) {
      result.push("");
    }
    blankCount = 0;
    seenContent = true;
    result.push(normalized);
  }

  // Ensure final newline
  return result.join("\n") + "\n";
}

export function runFormat(filePath: string, opts: FormatOptions = {}): FormatResult {
  const absPath = resolve(filePath);
  if (!existsSync(absPath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const original = readFileSync(absPath, "utf-8");
  const formatted = formatAria(original);
  const changed = original !== formatted;

  if (!opts.check && changed) {
    writeFileSync(absPath, formatted, "utf-8");
  }

  return { path: absPath, changed, original, formatted };
}

export function runFormatDir(dirPath: string, opts: FormatOptions = {}): FormatResult[] {
  const results: FormatResult[] = [];
  const entries = readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dirPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...runFormatDir(full, opts));
    } else if (entry.isFile() && entry.name.endsWith(".aria")) {
      results.push(runFormat(full, opts));
    }
  }
  return results;
}
