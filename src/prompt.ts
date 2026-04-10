/**
 * ARIA Prompt Builder
 * Converts an ARIA contract specification into an LLM prompt for code generation.
 */

import type { ContractDef, AriaModule } from "./ast.js";

export interface PromptContext {
  module: AriaModule;
  contract: ContractDef;
  scaffolding: string; // generated TypeScript stub from typescript.ts
  target: "typescript" | "rust" | "python";
}

const TARGET_INSTRUCTIONS: Record<string, string> = {
  typescript: "Implement in TypeScript with strict types. Use Zod for runtime validation if needed.",
  rust: "Implement in Rust with Result<T, E> error handling.",
  python: "Implement in Python 3.11+ with type hints and Pydantic models.",
};

export function buildImplementPrompt(ctx: PromptContext): string {
  const { module, contract, scaffolding, target } = ctx;
  const lines: string[] = [];

  // Role
  lines.push("You are an expert software engineer implementing a function from a formal specification.");
  lines.push("");
  lines.push(`Target language: ${target}`);
  lines.push(TARGET_INSTRUCTIONS[target] || "");
  lines.push("");

  // Module context
  lines.push(`# Module: ${module.name}`);
  if (module.author) lines.push(`Author: ${module.author}`);
  lines.push("");

  // Contract spec
  lines.push(`# Contract: ${contract.name}`);
  if (contract.docComment) {
    lines.push(contract.docComment);
    lines.push("");
  }

  // Inputs
  if (contract.inputs.length > 0) {
    lines.push("## Inputs");
    for (const inp of contract.inputs) {
      lines.push(`- \`${inp.name}: ${inp.type.name}\``);
    }
    lines.push("");
  }

  // Requires (preconditions)
  if (contract.requires.length > 0) {
    lines.push("## Preconditions (requires)");
    lines.push("Caller guarantees these are true when calling the function:");
    for (const r of contract.requires) {
      lines.push(`- ${r.expression}`);
    }
    lines.push("");
  }

  // Ensures (postconditions)
  if (contract.ensures.length > 0) {
    lines.push("## Postconditions (ensures)");
    lines.push("Your implementation MUST guarantee these are true after execution:");
    for (const e of contract.ensures) {
      lines.push(`- ${e.expression}`);
    }
    lines.push("");
  }

  // Effects
  if (contract.effects && contract.effects.length > 0) {
    lines.push("## Side Effects");
    for (const eff of contract.effects) {
      let line = `- ${eff.action} ${eff.target}`;
      if (eff.details) {
        const fields = Object.entries(eff.details).map(([k, v]) => `${k}: ${v}`).join(", ");
        line += ` (${fields})`;
      }
      lines.push(line);
    }
    lines.push("");
  }

  // Dependencies
  if (contract.dependsOn && contract.dependsOn.length > 0) {
    lines.push("## Dependencies");
    for (const dep of contract.dependsOn) {
      lines.push(`- ${dep.name}`);
    }
    lines.push("");
  }

  // On failure
  if (contract.onFailure.length > 0) {
    lines.push("## Error Cases (on_failure)");
    lines.push("Handle these specific failure cases:");
    for (const f of contract.onFailure) {
      let line = `- When \`${f.when}\` → return \`${f.return.type}\``;
      if (f.return.fields) {
        const fields = Object.entries(f.return.fields).map(([k, v]) => `${k}: ${v}`).join(", ");
        line += ` with { ${fields} }`;
      }
      lines.push(line);
    }
    lines.push("");
  }

  // Examples
  if (contract.examples.length > 0) {
    lines.push("## Examples");
    lines.push("Your implementation MUST satisfy these concrete examples:");
    for (let i = 0; i < contract.examples.length; i++) {
      const ex = contract.examples[i];
      lines.push(`### Example ${i + 1}${ex.name ? `: ${ex.name}` : ""}`);
      lines.push("Given:");
      lines.push("```json");
      lines.push(JSON.stringify(ex.given, null, 2));
      lines.push("```");
      lines.push("Then:");
      for (const a of ex.then) {
        lines.push(`- ${a.expression}`);
      }
      lines.push("");
    }
  }

  // Scaffolding
  lines.push("## Scaffolding (fill in the implementation)");
  lines.push("```" + target);
  lines.push(scaffolding);
  lines.push("```");
  lines.push("");

  // Output instructions
  lines.push("## Instructions");
  lines.push(`1. Replace the \`throw new Error("Not implemented")\` stub with a complete implementation.`);
  lines.push(`2. Your implementation MUST satisfy ALL preconditions, postconditions, error cases, and examples.`);
  lines.push(`3. Use the existing types and schemas — do not redefine them.`);
  lines.push(`4. Output ONLY the complete implementation function — no explanations, no markdown fences.`);
  lines.push(`5. The function signature must match the scaffolding exactly.`);

  return lines.join("\n");
}
