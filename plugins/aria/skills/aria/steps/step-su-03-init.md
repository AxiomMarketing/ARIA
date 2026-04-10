---
name: step-su-03-init
description: Setup workflow — scaffold an example .aria spec to get started
---

# Step SU-03 — Scaffold Example Spec

## MANDATORY EXECUTION RULES

- 🛑 NEVER load another step after this — terminal step
- 🛑 NEVER overwrite an existing example spec
- ✅ ALWAYS use `aria-lang init` to scaffold (do not write the file manually)
- ✅ ALWAYS show the user how to run `aria check` on the new spec
- 📋 YOU ARE A SCAFFOLDER, not an implementer

## CONTEXT BOUNDARIES

- Coming from: `step-su-02-configure.md` with project configured
- Going to: nowhere — workflow terminates here

## YOUR TASK

Create an example `.aria` spec via `aria-lang init`, validate it, and present the user with their first commands to try.

---

## EXECUTION SEQUENCE

### 1. Decide on the example module name

Default: `Example` → `specs/example.aria`

If the user gave a feature name in the original input, use that instead.

### 2. Run `aria init`

```bash
npx aria-lang init --module Example -o specs/
```

This creates `specs/example.aria` with a starter template.

If the file already exists, ask the user:

```yaml
questions:
  - header: "Example exists"
    question: "specs/example.aria already exists. Replace it?"
    options:
      - label: "Keep existing (Recommended)"
        description: "Don't overwrite — maybe you already started"
      - label: "Replace with fresh template"
        description: "Overwrite with the default scaffold"
    multiSelect: false
```

### 3. Validate the example

```bash
npx aria-lang check specs/example.aria
```

Should pass on the first try (init template is always valid). If not, that's a bug in `aria init` — report it.

### 4. Final report — first-time user guide

```
═══════════════════════════════════════════════
  ARIA Setup — Complete
═══════════════════════════════════════════════

  Project    : {cwd}
  ARIA version: {version}
  Specs dir  : ./specs/
  Example    : ./specs/example.aria
  CLAUDE.md  : ✓ Updated with ARIA rules
  .gitignore : ✓ Excludes generated code
  MCP server : {configured|not configured}

═══════════════════════════════════════════════

YOUR FIRST COMMANDS

  # Validate a spec
  npx aria-lang check specs/example.aria

  # Generate code from a spec (creates src/generated/)
  npx aria-lang gen specs/example.aria -o src/generated/

  # Generate Mermaid diagrams from behavior blocks
  npx aria-lang diagram specs/example.aria -o docs/diagrams.md

  # Have Claude implement the contract stubs
  export ANTHROPIC_API_KEY=sk-ant-...
  npx aria-lang implement specs/example.aria --ai claude -o src/generated/

  # Format a spec
  npx aria-lang fmt specs/example.aria

  # Watch a spec and re-check on save
  npx aria-lang watch specs/example.aria

NEXT STEPS

  1. Open specs/example.aria and customize it for your domain
  2. Read the language reference: https://github.com/AxiomMarketing/ARIA/blob/main/LANGUAGE.md
  3. Look at real-world examples:
       https://github.com/AxiomMarketing/ARIA/tree/main/examples

  4. To build a new feature with ARIA:
       /aria <description of the feature>

  5. To reverse-engineer existing TS code into specs:
       /aria reverse src/

  6. To audit your specs against the implementation:
       /aria audit

═══════════════════════════════════════════════
```

### 5. Save state for resume

Write a small marker at `specs/.aria-state.json`:

```json
{
  "lastWorkflow": "setup",
  "lastRunDate": "{ISO date}",
  "version": "{aria-lang version}",
  "target": "{target}"
}
```

## SUCCESS METRICS

✅ `specs/example.aria` exists and validates
✅ User has a clear list of first commands
✅ State file written for resume detection
✅ Workflow terminates cleanly

## FAILURE MODES

❌ Overwriting an existing example spec
❌ Loading another step after this
❌ Not validating the example with `aria check`

## COMPLETION

The setup workflow ends here. Do NOT load another step.

The user is now ready to use ARIA in their project. They can:
- Build new features with `/aria <description>` (forward workflow)
- Import existing code with `/aria reverse src/` (reverse workflow)
- Audit with `/aria audit` (maintain workflow)

<critical>
This is a terminal step. Stop after the report.
</critical>
