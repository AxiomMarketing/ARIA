/**
 * `aria drift` command — Phase 10.2
 * Compares an .aria specification with its TypeScript implementation
 * and reports incoherences (missing contracts, signature mismatches, type drift).
 */

import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { resolve, basename, join } from "node:path";
import { parseFile } from "../parser.js";
import { parseTsFile } from "../importer/ts-parser.js";
import type { ExtractedSourceFile } from "../importer/ts-parser.js";
import type { AriaModule, TypeDef, ContractDef, BehaviorDef } from "../ast.js";
import { toErrorMessage } from "../security.js";

export interface DriftOptions {
  output?: string;          // Output file (default: stdout)
  json?: boolean;           // Emit JSON instead of markdown
  failOn?: "error" | "warning"; // Exit code 1 if findings >= this severity
}

export interface DriftFinding {
  severity: "error" | "warning";
  category: "missing-contract" | "missing-function" | "signature-mismatch" | "type-mismatch" | "missing-state" | "behavior-mismatch";
  message: string;
}

export interface DriftReport {
  specPath: string;
  implPath: string;
  findings: DriftFinding[];
  summary: string;
}

/**
 * Compare a single .aria spec file against a single .ts implementation file.
 */
export function runDriftFile(specPath: string, implPath: string): DriftReport {
  const absSpec = resolve(specPath);
  const absImpl = resolve(implPath);
  if (!existsSync(absSpec)) throw new Error(`Spec not found: ${absSpec}`);
  if (!existsSync(absImpl)) throw new Error(`Implementation not found: ${absImpl}`);

  const specSource = readFileSync(absSpec, "utf-8");
  const specModule = parseFile(specSource);
  const implExtracted = parseTsFile(absImpl);

  const findings = compareSpecAndImpl(specModule, implExtracted);

  return {
    specPath: absSpec,
    implPath: absImpl,
    findings,
    summary: summarize(findings),
  };
}

/**
 * Compare a directory of specs against a directory of implementations.
 * Files are matched by stem name (foo.aria ↔ foo.ts).
 */
export function runDriftDir(specDir: string, implDir: string): DriftReport[] {
  const absSpecDir = resolve(specDir);
  const absImplDir = resolve(implDir);
  if (!existsSync(absSpecDir)) throw new Error(`Spec directory not found: ${absSpecDir}`);
  if (!existsSync(absImplDir)) throw new Error(`Impl directory not found: ${absImplDir}`);

  const specFiles = findFiles(absSpecDir, ".aria");
  const reports: DriftReport[] = [];

  for (const specFile of specFiles) {
    const stem = basename(specFile, ".aria");
    // Try kebab → camel transformations
    const candidates = [
      `${stem}.ts`,
      `${camelCase(stem)}.ts`,
      `${pascalCase(stem)}.ts`,
    ];
    let matched: string | null = null;
    for (const cand of candidates) {
      const full = join(absImplDir, cand);
      if (existsSync(full)) {
        matched = full;
        break;
      }
    }
    if (matched) {
      try {
        reports.push(runDriftFile(specFile, matched));
      } catch (err: unknown) {
        console.error(`\u2717 Drift check failed for ${specFile}: ${toErrorMessage(err)}`);
      }
    }
  }

  return reports;
}

/**
 * Public dispatcher.
 */
export function runDrift(specPath: string, implPath: string, opts: DriftOptions = {}): DriftReport[] {
  const absSpec = resolve(specPath);
  const absImpl = resolve(implPath);

  const specStat = statSync(absSpec);
  const implStat = statSync(absImpl);

  if (specStat.isDirectory() && implStat.isDirectory()) {
    return runDriftDir(absSpec, absImpl);
  } else if (specStat.isFile() && implStat.isFile()) {
    return [runDriftFile(absSpec, absImpl)];
  } else {
    throw new Error(`Spec and impl must both be files or both be directories`);
  }
}

// ============================================================================
// Comparison logic
// ============================================================================

