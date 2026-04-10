import { describe, it, expect } from "vitest";
import { formatError, suggestFix } from "../src/errors.ts";

describe("formatError", () => {
  it("formats a basic error without source", () => {
    const output = formatError({
      message: "Something went wrong",
      location: { line: 1, column: 1 },
    });
    expect(output).toContain("Error: Something went wrong");
  });

  it("includes source line context when provided", () => {
    const source = "line1\nline2\nline3";
    const output = formatError({
      message: "Bad token",
      location: { line: 2, column: 1, length: 5 },
      source,
    });
    expect(output).toContain("2 | line2");
  });

  it("renders caret pointing at the column", () => {
    const source = "  type Money is Bad";
    const output = formatError({
      message: "Unknown type",
      location: { line: 1, column: 17, length: 3 },
      source,
    });
    expect(output).toContain("^^^");
  });

  it("includes hint line when provided", () => {
    const output = formatError({
      message: "Missing colon",
      location: { line: 1, column: 1 },
      hint: "Use 'name: Type' syntax",
    });
    expect(output).toContain("Hint: Use 'name: Type' syntax");
  });

  it("handles out-of-range line gracefully", () => {
    const output = formatError({
      message: "Boom",
      location: { line: 99, column: 1 },
      source: "only one line",
    });
    expect(output).toContain("Error: Boom");
    expect(output).not.toContain("|"); // no context line rendered
  });

  it("defaults length to 1 when missing", () => {
    const output = formatError({
      message: "oops",
      location: { line: 1, column: 3 },
      source: "abc",
    });
    // exactly one caret
    const caretLine = output.split("\n").find((l) => l.trim().startsWith("^"));
    expect(caretLine).toBeDefined();
    expect(caretLine!.match(/\^/g)?.length).toBe(1);
  });
});

describe("suggestFix", () => {
  it("suggests colon for field syntax error", () => {
    const hint = suggestFix("Expected colon after field name", "identifier");
    expect(hint).toMatch(/name: Type/);
  });

  it("suggests == over = for doubleEquals variant", () => {
    const hint = suggestFix("Expected doubleEquals", "equals");
    expect(hint).toMatch(/==/);
  });

  it("suggests == over = for 'Expected ==' alias", () => {
    const hint = suggestFix("Expected ==", "equals");
    expect(hint).toMatch(/==/);
  });

  it("suggests unquoting identifiers when gotKind is string", () => {
    const hint = suggestFix("Expected identifier", "string");
    expect(hint).toMatch(/not be quoted/);
  });

  it("does NOT suggest unquoting when gotKind is not string", () => {
    const hint = suggestFix("Expected identifier", "integer");
    expect(hint).toBeUndefined();
  });

  it("returns undefined when no rule matches", () => {
    const hint = suggestFix("Random unrelated error", "unknown");
    expect(hint).toBeUndefined();
  });
});
