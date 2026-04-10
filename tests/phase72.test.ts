import { describe, it, expect } from "vitest";
import { tokenize } from "../src/lexer.ts";
import { parseFile } from "../src/parser.ts";
import { generateTypeScript } from "../src/generators/typescript.ts";
import { generateRust } from "../src/generators/rust.ts";
import { generatePython } from "../src/generators/python.ts";
import type { TypeDef } from "../src/ast.ts";

const BASE = [
  'module T',
  '  version "1.0"',
  '  target typescript',
  '',
].join('\n');

describe("Phase 7.2 — Lexer keywords", () => {
  it("tokenizes computed as keyword", () => {
    const tokens = tokenize("computed");
    expect(tokens.find((t) => t.kind === "computed")).toBeDefined();
  });

  it("tokenizes as as keyword", () => {
    const tokens = tokenize("as");
    expect(tokens.find((t) => t.kind === "as")).toBeDefined();
  });
});

describe("Phase 7.2 — Parser computed fields", () => {
  it("parses a record with a single computed field", () => {
    const m = parseFile(
      BASE +
        'type Order is Record\n' +
        '  subtotal: Integer\n' +
        '  total: Integer computed as subtotal + tax'
    );
    const order = m.body.find((n) => n.kind === "type") as TypeDef;
    expect(order).toBeDefined();
    expect(order.fields).toHaveLength(2);
    const subtotal = order.fields![0];
    const total = order.fields![1];
    expect(subtotal.computed).toBeUndefined();
    expect(total.computed).toBeDefined();
    expect(total.computed).toContain("subtotal");
    expect(total.computed).toContain("tax");
  });

  it("parses multiple computed fields in one record", () => {
    const m = parseFile(
      BASE +
        'type Cart is Record\n' +
        '  items: Integer\n' +
        '  price: Integer\n' +
        '  item_count: Integer computed as length(items)\n' +
        '  total: Integer computed as items * price'
    );
    const cart = m.body.find((n) => n.kind === "type") as TypeDef;
    expect(cart.fields).toHaveLength(4);
    const computedCount = cart.fields!.filter((f) => f.computed).length;
    expect(computedCount).toBe(2);
  });

  it("keeps storage and computed fields in original order", () => {
    const m = parseFile(
      BASE +
        'type X is Record\n' +
        '  a: Integer\n' +
        '  b: Integer computed as a + 1\n' +
        '  c: Integer'
    );
    const x = m.body.find((n) => n.kind === "type") as TypeDef;
    expect(x.fields!.map((f) => f.name)).toEqual(["a", "b", "c"]);
    expect(x.fields![1].computed).toBeDefined();
  });

  it("accepts computed fields alongside doc comments", () => {
    const m = parseFile(
      BASE +
        'type Pay is Record\n' +
        '  amount: Integer\n' +
        '  fee: Integer computed as amount / 10  --- 10% fee'
    );
    const pay = m.body.find((n) => n.kind === "type") as TypeDef;
    const fee = pay.fields![1];
    expect(fee.computed).toBeDefined();
    // Doc comment parsing may or may not capture the text — key is no crash
  });
});

describe("Phase 7.2 — TypeScript generator", () => {
  const SPEC = BASE + [
    'type Order is Record',
    '  subtotal: Integer',
    '  tax: Integer',
    '  total: Integer computed as subtotal + tax',
  ].join('\n');

  it("excludes computed fields from the Zod schema", () => {
    const m = parseFile(SPEC);
    const files = generateTypeScript(m);
    const types = files.find((f) => f.path.includes("types"))!;
    // The Zod schema z.object({...}) must contain subtotal and tax
    // but NOT a `total:` field key inside the object literal
    const match = types.content.match(/z\.object\(\{([^}]+)\}\)/);
    expect(match).toBeDefined();
    const objectBody = match![1];
    expect(objectBody).toContain("subtotal");
    expect(objectBody).toContain("tax");
    // Use word-boundary regex to avoid matching "subtotal" substring
    expect(objectBody).not.toMatch(/\btotal\s*:/);
  });

  it("emits a Computed interface with the derived field", () => {
    const m = parseFile(SPEC);
    const files = generateTypeScript(m);
    const types = files.find((f) => f.path.includes("types"))!;
    expect(types.content).toContain("export interface OrderComputed");
    expect(types.content).toContain("@computed subtotal + tax");
    expect(types.content).toMatch(/total:\s*number/);
  });

  it("exports type as intersection of schema infer + Computed", () => {
    const m = parseFile(SPEC);
    const files = generateTypeScript(m);
    const types = files.find((f) => f.path.includes("types"))!;
    expect(types.content).toMatch(/export type Order = z\.infer<typeof OrderSchema> & OrderComputed/);
  });

  it("records without computed fields still emit plain z.infer type", () => {
    const m = parseFile(
      BASE + 'type Simple is Record\n  id: String\n  value: Integer'
    );
    const files = generateTypeScript(m);
    const types = files.find((f) => f.path.includes("types"))!;
    expect(types.content).not.toContain("SimpleComputed");
    expect(types.content).toContain("export type Simple = z.infer<typeof SimpleSchema>");
  });
});

describe("Phase 7.2 — Rust generator", () => {
  const SPEC = BASE + [
    'type Order is Record',
    '  subtotal: Integer',
    '  total: Integer computed as subtotal * 2',
  ].join('\n');

  it("excludes computed fields from the struct body", () => {
    const m = parseFile(SPEC);
    const files = generateRust(m);
    const allContent = files.map((f) => f.content).join("\n");
    // Struct should have subtotal but not total as a field
    const structMatch = allContent.match(/pub struct Order \{([^}]+)\}/);
    expect(structMatch).toBeDefined();
    expect(structMatch![1]).toContain("subtotal");
    expect(structMatch![1]).not.toMatch(/pub total:/);
  });

  it("emits an impl block with a computed method", () => {
    const m = parseFile(SPEC);
    const files = generateRust(m);
    const allContent = files.map((f) => f.content).join("\n");
    expect(allContent).toContain("impl Order");
    expect(allContent).toContain("pub fn total(&self)");
    expect(allContent).toContain("todo!");
  });
});

describe("Phase 7.2 — Python generator", () => {
  const SPEC = BASE + [
    'type Order is Record',
    '  subtotal: Integer',
    '  total: Integer computed as subtotal + 10',
  ].join('\n');

  it("storage fields are in BaseModel class", () => {
    const m = parseFile(SPEC);
    const files = generatePython(m);
    const allContent = files.map((f) => f.content).join("\n");
    expect(allContent).toContain("class Order(BaseModel)");
    expect(allContent).toMatch(/subtotal:\s*int/);
  });

  it("computed fields become @computed_field @property", () => {
    const m = parseFile(SPEC);
    const files = generatePython(m);
    const allContent = files.map((f) => f.content).join("\n");
    expect(allContent).toContain("@computed_field");
    expect(allContent).toContain("@property");
    expect(allContent).toContain("def total(self)");
    expect(allContent).toContain("NotImplementedError");
  });

  it("imports computed_field from pydantic", () => {
    const m = parseFile(SPEC);
    const files = generatePython(m);
    const allContent = files.map((f) => f.content).join("\n");
    expect(allContent).toMatch(/from pydantic import .*computed_field/);
  });
});
