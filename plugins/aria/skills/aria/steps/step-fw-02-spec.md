---
name: step-fw-02-spec
description: Forward workflow — generate .aria specification from natural language
next_step: steps/step-fw-03-review.md
---

# Step FW-02 — Generate .aria Spec

## MANDATORY EXECUTION RULES

- 🛑 NEVER skip `on_failure` — every contract must declare at least one error case
- 🛑 NEVER use primitive types directly in contract inputs (wrap them in domain types)
- ✅ ALWAYS include `examples` with given/then for every contract
- ✅ ALWAYS use `where` clauses to express constraints, not narrative comments
- 📋 YOU ARE A SPEC AUTHOR, not an implementer — no code, only specification

## CONTEXT BOUNDARIES

- Coming from: `step-fw-01-parse.md` with `{description}`, `{module_name}`, `{target}` set
- Going to: `step-fw-03-review.md` with `{spec_path}` set

## YOUR TASK

Write a complete `.aria` file at `{specs_dir}/{kebab-module-name}.aria` that captures the user's feature.

---

## EXECUTION SEQUENCE

### 1. Determine output path

- If `{specs_dir}` is set, use it
- Otherwise default to `./specs/`
- Create the directory if it doesn't exist
- Filename: `{kebab-module-name}.aria` (e.g. `payment-processing.aria`)
- Set `{spec_path}` to the resolved path

### 2. Write the spec

Use this template structure (adapt to the actual feature):

```aria
module {ModuleName}
  version "1.0"
  target {target}

--- {One-line description from user}

-- ===========================================================
-- TYPES
-- ===========================================================

type {DomainType} is Integer
  where self > 0
  where self <= 1_000_000

type {RecordType} is Record
  id: String
  name: String
  status: {StatusEnum}

type {StatusEnum} is Enum
  active
  inactive
  pending

-- ===========================================================
-- CONTRACTS
-- ===========================================================

contract {OperationName}
  --- Description from user

  inputs
    field1: {DomainType}
    field2: {RecordType}

  requires
    field1 > 0
    field2.status == active

  ensures
    result.success == true
    result.id exists

  on_failure
    when field1 <= 0
      return InvalidInput with reason: "field1 must be positive"
    when field2.status != active
      return InactiveResource with id: field2.id

  examples
    given
      field1: 100
      field2: { id: "abc", name: "test", status: active }
    then
      result.success == true

-- ===========================================================
-- BEHAVIORS (only if the feature has lifecycle states)
-- ===========================================================

behavior {FlowName}
  states
    draft
    confirmed
    completed

  initial draft

  transitions
    draft -> confirmed
      when validation_passed
    confirmed -> completed
      when payment_received

  forbidden
    completed -> draft
```

### 3. Key authoring rules

1. **Contracts must have on_failure** — even if it's just one case
2. **Examples are mandatory** — at least one given/then per contract
3. **Wrap primitives in domain types** — `Money`, `Email`, `OrderId` instead of bare `Integer`/`String`
4. **Use where clauses** — `where self > 0`, `where length(self) <= 255`, `where self matches /regex/`
5. **State machines for any lifecycle** — orders, logins, payments, anything with named states
6. **Use temporal assertions in invariants** — `always`, `never`, `eventually`, `leads_to ... within N hours`
7. **Generic types when relevant** — `type Result of T, E is Enum`

### 4. Validate before saving

Mentally check:
- Does each contract have inputs, requires, ensures, on_failure, examples?
- Does each type have at least one where clause or fields/variants?
- Does each behavior have states, initial, transitions?

### 5. Write the file

Write the spec to `{spec_path}` and announce its location.

## SUCCESS METRICS

✅ File written at `{spec_path}`
✅ Every contract has on_failure + examples
✅ Domain types used instead of primitives in contract inputs
✅ Spec compiles to valid ARIA syntax (will be verified in next step via `aria check`)

## FAILURE MODES

❌ Contract without on_failure
❌ Primitive types leaking into contract inputs
❌ Missing examples block
❌ Writing TypeScript code (you should be writing ARIA only)

## NEXT STEP

→ Load `steps/step-fw-03-review.md`

<critical>
The spec is the source of truth. Every line you write here will guide the AI implementation downstream. Be precise.
</critical>
