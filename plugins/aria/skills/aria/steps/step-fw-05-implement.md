---
name: step-fw-05-implement
description: Forward workflow — Claude Code implements contract stubs directly from specs
next_step: steps/step-fw-06-test.md
---

# Step FW-05 — Direct Implementation by Claude Code

## MANDATORY EXECUTION RULES

- 🛑 NEVER use `aria implement --ai claude` — it requires a separate ANTHROPIC_API_KEY. Claude Code implements directly.
- 🛑 NEVER modify function signatures — they come from `aria gen`. Only fill in the function BODY.
- 🛑 NEVER modify `.types.ts` or `.behaviors.ts` — they are generated files.
- 🛑 NEVER use `any` type — use the specific types from `.types.ts`
- 🛑 NEVER invent types not in the spec — import everything from the generated `.types.ts`
- ✅ ALWAYS read the `.aria` spec before implementing each contract
- ✅ ALWAYS satisfy ALL requires (preconditions), ensures (postconditions), and on_failure cases
- ✅ ALWAYS make the examples pass (they become tests)
- ✅ ALWAYS run the type safety audit after implementation (see step 3)
- ✅ ALWAYS use design patterns from `reference/design-patterns.md` where ARIA spec structures match
- 📋 YOU ARE THE IMPLEMENTER — read the spec, fill the stubs, respect the contract

## CONTEXT BOUNDARIES

- Coming from: `step-fw-04-gen.md` with `{output_dir}` containing scaffolding stubs
- Going to: `step-fw-06-test.md` once all stubs are implemented

## YOUR TASK

Read each `.aria` spec and its generated `.contracts.ts` file. Replace every `throw new Error("Not implemented")` stub with a real implementation that satisfies the contract's requires/ensures/on_failure/examples.

---

## EXECUTION SEQUENCE

### 1. Inventory stubs to implement

Find all unimplemented contracts:

```bash
grep -rn "Not implemented" {output_dir}/*.contracts.ts
```

List them:
```
{output_dir}/payment.contracts.ts:
  - chargePayment (line 42)
  - refundPayment (line 78)

{output_dir}/auth.contracts.ts:
  - login (line 25)
  - logout (line 55)
```

### 2. Implement each contract

For each stub, follow this process:

#### a. Read the spec

Read the `.aria` file to understand the contract:
- **inputs** — what parameters the function receives (already typed in the signature)
- **requires** — preconditions to check BEFORE executing (early returns / throws)
- **ensures** — what must be true about the result AFTER execution
- **on_failure** — specific error cases with their return types
- **examples** — concrete input/output pairs (these become tests — your code must produce these results)
- **depends_on** — external services needed (inject via constructor or parameters)
- **rate_limit / timeout / retry** — cross-cutting concerns to implement as decorators
- **dispatch** — if present, implement as Strategy pattern

#### b. Read the generated types

Read `{output_dir}/{module}.types.ts` to know:
- Input type interface (e.g., `ChargePaymentInput`)
- Result union type (e.g., `ChargePaymentResult = { success: true; ... } | PaymentDeclined | InvalidCard`)
- Error type interfaces (e.g., `PaymentDeclined { kind: "PaymentDeclined"; ... }`)
- Zod schemas for runtime validation

#### c. Implement the function body

Replace `throw new Error("Not implemented")` with code that:

1. **Validates inputs** using the Zod schema:
   ```typescript
   const parsed = ChargePaymentInputSchema.parse(input);
   ```

2. **Checks preconditions** (from `requires`):
   ```typescript
   if (parsed.amount <= 0) {
     return { kind: "InvalidAmount", amount: parsed.amount };
   }
   ```

3. **Executes the business logic**

4. **Returns a result matching `ensures`**:
   ```typescript
   return { success: true, transactionId: id, status: "completed" };
   ```

5. **Handles error cases** (from `on_failure`):
   ```typescript
   if (balance < amount) {
     return { kind: "InsufficientFunds", remaining: balance };
   }
   ```

#### d. Also implement the guard functions

Fill in `{contractName}Requires()` and `{contractName}Ensures()` — these are currently `return true` stubs:

```typescript
export function chargePaymentRequires(input: ChargePaymentInput): boolean {
  // From spec: requires amount > 0 and card.expiry_year >= 2024
  return input.amount > 0 && input.card.expiryYear >= 2024;
}

export function chargePaymentEnsures(
  input: ChargePaymentInput,
  result: ChargePaymentResult,
): boolean {
  // From spec: ensures result.success implies result.transactionId exists
  if ('success' in result && result.success) {
    return typeof result.transactionId === 'string' && result.transactionId.length > 0;
  }
  return true; // error results are always valid
}
```

