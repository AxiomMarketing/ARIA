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

### 2. Architecture first — check for shared types

Before writing the spec, check if `{specs_dir}/shared-types.aria` exists. If it does, read it to know what types are already available for import. If this is a multi-module project, prefer importing shared types over redefining them locally.

**Import pattern:**
```aria
module {ModuleName}
  version "1.0"
  target {target}
  import Money, UserId, Email from "./shared-types.aria"
  import Account from "./auth.aria"
```

### 3. Write the spec

Use this template structure. Not all sections are needed — pick what fits the feature:

```aria
module {ModuleName}
  version "1.0"
  target {target}
  import SharedType from "./shared-types.aria"

--- {One-line description from user}

-- ===========================================================
-- TYPES
-- ===========================================================

--- Wrap primitives in domain types
type {DomainType} is Integer
  where self > 0
  where self <= 1_000_000

--- Records with computed fields
type {RecordType} is Record
  id: String
  subtotal: Money
  tax: Money
  total: Money computed as subtotal + tax
  status: {StatusEnum}

type {StatusEnum} is Enum
  active    --- Ready for use
  inactive  --- Disabled by admin
  pending   --- Awaiting approval

--- Generic types for reusable patterns
type Result of T, E is Record
  success: Boolean
  data: T
  error: E

type PaginatedList of T is Record
  items: List of T
  total: Integer
  page: Integer

-- ===========================================================
-- CONTRACTS
-- ===========================================================

contract {OperationName}
  --- Description from user
  depends_on ExternalAPI, AuditLogger
  rate_limit max 10 per minute per userId
  timeout 30 seconds
  retry max 3 backoff exponential

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
      field2: { id: "abc", subtotal: 1000, tax: 200, status: active }
    then
      result.success == true

--- Polymorphic dispatch — route to sub-contracts based on a field
contract ProcessPayment
  inputs
    method: PaymentMethod
    amount: Money

  dispatch on method
    when "card" -> ProcessCard
    when "bank" -> ProcessBank
    when "wallet" -> ProcessWallet

--- Multi-step orchestration with compensation (saga pattern)
contract PlaceOrder
  steps
    step validate -> ValidateStock
    step charge -> ChargePayment
    step ship -> CreateShipment

  compensate
    charge -> RefundPayment
    ship -> CancelShipment

--- Mark outdated contracts for deprecation
contract OldEndpoint
  deprecated "Use ProcessPaymentV2 instead"

-- ===========================================================
-- BEHAVIORS (state machines for any lifecycle)
-- ===========================================================

behavior {FlowName}
  states
    draft
    confirmed
    paid
    shipped
    delivered
    cancelled

  initial draft

  transitions
    draft -> confirmed
      when items.length > 0
    confirmed -> paid
      when payment.status == "completed"
    paid -> shipped
      when tracking_number exists
    shipped -> delivered
      when delivery_confirmed == true
    draft -> cancelled
      when user_requested == true
    confirmed -> cancelled
      when user_requested == true

  forbidden
    delivered -> draft
    cancelled -> confirmed
    shipped -> draft

  invariants
    always order.id exists
    never order.total < 0
    eventually order.status == "delivered" or order.status == "cancelled"
    leads_to paid -> shipped within 48 hours
```

### 4. ARIA Advanced Features Reference

Use these features when they fit the domain. Don't force them — use only what the feature needs.

| Feature | Syntax | When to use |
|---------|--------|-------------|
| **Generic types** | `type Result of T, E is Record` | Reusable wrappers (Result, PaginatedList, Optional) |
| **Computed fields** | `total: Money computed as subtotal + tax` | Derived values in records |
| **Dispatch** | `dispatch on field when "x" -> ContractX` | Polymorphic routing (payment methods, notification channels) |
| **Saga/steps** | `steps` + `compensate` | Multi-step workflows that need rollback |
| **Rate limit** | `rate_limit max N per interval per key` | API endpoints, login attempts |
| **Timeout** | `timeout N seconds` | External service calls |
| **Retry** | `retry max N backoff exponential` | Unreliable services |
| **depends_on** | `depends_on ServiceA, ServiceB` | External service dependencies |
| **Temporal invariants** | `always`, `never`, `eventually`, `leads_to X -> Y within N hours` | Time-bounded guarantees in behaviors |
| **Deprecation** | `deprecated "Use X instead"` | Marking old contracts for removal |
| **Module versioning** | `supersedes "Module" version "1.0"` | Evolving modules while keeping backwards compat |
| **Imports** | `import X, Y from "./file.aria"` | Shared types across modules |

### 5. Key authoring rules

1. **Check for shared types first** — import from `shared-types.aria` before defining locally
2. **Contracts must have on_failure** — at least one error case per contract
3. **Examples are mandatory** — at least one happy path + one error case per contract
4. **Wrap primitives in domain types** — `Money`, `Email`, `OrderId` instead of bare `Integer`/`String`
5. **Use where clauses** — `where self > 0`, `where length(self) <= 255`, `where self matches /regex/`
6. **State machines for any lifecycle** — orders, logins, payments, anything with named states
7. **Temporal assertions for time guarantees** — SLAs, timeouts, eventual consistency
8. **Generic types for reusable patterns** — Result, PaginatedList, Optional, etc.
9. **Declare external dependencies** — `depends_on` helps implementers know what to mock
10. **Saga pattern for multi-step ops** — if step 3 fails, steps 1-2 need rollback

### 6. Validate before saving

Mentally check:
- Does each contract have inputs, requires, ensures, on_failure, examples?
- Does each type have at least one where clause or fields/variants?
- Does each behavior have states, initial, transitions?

### 7. Write the file

Write the spec to `{spec_path}` and announce its location.

## SUCCESS METRICS

✅ File written at `{spec_path}`
✅ Every contract has on_failure + examples
✅ Domain types used instead of primitives in contract inputs
✅ Shared types imported (not redefined) when shared-types.aria exists
✅ Advanced features used where appropriate (generics, dispatch, temporal)
✅ Spec compiles to valid ARIA syntax (will be verified in next step via `aria check`)

## FAILURE MODES

❌ Contract without on_failure
❌ Primitive types leaking into contract inputs
❌ Missing examples block
❌ Writing TypeScript code (you should be writing ARIA only)
❌ Redefining types that exist in shared-types.aria instead of importing
❌ Using raw primitives when domain types exist

## NEXT STEP

→ Load `steps/step-fw-03-review.md`

<critical>
The spec is the source of truth. Every line you write here will guide the AI implementation downstream. Be precise.
</critical>
