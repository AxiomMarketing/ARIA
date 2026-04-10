---
name: step-mt-02-drift
description: Maintain workflow — detect drift between specs and source code
next_step: steps/step-mt-03-fix.md
---

# Step MT-02 — Drift Detection

## MANDATORY EXECUTION RULES

- 🛑 NEVER auto-apply fixes — only report
- 🛑 NEVER scan dirs without source code (check that {impl_dir} contains .ts files)
- ✅ ALWAYS run `aria drift specs/ {impl_dir}` for every spec/impl pair
- ✅ ALWAYS save the report to `specs/DRIFT.md`
- 📋 YOU ARE A REPORTER — fixes happen in step-mt-03

## CONTEXT BOUNDARIES

- Coming from: `step-mt-01-check.md` with all specs validated
- Going to: `step-mt-03-fix.md` with drift report

## YOUR TASK

Compare every `.aria` spec with its corresponding TypeScript implementation and produce a drift report.

---

## EXECUTION SEQUENCE

### 1. Determine implementation directory

Look for the standard locations:

```bash
ls src/    # Most common
ls lib/
ls app/
```

Set `{impl_dir}` to the first one found.

If multiple exist, use AskUserQuestion to let the user pick.

### 2. Run aria drift

```bash
npx aria-lang drift {specs_dir} {impl_dir} -o {specs_dir}/DRIFT.md
```

(or `npx tsx /Users/admin/WebstormProjects/ARIA/src/cli.ts drift ...` in dev mode)

This compares files by stem name (e.g. `specs/payment.aria` ↔ `src/payment.ts`).

### 3. Read and parse the report

Extract from `{specs_dir}/DRIFT.md`:
- Total errors
- Total warnings
- Findings categorized

### 4. Detect "no drift" scenario

If errors=0 and warnings=0, celebrate:

```
✓ No drift detected
  Your specs and implementation are in sync.

  Last drift check: {timestamp}
  Files compared  : {N}
  Findings        : 0

  Workflow ends here. Run /aria audit again after spec or code changes.
```

In this case, **do NOT load step-mt-03**. Workflow terminates.

### 5. Report findings

If drift exists, report:

```
⚠ Drift detected: {X} errors, {Y} warnings

By category:
  - Missing functions    : {N1}
  - Missing contracts    : {N2}
  - Signature mismatches : {N3}
  - Type drift           : {N4}
  - Behavior drift       : {N5}

Full report saved to: {specs_dir}/DRIFT.md

Top 5 most impactful findings:
  1. ✗ {message1}
  2. ✗ {message2}
  3. ⚠ {message3}
  4. ⚠ {message4}
  5. ⚠ {message5}
```

### 6. Decide whether to load fix step

**If errors > 0 AND `auto_mode=false`:**

```yaml
questions:
  - header: "Fix drift"
    question: "{X} errors found. Want to address them now?"
    options:
      - label: "Yes, propose fixes (Recommended)"
        description: "Load step-mt-03 to suggest concrete edits"
      - label: "Just show the report and stop"
        description: "I will fix manually using DRIFT.md as reference"
    multiSelect: false
```

If "Yes" → load step-mt-03.
If "Just show" → terminate.

**If errors > 0 AND `auto_mode=true`:** load step-mt-03.

**If only warnings:** terminate (warnings rarely require automated fixes).

## SUCCESS METRICS

✅ `aria drift` exited with code 0 (the command itself, not the report)
✅ DRIFT.md exists and is readable
✅ User has a categorized summary
✅ Decision made about loading step-mt-03

## FAILURE MODES

❌ Auto-applying fixes here (that's mt-03's job)
❌ Loading mt-03 when there's no drift
❌ Not reading the actual DRIFT.md to extract findings

## NEXT STEP

- If drift errors found AND user wants fixes → `steps/step-mt-03-fix.md`
- Otherwise: terminate workflow with summary

<critical>
"No drift" is the success state. Celebrate it and end the workflow.
</critical>
