---
name: step-fw-03-review
description: Forward workflow — review spec with user, run aria check, fix errors
next_step: steps/step-fw-04-gen.md
---

# Step FW-03 — Review Spec + Validate

## MANDATORY EXECUTION RULES

- 🛑 NEVER skip `aria check` — the spec must pass validation before code generation
- 🛑 NEVER proceed if `auto_mode=false` and the user has not approved the spec
- ✅ ALWAYS show the spec to the user (or summary if very long)
- ✅ ALWAYS use AskUserQuestion for the approval prompt
- 📋 YOU ARE A REVIEWER, not an editor — let the user decide what to change
- ✅ ALWAYS run `aria check --strict` (not just `aria check`) to enforce examples + on_failure
- ✅ ALWAYS run the quality checklist before presenting to user

## CONTEXT BOUNDARIES

- Coming from: `step-fw-02-spec.md` with `{spec_path}` set
- Going to: `step-fw-04-gen.md` once spec is validated and approved

## YOUR TASK

Show the user the generated spec, run `aria check` to validate, and get explicit approval before generating code.

---

## EXECUTION SEQUENCE

### 1. Display the spec

Read `{spec_path}` and present it to the user with a summary header:

```
Generated spec at: {spec_path}

Summary:
- {N} types
- {M} contracts
- {K} behaviors
- {file_size} lines
```

If the spec is over 100 lines, show the first 50 and last 30 lines with `... (truncated) ...` in between, plus a count of what was hidden.

### 2. Run `aria check --strict`

Execute strict validation (enforces examples + on_failure on every contract):

```bash
npx aria-lang check {spec_path} --strict
```

Or fallback to dev mode:

```bash
npx tsx /Users/admin/WebstormProjects/ARIA/src/cli.ts check {spec_path} --strict
```

Then run formatter check:

```bash
npx aria-lang fmt {spec_path} --check
```

If formatting drift is detected, auto-fix it:

```bash
npx aria-lang fmt {spec_path}
```

### 3. Handle check results

**If validation fails:**
- Show the errors to the user
- Edit `{spec_path}` to fix the errors
- Re-run `aria check`
- Loop until validation passes (max 3 attempts, then ask user for help)

**If validation succeeds:**
- Show `✓ Spec validates`
- Continue to step 4

### 4. Spec Quality Checklist

Before presenting to the user, verify these quality criteria manually (reading the spec):

**Mandatory (block if missing):**
- [ ] Every contract has `requires` with at least one formal expression
- [ ] Every contract has `ensures` with at least one formal expression
- [ ] Every contract has `on_failure` with at least one error case
- [ ] Every contract has `examples` with at least one `given/then`
- [ ] No primitive types in contract inputs (use domain types: `Money`, `Email`, `OrderId`)
- [ ] No `-- prose` comments under requires/ensures (use formal expressions only)

**Recommended (warn if missing):**
- [ ] At least 2 examples per contract (happy path + error case)
- [ ] `on_failure` covers every `requires` condition
- [ ] Behaviors have `forbidden` transitions (not just allowed ones)
- [ ] Behaviors have `invariants` with temporal assertions where relevant
- [ ] Generic types used for reusable patterns (Result, PaginatedList)
- [ ] `depends_on` declared for contracts calling external services
- [ ] Computed fields used for derived values in records
- [ ] Shared types imported (not redefined) if `shared-types.aria` exists

**Report format:**
```
Spec Quality Report:
  ✓ 4/4 mandatory checks passed
  ⚠ 3/8 recommended: missing forbidden transitions, no depends_on, no computed fields
```

If mandatory checks fail, fix the spec before presenting to the user.
If recommended checks miss, mention them in the summary but don't block.

### 5. Get approval (skip if auto_mode)

**If `{auto_mode}` = true:** auto-approve and move on.

**If `{auto_mode}` = false:** Use AskUserQuestion:

```yaml
questions:
  - header: "Approve spec"
    question: "The spec above will be used to generate code, types, and tests. Approve?"
    options:
      - label: "Approve and continue (Recommended)"
        description: "Run aria gen + aria implement (will call Claude API)"
      - label: "Modify the spec"
        description: "I want to refine the spec before generating"
      - label: "Abort"
        description: "Stop the workflow here"
    multiSelect: false
```

### 6. Handle the answer

- **Approve** → set `{spec_approved}=true` and load next step
- **Modify** → ask the user what to change, edit the file, loop back to step 1
- **Abort** → tell the user the spec is at `{spec_path}` and stop

## SUCCESS METRICS

✅ `aria check --strict` passes (not just `aria check`)
✅ Quality checklist mandatory items all pass
✅ `aria fmt --check` shows no formatting drift
✅ User has explicitly approved (or auto_mode skipped this)
✅ The spec is ready for code generation

## FAILURE MODES

❌ Loading step-fw-04 without `aria check` passing
❌ Skipping the user approval prompt when `auto_mode=false`
❌ Editing the spec without explicit user request

## NEXT STEP

→ Load `steps/step-fw-04-gen.md`

<critical>
This is the last cheap checkpoint before AI implementation. Make the user comfortable here — once they approve, the next steps will spend tokens on Claude API calls.
</critical>
