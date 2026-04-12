---
name: step-pj-05-implement
description: Project workflow — generate code + AI implementation for all specs
---

# Step PJ-05 — Generate + Implement All

## MANDATORY EXECUTION RULES

- 🛑 NEVER use `aria implement --ai claude` — it requires a separate ANTHROPIC_API_KEY. Claude Code implements directly.
- 🛑 NEVER skip the finalize step — CLAUDE.md must be updated
- 🛑 NEVER continue if `aria gen` fails on any spec
- 🛑 NEVER use `any` type — use generated types from `.types.ts`
- ✅ ALWAYS run `aria gen` on every spec first to produce scaffolding
- ✅ ALWAYS implement stubs directly by reading specs — YOU are the implementer
- ✅ ALWAYS report per-spec status (gen success/fail, contracts implemented)
- ✅ ALWAYS produce a final summary with all generated files
- 📋 YOU ARE THE IMPLEMENTER — read specs, fill stubs, respect contracts

## CONTEXT BOUNDARIES

- Coming from: `step-pj-04-iterate.md` with `{generated_specs}` set and `{implement_choice}` decided
- Going to: nowhere — workflow terminates here

## YOUR TASK

Run `aria gen` on every spec, optionally run `aria implement` on every spec (based on user choice from pj-04), and produce a final summary.

---

## EXECUTION SEQUENCE

### 1. Generate code for every spec

For each `{spec}` in `{generated_specs}`:

```bash
npx aria-lang gen {spec} -o src/{kebab-module}/
```

Track success/fail per spec.

If any fail, report the error but continue with the others.

### 2. (Optional) Implement contract stubs directly

Only if `{implement_choice}` includes implement. Claude Code implements directly — no API key needed.

For each spec, read the `.aria` file then fill in the `throw new Error("Not implemented")` stubs in the generated `.contracts.ts`:

1. Read the spec's requires/ensures/on_failure/examples
2. Read the generated `.types.ts` for input/result types
3. Replace each stub with real code that satisfies the contract
4. Implement `{name}Requires()` and `{name}Ensures()` guard functions (not just `return true`)
5. Apply design patterns from `reference/design-patterns.md` where the spec indicates them
6. Verify zero `any` in the implementation

Report progress per spec:

```
[1/6] specs/auth.aria → src/auth/
   ✓ Generated 4 files
   ✓ Implemented 4 contracts (Factory Method for roles)

[2/6] specs/products.aria → src/products/
   ✓ Generated 4 files
   ✓ Implemented 4 contracts (Builder for ProductConfig)
```

### 4. (Optional) Run tests for the whole project

If the project has a test runner (vitest/jest):

```bash
npx vitest run src/
```

Parse the result.

### 5. Final report

```
═══════════════════════════════════════════════
  ARIA Project Pipeline — Complete
═══════════════════════════════════════════════

  Project        : {project_name}
  Specs          : {N} files
  Generated code : {M} files in src/
  Implementation : {K}/{N} contracts implemented via Claude
  Tests          : {X} passed, {Y} failed

  Module breakdown:
    ✓ auth        — 4 types, 4 contracts implemented
    ✓ products    — 3 types, 4 contracts implemented
    ✓ orders      — 3 types, 5 contracts implemented
    ⚠ payments    — 1 contract failed AI implementation (review needed)
    ✓ commission  — 2 types, 1 contract implemented
    ✓ fulfillment — 3 types, 3 contracts implemented

═══════════════════════════════════════════════

NEXT STEPS

  1. Review the generated code in src/
     - Implementations may need refinement
     - Check the failed contracts (payments) and refine the spec

  2. Run drift detection:
       npx aria-lang drift specs/ src/

  3. Add to CI:
       - run: npx aria-lang check specs/
       - run: npx aria-lang drift specs/ src/ --fail-on warning

  4. Iterate:
       - Refine specs as requirements evolve
       - Re-run /aria audit to keep specs and code in sync
       - Use /aria forward <feature> for new features in this project

  5. Generate diagrams:
       npx aria-lang diagram specs/ -o docs/diagrams.md

═══════════════════════════════════════════════
```

### 6. Save state for resume

Write a state file at `specs/.aria-state.json`:

```json
{
  "lastWorkflow": "project",
  "lastRunDate": "{ISO date}",
  "projectName": "{project_name}",
  "specsCount": {N},
  "implementedCount": {K},
  "iterationsInPj04": {iteration_count}
}
```

## SUCCESS METRICS

✅ Every spec was processed (gen + optionally implement)
✅ Per-spec status reported (success/fail)
✅ Final summary includes all files
✅ User has clear next actions
✅ Workflow terminates cleanly

## FAILURE MODES

❌ Calling aria implement without ANTHROPIC_API_KEY
❌ Stopping on first failure instead of continuing with the others
❌ Loading another step after this
❌ Not reporting per-spec status

## COMPLETION

The project workflow ends here. Do NOT load another step.

The user now has:
- {N} `.aria` specs in `specs/`
- Generated code in `src/`
- (Optionally) AI-implemented contracts
- A clear next-action list

## FINALIZE

After the final report, load the finalization step to lock down the project:

→ Load `steps/step-finalize.md`

This updates CLAUDE.md with spec-driven rules, configures CI drift checks, and generates `specs/NEXT-STEPS.md`.

<critical>
Do NOT skip finalization. Without CLAUDE.md rules, the next AI session will ignore the specs and write whatever it wants. The finalize step is what makes the whole pipeline stick.
</critical>
