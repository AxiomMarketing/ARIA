---
layout: default
title: CLI Reference
description: Every aria CLI command, every flag, every exit code.
---

# CLI Reference

The `aria` command provides a complete toolchain for working with `.aria` specifications.

```bash
aria <command> [options]
```

Global version:

```bash
aria --version
# → 0.1.0
```

---

## `aria check`

Validate one or more `.aria` specs.

```bash
aria check <file|dir> [options]
```

**Arguments:**
- `<file|dir>` — A single `.aria` file OR a directory (scanned recursively).

**Options:**
- `--strict` — Fail if any contract lacks examples or `on_failure` cases.
- `--draft` — Allow incomplete specs (no `on_failure`, no examples).
- `--json` — Output machine-readable JSON (for editor integration).

**Exit codes:**
- `0` — Valid
- `1` — Parse or semantic error

**Examples:**

```bash
aria check payment.aria
# → ✓ payment.aria parsed successfully
#   Module: PaymentProcessing v1.0
#   Targets: typescript, rust
#   9 type(s), 4 contract(s), 1 behavior(s)

aria check specs/ --strict
# Scans the directory and fails if any spec is incomplete

aria check payment.aria --json
# { "status": "ok", "module": "PaymentProcessing", "types": 9, ... }
```

---

## `aria gen`

Generate code from a spec.

```bash
aria gen <file> [options]
```

**Options:**
- `-t, --target <lang>` — One of: `typescript` (default), `rust`, `python`, `jsonschema`.
- `-o, --output <dir>` — Output directory (default: `./generated`, created if needed).
- `--json` — Emit a JSON summary of generated files instead of human text.

**Generated file layout (TypeScript):**

```
<outDir>/
├── <module-name>.types.ts       # Zod schemas + TypeScript types
├── <module-name>.contracts.ts   # Contract stubs
├── <module-name>.behaviors.ts   # State machine validators
└── <module-name>.test.ts        # Tests from examples
```

**Examples:**

```bash
aria gen payment.aria --target typescript -o src/payment/
aria gen payment.aria --target rust -o crates/payment/src/
aria gen payment.aria --target python -o payment/
aria gen payment.aria --target jsonschema -o schemas/
```

---

## `aria diagram`

Generate a Mermaid state diagram from a spec's `behavior` blocks.

```bash
aria diagram <file> -o <outFile>
```

**Examples:**

```bash
aria diagram order.aria -o docs/order.md
# Produces a .md file with ```mermaid blocks, renderable on GitHub.
```

---

## `aria test`

Generate test files from `examples` blocks.

```bash
aria test <file> [options]
```

**Options:**
- `-o, --output <dir>` — Output directory (default: `./generated`).
- `-f, --framework <fw>` — Test framework (default: `vitest`).
- `--json` — Emit JSON summary.

The generated test file imports the generated contract stubs and runs each example as a `describe`/`it` block.

---

## `aria implement`

Run an AI model to fill in contract stubs based on the formal specification.

```bash
aria implement <file> [options]
```

**Options:**
- `--ai <provider>` — AI provider to use (default: `claude`). Currently only `claude` is supported.
- `-t, --target <lang>` — Target language (default: `typescript`). **Only `typescript` is currently supported** — other targets will error out.
- `-o, --output <dir>` — Output directory (default: `./generated`).
- `--api-key <key>` — Pass the API key inline instead of via the `ANTHROPIC_API_KEY` environment variable.
- `--model <model>` — Override the default Claude model (e.g., `claude-opus-4-6`).

**Examples:**

```bash
export ANTHROPIC_API_KEY=sk-ant-...
aria implement payment.aria --ai claude -o src/
# → Implementing 4 contract(s) via claude...
#   Implementing ChargePayment...
#   ✓ ChargePayment implemented
#   ...

