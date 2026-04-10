import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runDriftFile, runDrift, formatDriftReport } from "../src/commands/drift.ts";

const tempDirs: string[] = [];

function mkTmp(): string {
  const d = mkdtempSync(join(tmpdir(), "aria-drift-test-"));
  tempDirs.push(d);
  return d;
}

afterEach(() => {
  for (const d of tempDirs) {
    try { rmSync(d, { recursive: true, force: true }); } catch {}
  }
  tempDirs.length = 0;
});

const ARIA_SPEC = `module Payment
  version "1.0"
  target typescript

type Money is Integer
  where self > 0

type Account is Record
  id: String
  balance: Money

contract Transfer
  inputs
    sender: Account
    receiver: Account
    amount: Money
  requires
    amount > 0
`;

const MATCHING_TS = `
export interface Account {
  id: string;
  balance: number;
}

export function transfer(sender: Account, receiver: Account, amount: number): boolean {
  return true;
}
`;

const TS_MISSING_FUNCTION = `
export interface Account {
  id: string;
  balance: number;
}
// transfer() is missing
`;

const TS_EXTRA_FUNCTION = `
export interface Account {
  id: string;
  balance: number;
}

export function transfer(sender: Account, receiver: Account, amount: number): boolean {
  return true;
}

export function refund(amount: number): boolean {
  return true;
}
`;

describe("runDriftFile — matching spec/impl", () => {
  it("reports no errors when spec and impl match", () => {
    const dir = mkTmp();
    const specFile = join(dir, "payment.aria");
    const implFile = join(dir, "payment.ts");
    writeFileSync(specFile, ARIA_SPEC);
    writeFileSync(implFile, MATCHING_TS);

    const report = runDriftFile(specFile, implFile);
    const errors = report.findings.filter((f) => f.severity === "error");
    expect(errors).toHaveLength(0);
  });
});

describe("runDriftFile — missing function in impl", () => {
  it("reports an error when spec contract has no impl function", () => {
    const dir = mkTmp();
    const specFile = join(dir, "payment.aria");
    const implFile = join(dir, "payment.ts");
    writeFileSync(specFile, ARIA_SPEC);
    writeFileSync(implFile, TS_MISSING_FUNCTION);

    const report = runDriftFile(specFile, implFile);
    const errors = report.findings.filter((f) => f.severity === "error");
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].category).toBe("missing-function");
    expect(errors[0].message).toContain("Transfer");
  });
});

describe("runDriftFile — extra function in impl", () => {
  it("warns when impl has functions not in spec", () => {
    const dir = mkTmp();
    const specFile = join(dir, "payment.aria");
    const implFile = join(dir, "payment.ts");
    writeFileSync(specFile, ARIA_SPEC);
    writeFileSync(implFile, TS_EXTRA_FUNCTION);

    const report = runDriftFile(specFile, implFile);
    const warnings = report.findings.filter((f) => f.severity === "warning");
    expect(warnings.some((w) => w.category === "missing-contract" && w.message.includes("refund"))).toBe(true);
  });
});

describe("runDriftFile — type drift", () => {
  it("warns when spec type is missing from impl", () => {
    const dir = mkTmp();
    const specFile = join(dir, "x.aria");
    const implFile = join(dir, "x.ts");
    writeFileSync(specFile, `module X
  version "1.0"
  target typescript

type Currency is Enum
  eur
  usd
`);
    writeFileSync(implFile, `// no Currency type defined`);

    const report = runDriftFile(specFile, implFile);
    expect(report.findings.some((f) => f.message.includes("Currency"))).toBe(true);
  });
});

describe("runDrift — directory mode", () => {
  it("matches files by stem name across directories", () => {
    const dir = mkTmp();
    const specDir = join(dir, "specs");
    const implDir = join(dir, "src");
    mkdirSync(specDir);
    mkdirSync(implDir);

    writeFileSync(join(specDir, "payment.aria"), ARIA_SPEC);
    writeFileSync(join(implDir, "payment.ts"), MATCHING_TS);

    const reports = runDrift(specDir, implDir);
    expect(reports).toHaveLength(1);
    expect(reports[0].findings.filter((f) => f.severity === "error")).toHaveLength(0);
  });

  it("returns empty when no spec/impl pairs match", () => {
    const dir = mkTmp();
    const specDir = join(dir, "specs");
    const implDir = join(dir, "src");
    mkdirSync(specDir);
    mkdirSync(implDir);

    writeFileSync(join(specDir, "alpha.aria"), `module Alpha
  version "1.0"
  target typescript
`);
    writeFileSync(join(implDir, "beta.ts"), `export interface X {}`);

    const reports = runDrift(specDir, implDir);
    expect(reports).toHaveLength(0);
  });
});

describe("formatDriftReport", () => {
  it("emits a markdown report with summary", () => {
    const dir = mkTmp();
    const specFile = join(dir, "p.aria");
    const implFile = join(dir, "p.ts");
    writeFileSync(specFile, ARIA_SPEC);
    writeFileSync(implFile, TS_MISSING_FUNCTION);

    const report = runDriftFile(specFile, implFile);
    const formatted = formatDriftReport([report]);

    expect(formatted).toContain("# Drift Report");
    expect(formatted).toContain("error(s)");
    expect(formatted).toContain("Transfer");
  });
});
