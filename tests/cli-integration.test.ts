import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseFile } from "../src/parser.ts";
import { check } from "../src/checker.ts";
import { generateTypeScript } from "../src/generators/typescript.ts";
import { generateRust } from "../src/generators/rust.ts";
import { generatePython } from "../src/generators/python.ts";
import { generateJsonSchema } from "../src/generators/jsonschema.ts";
import { generateMermaidDoc } from "../src/generators/mermaid.ts";
import { generateTests } from "../src/generators/tests.ts";

/**
 * These tests exercise the same pipeline the CLI uses:
 *   parseFile -> check -> generateXxx -> writeFileSync
 * They do NOT spawn subprocess to avoid npx tsx startup cost.
 */

// Per-test temp dir registry, reset by beforeEach in each describe.
let tempDirs: string[] = [];

function mkTmp(): string {
  const d = mkdtempSync(join(tmpdir(), "aria-cli-int-"));
  tempDirs.push(d);
  return d;
}

function writeSpec(dir: string, name: string, content: string): string {
  const path = join(dir, name);
  writeFileSync(path, content, "utf-8");
  return path;
}

function resetTempDirs() {
  tempDirs = [];
}

function cleanupTempDirs() {
  for (const d of tempDirs) {
    try { rmSync(d, { recursive: true, force: true }); } catch {}
  }
  tempDirs = [];
}

const SIMPLE = [
  'module S',
  '  version "1.0"',
  '  target typescript',
  '',
  'type Money is Integer',
  '  where self > 0',
].join('\n');

const WITH_RECORD = [
  'module R',
  '  version "1.0"',
  '  target typescript',
  '',
  'type Money is Integer',
  '  where self > 0',
  '',
  'type Account is Record',
  '  id: String',
  '  balance: Money',
].join('\n');

const WITH_BEHAVIOR = [
  'module B',
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

describe("CLI pipeline — check command", () => {
  beforeEach(resetTempDirs);
  afterEach(cleanupTempDirs);

  it("validates a well-formed spec", () => {
    const dir = mkTmp();
    const file = writeSpec(dir, "simple.aria", SIMPLE);
    const source = readFileSync(file, "utf-8");
    const module = parseFile(source);
    expect(module.name).toBe("S");
    const result = check(module);
    expect(result.ok).toBe(true);
  });

  it("rejects a spec with unknown type reference", () => {
    const dir = mkTmp();
    const bad = [
      'module U',
      '  version "1.0"',
      '  target typescript',
      '',
      'type Account is Record',
      '  balance: NotDefined',
    ].join('\n');
    const file = writeSpec(dir, "unknown.aria", bad);
    const source = readFileSync(file, "utf-8");
    const module = parseFile(source);
    const result = check(module);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.message.includes("NotDefined"))).toBe(true);
  });

  it("throws on malformed syntax", () => {
    const dir = mkTmp();
    const file = writeSpec(dir, "broken.aria", "module @invalid");
    const source = readFileSync(file, "utf-8");
    expect(() => parseFile(source)).toThrow();
  });
});

describe("CLI pipeline — gen command (typescript)", () => {
  beforeEach(resetTempDirs);
  afterEach(cleanupTempDirs);

  it("produces .types.ts file with Money schema", () => {
    const dir = mkTmp();
    const outDir = join(dir, "out");
    mkdirSync(outDir, { recursive: true });

    const source = SIMPLE;
    const module = parseFile(source);
    const files = generateTypeScript(module);
    for (const f of files) writeFileSync(join(outDir, f.path), f.content, "utf-8");

    const written = readdirSync(outDir);
    expect(written.some((f) => f.endsWith(".types.ts"))).toBe(true);
    const typesFile = written.find((f) => f.endsWith(".types.ts"))!;
    const content = readFileSync(join(outDir, typesFile), "utf-8");
    expect(content).toContain("Money");
    expect(content).toContain("z.number()");
  });

  it("produces multiple output files for types + behaviors", () => {
    const dir = mkTmp();
    const outDir = join(dir, "out");
    mkdirSync(outDir, { recursive: true });

    const source = [
      'module M',
      '  version "1.0"',
      '  target typescript',
      '',
      'type Money is Integer',
      '  where self > 0',
      '',
      'behavior Flow',
      '  states',
      '    a',
      '    b',
      '  initial a',
      '  transitions',
      '    a -> b',
    ].join('\n');

    const module = parseFile(source);
    const files = generateTypeScript(module);
    for (const f of files) writeFileSync(join(outDir, f.path), f.content, "utf-8");

    const written = readdirSync(outDir);
    expect(written.some((f) => f.endsWith(".types.ts"))).toBe(true);
    expect(written.some((f) => f.endsWith(".behaviors.ts"))).toBe(true);
  });
});

describe("CLI pipeline — gen command (multi-target)", () => {
  it("generates Rust output with struct declarations", () => {
    const module = parseFile(WITH_RECORD);
    const files = generateRust(module);
    const allContent = files.map((f) => f.content).join("\n");
    expect(allContent).toMatch(/pub struct \w+/);
  });

  it("generates Python output with BaseModel class", () => {
    const module = parseFile(WITH_RECORD);
    const files = generatePython(module);
    const allContent = files.map((f) => f.content).join("\n");
    expect(allContent).toMatch(/(class \w+\(BaseModel\)|Annotated\[)/);
  });

  it("generates JSON Schema with $schema and Money/Account definitions", () => {
    const module = parseFile(WITH_RECORD);
    const file = generateJsonSchema(module);
    const parsed = JSON.parse(file.content);
    expect(parsed.$schema).toBeDefined();
    expect(parsed.$schema).toMatch(/json-schema/);
    // The schema should reference both defined types somewhere
    const serialized = JSON.stringify(parsed);
    expect(serialized).toContain("Money");
    expect(serialized).toContain("Account");
  });
});

describe("CLI pipeline — diagram command", () => {
  beforeEach(resetTempDirs);
  afterEach(cleanupTempDirs);

  it("generates Markdown doc with Mermaid code block", () => {
    const dir = mkTmp();
    const outFile = join(dir, "out.md");
    const module = parseFile(WITH_BEHAVIOR);
    const doc = generateMermaidDoc(module);
    writeFileSync(outFile, doc, "utf-8");

    expect(existsSync(outFile)).toBe(true);
    const content = readFileSync(outFile, "utf-8");
    expect(content).toContain("```mermaid");
    expect(content).toContain("stateDiagram-v2");
    expect(content).toContain("a --> b");
  });
});

describe("CLI pipeline — test command", () => {
  it("generates a vitest test file with describe('Flow', ...)", () => {
    const module = parseFile(WITH_BEHAVIOR);
    const testContent = generateTests(module);
    expect(testContent).toMatch(/describe\(['"]Flow/);
  });
});

describe("CLI pipeline — error propagation", () => {
  it("checker ok property is false when errors exist", () => {
    const bad = [
      'module E',
      '  version "1.0"',
      '  target typescript',
      '',
      'behavior Flow',
      '  states',
      '    a',
      '    b',
      '  initial ghost',
      '  transitions',
      '    a -> b',
    ].join('\n');
    const module = parseFile(bad);
    const result = check(module);
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("checker surfaces duplicate type as error", () => {
    const bad = [
      'module D',
      '  version "1.0"',
      '  target typescript',
      '',
      'type X is Integer',
      '',
      'type X is Integer',
    ].join('\n');
    const module = parseFile(bad);
    const result = check(module);
    expect(result.ok).toBe(false);
  });
});
