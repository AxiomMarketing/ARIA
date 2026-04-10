---
layout: default
title: CLI Reference
description: Every aria CLI command, every flag, every exit code.
---

# CLI Reference

The `aria` command provides a complete toolchain for working with `.aria` specifications. Install via `npm install -g aria-lang` or use `npx aria-lang ...` for one-off invocations.

```bash
aria <command> [options]
# or
npx aria-lang <command> [options]
```

Global version:

```bash
aria --version
# → 0.1.4
```

## Commands at a glance

| Command | Purpose | Phase |
|---|---|---|
| [`check`](#aria-check) | Validate spec files (parse + semantic check) | core |
| [`gen`](#aria-gen) | Generate code from a spec (TS/Rust/Python/JSON Schema) | core |
| [`diagram`](#aria-diagram) | Generate Mermaid state diagrams from behaviors | core |
| [`test`](#aria-test) | Generate test files from `examples` blocks | core |
| [`implement`](#aria-implement) | Have an AI fill in contract stubs | core |
| [`init`](#aria-init) | Scaffold a new `.aria` file from a template | core |
| [`watch`](#aria-watch) | Re-run check (and optionally gen) on file changes | core |
| [`fmt`](#aria-fmt) | Format `.aria` files | core |
| [`setup`](#aria-setup) | Inject ARIA section into project's CLAUDE.md | onboarding |
| [`import`](#aria-import) | Reverse-engineer existing TypeScript into `.aria` skeletons | reverse engineering |
| [`drift`](#aria-drift) | Detect divergence between spec and implementation | reverse engineering |
| [`aria-mcp`](#aria-mcp-mcp-server) | Start the MCP server (5 tools for any MCP client) | integration |

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

## `aria import`

Reverse-engineer existing TypeScript code into `.aria` spec skeletons. Phase 10.1.

```bash
aria import <path> [options]
```

**Arguments:**
- `<path>` — A `.ts` file or a directory to scan recursively.

**Options:**
- `-o, --output <dir>` — Output directory for generated `.aria` files (default: `./specs`).
- `--recursive` — Scan directory recursively (default: enabled).
- `--no-recursive` — Do not scan recursively.
- `-t, --target <lang>` — Target language for the emitted `.aria` (default: `typescript`).
- `--no-jsdoc` — Strip JSDoc comments from the output.

**What it extracts:**
- `interface` and `type X = { ... }` → `type X is Record`
- `enum` and `type Color = "red" | "green"` → `type X is Enum`
- Exported `function` declarations → `contract X` with inferred `inputs`, `requires`, `ensures`, and `on_failure` (from detected throws)
- `*State` / `*Status` / `*Phase` enums (3+ variants) → `behavior X` skeleton

**What it skips:**
- `node_modules/`, hidden directories
- `.test.ts`, `.spec.ts`, `.d.ts` files
- Symbolic links (security: prevents traversal)

**Examples:**

```bash
# Single file
aria import src/payment/charge.ts -o specs/

# Whole project (recursive)
aria import src/ -o specs/ --recursive

# Limit to a target language
aria import src/payment.ts -t rust -o specs/
```

The output is a **skeleton** — `requires` / `ensures` / `examples` are empty TODO markers. Use the `/aria reverse src/` skill (or manually) to enrich them.

---

## `aria drift`

Compare an `.aria` spec with its TypeScript implementation and report divergences. Phase 10.2.

```bash
aria drift <spec> <impl> [options]
```

**Arguments:**
- `<spec>` — A `.aria` file or directory.
- `<impl>` — A `.ts` file or directory.

If both are directories, files are matched by stem name (e.g. `specs/payment.aria` ↔ `src/payment.ts`).

**Options:**
- `-o, --output <file>` — Write the report to a file (default: stdout).
- `--json` — Emit JSON instead of markdown.
- `--fail-on <level>` — Exit code 1 if findings reach this severity (`error` or `warning`). Useful for CI.

**Detected divergences:**

| Category | Severity | Meaning |
|---|---|---|
| `missing-function` | error | Spec contract has no implementation function |
| `missing-contract` | warning | Implementation function has no spec contract |
| `signature-mismatch` | warning | Spec and impl signatures differ |
| `type-mismatch` | warning | Spec type missing from implementation |
| `behavior-mismatch` | warning | Spec behavior states ≠ impl enum variants |
| `missing-state` | warning | Spec behavior has states not in impl enum |

**Examples:**

```bash
# Single file pair
aria drift specs/payment.aria src/payment.ts

# Whole project, write to file
aria drift specs/ src/ -o DRIFT.md

# CI integration: fail on any warning or worse
aria drift specs/ src/ --fail-on warning
```

**CI workflow example:**

```yaml
# .github/workflows/ci.yml
- run: npx aria-lang drift specs/ src/ --fail-on warning
```

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
