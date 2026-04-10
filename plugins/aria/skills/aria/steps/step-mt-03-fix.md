---
name: step-mt-03-fix
description: Maintain workflow — propose and apply drift fixes
---

# Step MT-03 — Propose Fixes for Drift

## MANDATORY EXECUTION RULES

- 🛑 NEVER auto-apply fixes without user confirmation (unless `auto_mode=true` AND fix is trivial)
- 🛑 NEVER guess at intent — ask the user when ambiguous
- 🛑 NEVER load another step after this — terminal step
- ✅ ALWAYS show the proposed fix as a diff before applying
- ✅ ALWAYS re-run drift after applying fixes to verify
- 📋 YOU ARE AN ADVISOR — the user owns the final decision

## CONTEXT BOUNDARIES

- Coming from: `step-mt-02-drift.md` with drift errors and `DRIFT.md`
- Going to: nowhere — workflow terminates here

## YOUR TASK

For each drift finding, propose a concrete fix (in spec OR in code), show the diff, get user approval, apply, re-validate.

---

## EXECUTION SEQUENCE

### 1. Read drift report

Re-read `{specs_dir}/DRIFT.md` to get the full list of findings.

### 2. Group findings by file pair

Each spec/impl pair gets its own batch of fixes.

### 3. Per finding: propose a fix

For each finding, classify and propose:

#### Missing function (spec contract has no impl)

Two possible fixes:
- **Option A**: Add the function to `{impl}.ts`
  - Generate a stub via `aria gen --target typescript {spec}.aria` partial regeneration
- **Option B**: Remove the contract from the spec
  - Edit `{spec}.aria` to delete the unused contract

Ask the user which one they want.

#### Missing contract (impl function has no spec)

Two possible fixes:
- **Option A**: Add a contract to the spec
  - Read the function in `{impl}.ts`
  - Use the import workflow logic to deduce a contract skeleton
  - Append to `{spec}.aria`
- **Option B**: Mark the function as private/internal
  - Add a comment `// @internal — not exposed via ARIA spec`

#### Signature mismatch

- Show both signatures side by side
- Ask which one is authoritative
- Update the other to match

#### Type mismatch

- Show both type definitions
- Ask which one is authoritative
- Sync (carefully — types are load-bearing)

#### Behavior drift

- Show both state lists
- Ask which states to keep
- Update spec or impl enum

### 4. Confirmation flow per fix

For each proposed fix:

```
Finding: {message}
File pair: {spec} ↔ {impl}

Proposed fix:
  {spec_or_impl}.aria/.ts (modify):
    - {old line}
    + {new line}

```

If `auto_mode=false`:

```yaml
questions:
  - header: "Apply fix"
    question: "Apply this fix?"
    options:
      - label: "Yes (Recommended)"
        description: "Apply the fix as shown"
      - label: "Skip this finding"
        description: "Move on, leave it for later"
      - label: "Stop here"
        description: "Stop fixing and report"
    multiSelect: false
```

If `auto_mode=true` AND the fix is trivial (no semantic ambiguity), apply automatically.

### 5. Apply fixes

For each accepted fix:
- Edit the file
- Run `aria check {spec}.aria` to verify (if spec was modified)
- Track success/failure

### 6. Re-run drift

After all fixes applied:

```bash
npx aria-lang drift {specs_dir} {impl_dir} -o {specs_dir}/DRIFT.md
```

Compare error count before/after.

### 7. Final report

```
═══════════════════════════════════════════════
  ARIA Maintain Pipeline — Complete
═══════════════════════════════════════════════

  Initial drift: {X_initial} errors, {Y_initial} warnings
  After fixes  : {X_after} errors, {Y_after} warnings

  Fixes applied: {N_applied}
  Fixes skipped: {N_skipped}
  Fixes failed : {N_failed}

  Drift report: {specs_dir}/DRIFT.md

═══════════════════════════════════════════════
```

If drift is now clean:

```
✓ All drift resolved. Specs and impl are in sync.
  Add this to CI to prevent future drift:
    - run: npx aria-lang drift specs/ src/ --fail-on warning
```

If drift remains:

```
⚠ {X_after} drift findings remain. Run /aria audit again
  after manual fixes, or refine the spec.
```

## SUCCESS METRICS

✅ Each accepted fix was applied
✅ Re-drift verified the fixes
✅ Final report shows before/after counts
✅ User has a clear next action

## FAILURE MODES

❌ Auto-applying fixes without user approval
❌ Not re-running drift after fixes
❌ Loading another step after this
❌ Touching files unrelated to the drift findings

## COMPLETION

The maintain workflow ends here. Do NOT load another step.

<critical>
This is a terminal step. Stop after the final report.
</critical>
