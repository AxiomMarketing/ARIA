---
name: aria
description: Complete ARIA workflow orchestrator. Routes to one of 4 sub-workflows (forward / reverse / maintain / setup) depending on the user's intent. Use whenever the user says `/aria <anything>`, mentions formal specs, contracts, ARIA, or wants to integrate ARIA into a project.
argument-hint: "[forward|reverse|maintain|setup] <description>"
---

# ARIA Skill — Complete Orchestrator

<objective>
Provide a single entry point for every ARIA capability: build new features from natural language (forward), reverse-engineer existing TypeScript code into specs (reverse), maintain existing ARIA projects (maintain), and bootstrap ARIA into a fresh project (setup). Routes to the appropriate sub-workflow based on intent.
</objective>

## When to Use

Trigger this skill whenever the user:
- Says `/aria <anything>`
- Describes a feature they want to build (forward)
- Asks to "import existing code into ARIA" or "reverse-engineer specs" (reverse)
- Asks to "audit specs", "find drift", "check ARIA project" (maintain)
- Says "install ARIA in this project", "set up ARIA", "first time with ARIA" (setup)
- Mentions formal contracts, types + validation + tests, spec-first dev

## The 4 Workflows

```
                       /aria <command>
                              |
                  ┌───────────┴───────────┐
                  │  step-00-route.md     │
                  │  (intent detection)   │
                  └───────────┬───────────┘
                              |
        ┌────────────┬────────┼────────┬────────────┐
        ▼            ▼        ▼        ▼            ▼
    FORWARD      REVERSE  MAINTAIN   SETUP    (mcp/publish)
   "build new"  "import"  "audit"  "install"
```

| Workflow | When to use | Steps | Outputs |
|----------|-------------|-------|---------|
| **forward** (default) | New feature from natural language | fw-01 → fw-06 | `.aria` spec + generated code + tests + AI implementation |
| **reverse** | Existing TS codebase | rv-01 → rv-04 | `specs/*.aria` skeletons + drift report |
| **maintain** | Existing ARIA project | mt-01 → mt-03 | Validation report + drift fixes |
| **setup** | First-time install | su-01 → su-03 | `package.json` + `CLAUDE.md` + example spec |

## Quick Reference

| Concept | Value |
|---------|-------|
| **CLI binary** | `npx aria-lang <command>` (or `aria` if installed globally) |
| **Spec language ref** | `LANGUAGE.md` and `docs/reference.md` |
| **Targets** | `typescript`, `rust`, `python`, `jsonschema` |
| **AI provider** | Claude (`ANTHROPIC_API_KEY` env var required for `aria implement`) |
| **MCP server** | `npx aria-lang aria-mcp` (5 tools: check, gen, diagram, explain, spec) |

## CLI Commands Coverage

This skill orchestrates these ARIA CLI commands:

| Command | Used by workflow |
|---------|------------------|
| `aria check` | forward, maintain, reverse, setup |
| `aria gen` | forward, setup |
| `aria diagram` | forward, maintain |
| `aria test` | forward |
| `aria implement --ai claude` | forward |
| `aria init` | forward, setup |
| `aria fmt` | maintain |
| `aria setup` | setup |
| `aria import` | reverse |
| `aria drift` | reverse, maintain |
| `aria-mcp` | (referenced for IDE integration) |

## State Variables

These are set by `step-00-route.md` and persist across all workflow steps:

| Variable | Type | Description |
|----------|------|-------------|
| `{workflow}` | enum | One of: `forward`, `reverse`, `maintain`, `setup` |
| `{user_input}` | string | The original user description / args |
| `{cwd}` | string | Current project directory |
| `{has_aria_lang}` | boolean | True if `aria-lang` is in package.json |
| `{has_specs_dir}` | boolean | True if `specs/` exists with `.aria` files |
| `{has_claude_md}` | boolean | True if `CLAUDE.md` has the ARIA section |
| `{stack}` | string | Detected project language: `typescript`, `rust`, `python`, `mixed` |
| `{specs_dir}` | string | Path to specs directory (default: `specs/`) |
| `{output_dir}` | string | Path to generated code directory |
| `{auto_mode}` | boolean | Skip confirmations (set if `-a` or `--auto` flag in input) |

Forward-specific:
- `{description}` — natural language feature description
- `{module_name}` — derived from description
- `{spec_path}` — path to generated `.aria` file

Reverse-specific:
- `{import_source}` — directory or file to import from
- `{import_count}` — number of files imported

Maintain-specific:
- `{drift_report_path}` — path to drift report

## Execution Rules

- **Load one step at a time** — never load all steps upfront
- **Persist state via frontmatter** — write `{workflow}`, completed steps, etc. to a state file if `--save` is set
- **Always validate before destructive ops** — if `auto_mode=false`, use `AskUserQuestion` before `aria implement` or file overwrites
- **Use the published CLI** — assume `aria-lang` is on npm (`npx aria-lang ...`). For local dev fallback to `npx tsx /Users/admin/WebstormProjects/ARIA/src/cli.ts`
- **Detect context first** — `step-00-route.md` reads `package.json`, `CLAUDE.md`, `specs/` to inform routing decisions
- **Never skip the router** — always start at `step-00-route.md` even if the user gave a workflow name explicitly

## Entry Point

**FIRST ACTION:** Load `steps/step-00-route.md`

<critical>
Do NOT load any workflow-specific step (fw-, rv-, mt-, su-) until step-00-route has parsed the user input and set `{workflow}`. The router is the single source of truth for which sub-workflow to execute.
</critical>
