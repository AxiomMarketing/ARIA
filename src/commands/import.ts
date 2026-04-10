/**
 * `aria import` command — Phase 10.1
 * Reverse-engineers a TypeScript file (or directory) into ARIA spec skeletons.
 */

import { writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from "node:fs";
import { resolve, basename, join, dirname } from "node:path";
import { parseTsFile } from "../importer/ts-parser.js";
import { emitAria } from "../importer/aria-emitter.js";
import { writeFileAtomic, toErrorMessage } from "../security.js";

export interface ImportOptions {
  output?: string;       // output directory (default: ./specs)
  recursive?: boolean;   // scan directory recursively
  target?: string;       // target language for the emitted .aria (default: typescript)
  includeJsDoc?: boolean; // include JSDoc comments in the .aria
}

export interface ImportResult {
  inputPath: string;
  outputPath: string;
  moduleName: string;
  typeCount: number;
  contractCount: number;
  behaviorCount: number;
}

/**
 * Import a single TypeScript file and emit a .aria skeleton.
 */
export function runImportFile(filePath: string, opts: ImportOptions = {}): ImportResult {
  const absInput = resolve(filePath);
  if (!existsSync(absInput)) {
    throw new Error(`File not found: ${absInput}`);
  }

  const extracted = parseTsFile(absInput);

  // Derive a module name from the file basename
  const moduleName = deriveModuleName(absInput);

  const ariaSource = emitAria(extracted, {
    moduleName,
    target: opts.target || "typescript",
    includeJsDoc: opts.includeJsDoc !== false,
  });

  const outDir = resolve(opts.output || "./specs");
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

  const outFileName = `${kebabCase(moduleName)}.aria`;
  const outPath = join(outDir, outFileName);

  writeFileAtomic(outPath, ariaSource);

  return {
    inputPath: absInput,
    outputPath: outPath,
    moduleName,
    typeCount: extracted.types.length,
    contractCount: extracted.functions.length,
    behaviorCount: extracted.behaviors.length,
  };
}

/**
 * Import all .ts files in a directory (optionally recursive).
 */
export function runImportDir(dirPath: string, opts: ImportOptions = {}): ImportResult[] {
  const absDir = resolve(dirPath);
  if (!existsSync(absDir)) {
    throw new Error(`Directory not found: ${absDir}`);
  }

  const tsFiles = findTsFiles(absDir, opts.recursive !== false);
  const results: ImportResult[] = [];

  for (const file of tsFiles) {
    try {
      const result = runImportFile(file, opts);
      results.push(result);
    } catch (err: unknown) {
      console.error(`\u2717 Failed to import ${file}: ${toErrorMessage(err)}`);
    }
  }

  return results;
}

/**
 * Public entry point used by the CLI.
 * Detects whether the path is a file or directory and dispatches accordingly.
 */
export function runImport(path: string, opts: ImportOptions = {}): ImportResult[] {
  const absPath = resolve(path);
  if (!existsSync(absPath)) {
    throw new Error(`Path not found: ${absPath}`);
  }
  const stat = statSync(absPath);
  if (stat.isDirectory()) {
    return runImportDir(absPath, opts);
  } else if (stat.isFile()) {
    return [runImportFile(absPath, opts)];
  } else {
    throw new Error(`Unsupported path type: ${absPath}`);
  }
}

// ============================================================================
// Helpers
// ============================================================================

function findTsFiles(dir: string, recursive: boolean): string[] {
  const results: string[] = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip node_modules and hidden dirs
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      if (recursive) {
        results.push(...findTsFiles(full, true));
      }
    } else if (entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts") && !entry.name.endsWith(".test.ts") && !entry.name.endsWith(".spec.ts")) {
      results.push(full);
    }
  }
  return results;
}

function deriveModuleName(filePath: string): string {
  const base = basename(filePath, ".ts");
  // Convert kebab-case or snake_case to PascalCase
  return base
    .split(/[-_.]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function kebabCase(s: string): string {
  return s.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
}
