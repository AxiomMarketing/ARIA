import { describe, it, expect } from "vitest";
import { tokenize, Token } from "../src/lexer.ts";

function kinds(tokens: Token[]): string[] {
  return tokens.filter((t) => t.kind !== "newline" && t.kind !== "eof").map((t) => t.kind);
}

describe("Lexer", () => {
  it("tokenizes keywords", () => {
    const tokens = tokenize("module contract type behavior");
    const kw = kinds(tokens);
    expect(kw).toEqual(["module", "contract", "type", "behavior"]);
  });

  it("tokenizes operators", () => {
    const tokens = tokenize("== != >= <= -> > <");
    const ops = kinds(tokens);
    expect(ops).toEqual([
      "doubleEquals", "notEquals", "greaterEquals", "lessEquals",
      "arrow", "greater", "less",
    ]);
  });

  it("tokenizes integers with underscores", () => {
    const tokens = tokenize("1_000_000");
    const num = tokens.find((t) => t.kind === "integer");
    expect(num?.value).toBe(1000000);
  });

  it("tokenizes strings with escapes", () => {
    const tokens = tokenize('"hello\\nworld"');
    const str = tokens.find((t) => t.kind === "string");
    expect(str?.value).toBe("hello\nworld");
  });

  it("tokenizes regex after matches keyword", () => {
    const tokens = tokenize('matches /^[a-z]+$/');
    const regex = tokens.find((t) => t.kind === "regex");
    expect(regex?.value).toBe("^[a-z]+$");
  });

  it("preserves doc comments", () => {
    const tokens = tokenize("--- This is a doc comment");
    const doc = tokens.find((t) => t.kind === "docComment");
    expect(doc?.value).toBe("This is a doc comment");
  });

  it("skips line comments", () => {
    const tokens = tokenize("module -- this is ignored\ncontract");
    const kw = kinds(tokens);
    expect(kw).toEqual(["module", "contract"]);
  });

  it("tracks indentation", () => {
    const tokens = tokenize("module\n  type\n    where\n  contract");
    const structural = tokens
      .filter((t) => ["module", "type", "where", "contract", "indent", "dedent"].includes(t.kind))
      .map((t) => t.kind);
    expect(structural).toContain("indent");
    expect(structural).toContain("dedent");
  });

  it("reports line and column", () => {
    const tokens = tokenize("line1\nline2");
    const line2 = tokens.find((t) => t.kind === "identifier" && t.value === "line2");
    expect(line2?.line).toBe(2);
  });

  it("throws on unknown characters", () => {
    expect(() => tokenize("module @invalid")).toThrow(/Unexpected character/);
  });

  it("handles empty input with only EOF token", () => {
    const tokens = tokenize("");
    expect(tokens[tokens.length - 1].kind).toBe("eof");
    const nonStructural = tokens.filter(
      (t) => t.kind !== "eof" && t.kind !== "newline"
    );
    expect(nonStructural).toHaveLength(0);
  });

  it("handles whitespace-only input", () => {
    const tokens = tokenize("   \n   \n");
    const nonStructural = tokens.filter(
      (t) => t.kind !== "newline" && t.kind !== "eof" && t.kind !== "indent" && t.kind !== "dedent"
    );
    expect(nonStructural.length).toBe(0);
  });

  it("tokenizes decimal literals as decimal kind", () => {
    const tokens = tokenize("3.14");
    const num = tokens.find((t) => t.kind === "decimal");
    expect(num).toBeDefined();
    expect(Number(num!.value)).toBeCloseTo(3.14);
    // Must not tokenize as separate integers + dot
    const integers = tokens.filter((t) => t.kind === "integer");
    expect(integers).toHaveLength(0);
  });

  it("tokenizes multiple decimals", () => {
    const tokens = tokenize("0.001 1.5 100.25");
    const nums = tokens.filter((t) => t.kind === "decimal");
    expect(nums).toHaveLength(3);
  });

  it("emits matching INDENT/DEDENT pairs", () => {
    const tokens = tokenize("a\n  b\n    c\n  d\ne");
    const indents = tokens.filter((t) => t.kind === "indent").length;
    const dedents = tokens.filter((t) => t.kind === "dedent").length;
    expect(indents).toBe(dedents);
  });

  it("tracks column numbers on the same line", () => {
    const tokens = tokenize("module Name");
    const name = tokens.find((t) => t.kind === "identifier" && t.value === "Name");
    expect(name).toBeDefined();
    expect(name!.column).toBeGreaterThan(1);
  });

  it("handles multiple line comments", () => {
    const tokens = tokenize("-- first comment\n-- second comment\nmodule");
    const kw = kinds(tokens);
    expect(kw).toEqual(["module"]);
  });

  it("preserves newlines between statements", () => {
    const tokens = tokenize("module A\ntype B is Integer");
    const newlines = tokens.filter((t) => t.kind === "newline");
    expect(newlines.length).toBeGreaterThanOrEqual(1);
  });
});
