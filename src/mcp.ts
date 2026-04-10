#!/usr/bin/env node
/**
 * ARIA MCP Server
 * Exposes ARIA compiler capabilities via the Model Context Protocol.
 * Run via: npx aria-mcp (stdio transport)
 *
 * Tools exposed:
 *   aria_check   — Validate a .aria spec string
 *   aria_gen     — Generate code from a .aria spec string
 *   aria_diagram — Generate a Mermaid state diagram
 *   aria_explain — Explain an .aria spec in natural language
 *   aria_spec    — Generate an .aria spec from a natural-language description
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { parseFile } from "./parser.js";
import { check, formatCheckResult } from "./checker.js";
import { validateInputSize, toErrorMessage } from "./security.js";
import { generateTypeScript } from "./generators/typescript.js";
import { generateRust } from "./generators/rust.js";
import { generatePython } from "./generators/python.js";
import { generateJsonSchema } from "./generators/jsonschema.js";
import { generateMermaid } from "./generators/mermaid.js";

// ============================================================================
// Tool definitions
// ============================================================================

const TOOLS = [
  {
    name: "aria_check",
    description:
      "Validate an ARIA specification. Returns parse/semantic errors and warnings. Input: the full .aria source text.",
    inputSchema: {
      type: "object" as const,
      properties: {
        source: {
          type: "string",
          description: "The complete .aria specification source text",
        },
      },
      required: ["source"],
    },
  },
  {
    name: "aria_gen",
    description:
      "Generate code from an ARIA specification. Returns generated file contents for the specified target language (typescript, rust, python, jsonschema).",
    inputSchema: {
      type: "object" as const,
      properties: {
        source: {
          type: "string",
          description: "The complete .aria specification source text",
        },
        target: {
          type: "string",
          description: "Target language: typescript (default), rust, python, jsonschema",
          enum: ["typescript", "rust", "python", "jsonschema"],
        },
      },
      required: ["source"],
    },
  },
  {
    name: "aria_diagram",
    description:
      "Generate Mermaid state diagrams from ARIA behavior blocks. Returns Mermaid stateDiagram-v2 syntax for each behavior.",
    inputSchema: {
      type: "object" as const,
      properties: {
        source: {
          type: "string",
          description: "The complete .aria specification source text",
        },
      },
      required: ["source"],
    },
  },
  {
    name: "aria_explain",
    description:
      "Parse an ARIA specification and return a structured natural-language summary of its types, contracts, and behaviors.",
    inputSchema: {
      type: "object" as const,
      properties: {
        source: {
          type: "string",
          description: "The complete .aria specification source text",
        },
      },
      required: ["source"],
    },
  },
  {
    name: "aria_spec",
    description:
      "Generate an ARIA specification template from a natural-language description. Returns a .aria source text skeleton that the user can refine.",
    inputSchema: {
      type: "object" as const,
      properties: {
        description: {
          type: "string",
          description:
            "Natural-language description of the domain, entities, contracts, and behaviors to model",
        },
        target: {
          type: "string",
          description: "Target language for the module header (default: typescript)",
          enum: ["typescript", "rust", "python"],
        },
      },
      required: ["description"],
    },
  },
];

// ============================================================================
// Tool handlers
// ============================================================================

export function handleCheck(source: string): { ok: boolean; summary: string; errors: string[]; warnings: string[] } {
  validateInputSize(source, "source");
  const module = parseFile(source);
  const result = check(module);
  return {
    ok: result.ok,
    summary: formatCheckResult(result),
    errors: result.errors.map((e) => e.message),
    warnings: result.warnings.map((w) => w.message),
  };
}

export function handleGen(
  source: string,
  target: string = "typescript"
): { files: { path: string; content: string }[] } {
  validateInputSize(source, "source");
  const module = parseFile(source);

  if (target === "typescript") {
    return { files: generateTypeScript(module) };
  } else if (target === "rust") {
    return { files: generateRust(module) };
  } else if (target === "python") {
    return { files: generatePython(module) };
  } else if (target === "jsonschema" || target === "json-schema") {
    const file = generateJsonSchema(module);
    return { files: [file] };
  }
  throw new Error(`Unknown target: ${target}. Supported: typescript, rust, python, jsonschema`);
}

export function handleDiagram(source: string): { diagrams: { name: string; mermaid: string }[] } {
  validateInputSize(source, "source");
  const module = parseFile(source);
  const outputs = generateMermaid(module);
  return {
    diagrams: outputs.map((o) => ({ name: o.name, mermaid: o.diagram })),
  };
}

export function handleExplain(source: string): string {
  validateInputSize(source, "source");
  const module = parseFile(source);
  const result = check(module);
  const lines: string[] = [];

  lines.push(`# Module: ${module.name} v${module.version}`);
  lines.push(`Targets: ${module.targets.join(", ")}`);
  if (module.supersedes) {
    lines.push(`Supersedes: ${module.supersedes.module} v${module.supersedes.version}`);
  }
  lines.push("");

  const types = module.body.filter((n) => n.kind === "type");
  const contracts = module.body.filter((n) => n.kind === "contract");
  const behaviors = module.body.filter((n) => n.kind === "behavior");

  if (types.length > 0) {
    lines.push(`## Types (${types.length})`);
    for (const t of types) {
      const desc = t.docComment ? ` — ${t.docComment}` : "";
      lines.push(`- **${t.name}** (${t.base})${desc}`);
      if (t.whereClauses.length > 0) {
        for (const w of t.whereClauses) {
          lines.push(`  - constraint: \`${w.expression}\``);
        }
      }
    }
    lines.push("");
  }

  if (contracts.length > 0) {
    lines.push(`## Contracts (${contracts.length})`);
    for (const c of contracts) {
      const desc = c.docComment ? ` — ${c.docComment}` : "";
      const depr = c.deprecated ? ` ⚠ DEPRECATED: ${c.deprecated}` : "";
      lines.push(`- **${c.name}**(${c.inputs.map((i) => `${i.name}: ${i.type.name}`).join(", ")})${desc}${depr}`);
      if (c.requires.length > 0) {
        lines.push(`  - requires: ${c.requires.map((r) => `\`${r.expression}\``).join(", ")}`);
      }
      if (c.ensures.length > 0) {
        lines.push(`  - ensures: ${c.ensures.map((e) => `\`${e.expression}\``).join(", ")}`);
      }
      if (c.onFailure.length > 0) {
        lines.push(`  - errors: ${c.onFailure.map((f) => f.return.type).join(", ")}`);
      }
      if (c.dispatch) {
        lines.push(`  - dispatches on \`${c.dispatch.field}\`: ${c.dispatch.cases.map((dc) => `${dc.value} → ${dc.contract}`).join(", ")}`);
      }
    }
    lines.push("");
  }

  if (behaviors.length > 0) {
    lines.push(`## Behaviors (${behaviors.length})`);
    for (const b of behaviors) {
      const desc = b.docComment ? ` — ${b.docComment}` : "";
      lines.push(`- **${b.name}**${desc}`);
      lines.push(`  - states: ${b.states.map((s) => s.name).join(", ")}`);
      lines.push(`  - initial: ${b.initialState}`);
      lines.push(`  - transitions: ${b.transitions.map((t) => `${t.from} → ${t.to}`).join(", ")}`);
      if (b.forbidden.length > 0) {
        lines.push(`  - forbidden: ${b.forbidden.map((f) => `${f.from} → ${f.to}`).join(", ")}`);
      }
      if (b.invariants.length > 0) {
        lines.push(`  - invariants: ${b.invariants.map((i) => `\`${i.expression}\``).join(", ")}`);
      }
    }
    lines.push("");
  }

  if (!result.ok) {
    lines.push(`## Issues`);
    for (const e of result.errors) {
      lines.push(`- ❌ ${e.message}`);
    }
  }
  if (result.warnings.length > 0) {
    if (result.ok) lines.push(`## Warnings`);
    for (const w of result.warnings) {
      lines.push(`- ⚠ ${w.message}`);
    }
  }

  return lines.join("\n");
}

export function handleSpec(description: string, target: string = "typescript"): string {
  // Generate a skeleton .aria spec from a natural-language description.
  // This is a template generator — the AI caller is expected to refine it.
  const moduleName = description
    .split(/\s+/)
    .slice(0, 3)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase().replace(/[^a-zA-Z0-9]/g, ""))
    .join("");

  return [
    `module ${moduleName || "MyModule"}`,
    `  version "1.0"`,
    `  target ${target}`,
    ``,
    `--- TODO: Define your types here`,
    `--- Description: ${description}`,
    ``,
    `type ExampleId is String`,
    `  where length(self) > 0`,
    ``,
    `type ExampleRecord is Record`,
    `  id: ExampleId`,
    `  name: String`,
    ``,
    `contract ExampleOperation`,
    `  --- TODO: Fill in based on: ${description}`,
    ``,
    `  inputs`,
    `    id: ExampleId`,
    ``,
    `  requires`,
    `    id exists`,
    ``,
    `  ensures`,
    `    result.success == true`,
    ``,
    `  examples`,
    `    given`,
    `      id: "example_001"`,
    `    then`,
    `      result.success == true`,
    ``,
  ].join("\n");
}

// ============================================================================
// Server setup
// ============================================================================

async function main() {
  const server = new Server(
    { name: "aria-mcp", version: "0.1.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case "aria_check": {
          const result = handleCheck(args?.source as string);
          return {
            content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
          };
        }
        case "aria_gen": {
          const result = handleGen(args?.source as string, (args?.target as string) || "typescript");
          return {
            content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
          };
        }
        case "aria_diagram": {
          const result = handleDiagram(args?.source as string);
          return {
            content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
          };
        }
        case "aria_explain": {
          const result = handleExplain(args?.source as string);
          return {
            content: [{ type: "text" as const, text: result }],
          };
        }
        case "aria_spec": {
          const result = handleSpec(args?.description as string, (args?.target as string) || "typescript");
          return {
            content: [{ type: "text" as const, text: result }],
          };
        }
        default:
          return {
            content: [{ type: "text" as const, text: `Unknown tool: ${name}` }],
            isError: true,
          };
      }
    } catch (err: unknown) {
      return {
        content: [{ type: "text" as const, text: `Error: ${toErrorMessage(err)}` }],
        isError: true,
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("ARIA MCP server failed:", err);
  process.exit(1);
});
