import { describe, it, expect } from "vitest";
import { tokenize } from "../src/lexer.ts";
import { parseFile } from "../src/parser.ts";
import { check } from "../src/checker.ts";
import { generateTypeScript } from "../src/generators/typescript.ts";
import type { ContractDef } from "../src/ast.ts";

const BASE = [
  'module T',
  '  version "1.0"',
  '  target typescript',
  '',
].join('\n');

const DISPATCH_SPEC = BASE + [
  'type Method is Enum',
  '  card',
  '  bank',
  '  wallet',
  '',
  'contract ProcessCardPayment',
  '  inputs',
  '    method: Method',
  '  requires',
  '    method == card',
  '',
  'contract ProcessBankPayment',
  '  inputs',
  '    method: Method',
  '  requires',
  '    method == bank',
  '',
  'contract ProcessPayment',
  '  inputs',
  '    method: Method',
  '  dispatch on method',
  '    when card -> ProcessCardPayment',
  '    when bank -> ProcessBankPayment',
].join('\n');

describe("Phase 7.3 — Lexer", () => {
  it("tokenizes dispatch as keyword", () => {
    const tokens = tokenize("dispatch");
    expect(tokens.find((t) => t.kind === "dispatch")).toBeDefined();
  });
});

describe("Phase 7.3 — Parser dispatch block", () => {
  it("parses dispatch with field name and cases", () => {
    const m = parseFile(DISPATCH_SPEC);
    const c = m.body.find((n) => n.kind === "contract" && n.name === "ProcessPayment") as ContractDef;
    expect(c).toBeDefined();
    expect(c.dispatch).toBeDefined();
    expect(c.dispatch!.field).toBe("method");
    expect(c.dispatch!.cases).toHaveLength(2);
  });

  it("preserves dispatch case values and target contracts", () => {
    const m = parseFile(DISPATCH_SPEC);
    const c = m.body.find((n) => n.kind === "contract" && n.name === "ProcessPayment") as ContractDef;
    const cases = c.dispatch!.cases;
    expect(cases[0].value).toBe("card");
    expect(cases[0].contract).toBe("ProcessCardPayment");
    expect(cases[1].value).toBe("bank");
    expect(cases[1].contract).toBe("ProcessBankPayment");
  });

  it("dispatch is undefined when not present", () => {
    const m = parseFile(DISPATCH_SPEC);
    const c = m.body.find((n) => n.kind === "contract" && n.name === "ProcessCardPayment") as ContractDef;
    expect(c.dispatch).toBeUndefined();
  });

  it("parses dispatch with 3+ cases", () => {
    const spec = BASE + [
      'type Kind is Enum',
      '  a',
      '  b',
      '  c',
      '',
      'contract SubA',
      '  inputs',
      '    kind: Kind',
      '  requires',
      '    kind exists',
      '',
      'contract SubB',
      '  inputs',
      '    kind: Kind',
      '  requires',
      '    kind exists',
      '',
      'contract SubC',
      '  inputs',
      '    kind: Kind',
      '  requires',
      '    kind exists',
      '',
      'contract Router',
      '  inputs',
      '    kind: Kind',
      '  dispatch on kind',
      '    when a -> SubA',
      '    when b -> SubB',
      '    when c -> SubC',
    ].join('\n');
    const m = parseFile(spec);
    const c = m.body.find((n) => n.kind === "contract" && n.name === "Router") as ContractDef;
    expect(c.dispatch!.cases).toHaveLength(3);
  });
});

describe("Phase 7.3 — Checker dispatch validation", () => {
  it("accepts valid dispatch with known field and contracts", () => {
    const m = parseFile(DISPATCH_SPEC);
    const result = check(m);
    expect(result.errors.filter((e) => e.message.includes("dispatch"))).toEqual([]);
  });

  it("rejects dispatch on unknown field", () => {
    const spec = BASE + [
      'type Method is Enum',
      '  card',
      '',
      'contract Sub',
      '  inputs',
      '    method: Method',
      '  requires',
      '    method exists',
      '',
      'contract Bad',
      '  inputs',
      '    method: Method',
      '  dispatch on nonexistent',
      '    when card -> Sub',
    ].join('\n');
    const m = parseFile(spec);
    const result = check(m);
    expect(result.errors.some((e) => e.message.includes("nonexistent") && e.message.includes("not in inputs"))).toBe(true);
  });

  it("rejects dispatch case referencing unknown contract", () => {
    const spec = BASE + [
      'type Method is Enum',
      '  card',
      '',
      'contract Bad',
      '  inputs',
      '    method: Method',
      '  dispatch on method',
      '    when card -> GhostContract',
    ].join('\n');
    const m = parseFile(spec);
    const result = check(m);
    expect(result.errors.some((e) => e.message.includes("GhostContract"))).toBe(true);
  });
});

describe("Phase 7.3 — TypeScript generator dispatch", () => {
  it("emits a switch/case dispatcher function", () => {
    const m = parseFile(DISPATCH_SPEC);
    const files = generateTypeScript(m);
    const contracts = files.find((f) => f.path.includes("contracts"));
    expect(contracts?.content).toContain("switch (input.method)");
    expect(contracts?.content).toContain('case "card"');
    expect(contracts?.content).toContain('case "bank"');
    expect(contracts?.content).toContain("processCardPayment");
    expect(contracts?.content).toContain("processBankPayment");
  });

  it("does NOT emit throw stub for dispatch contracts", () => {
    const m = parseFile(DISPATCH_SPEC);
    const files = generateTypeScript(m);
    const contracts = files.find((f) => f.path.includes("contracts"));
    // ProcessPayment should use switch, not throw "Not implemented"
    // Extract the processPayment function block
    const fnMatch = contracts?.content.match(/export async function processPayment[\s\S]*?^\}/m);
    expect(fnMatch).toBeDefined();
    expect(fnMatch![0]).not.toContain("Not implemented");
  });

  it("non-dispatch contracts still use throw stub", () => {
    const m = parseFile(DISPATCH_SPEC);
    const files = generateTypeScript(m);
    const contracts = files.find((f) => f.path.includes("contracts"));
    // ProcessCardPayment should still have the throw stub
    const fnMatch = contracts?.content.match(/export async function processCardPayment[\s\S]*?^\}/m);
    expect(fnMatch).toBeDefined();
    expect(fnMatch![0]).toContain("Not implemented");
  });
});
