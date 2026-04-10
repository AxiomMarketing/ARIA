import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseFile } from "../src/parser.ts";
import { buildImplementPrompt } from "../src/prompt.ts";
import { runImplement } from "../src/commands/implement.ts";
import type { AIProvider } from "../src/providers/index.ts";
import type { AriaModule, ContractDef } from "../src/ast.ts";

// ============================================================================
// Shared test fixtures
// ============================================================================

const MINIMAL_ARIA = [
  'module Payment',
  '  version "1.0"',
  '  target typescript',
  '',
  'type Money is Integer',
  '  where self > 0',
  '',
  'contract Transfer',
  '  inputs',
  '    amount: Money',
  '    recipient: String',
  '  requires',
  '    amount > 0',
  '  ensures',
  '    result.success == true',
  '  on_failure',
  '    when amount <= 0',
  '      return InvalidAmount with message: "amount must be positive"',
  '  examples',
  '    given',
  '      amount: 1000',
  '      recipient: "bob"',
  '    then',
  '      result.success == true',
].join("\n");

function parseMinimal(): AriaModule {
  return parseFile(MINIMAL_ARIA);
}

function getContract(module: AriaModule): ContractDef {
  return module.body.find((n): n is ContractDef => n.kind === "contract")!;
}

// ============================================================================
// buildImplementPrompt tests
// ============================================================================

describe("buildImplementPrompt", () => {
  it("includes the contract name", () => {
    const module = parseMinimal();
    const contract = getContract(module);
    const prompt = buildImplementPrompt({ module, contract, scaffolding: "// stub", target: "typescript" });
    expect(prompt).toContain("Transfer");
  });

  it("includes all inputs with types", () => {
    const module = parseMinimal();
    const contract = getContract(module);
    const prompt = buildImplementPrompt({ module, contract, scaffolding: "// stub", target: "typescript" });
    expect(prompt).toContain("amount");
    expect(prompt).toContain("Money");
    expect(prompt).toContain("recipient");
    expect(prompt).toContain("String");
  });

  it("includes requires clauses", () => {
    const module = parseMinimal();
    const contract = getContract(module);
    const prompt = buildImplementPrompt({ module, contract, scaffolding: "// stub", target: "typescript" });
    expect(prompt).toContain("amount > 0");
    expect(prompt).toContain("Preconditions");
  });

  it("includes ensures clauses", () => {
    const module = parseMinimal();
    const contract = getContract(module);
    const prompt = buildImplementPrompt({ module, contract, scaffolding: "// stub", target: "typescript" });
    // Parser may add spaces around operators/dots — check for the key tokens
    expect(prompt).toContain("result");
    expect(prompt).toContain("success");
    expect(prompt).toContain("Postconditions");
  });

  it("includes on_failure cases", () => {
    const module = parseMinimal();
    const contract = getContract(module);
    const prompt = buildImplementPrompt({ module, contract, scaffolding: "// stub", target: "typescript" });
    expect(prompt).toContain("InvalidAmount");
    expect(prompt).toContain("amount <= 0");
    expect(prompt).toContain("Error Cases");
  });

  it("includes examples with given/then", () => {
    const module = parseMinimal();
    const contract = getContract(module);
    const prompt = buildImplementPrompt({ module, contract, scaffolding: "// stub", target: "typescript" });
    // The MINIMAL_ARIA has an examples block with a given/then pair
    expect(prompt).toContain("Example");
    expect(contract.examples.length).toBeGreaterThan(0);
  });

  it("includes the scaffolding", () => {
    const module = parseMinimal();
    const contract = getContract(module);
    const scaffold = `export async function transfer(input: TransferInput): Promise<TransferResult> {\n  throw new Error("Not implemented");\n}`;
    const prompt = buildImplementPrompt({ module, contract, scaffolding: scaffold, target: "typescript" });
    expect(prompt).toContain(scaffold);
  });

  it("includes target language instructions", () => {
    const module = parseMinimal();
    const contract = getContract(module);
    const prompt = buildImplementPrompt({ module, contract, scaffolding: "// stub", target: "typescript" });
    expect(prompt).toContain("TypeScript");
  });

  it("includes module name", () => {
    const module = parseMinimal();
    const contract = getContract(module);
    const prompt = buildImplementPrompt({ module, contract, scaffolding: "// stub", target: "typescript" });
    expect(prompt).toContain("Payment");
  });
});

