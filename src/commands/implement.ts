/**
 * ARIA Implement Command
 * Parses an .aria file, generates scaffolding, calls the AI provider per contract,
 * and writes complete implementations to the output directory.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { parseFile } from "../parser.js";
import { check, formatCheckResult } from "../checker.js";
import { generateTypeScript } from "../generators/typescript.js";
import { buildImplementPrompt } from "../prompt.js";
import { createProvider } from "../providers/index.js";
import type { ContractDef, AriaModule } from "../ast.js";
import type { ProviderName, AIProvider } from "../providers/index.js";
import { detectDangerousPatterns } from "../security.js";

export interface ImplementOptions {
  ai: ProviderName;
  target: "typescript";
  output: string;
  apiKey?: string;
  model?: string;
  /** Optional provider override — used in tests to inject a mock without calling the API */
  provider?: AIProvider;
}

export async function runImplement(file: string, opts: ImplementOptions): Promise<void> {
  // 1. Parse
  const source = readFileSync(resolve(file), "utf-8");
  let module: AriaModule;
  try {
    module = parseFile(source);
  } catch (err: any) {
    console.error(`\u2717 Parse error: ${err.message}`);
    process.exit(1);
  }

  // 2. Check — refuse if errors
  const checkResult = check(module);
  if (!checkResult.ok) {
    console.error(`\u2717 Spec has errors — fix them before running implement:`);
    console.error(formatCheckResult(checkResult));
    process.exit(1);
  }

  // 3. Generate TypeScript scaffolding
  const generatedFiles = generateTypeScript(module);

  // 4. Prepare output directory
  const outDir = resolve(opts.output);
  mkdirSync(outDir, { recursive: true });

  // Write all scaffolding files first
  for (const f of generatedFiles) {
    const outPath = join(outDir, f.path);
    writeFileSync(outPath, f.content, "utf-8");
  }

  // 5. Create AI provider (or use injected mock)
  const provider = opts.provider ?? createProvider(opts.ai, {
    apiKey: opts.apiKey,
    model: opts.model,
  });

  // 6. For each contract, build prompt and call AI
  const contracts = module.body.filter((n): n is ContractDef => n.kind === "contract");

  if (contracts.length === 0) {
    console.log(`\u26a0 No contracts found in spec — nothing to implement.`);
    return;
  }

  console.log(`\u2192 Implementing ${contracts.length} contract(s) via ${opts.ai}...`);

  // Find the contracts file to patch
  const kebabName = module.name
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase();
  const contractsFileName = `${kebabName}.contracts.ts`;
  const contractsFilePath = join(outDir, contractsFileName);

  let contractsContent = generatedFiles.find((f) => f.path === contractsFileName)?.content ?? "";

  for (const contract of contracts) {
    console.log(`  Implementing ${contract.name}...`);

    // Extract scaffolding for this specific contract function
    const scaffolding = extractContractScaffolding(contractsContent, contract.name);

    const prompt = buildImplementPrompt({
      module,
      contract,
      scaffolding,
      target: opts.target,
    });

    let implementation: string;
    try {
      implementation = await provider.generate(prompt, {
        maxTokens: 4096,
        temperature: 0.2,
      });
    } catch (err: any) {
      console.error(`  \u2717 AI call failed for ${contract.name}: ${err.message}`);
      process.exit(1);
    }

    // BE-2: Check AI output for dangerous patterns before writing to disk
    const warnings = detectDangerousPatterns(implementation);
    if (warnings.length > 0) {
      console.error(`  \u26a0 AI output for ${contract.name} contains suspicious patterns:`);
      for (const w of warnings) console.error(`    ${w}`);
      console.error(`  Review the generated code carefully before running it.`);
    }

    // Replace the stub with the AI implementation
    contractsContent = patchImplementation(contractsContent, contract.name, implementation);
    console.log(`  \u2713 ${contract.name} implemented`);
  }

  // Write the patched contracts file
  writeFileSync(contractsFilePath, contractsContent, "utf-8");

  console.log(`\n\u2713 Implementation complete. Files written to ${outDir}`);
  for (const f of generatedFiles) {
    console.log(`  ${f.path}`);
  }
}

/**
 * Extracts the scaffolding stub for a given contract from the contracts file content.
 * Returns the async function signature + body as a string.
 */
function extractContractScaffolding(content: string, contractName: string): string {
  const camel = contractName[0].toLowerCase() + contractName.slice(1);
  // Match the implementation function block (from "export async function" to closing "}")
  const startMarker = `export async function ${camel}(`;
  const startIdx = content.indexOf(startMarker);
  if (startIdx === -1) {
    return `// No scaffolding found for ${contractName}`;
  }

  // Find the matching closing brace by counting braces
  let depth = 0;
  let inFunction = false;
  let endIdx = startIdx;

  for (let i = startIdx; i < content.length; i++) {
    const ch = content[i];
    if (ch === "{") {
      depth++;
      inFunction = true;
    } else if (ch === "}") {
      depth--;
      if (inFunction && depth === 0) {
        endIdx = i + 1;
        break;
      }
    }
  }

  return content.slice(startIdx, endIdx);
}

/**
 * Replaces the throw stub inside the contract's async function with the AI implementation.
 * The AI returns a complete function — we extract the body and splice it in.
 */
function patchImplementation(content: string, contractName: string, aiOutput: string): string {
  const camel = contractName[0].toLowerCase() + contractName.slice(1);
  const stubMarker = `throw new Error("Not implemented — generate with: aria implement");`;

  // Find the function in content
  const funcStart = `export async function ${camel}(`;
  const funcIdx = content.indexOf(funcStart);
  if (funcIdx === -1) return content;

  // Find the stub throw inside the function
  const stubIdx = content.indexOf(stubMarker, funcIdx);
  if (stubIdx === -1) return content;

  // Extract the function body from the AI output (everything between the outermost braces)
  const aiBody = extractFunctionBody(aiOutput.trim());

  // Replace from the stub line back to (but not including) closing brace
  // Find beginning of stub line (including leading whitespace)
  let lineStart = stubIdx;
  while (lineStart > 0 && content[lineStart - 1] !== "\n") {
    lineStart--;
  }

  // Find end of stub line
  let lineEnd = stubIdx + stubMarker.length;
  // Advance past newline if present
  if (content[lineEnd] === "\n") lineEnd++;

  return content.slice(0, lineStart) + aiBody + "\n" + content.slice(lineEnd);
}

/**
 * Extracts the body from an AI-returned function (content between outermost braces),
 * preserving indentation. If the AI returned only the body (no function wrapper), returns as-is.
 */
function extractFunctionBody(aiOutput: string): string {
  // If the AI returned a complete function, extract the body
  const funcMatch = aiOutput.match(/^(?:export\s+)?(?:async\s+)?function\s+\w+[\s\S]*?\{([\s\S]*)\}$/);
  if (funcMatch) {
    return funcMatch[1].trim();
  }

  // Otherwise assume the AI returned just the body lines
  return aiOutput;
}
