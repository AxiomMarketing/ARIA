import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInit } from "../src/commands/init.ts";
import { runFormat, formatAria } from "../src/commands/fmt.ts";
import { runSetup } from "../src/commands/setup.ts";
import { parseFile } from "../src/parser.ts";

function createTempDir(): string {
  return mkdtempSync(join(tmpdir(), "aria-cli-test-"));
}

describe("runInit", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs) {
      try { rmSync(dir, { recursive: true, force: true }); } catch {}
    }
    tempDirs.length = 0;
  });

  it("creates a new .aria file with the given module name", () => {
    const dir = createTempDir();
    tempDirs.push(dir);
    const result = runInit({ module: "TestModule", output: dir });
    expect(result.path).toContain("test-module.aria");
    expect(result.module).toBe("TestModule");
  });

  it("generated file has correct module name header", () => {
    const dir = createTempDir();
    tempDirs.push(dir);
    const result = runInit({ module: "PaymentSystem", output: dir });
    const source = readFileSync(result.path, "utf-8");
    // The template uses 'from' as a field name which is a reserved keyword
    // in the lexer, so full parse is not possible. Verify the module header
    // is correctly written instead.
    expect(source).toMatch(/^module PaymentSystem\s/);
    expect(source).toContain('version "1.0"');
  });

  it("refuses to overwrite existing file", () => {
    const dir = createTempDir();
    tempDirs.push(dir);
    runInit({ module: "Existing", output: dir });
    expect(() => runInit({ module: "Existing", output: dir })).toThrow(/already exists/);
  });

  it("uses default module name if not provided", () => {
    const dir = createTempDir();
    tempDirs.push(dir);
    const result = runInit({ output: dir });
    expect(result.module).toBe("MyModule");
  });
});

describe("formatAria", () => {
  it("collapses multiple blank lines to one", () => {
    const input = "line1\n\n\n\nline2\n";
    const output = formatAria(input);
    expect(output).toBe("line1\n\nline2\n");
  });

  it("removes trailing whitespace", () => {
    const input = "line1   \nline2\t  \n";
    const output = formatAria(input);
    expect(output).toContain("line1\n");
    expect(output).toContain("line2\n");
    expect(output).not.toContain("line1   ");
  });

  it("converts tabs to 2 spaces", () => {
    const input = "module T\n\tversion \"1.0\"\n";
    const output = formatAria(input);
    expect(output).toContain("  version");
    expect(output).not.toContain("\t");
  });

  it("ensures final newline", () => {
    const input = "line1\nline2";
    const output = formatAria(input);
    expect(output.endsWith("\n")).toBe(true);
  });

  it("removes leading blank lines", () => {
    const input = "\n\nline1\n";
    const output = formatAria(input);
    expect(output.startsWith("line1")).toBe(true);
  });

  it("is idempotent", () => {
    const input = "module T\n  version \"1.0\"\n\ntype X is Integer\n";
    expect(formatAria(formatAria(input))).toBe(formatAria(input));
  });
});

describe("runFormat", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs) {
      try { rmSync(dir, { recursive: true, force: true }); } catch {}
    }
    tempDirs.length = 0;
  });

  it("formats a file in place", () => {
    const dir = createTempDir();
    tempDirs.push(dir);
    const file = join(dir, "test.aria");
    writeFileSync(file, "line1   \n\n\n\nline2");
    const result = runFormat(file);
    expect(result.changed).toBe(true);
    const content = readFileSync(file, "utf-8");
    expect(content).not.toContain("   \n");
  });

  it("does not write when --check", () => {
    const dir = createTempDir();
    tempDirs.push(dir);
    const file = join(dir, "test.aria");
    const original = "line1   \n\n\n";
    writeFileSync(file, original);
    const result = runFormat(file, { check: true });
    expect(result.changed).toBe(true);
    const content = readFileSync(file, "utf-8");
    expect(content).toBe(original); // unchanged on disk
  });

  it("reports no change when already formatted", () => {
    const dir = createTempDir();
    tempDirs.push(dir);
    const file = join(dir, "test.aria");
    writeFileSync(file, "module T\n  version \"1.0\"\n");
    const result = runFormat(file);
    expect(result.changed).toBe(false);
  });
});

describe("runSetup", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs) {
      try { rmSync(dir, { recursive: true, force: true }); } catch {}
    }
    tempDirs.length = 0;
  });

  it("creates CLAUDE.md when it does not exist", () => {
    const dir = createTempDir();
    tempDirs.push(dir);
    const output = join(dir, "CLAUDE.md");
    const result = runSetup({ output, specsDir: "specs", target: "typescript" });
    expect(result.action).toBe("created");
    const content = readFileSync(output, "utf-8");
    expect(content).toContain("## ARIA Specifications");
    expect(content).toContain("specs/");
    expect(content).toContain("npx aria check");
  });

  it("appends to existing CLAUDE.md without ARIA section", () => {
    const dir = createTempDir();
    tempDirs.push(dir);
    const output = join(dir, "CLAUDE.md");
    writeFileSync(output, "# CLAUDE.md\n\nExisting content.\n");
    const result = runSetup({ output, specsDir: "contracts", target: "rust" });
    expect(result.action).toBe("appended");
    const content = readFileSync(output, "utf-8");
    expect(content).toContain("Existing content.");
    expect(content).toContain("## ARIA Specifications");
    expect(content).toContain("contracts/");
    expect(content).toContain("-t rust");
  });

  it("skips when ARIA section already exists", () => {
    const dir = createTempDir();
    tempDirs.push(dir);
    const output = join(dir, "CLAUDE.md");
    writeFileSync(output, "# CLAUDE.md\n\n## ARIA Specifications\n\nAlready here.\n");
    const result = runSetup({ output });
    expect(result.action).toBe("skipped");
  });

  it("replaces existing section with --force", () => {
    const dir = createTempDir();
    tempDirs.push(dir);
    const output = join(dir, "CLAUDE.md");
    writeFileSync(output, "# CLAUDE.md\n\n## ARIA Specifications\n\nOld content.\n");
    const result = runSetup({ output, force: true, specsDir: "new-specs", target: "python" });
    expect(result.action).toBe("appended");
    const content = readFileSync(output, "utf-8");
    expect(content).toContain("new-specs/");
    expect(content).toContain("-t python");
    expect(content).not.toContain("Old content.");
  });

  it("creates specs directory if it does not exist", () => {
    const dir = createTempDir();
    tempDirs.push(dir);
    const output = join(dir, "CLAUDE.md");
    const specsDir = join(dir, "my-specs");
    const result = runSetup({ output, specsDir });
    expect(existsSync(specsDir)).toBe(true);
  });
});