#### e. Apply design patterns where the spec indicates

Consult `reference/design-patterns.md` and apply patterns based on spec structure:

| Spec feature | Pattern to apply |
|---|---|
| `behavior` with `states` + `transitions` | **State** — each state is a class |
| `dispatch on field when X -> ContractX` | **Strategy** — each case is a strategy |
| `steps` + `compensate` | **Command** — each step is a command with undo |
| `rate_limit` / `timeout` / `retry` | **Decorator** — wrap the base function |
| `depends_on ExternalService` | **Adapter** — normalize external APIs |
| Enum with many variants creating objects | **Factory Method** |
| `invariants` with `always`/`never` | **Observer** — reactive invariant checking |
| `old()` in ensures | **Memento** — state snapshots |
| 3+ ordered `requires` | **Chain of Responsibility** |

Don't force patterns — use only when the spec naturally calls for one.

#### f. Report progress per contract

```
[1/6] chargePayment — implemented (Strategy: payment method dispatch)
[2/6] refundPayment — implemented (Command: reversible operation)
[3/6] login — implemented (Chain of Responsibility: 4 validation steps)
```

### 3. Type safety audit

After implementing all contracts:

```bash
# Compile check — zero errors expected
npx tsc --noEmit {output_dir}/*.ts

# Zero-any check
grep -rn ": any" {output_dir}/*.contracts.ts | grep -v "// any-ok"
grep -rn "as any" {output_dir}/*.contracts.ts
grep -rn "@ts-ignore" {output_dir}/*.contracts.ts
```

**Forbidden patterns (fix immediately if found):**

| Pattern | Fix |
|---------|-----|
| `: any` | Use the specific type from `.types.ts` |
| `as any` | Use `as SpecificType` or a type guard |
| `any[]` | Use `SpecificType[]` |
| `@ts-ignore` / `@ts-expect-error` | Fix the underlying type issue |
| `Object` / `Function` / `{}` as type | Use specific interface or `Record<string, unknown>` |

### 4. If implementation is complex

For large modules (5+ contracts), ask the user before implementing all:

```yaml
questions:
  - header: "Implementation scope"
    question: "{N} contracts to implement. How to proceed?"
    options:
      - label: "Implement all (Recommended)"
        description: "I'll implement all {N} contracts now"
      - label: "Core contracts only"
        description: "Implement the most critical ones, leave the rest as stubs"
      - label: "One by one with review"
        description: "Show me each implementation for approval before moving to the next"
    multiSelect: false
```

### 5. Final report

```
✓ Implemented {N}/{total} contracts
  - chargePayment ✓ (Strategy pattern)
  - refundPayment ✓ (Command pattern)
  - login ✓
  - logout ✓

Guard functions:
  - {N} requires guards implemented
  - {N} ensures guards implemented

Type safety:
  - tsc --noEmit: 0 errors
  - any count: 0
  - Patterns applied: {list}
```

## SUCCESS METRICS

✅ All `throw new Error("Not implemented")` stubs replaced with real implementations
✅ Every `requires` guard function (`{name}Requires`) returns actual boolean checks, not `return true`
✅ Every `ensures` guard function (`{name}Ensures`) validates the postconditions
✅ `npx tsc --noEmit` passes with zero errors
✅ Zero `any` in contract files
✅ Design patterns applied where spec structure indicates them
✅ User informed of what was implemented and which patterns were used

## FAILURE MODES

❌ Using `aria implement --ai claude` (requires separate API key — use Claude Code directly)
❌ Modifying `.types.ts` or `.behaviors.ts` (generated, not yours)
❌ Changing function signatures (they come from the spec via `aria gen`)
❌ Using `any` type instead of generated types
❌ Leaving `requires`/`ensures` guards as `return true`
❌ Not reading the `.aria` spec before implementing (inventing behavior not in the contract)

## NEXT STEP

→ Load `steps/step-fw-06-test.md`

<critical>
YOU are the implementer. Read the .aria spec carefully — it defines WHAT the function must do (requires, ensures, examples). Your job is to write the HOW. Never invent behavior not described in the spec. If the spec is unclear, go back to step-fw-02 to clarify it instead of guessing.
</critical>
