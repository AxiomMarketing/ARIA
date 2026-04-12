---
name: step-rv-04-drift
description: Reverse workflow — detect drift, then optionally bridge to code generation
---

# Step RV-04 — Drift Detection + Action Plan

## MANDATORY EXECUTION RULES

- 🛑 NEVER auto-fix drift in this step — only report
- ✅ ALWAYS run `aria drift specs/ {import_source}` to compare both directions
- ✅ ALWAYS produce a written drift report at `specs/DRIFT.md`
- ✅ ALWAYS provide a clear action plan
- ✅ ALWAYS offer the user a choice: stop here OR continue to code generation
- 📋 YOU ARE A REPORTER — let the user decide what to fix and whether to generate code

## CONTEXT BOUNDARIES

- Coming from: `step-audit-consistency.md` with consistent, deduplicated specs
- Going to: nowhere — workflow terminates here

## YOUR TASK

Run `aria-lang drift` between the enriched specs and the source code, write a markdown report, and present an action plan to the user.

---

## EXECUTION SEQUENCE

### 1. Run aria drift

```bash
npx aria-lang drift specs/ {import_source} -o specs/DRIFT.md
```

(or `npx tsx /Users/admin/WebstormProjects/ARIA/src/cli.ts drift ...` in dev mode)

This compares each spec with its implementation and writes a markdown report.

### 2. Read and parse the report

Read `specs/DRIFT.md`. Count:
- Total errors (severity: error)
- Total warnings (severity: warning)
- Findings by category:
  - `missing-function` — spec contract has no impl function
  - `missing-contract` — impl function has no spec contract
  - `signature-mismatch` — signature differs
  - `type-mismatch` — type drift
  - `behavior-mismatch` — state machine drift
  - `missing-state` — behavior states differ from impl enum

### 3. Categorize findings by action

For each finding, classify by what it means:

| Finding | What it means | Recommended action |
|---|---|---|
| `missing-function` | Spec describes a contract not implemented | Implement the function OR remove from spec |
| `missing-contract` | Code has a function with no spec | Add a contract to the spec OR mark as private |
| `signature-mismatch` | Spec and impl signatures differ | Update one to match the other |
| `type-mismatch` | Spec type doesn't exist in impl | Add the type to impl OR remove from spec |
| `behavior-mismatch` | Spec behavior states ≠ impl enum | Sync the state machine |

### 4. Final report to user

```
═══════════════════════════════════════════════
  ARIA Reverse Pipeline — Complete
═══════════════════════════════════════════════

  Source dir   : {import_source}
  Specs dir    : ./specs/
  Specs created: {N}
  Drift report : specs/DRIFT.md

  Drift summary:
    • {X} errors
    • {Y} warnings

  By category:
    • Missing functions    : {N1}
    • Missing contracts    : {N2}
    • Signature mismatches : {N3}
    • Type mismatches      : {N4}
    • Behavior drift       : {N5}

═══════════════════════════════════════════════

ACTION PLAN

1. Review specs/DRIFT.md for the full list
2. For each ERROR finding, decide: fix the code or fix the spec
3. For each WARNING, decide if it's intentional or should be normalized
4. Re-run drift detection after fixes:
     npx aria-lang drift specs/ {import_source}
5. Once drift is clean, integrate into CI:
     # In .github/workflows/ci.yml
     - run: npx aria-lang drift specs/ src/ --fail-on warning

NEXT STEPS YOU MAY WANT

• Generate diagrams for behaviors:
    npx aria-lang diagram specs/ -o docs/diagrams.md

• Add ARIA section to your CLAUDE.md so the AI follows specs:
    npx aria-lang setup --specs-dir specs

• Run the maintain workflow whenever you update specs:
    /aria audit
```

### 5. Save state for resume

Write a small state file at `specs/.aria-state.json` so future `/aria` invocations can detect this is a reverse-engineered project:

```json
{
  "lastWorkflow": "reverse",
  "lastRunDate": "2026-04-11",
  "sourcedFrom": "{import_source}",
  "specsCount": {N},
  "driftErrors": {X},
  "driftWarnings": {Y}
}
```

## SUCCESS METRICS

✅ `specs/DRIFT.md` exists and is readable
✅ Final report includes counts by category
✅ User has a concrete action plan
✅ State file written for resume

## FAILURE MODES

❌ Auto-fixing drift (this step is read-only)
❌ Loading another step after this
❌ Hiding findings from the user
❌ Not categorizing findings (just dumping the raw report)

### 6. Bridge to implementation

After the drift report, ask the user what they want to do next:

```yaml
questions:
  - header: "Next step"
    question: "Drift report ready. What voulez-vous faire maintenant ?"
    options:
      - label: "Stop here"
        description: "I'll review the specs and drift report manually"
      - label: "Generate TypeScript + Zod from specs (Recommended)"
        description: "Run aria gen on all enriched specs to produce .types.ts, .contracts.ts, .behaviors.ts"
      - label: "Generate + Implement with AI"
        description: "Run aria gen then Claude Code implements the stubs directly from specs"
      - label: "Generate diagrams"
        description: "Run aria diagram to produce Mermaid state diagrams for all behaviors"
    multiSelect: false
```

**If user chooses "Generate TypeScript + Zod":**

```bash
npx aria-lang gen specs/ -o {output_dir}
```

Then report:
```
✓ Generated code from {N} specs:
  - {output_dir}/*.types.ts (Zod schemas + TypeScript interfaces)
  - {output_dir}/*.contracts.ts (runtime contract validation)
  - {output_dir}/*.behaviors.ts (state machine stubs)

Next: fill in the function bodies guided by the contracts.
Claude Code can implement the stubs directly by reading the specs.
```

**If user chooses "Generate + Implement with AI":**

```bash
npx aria-lang gen specs/ -o {output_dir}
Claude Code implements the stubs directly by reading the specs (no API key needed).
```

**If user chooses "Generate diagrams":**

```bash
npx aria-lang diagram specs/ -o docs/diagrams.md
```

## COMPLETION

The reverse workflow ends after the user's choice is executed (or immediately if they choose "Stop here").

The user now has:
- Generated `.aria` skeletons in `specs/`
- Enriched specs with formal requires/ensures/examples
- A drift report at `specs/DRIFT.md`
- A clear action plan
- (Optionally) Generated TypeScript code, AI implementations, or Mermaid diagrams

## FINALIZE

After the user's choice is executed (or if they choose "Stop here"), load the finalization step:

→ Load `steps/step-finalize.md`

This updates CLAUDE.md with spec-driven rules, configures CI drift checks, and generates `specs/NEXT-STEPS.md`.

<critical>
Always offer the implementation bridge AND finalize. The reverse workflow's value is diminished if specs stay as dead documents and the CLAUDE.md doesn't enforce them. The whole point is: specs → code → tests → enforcement.
</critical>
