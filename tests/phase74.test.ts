import { describe, it, expect } from "vitest";
import { tokenize } from "../src/lexer.ts";
import { parseFile } from "../src/parser.ts";
import { generateTypeScript } from "../src/generators/typescript.ts";
import { generateRust } from "../src/generators/rust.ts";
import { generateMermaid } from "../src/generators/mermaid.ts";
import type { BehaviorDef } from "../src/ast.ts";

const BASE = [
  'module T',
  '  version "1.0"',
  '  target typescript',
  '',
].join('\n');

describe("Phase 7.4 — Temporal keywords (lexer)", () => {
  it("tokenizes always as keyword", () => {
    const tokens = tokenize("always");
    const kw = tokens.find((t) => t.kind === "always");
    expect(kw).toBeDefined();
  });

  it("tokenizes never as keyword", () => {
    const tokens = tokenize("never");
    const kw = tokens.find((t) => t.kind === "never");
    expect(kw).toBeDefined();
  });

  it("tokenizes eventually as keyword", () => {
    const tokens = tokenize("eventually");
    const kw = tokens.find((t) => t.kind === "eventually");
    expect(kw).toBeDefined();
  });

  it("tokenizes leads_to as keyword", () => {
    const tokens = tokenize("leads_to");
    const kw = tokens.find((t) => t.kind === "leads_to");
    expect(kw).toBeDefined();
  });

  it("tokenizes within as keyword", () => {
    const tokens = tokenize("within");
    const kw = tokens.find((t) => t.kind === "within");
    expect(kw).toBeDefined();
  });
});

describe("Phase 7.4 — Temporal assertions in invariants (parser)", () => {
  const BEHAVIOR_SPEC = BASE + [
    'behavior Order',
    '  states',
    '    created',
    '    paid',
    '    shipped',
    '    delivered',
    '  initial created',
    '  transitions',
    '    created -> paid',
    '    paid -> shipped',
    '    shipped -> delivered',
    '  invariants',
    '    always balance >= 0',
    '    never status == invalid',
    '    eventually delivered_at exists',
    '    once paid implies paid_at exists',
    '    leads_to created -> paid within 24 hours',
  ].join('\n');

  it("parses all 5 temporal constructs as invariants", () => {
    const m = parseFile(BEHAVIOR_SPEC);
    const b = m.body.find((n) => n.kind === "behavior") as BehaviorDef;
    expect(b).toBeDefined();
    expect(b.invariants).toHaveLength(5);
  });

  it("preserves 'always' in the invariant expression", () => {
    const m = parseFile(BEHAVIOR_SPEC);
    const b = m.body.find((n) => n.kind === "behavior") as BehaviorDef;
    const exprs = b.invariants.map((i) => i.expression);
    expect(exprs.some((e) => e.includes("always"))).toBe(true);
  });

  it("preserves 'never' in the invariant expression", () => {
    const m = parseFile(BEHAVIOR_SPEC);
    const b = m.body.find((n) => n.kind === "behavior") as BehaviorDef;
    const exprs = b.invariants.map((i) => i.expression);
    expect(exprs.some((e) => e.includes("never"))).toBe(true);
  });

  it("preserves 'eventually' in the invariant expression", () => {
    const m = parseFile(BEHAVIOR_SPEC);
    const b = m.body.find((n) => n.kind === "behavior") as BehaviorDef;
    const exprs = b.invariants.map((i) => i.expression);
    expect(exprs.some((e) => e.includes("eventually"))).toBe(true);
  });

  it("preserves 'leads_to X -> Y within N hours' intact", () => {
    const m = parseFile(BEHAVIOR_SPEC);
    const b = m.body.find((n) => n.kind === "behavior") as BehaviorDef;
    const leadsTo = b.invariants.find((i) => i.expression.includes("leads_to"));
    expect(leadsTo).toBeDefined();
    expect(leadsTo!.expression).toContain("within");
    expect(leadsTo!.expression).toContain("24");
    expect(leadsTo!.expression).toContain("hours");
  });
});

describe("Phase 7.4 — Temporal assertions in generators", () => {
  const SPEC = BASE + [
    'behavior Order',
    '  --- Order lifecycle',
    '  states',
    '    created',
    '    paid',
    '  initial created',
    '  transitions',
    '    created -> paid',
    '  invariants',
    '    always balance >= 0',
    '    eventually paid_at exists',
  ].join('\n');

  it("Mermaid emits invariants as a note on the state diagram", () => {
    const m = parseFile(SPEC);
    const diagrams = generateMermaid(m);
    expect(diagrams[0].diagram).toContain("Invariants");
    expect(diagrams[0].diagram).toContain("always balance");
    expect(diagrams[0].diagram).toContain("eventually paid_at");
  });

  it("TypeScript emits invariants as @invariant JSDoc tags", () => {
    const m = parseFile(SPEC);
    const files = generateTypeScript(m);
    const behaviors = files.find((f) => f.path.includes("behaviors"));
    expect(behaviors?.content).toContain("@invariant always balance");
    expect(behaviors?.content).toContain("@invariant eventually paid_at");
  });

  it("TypeScript exports invariants array at runtime", () => {
    const m = parseFile(SPEC);
    const files = generateTypeScript(m);
    const behaviors = files.find((f) => f.path.includes("behaviors"));
    expect(behaviors?.content).toContain("OrderInvariants");
    expect(behaviors?.content).toMatch(/always balance/);
  });

  it("Rust emits invariants as /// doc comments above the state enum", () => {
    const m = parseFile(SPEC);
    const files = generateRust(m);
    const allContent = files.map((f) => f.content).join("\n");
    expect(allContent).toContain("# Invariants");
    expect(allContent).toContain("`always balance");
  });

  it("Rust exports INVARIANTS static slice", () => {
    const m = parseFile(SPEC);
    const files = generateRust(m);
    const allContent = files.map((f) => f.content).join("\n");
    expect(allContent).toContain("ORDER_INVARIANTS");
  });
});

describe("Phase 7.4 — No regression on behaviors without invariants", () => {
  it("omits @invariant JSDoc when behavior has none", () => {
    const spec = BASE + [
      'behavior Simple',
      '  states',
      '    a',
      '    b',
      '  initial a',
      '  transitions',
      '    a -> b',
    ].join('\n');
    const m = parseFile(spec);
    const files = generateTypeScript(m);
    const behaviors = files.find((f) => f.path.includes("behaviors"));
    expect(behaviors?.content).not.toContain("@invariant");
    expect(behaviors?.content).not.toContain("SimpleInvariants");
  });

  it("Mermaid omits Invariants note when behavior has none", () => {
    const spec = BASE + [
      'behavior Simple',
      '  states',
      '    a',
      '    b',
      '  initial a',
      '  transitions',
      '    a -> b',
    ].join('\n');
    const m = parseFile(spec);
    const diagrams = generateMermaid(m);
    expect(diagrams[0].diagram).not.toContain("Invariants");
  });
});
