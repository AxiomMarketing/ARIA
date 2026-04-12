---
name: step-pj-05-implement
description: Project workflow — generate code + AI implementation for all specs
---

# Step PJ-05 — Generate + Implement All

## MANDATORY EXECUTION RULES

- 🛑 NEVER run aria implement without ANTHROPIC_API_KEY
- 🛑 NEVER load another step after this — terminal step
- 🛑 NEVER continue if `aria gen` fails on any spec
- ✅ ALWAYS run `aria gen` on every spec before any `aria implement` call
- ✅ ALWAYS report per-spec status (gen success/fail, implement success/fail)
- ✅ ALWAYS produce a final summary with all generated files
- 📋 YOU ARE A DRIVER — call CLI commands, do not write code by hand

## CONTEXT BOUNDARIES

- Coming from: `step-pj-04-iterate.md` with `{generated_specs}` set and `{implement_choice}` decided
- Going to: nowhere — workflow terminates here

## YOUR TASK

Run `aria gen` on every spec, optionally run `aria implement` on every spec (based on user choice from pj-04), and produce a final summary.

---

## EXECUTION SEQUENCE

### 1. Verify ANTHROPIC_API_KEY (only if implementing)

If `{implement_choice}` includes implement, check:

```bash
echo "${ANTHROPIC_API_KEY:-NOT_SET}" | head -c 10
```

If not set:
- If `auto_mode=false`, ask if the user wants to skip implementation OR set the key
- If `auto_mode=true`, automatically downgrade to "scaffolding only"

### 2. Generate code for every spec

For each `{spec}` in `{generated_specs}`:

```bash
npx aria-lang gen {spec} -o src/{kebab-module}/
```

Track success/fail per spec.

If any fail, report the error but continue with the others.

### 3. (Optional) Run aria implement for every spec

Only if `{implement_choice}` includes implement.

For each `{spec}` in `{generated_specs}`:

```bash
npx aria-lang implement {spec} --ai claude -o src/{kebab-module}/
```

Track success/fail per spec. Report progress per spec:

```
[1/6] specs/auth.aria → src/auth/
   ✓ Generated 4 files
   ✓ Implemented 4 contracts via Claude

[2/6] specs/products.aria → src/products/
   ✓ Generated 4 files
   ⚠ 1 contract had a security warning, review needed
   ✓ Implemented 4 contracts via Claude
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
