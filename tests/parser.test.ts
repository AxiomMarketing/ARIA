import { describe, it, expect } from "vitest";
import { parseFile } from "../src/parser.ts";

describe("Parser", () => {
  it("parses minimal module", () => {
    const src = [
      'module Test',
      '  version "1.0"',
      '  target typescript',
    ].join('\n');
    const m = parseFile(src);
    expect(m.name).toBe("Test");
    expect(m.version).toBe("1.0");
  });

  it("parses type with where clauses (tokenToString fix)", () => {
    const src = [
      'module T',
      '  version "1.0"',
      '  target typescript',
      '',
      'type Money is Integer',
      '  where self > 0',
      '  where self <= 1000000',
    ].join('\n');
    const m = parseFile(src);
    const money = m.body.find((n) => n.kind === "type" && n.name === "Money");
    expect(money).toBeDefined();
    expect(money!.kind).toBe("type");
    expect((money as any).base).toBe("Integer");
    expect((money as any).whereClauses.length).toBe(2);
    expect((money as any).whereClauses[0].expression).toContain(">");
    expect((money as any).whereClauses[0].expression).not.toContain("greater");
  });

  it("parses Record type with fields", () => {
    const src = [
      'module T',
      '  version "1.0"',
      '  target typescript',
      '',
      'type Account is Record',
      '  id: String',
      '  balance: Integer',
    ].join('\n');
    const m = parseFile(src);
    const acc = m.body.find((n) => n.kind === "type" && n.name === "Account");
    expect(acc).toBeDefined();
    expect(acc!.kind).toBe("type");
    expect((acc as any).fields?.length).toBe(2);
    expect((acc as any).fields?.[0].name).toBe("id");
  });

  it("parses Enum type", () => {
    const src = [
      'module T',
      '  version "1.0"',
      '  target typescript',
      '',
      'type Status is Enum',
      '  active',
      '  frozen',
    ].join('\n');
    const m = parseFile(src);
    const status = m.body.find((n) => n.kind === "type" && n.name === "Status");
    expect(status).toBeDefined();
    expect(status!.kind).toBe("type");
    expect((status as any).variants?.length).toBe(2);
  });

  it("parses contract with inputs after doc comment (docComment fix)", () => {
    const src = [
      'module T',
      '  version "1.0"',
      '  target typescript',
      '',
      'type Amount is Integer',
      '',
      'contract Pay',
      '  --- Pays an amount',
      '  inputs',
      '    amount: Amount',
      '  requires',
      '    amount > 0',
    ].join('\n');
    const m = parseFile(src);
    const c = m.body.find((n) => n.kind === "contract" && n.name === "Pay");
    expect(c).toBeDefined();
    expect(c!.kind).toBe("contract");
    expect((c as any).docComment).toBe("Pays an amount");
    expect((c as any).inputs.length).toBe(1);
    expect((c as any).inputs[0].name).toBe("amount");
    expect((c as any).requires.length).toBeGreaterThanOrEqual(1);
  });

  it("parses rate_limit block (rate_limit fix)", () => {
    const src = [
      'module T',
      '  version "1.0"',
      '  target typescript',
      '',
      'contract Login',
      '  inputs',
      '    email: String',
      '  rate_limit',
      '    max 5 per minute per ip_address',
      '    max 10 per hour per email',
    ].join('\n');
    const m = parseFile(src);
    const c = m.body.find((n) => n.kind === "contract" && n.name === "Login");
    expect(c).toBeDefined();
    expect(c!.kind).toBe("contract");
    expect((c as any).rateLimit).toBeDefined();
    expect((c as any).rateLimit?.limits.length).toBe(2);
    expect((c as any).rateLimit?.limits[0].max).toBe(5);
    expect((c as any).rateLimit?.limits[0].period).toBe("minute");
    expect((c as any).rateLimit?.limits[0].perKey).toBe("ip_address");
  });

  it("parses behavior with states and transitions", () => {
    const src = [
      'module T',
      '  version "1.0"',
      '  target typescript',
      '',
      'behavior Flow',
      '  states',
      '    a',
      '    b',
      '    c',
      '  initial a',
      '  transitions',
      '    a -> b',
      '    b -> c',
      '  forbidden',
      '    c -> a',
    ].join('\n');
    const m = parseFile(src);
    const b = m.body.find((n) => n.kind === "behavior" && n.name === "Flow");
    expect(b).toBeDefined();
    expect(b!.kind).toBe("behavior");
    expect((b as any).states.length).toBe(3);
    expect((b as any).initialState).toBe("a");
    expect((b as any).transitions.length).toBe(2);
    expect((b as any).forbidden.length).toBe(1);
  });

  it("parses regex in where clause", () => {
    const src = [
      'module T',
      '  version "1.0"',
      '  target typescript',
      '',
      'type Email is String',
      '  where self matches /^[a-z]+$/',
    ].join('\n');
    const m = parseFile(src);
    const email = m.body.find((n) => n.kind === "type" && n.name === "Email");
    expect(email).toBeDefined();
    expect(email!.kind).toBe("type");
    expect((email as any).whereClauses[0].expression).toContain("/^[a-z]+$/");
  });

  it("parses on_failure with when/return/with", () => {
    const src = [
      'module T',
      '  version "1.0"',
      '  target typescript',
      '',
      'contract Charge',
      '  inputs',
      '    amount: Integer',
      '  requires',
      '    amount > 0',
      '  on_failure',
      '    when amount > 1000',
      '      return LimitExceeded with reason: "too_high", limit: 1000',
    ].join('\n');
    const m = parseFile(src);
    const c = m.body.find((n) => n.kind === "contract" && n.name === "Charge");
    expect(c).toBeDefined();
    expect(c!.kind).toBe("contract");
    const failures = (c as any).onFailure;
    expect(failures).toHaveLength(1);
    expect(failures[0].return.type).toBe("LimitExceeded");
    expect(failures[0].return.fields).toBeDefined();
    expect(failures[0].return.fields.reason).toContain("too_high");
  });

  it("parses effects block", () => {
    const src = [
      'module T',
      '  version "1.0"',
      '  target typescript',
      '',
      'contract Notify',
      '  inputs',
      '    user: String',
      '  effects',
      '    sends Email to user.email',
      '    writes AuditLog with action: "test"',
    ].join('\n');
    const m = parseFile(src);
    const c = m.body.find((n) => n.kind === "contract" && n.name === "Notify");
    expect(c).toBeDefined();
    expect(c!.kind).toBe("contract");
    expect((c as any).effects.length).toBeGreaterThanOrEqual(1);
    expect((c as any).effects[0].action).toBe("sends");
    expect((c as any).effects[0].target).toBe("Email");
  });

  it("parses depends_on block", () => {
    const src = [
      'module T',
      '  version "1.0"',
      '  target typescript',
      '',
      'contract Process',
      '  inputs',
      '    data: String',
      '  depends_on',
      '    EmailService',
      '    Database',
    ].join('\n');
    const m = parseFile(src);
    const c = m.body.find((n) => n.kind === "contract" && n.name === "Process");
    expect(c).toBeDefined();
    expect(c!.kind).toBe("contract");
    expect((c as any).dependsOn.length).toBeGreaterThanOrEqual(2);
  });

  it("parses timeout and retry block", () => {
    const src = [
      'module T',
      '  version "1.0"',
      '  target typescript',
      '',
      'contract Call',
      '  inputs',
      '    data: String',
      '  requires',
      '    data exists',
      '  timeout 30 seconds',
      '  retry',
      '    max 3',
      '    backoff exponential',
    ].join('\n');
    const m = parseFile(src);
    const c = m.body.find((n) => n.kind === "contract" && n.name === "Call");
    expect(c).toBeDefined();
    expect((c as any).timeout).toBeDefined();
    expect((c as any).timeout.value).toBe(30);
    expect((c as any).timeout.unit).toBe("second");
    expect((c as any).retry).toBeDefined();
    expect((c as any).retry.max).toBe(3);
    expect((c as any).retry.backoff).toBe("exponential");
  });

  it("parses rate_limit with singular period normalization", () => {
    const src = [
      'module T',
      '  version "1.0"',
      '  target typescript',
      '',
      'contract Submit',
      '  inputs',
      '    data: String',
      '  rate_limit',
      '    max 5 per minute per ip',
    ].join('\n');
    const m = parseFile(src);
    const c = m.body.find((n) => n.kind === "contract" && n.name === "Submit");
    expect(c).toBeDefined();
    expect(c!.kind).toBe("contract");
    expect((c as any).rateLimit.limits[0].period).toBe("minute");
  });
});
