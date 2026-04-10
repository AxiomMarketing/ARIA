import { describe, it, expect } from "vitest";
import {
  handleCheck,
  handleGen,
  handleDiagram,
  handleExplain,
  handleSpec,
} from "../src/mcp.ts";

const SIMPLE = [
  'module Simple',
  '  version "1.0"',
  '  target typescript',
  '',
  'type Money is Integer',
  '  where self > 0',
  '',
  'type Account is Record',
  '  id: String',
  '  balance: Money',
  '',
  'contract Pay',
  '  inputs',
  '    amount: Money',
  '  requires',
  '    amount > 0',
].join('\n');

const WITH_BEHAVIOR = [
  'module B',
  '  version "1.0"',
  '  target typescript',
  '',
  'behavior Flow',
  '  states',
  '    open',
  '    closed',
  '  initial open',
  '  transitions',
  '    open -> closed',
].join('\n');

describe("MCP tool handlers — aria_check", () => {
  it("returns ok for valid spec", () => {
    const result = handleCheck(SIMPLE);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("returns errors for invalid type reference", () => {
    const bad = [
      'module Bad',
      '  version "1.0"',
      '  target typescript',
      '',
      'type X is Record',
      '  field: Unknown',
    ].join('\n');
    const result = handleCheck(bad);
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain("Unknown");
  });

  it("catches parse errors gracefully", () => {
    expect(() => handleCheck("module @invalid")).toThrow();
  });
});

describe("MCP tool handlers — aria_gen", () => {
  it("generates TypeScript files by default", () => {
    const result = handleGen(SIMPLE);
    expect(result.files.length).toBeGreaterThan(0);
    expect(result.files.some((f) => f.path.endsWith(".types.ts"))).toBe(true);
    expect(result.files[0].content).toContain("z.");
  });

  it("generates Rust files when target=rust", () => {
    const result = handleGen(SIMPLE, "rust");
    expect(result.files.length).toBeGreaterThan(0);
    const allContent = result.files.map((f) => f.content).join("\n");
    expect(allContent).toMatch(/pub struct/);
  });

  it("generates Python files when target=python", () => {
    const result = handleGen(SIMPLE, "python");
    expect(result.files.length).toBeGreaterThan(0);
    const allContent = result.files.map((f) => f.content).join("\n");
    expect(allContent).toMatch(/BaseModel/);
  });

  it("generates JSON Schema when target=jsonschema", () => {
    const result = handleGen(SIMPLE, "jsonschema");
    expect(result.files.length).toBe(1);
    const parsed = JSON.parse(result.files[0].content);
    expect(parsed.$schema).toBeDefined();
  });

  it("throws on unknown target", () => {
    expect(() => handleGen(SIMPLE, "cobol" as any)).toThrow(/Unknown target/);
  });
});

describe("MCP tool handlers — aria_diagram", () => {
  it("returns Mermaid diagrams for behaviors", () => {
    const result = handleDiagram(WITH_BEHAVIOR);
    expect(result.diagrams).toHaveLength(1);
    expect(result.diagrams[0].name).toBe("Flow");
    expect(result.diagrams[0].mermaid).toContain("stateDiagram-v2");
    expect(result.diagrams[0].mermaid).toContain("open --> closed");
  });

  it("returns empty array when no behaviors", () => {
    const result = handleDiagram(SIMPLE);
    expect(result.diagrams).toEqual([]);
  });
});

describe("MCP tool handlers — aria_explain", () => {
  it("returns a structured summary with types and contracts", () => {
    const result = handleExplain(SIMPLE);
    expect(result).toContain("# Module: Simple");
    expect(result).toContain("Money");
    expect(result).toContain("Account");
    expect(result).toContain("Pay");
    expect(result).toContain("amount > 0");
  });

  it("includes behavior summary when present", () => {
    const result = handleExplain(WITH_BEHAVIOR);
    expect(result).toContain("Flow");
    expect(result).toContain("open");
    expect(result).toContain("closed");
  });
});

describe("MCP tool handlers — aria_spec", () => {
  it("generates a valid .aria skeleton from description", () => {
    const result = handleSpec("user registration system");
    expect(result).toContain("module ");
    expect(result).toContain('version "1.0"');
    expect(result).toContain("target typescript");
    expect(result).toContain("contract ");
    expect(result).toContain("inputs");
    expect(result).toContain("requires");
  });

  it("uses the specified target language", () => {
    const result = handleSpec("payment processing", "rust");
    expect(result).toContain("target rust");
  });

  it("generates a parseable skeleton", () => {
    const spec = handleSpec("simple inventory management");
    // Should not throw
    expect(() => handleCheck(spec)).not.toThrow();
    const checkResult = handleCheck(spec);
    expect(checkResult.ok).toBe(true);
  });
});
