import { describe, it, expect } from "vitest";
import { parseFile } from "../src/parser.ts";
import { check, formatCheckResult } from "../src/checker.ts";

const BASE = [
  'module T',
  '  version "1.0"',
  '  target typescript',
  '',
].join('\n');

describe("Checker — type resolution", () => {
  it("accepts valid primitive type references", () => {
    const m = parseFile(BASE + 'type Money is Integer\n  where self > 0');
    const result = check(m);
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("accepts Record referencing defined types", () => {
    const m = parseFile(
      BASE +
        'type Money is Integer\n  where self > 0\n' +
        '\ntype Account is Record\n  balance: Money'
    );
    const result = check(m);
    expect(result.ok).toBe(true);
  });

  it("reports unknown type in record field", () => {
    const m = parseFile(
      BASE + 'type Account is Record\n  balance: DoesNotExist'
    );
    const result = check(m);
    expect(result.ok).toBe(false);
    expect(result.errors[0].message).toMatch(/unknown type "DoesNotExist"/);
  });

  it("reports unknown type in contract input", () => {
    const m = parseFile(
      BASE +
        'contract Pay\n  inputs\n    amount: NotDefined\n  requires\n    amount > 0'
    );
    const result = check(m);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.message.includes("NotDefined"))).toBe(true);
  });

  it("accepts List<X> where X is a known type (unwraps List<>)", () => {
    const m = parseFile(
      BASE +
        'type Money is Integer\n  where self > 0\n' +
        '\ncontract Batch\n  inputs\n    items: List of Money\n  requires\n    items.length > 0'
    );
    const result = check(m);
    expect(result.ok).toBe(true);
  });

  it("rejects List<X> where X is unknown", () => {
    const m = parseFile(
      BASE +
        'contract Batch\n  inputs\n    items: List of GhostType\n  requires\n    items.length > 0'
    );
    const result = check(m);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.message.includes("GhostType"))).toBe(true);
  });

  it("accepts imported types", () => {
    const m = parseFile(
      'module T\n  version "1.0"\n  target typescript\n' +
        '  import Money from "./shared.aria"\n' +
        '\ntype Account is Record\n  balance: Money'
    );
    const result = check(m);
    expect(result.ok).toBe(true);
  });
});

describe("Checker — duplicate detection", () => {
  it("detects duplicate type definitions and sets ok=false", () => {
    const m = parseFile(
      BASE + 'type Money is Integer\n\ntype Money is Integer'
    );
    const result = check(m);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.message.includes("Duplicate type"))).toBe(true);
  });

  it("detects duplicate contract definitions and sets ok=false", () => {
    const m = parseFile(
      BASE +
        'type Money is Integer\n' +
        '\ncontract Pay\n  inputs\n    amount: Money\n  requires\n    amount > 0\n' +
        '\ncontract Pay\n  inputs\n    amount: Money\n  requires\n    amount > 0'
    );
    const result = check(m);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.message.includes("Duplicate contract"))).toBe(true);
  });

  it("detects duplicate behavior definitions and sets ok=false", () => {
    const m = parseFile(
      BASE +
        'behavior Flow\n  states\n    a\n    b\n  initial a\n  transitions\n    a -> b\n' +
        '\nbehavior Flow\n  states\n    a\n    b\n  initial a\n  transitions\n    a -> b'
    );
    const result = check(m);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.message.includes("Duplicate behavior"))).toBe(true);
  });
});

describe("Checker — behavior forbidden states", () => {
  it("reports unknown 'from' state in forbidden", () => {
    const m = parseFile(
      BASE +
        'behavior Flow\n  states\n    a\n    b\n  initial a\n  transitions\n    a -> b\n  forbidden\n    ghost -> a'
    );
    const result = check(m);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.message.includes("forbidden") && e.message.includes("ghost"))).toBe(true);
  });

  it("reports unknown 'to' state in forbidden", () => {
    const m = parseFile(
      BASE +
        'behavior Flow\n  states\n    a\n    b\n  initial a\n  transitions\n    a -> b\n  forbidden\n    b -> phantom'
    );
    const result = check(m);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.message.includes("forbidden") && e.message.includes("phantom"))).toBe(true);
  });

  it("warns when forbidden transition is also in transitions", () => {
    const m = parseFile(
      BASE +
        'behavior Flow\n  states\n    a\n    b\n  initial a\n  transitions\n    a -> b\n  forbidden\n    a -> b'
    );
    const result = check(m);
    expect(result.warnings.some((w) => w.message.includes("forbidden transition \"a -> b\""))).toBe(true);
  });
});

describe("Checker — behavior validation", () => {
  it("accepts valid behavior with all states referenced", () => {
    const m = parseFile(
      BASE +
        'behavior Flow\n  states\n    draft\n    confirmed\n  initial draft\n  transitions\n    draft -> confirmed'
    );
    const result = check(m);
    expect(result.ok).toBe(true);
  });

  it("reports unknown initial state", () => {
    const m = parseFile(
      BASE +
        'behavior Flow\n  states\n    a\n    b\n  initial nonexistent\n  transitions\n    a -> b'
    );
    const result = check(m);
    expect(result.ok).toBe(false);
    expect(result.errors[0].message).toMatch(/initial state "nonexistent"/);
  });

  it("reports unknown 'from' state in transition", () => {
    const m = parseFile(
      BASE +
        'behavior Flow\n  states\n    a\n    b\n  initial a\n  transitions\n    ghost -> b'
    );
    const result = check(m);
    expect(result.errors.some((e) => e.message.includes("'from' state \"ghost\""))).toBe(true);
  });

  it("reports unknown 'to' state in transition", () => {
    const m = parseFile(
      BASE +
        'behavior Flow\n  states\n    a\n    b\n  initial a\n  transitions\n    a -> missing'
    );
    const result = check(m);
    expect(result.errors.some((e) => e.message.includes("'to' state \"missing\""))).toBe(true);
  });

  it("warns on unreachable state", () => {
    const m = parseFile(
      BASE +
        'behavior Flow\n  states\n    a\n    b\n    orphan\n  initial a\n  transitions\n    a -> b'
    );
    const result = check(m);
    expect(result.warnings.some((w) => w.message.includes('"orphan"') && w.message.includes("unreachable"))).toBe(true);
  });
});

describe("Checker — formatCheckResult", () => {
  it("formats empty result as success", () => {
    const output = formatCheckResult({ errors: [], warnings: [], ok: true });
    expect(output).toContain("No issues found");
  });

  it("formats errors with marker", () => {
    const output = formatCheckResult({
      errors: [{ severity: "error", message: "something bad" }],
      warnings: [],
      ok: false,
    });
    expect(output).toContain("something bad");
    expect(output).toContain("1 error");
  });

  it("formats warnings with marker", () => {
    const output = formatCheckResult({
      errors: [],
      warnings: [{ severity: "warning", message: "be careful" }],
      ok: true,
    });
    expect(output).toContain("be careful");
    expect(output).toContain("Warning");
  });

  it("includes hints when provided", () => {
    const output = formatCheckResult({
      errors: [{ severity: "error", message: "bad", hint: "try this" }],
      warnings: [],
      ok: false,
    });
    expect(output).toContain("try this");
  });
});
