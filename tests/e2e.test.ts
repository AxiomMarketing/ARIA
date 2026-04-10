import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseFile } from "../src/parser.ts";
import { check } from "../src/checker.ts";
import { generateTypeScript } from "../src/generators/typescript.ts";
import { generateRust } from "../src/generators/rust.ts";
import { generatePython } from "../src/generators/python.ts";
import { generateJsonSchema } from "../src/generators/jsonschema.ts";
import { generateMermaid } from "../src/generators/mermaid.ts";
import { generateTests } from "../src/generators/tests.ts";

const EXAMPLES = resolve(__dirname, "..", "examples");

const SIMPLE_SPEC = [
  'module Simple',
  '  version "1.0"',
  '  target typescript',
  '',
  'type Money is Integer',
  '  where self > 0',
  '  where self <= 1_000_000',
  '',
  'type Account is Record',
  '  id: String',
  '  balance: Money',
  '',
  'behavior Flow',
  '  states',
  '    draft',
  '    confirmed',
  '    cancelled',
  '  initial draft',
  '  transitions',
  '    draft -> confirmed',
  '    confirmed -> cancelled',
].join('\n');

describe("E2E — example files parse and check", () => {
  // NOTE: Only auth.aria is tested here. payment.aria and order.aria trigger the
  // known parser infinite loop on inline `ensures` + `examples` constructs —
  // this is documented in the roadmap as a Phase 2.2 deferred bug.
  const AUTH_PATH = join(EXAMPLES, "auth.aria");

  it("auth.aria fixture exists", () => {
    expect(existsSync(AUTH_PATH)).toBe(true);
  });

  it("auth.aria parses without error", () => {
    const source = readFileSync(AUTH_PATH, "utf-8");
    expect(() => parseFile(source)).not.toThrow();
  });

  it("auth.aria produces a module with Authentication name", () => {
    const source = readFileSync(AUTH_PATH, "utf-8");
    const module = parseFile(source);
    expect(module.name).toBe("Authentication");
    expect(module.body.length).toBeGreaterThan(0);
  });

  it("auth.aria passes semantic check with zero errors", () => {
    const source = readFileSync(AUTH_PATH, "utf-8");
    const module = parseFile(source);
    const result = check(module);
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("payment.aria parses without error", () => {
    const path = join(EXAMPLES, "payment.aria");
    if (!existsSync(path)) return;
    const source = readFileSync(path, "utf-8");
    expect(() => parseFile(source)).not.toThrow();
    const module = parseFile(source);
    expect(module.name).toBe("PaymentProcessing");
    expect(module.body.length).toBeGreaterThan(10);
  });

  it("payment.aria passes semantic check", () => {
    const path = join(EXAMPLES, "payment.aria");
    if (!existsSync(path)) return;
    const source = readFileSync(path, "utf-8");
    const module = parseFile(source);
    const result = check(module);
    expect(result.errors).toEqual([]);
  });

  it("order.aria parses without error", () => {
    const path = join(EXAMPLES, "order.aria");
    if (!existsSync(path)) return;
    const source = readFileSync(path, "utf-8");
    expect(() => parseFile(source)).not.toThrow();
    const module = parseFile(source);
    expect(module.name).toBe("OrderProcessing");
  });

  // Note: order.aria references Email type (cross-module) and ChargePayment (external contract),
  // so it does not pass semantic check in isolation. Parsing alone is sufficient here.
});

describe("E2E — full pipeline (parse → check → gen TypeScript)", () => {
  it("produces type + behavior files from a simple spec", () => {
    const module = parseFile(SIMPLE_SPEC);
    const result = check(module);
    expect(result.ok).toBe(true);

    const files = generateTypeScript(module);
    expect(files.length).toBeGreaterThan(0);

    const types = files.find((f) => f.path.includes("types"));
    expect(types?.content).toContain("Money");
    expect(types?.content).toContain("Account");

    const behaviors = files.find((f) => f.path.includes("behaviors"));
    expect(behaviors?.content).toContain("Flow");
  });

  it("generated TypeScript contains valid import + export structure", () => {
    const module = parseFile(SIMPLE_SPEC);
    const files = generateTypeScript(module);
    const types = files.find((f) => f.path.includes("types"));
    expect(types?.content).toContain('import { z }');
    expect(types?.content).toContain("export");
  });
});

describe("E2E — multi-target generation", () => {
  it("generates all 4 targets from the same spec", () => {
    const module = parseFile(SIMPLE_SPEC);
    expect(check(module).ok).toBe(true);

    const ts = generateTypeScript(module);
    const rust = generateRust(module);
    const py = generatePython(module);
    const jsonSchema = generateJsonSchema(module);

    expect(ts.length).toBeGreaterThan(0);
    expect(rust.length).toBeGreaterThan(0);
    expect(py.length).toBeGreaterThan(0);
    expect(jsonSchema.content.length).toBeGreaterThan(0);
  });

  it("Rust output contains struct declarations", () => {
    const module = parseFile(SIMPLE_SPEC);
    const files = generateRust(module);
    const allContent = files.map((f) => f.content).join("\n");
    expect(allContent).toMatch(/pub struct \w+/);
  });

  it("Python output contains BaseModel/Annotated", () => {
    const module = parseFile(SIMPLE_SPEC);
    const files = generatePython(module);
    const allContent = files.map((f) => f.content).join("\n");
    expect(allContent).toMatch(/(class \w+\(BaseModel\)|Annotated\[)/);
  });

  it("JSON Schema output is valid JSON with $schema", () => {
    const module = parseFile(SIMPLE_SPEC);
    const file = generateJsonSchema(module);
    const parsed = JSON.parse(file.content);
    expect(parsed.$schema).toBeDefined();
  });
});

describe("E2E — behavior pipeline (parse → gen mermaid)", () => {
  it("produces Mermaid diagram from behavior", () => {
    const module = parseFile(SIMPLE_SPEC);
    const diagrams = generateMermaid(module);
    expect(diagrams.length).toBe(1);
    expect(diagrams[0].name).toBe("Flow");
    expect(diagrams[0].diagram).toContain("stateDiagram-v2");
    expect(diagrams[0].diagram).toContain("draft");
    expect(diagrams[0].diagram).toContain("confirmed");
  });

  it("Mermaid includes all transitions and terminal state", () => {
    const module = parseFile(SIMPLE_SPEC);
    const diagrams = generateMermaid(module);
    const d = diagrams[0].diagram;
    expect(d).toContain("draft --> confirmed");
    expect(d).toContain("confirmed --> cancelled");
    expect(d).toContain("cancelled --> [*]");
  });
});

describe("E2E — test generator pipeline", () => {
  it("generates a vitest test file from examples", () => {
    const spec = [
      'module TG',
      '  version "1.0"',
      '  target typescript',
      '',
      'behavior Flow',
      '  states',
      '    a',
      '    b',
      '  initial a',
      '  transitions',
      '    a -> b',
    ].join('\n');
    const module = parseFile(spec);
    const content = generateTests(module);
    expect(content).toMatch(/describe\(['"]Flow/);
  });
});
