---
name: step-pj-04-iterate
description: Project workflow — review specs with user, refine in iterations
next_step: steps/step-pj-05-implement.md
---

# Step PJ-04 — Review + Iterate Loop

## MANDATORY EXECUTION RULES

- 🛑 NEVER skip the user review — this step exists specifically for refinement
- 🛑 NEVER edit specs without explicit user request
- 🛑 NEVER loop more than 5 times — if 5 rounds aren't enough, ask user to start over
- ✅ ALWAYS show a per-spec summary (not the raw file content unless asked)
- ✅ ALWAYS re-validate with `aria check` after each user-requested edit
- ✅ ALWAYS use AskUserQuestion for the iteration loop
- 📋 YOU ARE A FACILITATOR — present, listen, edit precisely

## CONTEXT BOUNDARIES

- Coming from: `step-pj-03-generate-all.md` with `{generated_specs}` set
- Going to: `step-pj-05-implement.md` once user is satisfied

## YOUR TASK

Show the user each generated spec, gather feedback, apply edits, validate, loop until the user is satisfied or hits the iteration cap.

---

## EXECUTION SEQUENCE

### 1. Initialize iteration state

Set `{iteration_count}` = 0.

### 2. Present all specs (high-level summary)

```
═══════════════════════════════════════════════
  Spec Review Round {iteration_count + 1}/5
═══════════════════════════════════════════════

Generated specs (click to view full content):

  1. specs/auth.aria
     Types     : User, Email, SessionToken, PasswordHash
     Contracts : SignUp, LogIn, LogOut, ResetPassword
     Behaviors : LoginFlow (5 states)
     Status    : ✓ valid

  2. specs/products.aria
     Types     : Product, ProductId, Category
     Contracts : CreateProduct, UpdateProduct, DeleteProduct, ListByCategory
     Behaviors : ProductLifecycle (4 states)
     Status    : ✓ valid

  ...

═══════════════════════════════════════════════
```

### 3. Ask the user what to do (skip if auto_mode)

**If `{auto_mode}` = true:** auto-approve and skip to step 7.

**If `{auto_mode}` = false:**

```yaml
questions:
  - header: "Review"
    question: "What do you want to do with these specs?"
    options:
      - label: "All look good, proceed (Recommended)"
        description: "Move on to optional code generation + AI implementation"
      - label: "Show me one spec in full"
        description: "Display the full content of a specific .aria file"
      - label: "Refine a specific spec"
        description: "I want to add/change/remove something in one spec"
      - label: "Add a missing module"
        description: "I need a new module that wasn't generated"
      - label: "Remove a module"
        description: "One of these modules isn't needed"
      - label: "Stop here, no code generation"
        description: "Save the specs as-is, I'll handle the rest manually"
    multiSelect: false
```

### 4. Handle the answer

#### Show one spec in full

Ask which one (free text or list), `cat` the file, then loop back to step 3.

#### Refine a specific spec

```yaml
questions:
  - header: "Spec to edit"
    question: "Which spec needs refinement?"
    options: [list of {generated_specs}]
    multiSelect: false
```

Then ask for the change in free text:

```
What do you want to change in specs/{name}.aria?

Examples:
  - "Add a refund contract"
  - "The Money type should allow up to 50 million cents"
  - "Add a SuspendedUser error case to LogIn"
  - "Add a behavior for password reset flow"
```

Edit the file precisely (do NOT regenerate from scratch — preserve existing content), re-validate with `aria check`, increment `{iteration_count}`, loop back to step 3.

#### Add a missing module

Ask the user for the module name and a one-line description, then:
- Add it to `{domains}` (mental model)
- Generate the spec following the same rules as pj-03
- Validate
- Append to `{generated_specs}`
- Increment `{iteration_count}`
- Loop back to step 3

#### Remove a module

Ask which one. Confirm. Delete the file. Remove from `{generated_specs}`. Loop back.

#### Stop here

Skip to step 6 (final report) without code generation.

#### All look good

Skip to step 5.

### 5. Final approval gate

Before proceeding to optional code generation, confirm:

```
You're about to:
  1. Generate code from {N} specs (aria gen)
  2. Optionally have Claude implement the contracts (aria implement)

This will create files in src/ and may use Claude API tokens.

Continue?
```

```yaml
questions:
  - header: "Generate code"
    question: "Proceed to code generation?"
    options:
      - label: "Yes, generate + implement (Recommended)"
        description: "Run aria gen + aria implement on all specs"
      - label: "Generate scaffolding only (no AI)"
        description: "Run aria gen but skip aria implement (no Claude API calls)"
      - label: "Stop here, just keep the specs"
        description: "Specs only — I'll generate code later manually"
    multiSelect: false
```

Set `{implement_choice}` based on the answer.

### 6. Iteration cap

If `{iteration_count}` >= 5, force a decision:

```
You've made 5 rounds of edits. To prevent endless refinement, you must now choose:

1. Lock in the specs and proceed
2. Save as-is and stop
```

### 7. Final report (if no code generation)

```
═══════════════════════════════════════════════
  Project Specs Complete (no code generated)
═══════════════════════════════════════════════

  Specs    : {generated_specs.length} files in {specs_dir}/
  Iterations: {iteration_count}

  To generate code later:
    npx aria-lang gen specs/auth.aria -o src/auth/
    ... (one per spec)

  To have Claude implement the contracts later:
    npx aria-lang implement specs/auth.aria --ai claude -o src/auth/

═══════════════════════════════════════════════
```

If user chose to stop here, **terminate the workflow**. Do NOT load step-pj-05.

## SUCCESS METRICS

✅ User has reviewed every spec at least once (or auto_mode skipped)
✅ All edits validated with `aria check`
✅ User has explicitly approved or chosen to stop
✅ `{iteration_count}` <= 5

## FAILURE MODES

❌ Editing specs without user request
❌ Looping more than 5 times
❌ Re-generating from scratch instead of editing precisely
❌ Skipping the validation after each edit

## NEXT STEP

- If user approved code generation → `steps/step-pj-05-implement.md`
- If user stopped here → terminate workflow (do not load any other step)

<critical>
This is the user's chance to refine before expensive code generation. Be patient and precise with edits.
</critical>