function compareSpecAndImpl(spec: AriaModule, impl: ExtractedSourceFile): DriftFinding[] {
  const findings: DriftFinding[] = [];

  const specTypes = spec.body.filter((n): n is TypeDef => n.kind === "type");
  const specContracts = spec.body.filter((n): n is ContractDef => n.kind === "contract");
  const specBehaviors = spec.body.filter((n): n is BehaviorDef => n.kind === "behavior");

  const implTypeNames = new Set(impl.types.map((t) => t.name));
  const implFunctionNames = new Set(impl.functions.map((f) => f.name.toLowerCase()));

  // 1. Each spec type should exist in impl
  for (const t of specTypes) {
    if (!implTypeNames.has(t.name)) {
      findings.push({
        severity: "warning",
        category: "type-mismatch",
        message: `Type "${t.name}" defined in spec but not found in implementation`,
      });
    }
  }

  // 2. Each spec contract should have a matching impl function
  for (const c of specContracts) {
    const camel = camelCase(c.name);
    if (!implFunctionNames.has(c.name.toLowerCase()) && !implFunctionNames.has(camel.toLowerCase())) {
      findings.push({
        severity: "error",
        category: "missing-function",
        message: `Contract "${c.name}" has no corresponding function in implementation`,
      });
    } else {
      // Found — compare signature
      const fn = impl.functions.find(
        (f) => f.name.toLowerCase() === c.name.toLowerCase() || f.name.toLowerCase() === camel.toLowerCase()
      );
      if (fn) {
        const specInputCount = c.inputs.length;
        const implParamCount = fn.parameters.length;
        if (specInputCount !== implParamCount && implParamCount !== 1) {
          // Allow impl to take 1 input object grouping multiple spec inputs
          findings.push({
            severity: "warning",
            category: "signature-mismatch",
            message: `Contract "${c.name}" has ${specInputCount} inputs in spec but ${implParamCount} parameters in impl`,
          });
        }
      }
    }
  }

  // 3. Each impl function should have a corresponding spec contract (warn only)
  const specContractNames = new Set(specContracts.map((c) => c.name.toLowerCase()));
  for (const fn of impl.functions) {
    const camel = camelCase(fn.name);
    if (!specContractNames.has(fn.name.toLowerCase()) && !specContractNames.has(camel.toLowerCase())) {
      // Skip private/internal helpers (lowercase first letter is fine — we check exported only)
      findings.push({
        severity: "warning",
        category: "missing-contract",
        message: `Function "${fn.name}" exists in impl but has no contract in spec`,
      });
    }
  }

  // 4. Each spec behavior should have a matching enum in impl
  for (const b of specBehaviors) {
    const matchingEnum = impl.types.find(
      (t) => t.kind === "enum" && (t.name === b.name || t.name.startsWith(b.name) || b.name.startsWith(t.name))
    );
    if (!matchingEnum) {
      findings.push({
        severity: "warning",
        category: "behavior-mismatch",
        message: `Behavior "${b.name}" has no matching enum in implementation`,
      });
    } else if (matchingEnum.kind === "enum") {
      const specStates = new Set(b.states.map((s) => s.name));
      const implVariants = new Set(matchingEnum.variants.map((v) => v.toLowerCase()));
      const missingInImpl: string[] = [];
      for (const s of b.states) {
        if (!implVariants.has(s.name.toLowerCase())) {
          missingInImpl.push(s.name);
        }
      }
      if (missingInImpl.length > 0) {
        findings.push({
          severity: "warning",
          category: "missing-state",
          message: `Behavior "${b.name}" states [${missingInImpl.join(", ")}] not in impl enum "${matchingEnum.name}"`,
        });
      }
    }
  }

  return findings;
}

// ============================================================================
// Formatting
// ============================================================================

function summarize(findings: DriftFinding[]): string {
  const errors = findings.filter((f) => f.severity === "error").length;
  const warnings = findings.filter((f) => f.severity === "warning").length;
  if (errors === 0 && warnings === 0) return "No drift detected";
  return `${errors} error(s), ${warnings} warning(s)`;
}

export function formatDriftReport(reports: DriftReport[]): string {
  const lines: string[] = [];
  lines.push("# Drift Report\n");

  const totalErrors = reports.reduce((acc, r) => acc + r.findings.filter((f) => f.severity === "error").length, 0);
  const totalWarnings = reports.reduce((acc, r) => acc + r.findings.filter((f) => f.severity === "warning").length, 0);

  lines.push(`**Total**: ${totalErrors} error(s), ${totalWarnings} warning(s) across ${reports.length} file(s)\n`);

  for (const report of reports) {
    lines.push(`## ${basename(report.specPath)} ↔ ${basename(report.implPath)}`);
    lines.push("");
    lines.push(`- Spec: \`${report.specPath}\``);
    lines.push(`- Impl: \`${report.implPath}\``);
    lines.push(`- ${report.summary}`);
    lines.push("");
    if (report.findings.length === 0) {
      lines.push("✓ No drift detected\n");
      continue;
    }
    for (const f of report.findings) {
      const icon = f.severity === "error" ? "✗" : "⚠";
      lines.push(`- ${icon} **${f.category}**: ${f.message}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

// ============================================================================
// Helpers
// ============================================================================

function findFiles(dir: string, ext: string): string[] {
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
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      results.push(...findFiles(full, ext));
    } else if (entry.isFile() && entry.name.endsWith(ext)) {
      results.push(full);
    }
  }
  return results;
}

function camelCase(s: string): string {
  return s
    .split(/[-_.]/)
    .filter(Boolean)
    .map((p, i) => (i === 0 ? p.toLowerCase() : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()))
    .join("");
}

function pascalCase(s: string): string {
  return s
    .split(/[-_.]/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join("");
}
