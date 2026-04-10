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

### 2. Run `aria check`

Execute:

```bash
npx aria-lang check {spec_path}
```

Or fallback to dev mode if `aria-lang` isn't installed:

```bash
npx tsx /Users/admin/WebstormProjects/ARIA/src/cli.ts check {spec_path}
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

### 4. Get approval (skip if auto_mode)

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

### 5. Handle the answer

- **Approve** → set `{spec_approved}=true` and load next step
- **Modify** → ask the user what to change, edit the file, loop back to step 1
- **Abort** → tell the user the spec is at `{spec_path}` and stop

## SUCCESS METRICS

✅ `aria check {spec_path}` exits with code 0
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
