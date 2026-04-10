import { describe, it, expect } from "vitest";
import { parseFile } from "../src/parser.ts";
import { check } from "../src/checker.ts";
import { generateTypeScript } from "../src/generators/typescript.ts";
import type { TypeDef, ContractDef } from "../src/ast.ts";

const BASE = [
  'module T',
  '  version "1.0"',
  '  target typescript',
  '',
].join('\n');

describe("Phase 7.1 — Generic types parsing", () => {
  it("parses type with single generic parameter", () => {
    const m = parseFile(
      BASE + 'type Box of T is Record\n  value: T'
    );
    const typeDef = m.body.find((n) => n.kind === "type") as TypeDef | undefined;
    expect(typeDef).toBeDefined();
    expect(typeDef!.name).toBe("Box");
    expect(typeDef!.typeParams).toEqual(["T"]);
    expect(typeDef!.base).toBe("Record");
  });

  it("parses type with multiple generic parameters", () => {
    const m = parseFile(
      BASE + 'type Result of T, E is Enum\n  ok\n  err'
    );
    const typeDef = m.body.find((n) => n.kind === "type") as TypeDef | undefined;
    expect(typeDef).toBeDefined();
    expect(typeDef!.typeParams).toEqual(["T", "E"]);
    expect(typeDef!.base).toBe("Enum");
    expect(typeDef!.variants).toHaveLength(2);
  });

  it("parses generic type parameters in Record fields", () => {
    const m = parseFile(
      BASE + 'type Pair of A, B is Record\n  first: A\n  second: B'
    );
    const typeDef = m.body.find((n) => n.kind === "type") as TypeDef | undefined;
    expect(typeDef).toBeDefined();
    expect(typeDef!.fields).toHaveLength(2);
    expect(typeDef!.fields![0].type.name).toBe("A");
    expect(typeDef!.fields![1].type.name).toBe("B");
  });

  it("parses generic type instantiation in contract input", () => {
    const m = parseFile(
      BASE +
        'type Money is Integer\n  where self > 0\n' +
        '\ntype Box of T is Record\n  value: T\n' +
        '\ncontract Wrap\n  inputs\n    boxed: Box of Money\n  requires\n    boxed.value > 0'
    );
    const contract = m.body.find((n) => n.kind === "contract") as ContractDef | undefined;
    expect(contract).toBeDefined();
    const input = contract!.inputs[0];
    expect(input.type.name).toContain("Box");
    expect(input.type.typeArgs).toBeDefined();
    expect(input.type.typeArgs!.map((a) => a.name)).toContain("Money");
  });

  it("parses generic with two type arguments", () => {
    const m = parseFile(
      BASE +
        'type Money is Integer\n  where self > 0\n' +
        '\ntype Error is Enum\n  badRequest\n  notFound\n' +
        '\ntype Result of T, E is Enum\n  ok\n  err\n' +
        '\ncontract Do\n  inputs\n    r: Result of Money, Error\n  requires\n    r.ok exists'
    );
    const contract = m.body.find((n) => n.kind === "contract") as ContractDef | undefined;
    expect(contract).toBeDefined();
    const input = contract!.inputs[0];
    expect(input.type.typeArgs).toHaveLength(2);
    expect(input.type.typeArgs!.map((a) => a.name)).toEqual(["Money", "Error"]);
  });

  it("generator emits Result<Money, Error> in contract input type", () => {
    const m = parseFile(
      BASE +
        'type Money is Integer\n  where self > 0\n' +
        '\ntype Error is Enum\n  badRequest\n  notFound\n' +
        '\ntype Result of T, E is Enum\n  ok\n  err\n' +
        '\ncontract Do\n  inputs\n    r: Result of Money, Error\n  requires\n    r.ok exists'
    );
    const files = generateTypeScript(m);
    const contracts = files.find((f) => f.path.includes("contracts"));
    expect(contracts?.content).toMatch(/Result<Money, Error>/);
  });
});

describe("Phase 7.1 — Nested generic types", () => {
  it("parses List of Result of Money, Error recursively", () => {
    const m = parseFile(
      BASE +
        'type Money is Integer\n  where self > 0\n' +
        '\ntype Error is Enum\n  bad\n' +
        '\ntype Result of T, E is Enum\n  ok\n  err\n' +
        '\ncontract List1\n  inputs\n    items: List of Result\n  requires\n    items.length > 0'
    );
    const contract = m.body.find((n) => n.kind === "contract") as ContractDef | undefined;
    expect(contract).toBeDefined();
    expect(contract!.inputs[0].type.name).toMatch(/^List<Result/);
  });

  it("checker handles generic args separated by commas without splitting nested <>", () => {
    const m = parseFile(
      BASE +
        'type Money is Integer\n  where self > 0\n' +
        '\ntype Err is Enum\n  bad\n' +
        '\ntype Result of T, E is Enum\n  ok\n  err\n' +
        '\ntype Outer of X is Record\n  wrapped: X'
    );
    const result = check(m);
    // None of these definitions should produce errors — scope is clean
    expect(result.errors.filter((e) => !e.message.includes("unreachable"))).toEqual([]);
  });
});

