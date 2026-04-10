import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseTsSource } from "../src/importer/ts-parser.ts";
import { emitAria } from "../src/importer/aria-emitter.ts";
import { runImport, runImportFile } from "../src/commands/import.ts";

const tempDirs: string[] = [];

function mkTmp(): string {
  const d = mkdtempSync(join(tmpdir(), "aria-import-test-"));
  tempDirs.push(d);
  return d;
}

afterEach(() => {
  for (const d of tempDirs) {
    try { rmSync(d, { recursive: true, force: true }); } catch {}
  }
  tempDirs.length = 0;
});

describe("ts-parser — extract types", () => {
  it("extracts an interface as a record", () => {
    const ts = `
      export interface Account {
        id: string;
        balance: number;
        active?: boolean;
      }
    `;
    const result = parseTsSource(ts, "test.ts");
    expect(result.types).toHaveLength(1);
    const account = result.types[0];
    expect(account.kind).toBe("record");
    if (account.kind === "record") {
      expect(account.name).toBe("Account");
      expect(account.fields).toHaveLength(3);
      expect(account.fields[0].name).toBe("id");
      expect(account.fields[0].typeName).toBe("string");
      expect(account.fields[2].optional).toBe(true);
    }
  });

  it("extracts an enum", () => {
    const ts = `
      export enum Status {
        Active = "active",
        Frozen = "frozen",
        Closed = "closed",
      }
    `;
    const result = parseTsSource(ts, "test.ts");
    expect(result.types).toHaveLength(1);
    const status = result.types[0];
    expect(status.kind).toBe("enum");
    if (status.kind === "enum") {
      expect(status.variants).toEqual(["Active", "Frozen", "Closed"]);
    }
  });

  it("extracts a string union as enum", () => {
    const ts = `export type Color = "red" | "green" | "blue";`;
    const result = parseTsSource(ts, "test.ts");
    expect(result.types).toHaveLength(1);
    expect(result.types[0].kind).toBe("enum");
    if (result.types[0].kind === "enum") {
      expect(result.types[0].variants).toEqual(["red", "green", "blue"]);
    }
  });

  it("extracts a type literal as record", () => {
    const ts = `export type Point = { x: number; y: number };`;
    const result = parseTsSource(ts, "test.ts");
    expect(result.types[0].kind).toBe("record");
  });
});

describe("ts-parser — extract functions", () => {
  it("extracts an exported function with parameters and return type", () => {
    const ts = `
      export function transfer(from: string, to: string, amount: number): boolean {
        return true;
      }
    `;
    const result = parseTsSource(ts, "test.ts");
    expect(result.functions).toHaveLength(1);
    const fn = result.functions[0];
    expect(fn.name).toBe("transfer");
    expect(fn.parameters).toHaveLength(3);
    expect(fn.parameters[0].name).toBe("from");
    expect(fn.returnType).toBe("boolean");
  });

  it("detects async functions", () => {
    const ts = `export async function fetchData(): Promise<string> { return ""; }`;
    const result = parseTsSource(ts, "test.ts");
    expect(result.functions[0].isAsync).toBe(true);
  });

  it("detects throws inside function bodies", () => {
    const ts = `
      class InvalidArgError extends Error {}
      export function divide(a: number, b: number): number {
        if (b === 0) throw new InvalidArgError("division by zero");
        return a / b;
      }
    `;
    const result = parseTsSource(ts, "test.ts");
    expect(result.functions[0].throws).toContain("InvalidArgError");
  });

  it("does NOT extract non-exported functions", () => {
    const ts = `
      function privateHelper() {}
      export function publicAPI() {}
    `;
    const result = parseTsSource(ts, "test.ts");
    expect(result.functions).toHaveLength(1);
    expect(result.functions[0].name).toBe("publicAPI");
  });
});

describe("ts-parser — state machine detection", () => {
  it("detects an enum named *State as a behavior", () => {
    const ts = `
      export enum OrderState {
        Draft = "draft",
        Confirmed = "confirmed",
        Paid = "paid",
        Shipped = "shipped",
      }
    `;
    const result = parseTsSource(ts, "test.ts");
    expect(result.behaviors).toHaveLength(1);
    expect(result.behaviors[0].states).toEqual(["Draft", "Confirmed", "Paid", "Shipped"]);
  });
});

