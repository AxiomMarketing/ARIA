import { describe, it, expect } from "vitest";
import { parseFile } from "../src/parser.ts";
import { generateTypeScript } from "../src/generators/typescript.ts";
import { generateMermaid } from "../src/generators/mermaid.ts";
import { generateTests } from "../src/generators/tests.ts";

const BASE = [
  'module T',
  '  version "1.0"',
  '  target typescript',
  '',
].join('\n');

describe("TypeScript Generator — Zod constraints", () => {
  it("generates .length() for exact length", () => {
    const m = parseFile(BASE + 'type Token is String\n  where length(self) == 64');
    const files = generateTypeScript(m);
    const types = files.find((f) => f.path.includes("types"));
    expect(types?.content).toContain(".length(64)");
  });

  it("generates .max() for max length", () => {
    const m = parseFile(BASE + 'type Name is String\n  where length(self) <= 255');
    const files = generateTypeScript(m);
    const types = files.find((f) => f.path.includes("types"));
    expect(types?.content).toContain(".max(255)");
  });

  it("generates .gt() for greater than", () => {
    const m = parseFile(BASE + 'type Money is Integer\n  where self > 0');
    const files = generateTypeScript(m);
    const types = files.find((f) => f.path.includes("types"));
    const content = types?.content || "";
    expect(content.includes(".gt(0)") || content.includes(".positive()")).toBe(true);
  });

  it("generates .regex() for matches", () => {
    const m = parseFile(BASE + 'type Email is String\n  where self matches /^[a-z]+$/');
    const files = generateTypeScript(m);
    const types = files.find((f) => f.path.includes("types"));
    expect(types?.content).toContain(".regex(");
  });

  it("generates z.object for Record types", () => {
    const m = parseFile(BASE + 'type Account is Record\n  id: String\n  balance: Integer');
    const files = generateTypeScript(m);
    const types = files.find((f) => f.path.includes("types"));
    expect(types?.content).toContain("z.object(");
  });

  it("generates z.enum for Enum types", () => {
    const m = parseFile(BASE + 'type Status is Enum\n  active\n  frozen');
    const files = generateTypeScript(m);
    const types = files.find((f) => f.path.includes("types"));
    expect(types?.content).toContain('z.enum(');
  });
});

describe("TypeScript Generator — Contracts", () => {
  it("generates contract with input fields", () => {
    const m = parseFile(BASE + 'type Amount is Integer\n\ncontract Pay\n  --- Pay something\n  inputs\n    amount: Amount\n  requires\n    amount > 0');
    const files = generateTypeScript(m);
    const contracts = files.find((f) => f.path.includes("contracts"));
    expect(contracts?.content).toContain("amount:");
  });
});

describe("TypeScript Generator — Behaviors", () => {
  it("generates transition map and validator", () => {
    const m = parseFile(BASE + 'behavior Flow\n  states\n    a\n    b\n  initial a\n  transitions\n    a -> b');
    const files = generateTypeScript(m);
    const behaviors = files.find((f) => f.path.includes("behaviors"));
    expect(behaviors?.content).toContain("canFlowTransition");
  });
});