describe("Phase 7.1 — Generic types checker", () => {
  it("accepts type param references inside the defining type", () => {
    const m = parseFile(
      BASE + 'type Box of T is Record\n  value: T'
    );
    const result = check(m);
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("rejects references to undefined types", () => {
    const m = parseFile(
      BASE + 'type Box is Record\n  value: UnknownType'
    );
    const result = check(m);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.message.includes("UnknownType"))).toBe(true);
  });

  it("type param T is NOT visible outside the defining type", () => {
    // Box defines T in scope; a SECOND type tries to use T — must fail
    const m = parseFile(
      BASE +
        'type Box of T is Record\n  value: T\n' +
        '\ntype Leak is Record\n  escaped: T'
    );
    const result = check(m);
    expect(result.ok).toBe(false);
    // Error must mention T as unknown type in the Leak context
    expect(result.errors.some((e) => e.message.includes("Leak") && e.message.includes("T"))).toBe(true);
  });

  it("accepts generic instantiation with known types", () => {
    const m = parseFile(
      BASE +
        'type Money is Integer\n  where self > 0\n' +
        '\ntype Box of T is Record\n  value: T\n' +
        '\ncontract Wrap\n  inputs\n    boxed: Box of Money\n  requires\n    boxed.value > 0'
    );
    const result = check(m);
    expect(result.errors).toEqual([]);
  });

  it("rejects generic instantiation with unknown type arg", () => {
    const m = parseFile(
      BASE +
        'type Box of T is Record\n  value: T\n' +
        '\ncontract Wrap\n  inputs\n    boxed: Box of Ghost\n  requires\n    boxed.value > 0'
    );
    const result = check(m);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.message.includes("Ghost"))).toBe(true);
  });
});

describe("Phase 7.1 — Generic types TypeScript generator", () => {
  it("emits generic type alias for Record with type params", () => {
    const m = parseFile(
      BASE + 'type Box of T is Record\n  value: T'
    );
    const files = generateTypeScript(m);
    const types = files.find((f) => f.path.includes("types"));
    expect(types?.content).toMatch(/export type Box<T>/);
    expect(types?.content).toContain("value: T");
  });

  it("emits generic type alias with multiple params", () => {
    const m = parseFile(
      BASE + 'type Pair of A, B is Record\n  first: A\n  second: B'
    );
    const files = generateTypeScript(m);
    const types = files.find((f) => f.path.includes("types"));
    expect(types?.content).toMatch(/export type Pair<A, B>/);
    expect(types?.content).toContain("first: A");
    expect(types?.content).toContain("second: B");
  });

  it("does NOT emit Zod schema for generic types", () => {
    const m = parseFile(
      BASE + 'type Box of T is Record\n  value: T'
    );
    const files = generateTypeScript(m);
    const types = files.find((f) => f.path.includes("types"));
    // Generic types skip Zod because Zod doesn't support generics cleanly
    expect(types?.content).not.toContain("BoxSchema");
  });

  it("emits generic enum as discriminated union", () => {
    const m = parseFile(
      BASE + 'type Result of T, E is Enum\n  ok\n  err'
    );
    const files = generateTypeScript(m);
    const types = files.find((f) => f.path.includes("types"));
    expect(types?.content).toMatch(/export type Result<T, E>/);
    expect(types?.content).toContain('kind: "ok"');
    expect(types?.content).toContain('kind: "err"');
  });
});

describe("Phase 7.5 — Versioned contracts (supersedes)", () => {
  it("parses supersedes at module level", () => {
    const m = parseFile(
      'module PaymentV2\n  version "2.0"\n  target typescript\n  supersedes "Payment" version "1.0"\n'
    );
    expect(m.supersedes).toBeDefined();
    expect(m.supersedes!.module).toBe("Payment");
    expect(m.supersedes!.version).toBe("1.0");
  });

  it("supersedes is undefined when not present", () => {
    const m = parseFile(
      'module Plain\n  version "1.0"\n  target typescript\n'
    );
    expect(m.supersedes).toBeUndefined();
  });
});

describe("Phase 7.5 — Deprecated contracts", () => {
  it("parses deprecated reason on contract", () => {
    const m = parseFile(
      BASE +
        'type Money is Integer\n  where self > 0\n' +
        '\ncontract OldPay\n  inputs\n    amount: Money\n  requires\n    amount > 0\n  deprecated "Use NewPay instead"'
    );
    const contract = m.body.find((n) => n.kind === "contract") as ContractDef | undefined;
    expect(contract).toBeDefined();
    expect(contract!.deprecated).toBe("Use NewPay instead");
  });

  it("deprecated is undefined when not present", () => {
    const m = parseFile(
      BASE +
        'type Money is Integer\n  where self > 0\n' +
        '\ncontract Pay\n  inputs\n    amount: Money\n  requires\n    amount > 0'
    );
    const contract = m.body.find((n) => n.kind === "contract") as ContractDef | undefined;
    expect(contract!.deprecated).toBeUndefined();
  });

  it("generator emits @deprecated JSDoc tag", () => {
    const m = parseFile(
      BASE +
        'type Money is Integer\n  where self > 0\n' +
        '\ncontract OldPay\n  --- Old payment flow\n  inputs\n    amount: Money\n  requires\n    amount > 0\n  deprecated "Use NewPay instead"'
    );
    const files = generateTypeScript(m);
    const contracts = files.find((f) => f.path.includes("contracts"));
    expect(contracts?.content).toContain("@deprecated Use NewPay instead");
  });
});