# Inline API key + custom model
aria implement payment.aria --api-key sk-ant-... --model claude-sonnet-4-6 -o src/
```

---

## `aria init`

Scaffold a new `.aria` file with a module template.

```bash
aria init [--module <Name>] [-o <dir>]
```

**Options:**
- `--module <Name>` — Module name (default: `MyModule`).
- `-o, --output <dir>` — Output directory (default: current).

**Example:**

```bash
aria init --module Marketplace -o specs/
# → Created specs/marketplace.aria
```

---

## `aria watch`

Re-run `check` (and optionally `gen`) on file changes.

```bash
aria watch <path> [options]
```

**Arguments:**
- `<path>` — A single `.aria` file OR a directory (watches all `.aria` files within).

**Options:**
- `--gen` — Also regenerate code on every change (not just `check`).
- `-o, --output <dir>` — Output directory when `--gen` is set.
- `-t, --target <lang>` — Target language when `--gen` is set (default: `typescript`).

**Examples:**

```bash
# Watch a single file and re-check on every save
aria watch spec.aria

# Watch a directory and regenerate TypeScript on every change
aria watch specs/ --gen -o src/ -t typescript
```

---

## `aria setup`

Add the ARIA section to your project's `CLAUDE.md` so Claude Code naturally works with your specs.

```bash
aria setup [options]
```

**Options:**
- `-o, --output <path>` — Path to CLAUDE.md (default: `./CLAUDE.md`).
- `--specs-dir <dir>` — Specs directory to reference in the template (default: `specs`).
- `-t, --target <lang>` — Default target language for commands in the template (default: `typescript`).
- `--force` — Replace the existing ARIA section if one is already present.

**What it does:**
- If `CLAUDE.md` doesn't exist, creates it with a standard header + the ARIA section.
- If `CLAUDE.md` exists but has no ARIA section, appends it.
- If `CLAUDE.md` already has `## ARIA Specifications`, skips (or replaces with `--force`).
- Creates the specs directory if it doesn't exist.

**Examples:**

```bash
# Default: add ARIA section for TypeScript with specs/ directory
aria setup

# Custom specs dir and target
aria setup --specs-dir contracts -t rust

# Replace existing ARIA section with updated template
aria setup --force --specs-dir api-specs
```

---

## `aria fmt`

Format one or more `.aria` files.

```bash
aria fmt <file|dir> [--check]
```

**Options:**
- `--check` — Only verify formatting; do not write. Exits non-zero if any file would change.

---

## `aria-mcp` (MCP Server)

Run the ARIA MCP server for integration with Claude Desktop, Cursor, or any MCP-compatible client.

```bash
aria-mcp
# or
npx aria-mcp
```

The server runs on **stdio** and exposes 5 tools via the Model Context Protocol:

| Tool | Description |
|---|---|
| `aria_check` | Validate an `.aria` source string. Returns errors/warnings. |
| `aria_gen` | Generate code (TypeScript/Rust/Python/JSON Schema) from source. Returns file contents. |
| `aria_diagram` | Generate Mermaid state diagrams from behaviors. |
| `aria_explain` | Return a structured natural-language summary of the spec. |
| `aria_spec` | Generate a `.aria` skeleton from a natural-language description. |

### Configuration examples

**Claude Desktop** (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "aria": {
      "command": "npx",
      "args": ["aria-mcp"]
    }
  }
}
```

**Cursor** (`.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "aria": {
      "command": "npx",
      "args": ["aria-mcp"]
    }
  }
}
```

**Claude Code** (`.claude/settings.json`):

```json
{
  "mcpServers": {
    "aria": {
      "command": "npx",
      "args": ["aria-mcp"]
    }
  }
}
```

---

## Environment variables

| Variable | Used by | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | `aria implement --ai claude` | Required API key for the Anthropic provider. |

---

## Exit codes (global)

| Code | Meaning |
|---|---|
| `0` | Success |
| `1` | Validation, generation, or IO error |
| `2` | CLI usage error (unknown command, missing argument) |
