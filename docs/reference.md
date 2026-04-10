---
layout: default
title: Language Reference
description: ARIA language reference — types, contracts, behaviors, generics.
---

# Language Reference

This page is a concise index into the complete language reference in [`LANGUAGE.md`](https://github.com/aria-lang/aria/blob/main/LANGUAGE.md).

For a hands-on walkthrough, read the [tutorial](tutorial.md) first.

---

## Module header

```aria
module PaymentProcessing
  version "1.0"
  target typescript, rust
  author "Jane Doe"
  supersedes "Payment" version "0.9"   -- optional, phase 7.5
```

## Imports

```aria
module Order
  import Money, Email from "./payment.aria"
```

Imported types are visible inside the module's body.

## Types

### Primitives

- `Integer` — arbitrary integer
- `Decimal` — arbitrary precision decimal
- `String`
- `Boolean`
- `DateTime`

### Refinement (`where`)

```aria
type Money is Integer
  where self > 0
  where self <= 10_000_000
  unit "cents"

type Email is String
  where self matches /^[^@]+@[^@]+\.[^@]+$/
  where length(self) <= 255
```

### Records

```aria
type Account is Record
  id: String
  balance: Money
  status: AccountStatus
```

### Computed fields (phase 7.2)

Record fields can be marked as derived from other fields using `computed as <expression>`:

```aria
type Order is Record
  subtotal: Money
  tax: Money
  total: Money computed as subtotal + tax
  item_count: Integer computed as length(items)
```

**Generator behavior:**
- **Zod schema** — computed fields are **excluded** from the `z.object({...})` storage schema. Only storage fields participate in runtime validation.
- **TypeScript type** — a separate `<Name>Computed` interface is generated and intersected with the schema's inferred type: `type Order = z.infer<typeof OrderSchema> & OrderComputed`.
- **Rust** — computed fields become `impl` methods returning the declared type, with a `todo!()` body the consumer must fill in.
- **Python (Pydantic v2)** — computed fields become `@computed_field @property` methods with a `NotImplementedError` default body.

**Note:** Phase 7.2 parses computed expressions as raw strings (no evaluation). The downstream consumer (or the AI via `aria implement`) is responsible for supplying the actual computation. No compile-time dependency tracking between computed and storage fields.

### Enums

```aria
type AccountStatus is Enum
  active    --- Operational
  frozen    --- Temporarily locked
  closed    --- Permanently closed
```

### Lists

```aria
type Orders is List of Order
```

### Generics (phase 7.1)

```aria
type Box of T is Record
  value: T

type Result of T, E is Enum
  ok
  err

-- Usage:
contract Wrap
  inputs
    boxed: Box of Money
    result: Result of Money, Error
```

## Contracts

### Skeleton

```aria
contract ContractName
  --- Doc comment (preserved in output)

  inputs
    field: Type
    ...

  requires
    -- preconditions
    expr

  ensures
    -- postconditions
    expr

  on_failure
    when <condition>
      return <ErrorType> with field: value, field: value

  examples
    given
      field: value
    then
      expr
```

### Optional sections

- `effects` — declare side effects (`sends`, `writes`, `creates`, `reads`, `deletes`)
- `depends_on` — list external services
- `timeout <n> <unit>` — unit is `seconds`, `minutes`, `hours`, `days`
- `retry` — with `max N`, `backoff exponential|linear|constant`, `on_exhaust return Err`
- `rate_limit` — with `max N per <unit> per <key>`
- `steps` — numbered orchestration `1. Contract with field, ... then result_name`
- `compensate` — saga compensation `on step N <status> ... <Action>`
- `deprecated "reason"` — emit `@deprecated` JSDoc (phase 7.5)

### `old()` in ensures

References the pre-state value of a field:

```aria
ensures
  from.balance == old(from.balance) - amount
```

## Behaviors (state machines)

```aria
behavior OrderLifecycle
  --- Full cycle of an order

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
      when payment.success == true
    paid -> shipped
      when fulfillment.ready == true
      ensures shipped_at exists
    shipped -> delivered
      when delivery.confirmed == true

  invariants
    -- Classical invariants (phase 1)
    once paid implies paid_at exists
    -- Temporal assertions (phase 7.4)
    always balance >= 0
    never status == invalid
    eventually delivered_at exists
    leads_to created -> paid within 24 hours

  forbidden
    delivered -> draft    --- Cannot roll back a delivery
    cancelled -> paid     --- Cannot pay a cancelled order

  examples
    flow "happy path"
      draft -> confirmed -> paid -> shipped -> delivered
```

## Comments

- `--` line comment
- `---` doc comment (preserved in generated output and Mermaid notes)

## Temporal assertions (phase 7.4)

Inside a `behavior`'s `invariants` block, the following temporal operators are recognized:

| Keyword | Meaning |
|---|---|
| `once X implies Y` | From the first time `X` holds, `Y` must also hold |
| `always X` | `X` must be true in every state |
| `never X` | `X` must never be true |
| `eventually X` | `X` must become true at some point |
| `leads_to X -> Y within N hours` | Once `X` holds, `Y` must hold within the given time bound (`seconds`, `minutes`, `hours`, `days`) |

**Phase 7.4 scope:** the compiler parses these assertions and propagates them into generated documentation (Mermaid state notes, TypeScript JSDoc `@invariant`, Rust `///` doc comments) plus a runtime-inspectable `XInvariants` export. **No automated verification engine is shipped yet** — the assertions are treated as structured documentation, not runtime checks.

**Example:**

```aria
behavior Order
  states
    created
    paid
    shipped
    delivered

  initial created

  transitions
    created -> paid
    paid -> shipped
    shipped -> delivered

  invariants
    always balance >= 0
    never status == invalid
    eventually delivered_at exists
    leads_to created -> paid within 24 hours
```

## Reserved keywords

See [`LANGUAGE.md`](https://github.com/aria-lang/aria/blob/main/LANGUAGE.md#reserved-keywords) for the full list. Notable additions:

- Phase 7.5: `supersedes`, `deprecated`
- Phase 7.4: `always`, `never`, `eventually`, `leads_to`, `within`

---

## Full reference

The complete grammar, every keyword, edge cases, and formal semantics are in [`LANGUAGE.md`](https://github.com/aria-lang/aria/blob/main/LANGUAGE.md) (about 1300 lines). This page is a fast lookup — the source is authoritative.