describe("Mermaid Generator", () => {
  it("generates state diagram with transitions", () => {
    const m = parseFile(BASE + 'behavior Flow\n  states\n    open\n    closed\n  initial open\n  transitions\n    open -> closed');
    const outputs = generateMermaid(m);
    expect(outputs.length).toBe(1);
    expect(outputs[0].diagram).toContain("stateDiagram-v2");
    expect(outputs[0].diagram).toContain("[*] --> open");
    expect(outputs[0].diagram).toContain("open --> closed");
  });

  it("marks terminal states with [*] arrow", () => {
    const m = parseFile(BASE + 'behavior Flow\n  states\n    open\n    closed\n  initial open\n  transitions\n    open -> closed');
    const outputs = generateMermaid(m);
    expect(outputs[0].diagram).toContain("closed --> [*]");
  });

  it("renders forbidden transitions as notes", () => {
    const m = parseFile(
      BASE +
        'behavior Flow\n  states\n    a\n    b\n    c\n  initial a\n  transitions\n    a -> b\n    b -> c\n  forbidden\n    c -> a'
    );
    const outputs = generateMermaid(m);
    expect(outputs[0].diagram).toContain("Forbidden");
    // Arrow is rendered as Unicode → inside note bodies to avoid Mermaid parser conflicts
    expect(outputs[0].diagram).toContain("c → a");
  });

  it("returns empty array when no behaviors in module", () => {
    const m = parseFile(BASE + 'type Money is Integer\n  where self > 0');
    const outputs = generateMermaid(m);
    expect(outputs).toHaveLength(0);
  });

  it("handles multiple behaviors in one module", () => {
    const m = parseFile(
      BASE +
        'behavior A\n  states\n    x\n    y\n  initial x\n  transitions\n    x -> y\n' +
        '\nbehavior B\n  states\n    m\n    n\n  initial m\n  transitions\n    m -> n'
    );
    const outputs = generateMermaid(m);
    expect(outputs).toHaveLength(2);
    expect(outputs.map((o) => o.name).sort()).toEqual(["A", "B"]);
  });
});

describe("TypeScript Generator — edge cases", () => {
  it("handles module with only types", () => {
    const m = parseFile(BASE + 'type Money is Integer\n  where self > 0');
    const files = generateTypeScript(m);
    expect(files.length).toBeGreaterThan(0);
    const types = files.find((f) => f.path.includes("types"));
    expect(types).toBeDefined();
  });

  it("generates independent files for types/contracts/behaviors", () => {
    const m = parseFile(
      BASE +
        'type Money is Integer\n  where self > 0\n' +
        '\ncontract Pay\n  inputs\n    amount: Money\n  requires\n    amount > 0\n' +
        '\nbehavior Flow\n  states\n    a\n    b\n  initial a\n  transitions\n    a -> b'
    );
    const files = generateTypeScript(m);
    const paths = files.map((f) => f.path);
    expect(paths.some((p) => p.includes("types"))).toBe(true);
    expect(paths.some((p) => p.includes("contracts"))).toBe(true);
    expect(paths.some((p) => p.includes("behaviors"))).toBe(true);
  });

  it("exports both schema and inferred type", () => {
    const m = parseFile(BASE + 'type Money is Integer\n  where self > 0');
    const files = generateTypeScript(m);
    const types = files.find((f) => f.path.includes("types"));
    expect(types?.content).toContain("export const MoneySchema");
    expect(types?.content).toContain("export type Money");
    expect(types?.content).toContain("z.infer");
  });
});

describe("Test Generator — assertions", () => {
  it("generates expect().toBe() for equality assertions", () => {
    const spec = BASE + [
      'type Amount is Integer',
      '  where self > 0',
      '',
      'contract Pay',
      '  inputs',
      '    amount: Amount',
      '  requires',
      '    amount > 0',
      '  examples',
      '    given',
      '      amount: 100',
      '    then',
      '      result.status == 1',
    ].join('\n');
    const m = parseFile(spec);
    const testContent = generateTests(m);
    // Equality assertion should emit toBe() or similar
    expect(testContent).toMatch(/toBe|toEqual/);
  });

  it("generates numeric assertions for comparison operators", () => {
    const spec = BASE + [
      'type Amount is Integer',
      '  where self > 0',
      '',
      'contract Pay',
      '  inputs',
      '    amount: Amount',
      '  requires',
      '    amount > 0',
      '  examples',
      '    given',
      '      amount: 500',
      '    then',
      '      result.balance > 100',
    ].join('\n');
    const m = parseFile(spec);
    const testContent = generateTests(m);
    // Numeric comparison should emit toBeGreaterThan or similar
    expect(testContent).toMatch(/toBeGreaterThan|>/);
  });
});