describe("aria-emitter", () => {
  it("emits a valid module header", () => {
    const result = parseTsSource(`export interface Foo { x: number }`, "test.ts");
    const aria = emitAria(result, { moduleName: "TestMod" });
    expect(aria).toContain("module TestMod");
    expect(aria).toContain('version "1.0"');
    expect(aria).toContain("target typescript");
  });

  it("emits Record types from interfaces", () => {
    const result = parseTsSource(
      `export interface Account { id: string; balance: number; }`,
      "test.ts"
    );
    const aria = emitAria(result, { moduleName: "M" });
    expect(aria).toContain("type Account is Record");
    expect(aria).toContain("id: String");
    expect(aria).toContain("balance: Integer");
  });

  it("emits Enum types from string unions", () => {
    const result = parseTsSource(
      `export type Color = "red" | "green" | "blue";`,
      "test.ts"
    );
    const aria = emitAria(result, { moduleName: "M" });
    expect(aria).toContain("type Color is Enum");
    expect(aria).toContain("  red");
    expect(aria).toContain("  green");
    expect(aria).toContain("  blue");
  });

  it("emits contracts from exported functions", () => {
    const result = parseTsSource(
      `export function pay(amount: number): boolean { return true; }`,
      "test.ts"
    );
    const aria = emitAria(result, { moduleName: "M" });
    expect(aria).toContain("contract Pay");
    expect(aria).toContain("inputs");
    expect(aria).toContain("amount: Integer");
    expect(aria).toContain("requires");
    expect(aria).toContain("ensures");
  });

  it("emits on_failure clauses from detected throws", () => {
    const result = parseTsSource(
      `
      class InvalidArg extends Error {}
      export function pay(amount: number): boolean {
        if (amount < 0) throw new InvalidArg("negative");
        return true;
      }
      `,
      "test.ts"
    );
    const aria = emitAria(result, { moduleName: "M" });
    expect(aria).toContain("on_failure");
    expect(aria).toContain("return InvalidArg");
  });
});

describe("runImportFile", () => {
  it("imports a single .ts file and writes a .aria spec", () => {
    const dir = mkTmp();
    const tsFile = join(dir, "payment.ts");
    writeFileSync(
      tsFile,
      `
      export interface Account {
        id: string;
        balance: number;
      }
      export function transfer(from: Account, to: Account, amount: number): boolean {
        return true;
      }
      `,
      "utf-8"
    );
    const outDir = join(dir, "specs");
    const result = runImportFile(tsFile, { output: outDir });
    expect(result.typeCount).toBe(1);
    expect(result.contractCount).toBe(1);
    expect(existsSync(result.outputPath)).toBe(true);
    const ariaContent = readFileSync(result.outputPath, "utf-8");
    expect(ariaContent).toContain("module Payment");
    expect(ariaContent).toContain("type Account is Record");
    expect(ariaContent).toContain("contract Transfer");
  });

  it("creates the output directory if missing", () => {
    const dir = mkTmp();
    const tsFile = join(dir, "x.ts");
    writeFileSync(tsFile, `export function x(): void {}`);
    const outDir = join(dir, "nested", "specs");
    const result = runImportFile(tsFile, { output: outDir });
    expect(existsSync(outDir)).toBe(true);
    expect(existsSync(result.outputPath)).toBe(true);
  });
});

describe("runImport — directory mode", () => {
  it("imports all .ts files in a directory", () => {
    const dir = mkTmp();
    mkdirSync(join(dir, "src"));
    writeFileSync(join(dir, "src", "a.ts"), `export interface A { x: number }`);
    writeFileSync(join(dir, "src", "b.ts"), `export interface B { y: string }`);
    writeFileSync(join(dir, "src", "c.test.ts"), `export interface C {}`); // Should be skipped

    const outDir = join(dir, "specs");
    const results = runImport(join(dir, "src"), { output: outDir });
    expect(results).toHaveLength(2); // a.ts + b.ts, NOT c.test.ts
  });

  it("skips node_modules and hidden directories", () => {
    const dir = mkTmp();
    mkdirSync(join(dir, "src"));
    mkdirSync(join(dir, "src", "node_modules"));
    writeFileSync(join(dir, "src", "real.ts"), `export interface X {}`);
    writeFileSync(join(dir, "src", "node_modules", "fake.ts"), `export interface Y {}`);

    const outDir = join(dir, "specs");
    const results = runImport(join(dir, "src"), { output: outDir });
    expect(results).toHaveLength(1);
    expect(results[0].moduleName).toBe("Real");
  });
});
