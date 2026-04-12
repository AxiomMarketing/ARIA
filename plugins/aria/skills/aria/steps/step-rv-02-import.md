---
name: step-rv-02-import
description: Reverse workflow — run aria import to generate skeletons
next_step: steps/step-rv-03-enrich.md
---

# Step RV-02 — Run aria import

## MANDATORY EXECUTION RULES

- 🛑 NEVER write `.aria` files manually — use `aria-lang import` exclusively
- 🛑 NEVER skip the post-import validation
- 🛑 NEVER create ad-hoc directories (.aria-needs-fix/, .aria/excluded/, .aria-backup/) — log issues in `specs/IMPORT-REPORT.md`
- ✅ ALWAYS use `--recursive` for directory imports
- ✅ ALWAYS validate generated specs with `aria check` before next step
- ✅ ALWAYS keep invalid specs in `specs/` (do NOT move them) — they will be fixed in rv-03
- ✅ ALWAYS use `--draft` flag for skeleton validation (skeletons are intentionally incomplete)
- 📋 YOU ARE A CLI DRIVER, not a parser

## CONTEXT BOUNDARIES

- Coming from: `step-rv-01-scan.md` with `{import_source}` and confirmed plan
- Going to: `step-rv-03-enrich.md` with skeletons on disk

## YOUR TASK

Run `aria-lang import` against the source directory and verify the generated skeletons parse correctly.

---

## EXECUTION SEQUENCE

### 1. Run aria import

```bash
npx aria-lang import {import_source} -o specs/ --recursive
```

(or `npx tsx /Users/admin/WebstormProjects/ARIA/src/cli.ts import ...` in dev mode)

Capture the output: it lists each generated file with module name + type/contract/behavior counts.

### 2. Parse the import results

The CLI prints:

```
✓ Imported N file(s) → specs/
  specs/foo.aria
    Module: Foo
    3 type(s), 2 contract(s), 0 behavior(s)
  specs/bar.aria
    ...
```

Set `{generated_specs}` = list of paths.

### 3. Validate every generated spec

```bash
npx aria-lang check specs/ --json --draft
```

The `--draft` flag is used here because skeletons are intentionally incomplete (missing requires/ensures/examples). Draft mode only checks syntax, not completeness. The enrichment step (rv-03) will fill in the content, then rv-03 will validate with `--strict`.

If any spec fails to parse, log it in `specs/IMPORT-REPORT.md` with the error message. Do NOT move or delete the file — keep it in `specs/` for rv-03 to attempt fixing. Do NOT create backup directories or exclusion folders.

### 4. Report

```
✓ Imported {N} files into specs/
  - {N_with_types} files have at least one type
  - {N_with_contracts} files have at least one contract
  - {N_with_behaviors} files have at least one behavior
  - {N_invalid} files failed validation (skipped)

The skeletons contain TODO markers for:
  - requires (preconditions)
  - ensures (postconditions)
  - examples (given/then test cases)
  - on_failure (error cases — partially detected from throws)
```

### 5. Quick preview

Show the first 30 lines of one representative spec so the user sees what was generated:

```
Sample skeleton (specs/{first}.aria):

{30 lines}
```

## SUCCESS METRICS

✅ `aria-lang import` exited with code 0
✅ `aria-lang check specs/` reports all specs as valid
✅ User has seen a sample skeleton

## FAILURE MODES

❌ Editing `.aria` files manually
❌ Skipping the validation step
❌ Moving/deleting invalid specs — keep them in `specs/` for rv-03 to fix
❌ Creating ad-hoc directories (.aria-needs-fix/, .aria-backup/, .aria/excluded/)

## NEXT STEP

→ Load `steps/step-rv-03-enrich.md`

<critical>
The skeletons are intentionally minimal — they will be enriched by Claude in the next step. Do NOT try to add content here.
</critical>