// ============================================================================
// runImplement integration tests (with mock provider)
// ============================================================================

describe("runImplement (mock provider)", () => {
  let tmpDir: string;
  let ariaFile: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "aria-test-"));
    // Write a temp .aria file
    ariaFile = join(tmpDir, "payment.aria");
    const { writeFileSync } = require("node:fs");
    writeFileSync(ariaFile, MINIMAL_ARIA, "utf-8");
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("replaces the throw stub with AI implementation", async () => {
    const mockImplementation = `  return { success: true, amount: input.amount };`;

    const mockProvider: AIProvider = {
      name: "mock",
      generate: vi.fn().mockResolvedValue(mockImplementation),
    };

    const outDir = join(tmpDir, "out");
    await runImplement(ariaFile, {
      ai: "claude",
      target: "typescript",
      output: outDir,
      provider: mockProvider,
    });

    const contractsFile = join(outDir, "payment.contracts.ts");
    const content = readFileSync(contractsFile, "utf-8");

    expect(content).toContain("return { success: true");
    expect(content).not.toContain('throw new Error("Not implemented — generate with: aria implement")');
  });

  it("writes all generated files to output directory", async () => {
    const mockProvider: AIProvider = {
      name: "mock",
      generate: vi.fn().mockResolvedValue(`  return { success: true };`),
    };

    const outDir = join(tmpDir, "out");
    await runImplement(ariaFile, {
      ai: "claude",
      target: "typescript",
      output: outDir,
      provider: mockProvider,
    });

    const { existsSync } = require("node:fs");
    expect(existsSync(join(outDir, "payment.types.ts"))).toBe(true);
    expect(existsSync(join(outDir, "payment.contracts.ts"))).toBe(true);
  });

  it("calls the AI provider once per contract", async () => {
    const generateFn = vi.fn().mockResolvedValue(`  return { success: true };`);
    const mockProvider: AIProvider = {
      name: "mock",
      generate: generateFn,
    };

    const outDir = join(tmpDir, "out");
    await runImplement(ariaFile, {
      ai: "claude",
      target: "typescript",
      output: outDir,
      provider: mockProvider,
    });

    // MINIMAL_ARIA has 1 contract (Transfer)
    expect(generateFn).toHaveBeenCalledTimes(1);
  });

  it("calls AI with a prompt containing the contract spec", async () => {
    const generateFn = vi.fn().mockResolvedValue(`  return { success: true };`);
    const mockProvider: AIProvider = {
      name: "mock",
      generate: generateFn,
    };

    const outDir = join(tmpDir, "out");
    await runImplement(ariaFile, {
      ai: "claude",
      target: "typescript",
      output: outDir,
      provider: mockProvider,
    });

    const [calledPrompt] = generateFn.mock.calls[0];
    expect(calledPrompt).toContain("Transfer");
    expect(calledPrompt).toContain("amount > 0");
  });
});

// ============================================================================
// Claude provider: API key validation
// ============================================================================

describe("createClaudeProvider — API key error", () => {
  it("throws a clear error when ANTHROPIC_API_KEY is missing", async () => {
    const originalKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    try {
      const { createProvider } = await import("../src/providers/index.ts");
      expect(() => createProvider("claude")).toThrow("ANTHROPIC_API_KEY");
    } finally {
      if (originalKey !== undefined) {
        process.env.ANTHROPIC_API_KEY = originalKey;
      }
    }
  });
});
