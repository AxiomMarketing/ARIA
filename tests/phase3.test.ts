import { describe, it, expect } from "vitest";
import { parseFile } from "../src/parser.ts";
import { generateRust } from "../src/generators/rust.ts";
import { generatePython } from "../src/generators/python.ts";
import { generateJsonSchema } from "../src/generators/jsonschema.ts";

const BASE = [
  'module T',
  '  version "1.0"',
  '  target typescript',
  '',
].join('\n');

describe("Rust Generator", () => {
  it("generates struct for Integer type with constraints", () => {
    const m = parseFile(BASE + 'type Money is Integer\n  where self > 0');
    const files = generateRust(m);
    const typesFile = files.find((f) => f.path.includes("types"));
    expect(typesFile).toBeDefined();
    expect(typesFile!.content).toContain("pub struct Money");
  });

  it("includes serde derives", () => {
    const m = parseFile(BASE + 'type Account is Record\n  id: String\n  balance: Integer');
    const files = generateRust(m);
    const typesFile = files.find((f) => f.path.includes("types"));
    expect(typesFile!.content).toMatch(/Serialize|Deserialize/);
  });

  it("generates enum for Enum types", () => {
    const m = parseFile(BASE + 'type Status is Enum\n  active\n  frozen\n  closed');
    const files = generateRust(m);
    const typesFile = files.find((f) => f.path.includes("types"));
    expect(typesFile!.content).toContain("pub enum Status");
  });

  it("generates state machine for behavior", () => {
    const m = parseFile(BASE + 'behavior Flow\n  states\n    a\n    b\n  initial a\n  transitions\n    a -> b');
    const files = generateRust(m);
    const behaviorFile = files.find((f) => f.path.includes("behavior"));
    expect(behaviorFile).toBeDefined();
    expect(behaviorFile!.content).toContain("pub enum");
  });
});

describe("Python Generator", () => {
  it("generates Annotated type for Integer with constraints", () => {
    const m = parseFile(BASE + 'type Money is Integer\n  where self > 0');
    const files = generatePython(m);
    const typesFile = files.find((f) => f.path.includes("types"));
    expect(typesFile).toBeDefined();
    expect(typesFile!.content).toContain("Annotated");
    expect(typesFile!.content).toContain("Field");
  });

  it("generates BaseModel for Record", () => {
    const m = parseFile(BASE + 'type Account is Record\n  id: String\n  balance: Integer');
    const files = generatePython(m);
    const typesFile = files.find((f) => f.path.includes("types"));
    expect(typesFile!.content).toContain("class Account");
    expect(typesFile!.content).toContain("BaseModel");
  });

  it("generates Enum subclass for Enum types", () => {
    const m = parseFile(BASE + 'type Status is Enum\n  active\n  frozen');
    const files = generatePython(m);
    const typesFile = files.find((f) => f.path.includes("types"));
    expect(typesFile!.content).toContain("class Status");
    expect(typesFile!.content).toContain("Enum");
  });

  it("includes required imports", () => {
    const m = parseFile(BASE + 'type Money is Integer\n  where self > 0');
    const files = generatePython(m);
    const typesFile = files.find((f) => f.path.includes("types"));
    expect(typesFile!.content).toContain("from pydantic import");
  });
});

describe("JSON Schema Generator", () => {
  it("returns a single file with valid JSON", () => {
    const m = parseFile(BASE + 'type Money is Integer\n  where self > 0');
    const file = generateJsonSchema(m);
    expect(file).toBeDefined();
    expect(file.path).toMatch(/\.schema\.json$/);
    const parsed = JSON.parse(file.content);
    expect(parsed).toBeDefined();
  });

  it("includes $schema and $defs", () => {
    const m = parseFile(BASE + 'type Money is Integer');
    const file = generateJsonSchema(m);
    const schema = JSON.parse(file.content);
    expect(schema.$schema).toContain("json-schema.org");
    expect(schema.$defs).toBeDefined();
  });

  it("maps Integer with where to exclusiveMinimum", () => {
    const m = parseFile(BASE + 'type Money is Integer\n  where self > 0');
    const file = generateJsonSchema(m);
    const schema = JSON.parse(file.content);
    const money = schema.$defs.Money;
    expect(money.type).toBe("integer");
    // Should have exclusiveMinimum: 0 or minimum: 1
    expect(money.exclusiveMinimum !== undefined || money.minimum !== undefined).toBe(true);
  });

  it("generates enum array for Enum types", () => {
    const m = parseFile(BASE + 'type Status is Enum\n  active\n  frozen\n  closed');
    const file = generateJsonSchema(m);
    const schema = JSON.parse(file.content);
    expect(schema.$defs.Status.enum).toEqual(["active", "frozen", "closed"]);
  });

  it("generates object with properties for Record", () => {
    const m = parseFile(BASE + 'type Money is Integer\n\ntype Account is Record\n  id: String\n  balance: Money');
    const file = generateJsonSchema(m);
    const schema = JSON.parse(file.content);
    const account = schema.$defs.Account;
    expect(account.type).toBe("object");
    expect(account.properties).toBeDefined();
    expect(account.properties.id).toBeDefined();
  });
});
