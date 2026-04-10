---
layout: default
title: Examples
description: Real-world ARIA specifications — authentication, payments, e-commerce orders.
---

# Examples Gallery

Three real-world specifications that ship with ARIA. Clone the repo to try them locally.

---

## Authentication ([`auth.aria`](https://github.com/AxiomMarketing/ARIA/blob/main/examples/auth.aria))

Covers user login, session management, and lockout behavior.

**Highlights:**
- Refined `SessionToken` type (exact length 64, no ambiguity)
- `Login` contract with `requires` / `ensures` / `on_failure` (invalid credentials, account locked)
- `LoginFlow` state machine with 5 states and explicit forbidden transitions
- Rate limiting per IP and per email

**Try it:**

```bash
aria check examples/auth.aria
aria gen examples/auth.aria --target typescript -o generated/auth/
aria diagram examples/auth.aria -o docs/auth-flow.md
```

---

## Payment processing ([`payment.aria`](https://github.com/AxiomMarketing/ARIA/blob/main/examples/payment.aria))

Complete payment + refund + commission split workflow.

**Highlights:**
- `Money` type in cents with min/max refinement
- `PaymentMethod`, `Currency`, `PaymentStatus` enums
- `ChargePayment`, `RefundPayment`, `CalculateCommission`, `ProcessPaymentWithCommission` contracts
- `ProcessPaymentWithCommission` uses `steps` + `compensate` (saga pattern)
- `PaymentLifecycle` behavior with 8 states, transitions, invariants, forbidden rules, and named flow examples

**Try it:**

```bash
aria check examples/payment.aria
aria gen examples/payment.aria --target typescript -o generated/payment/
aria gen examples/payment.aria --target rust -o generated/payment-rust/
aria diagram examples/payment.aria -o docs/payment-flow.md
```

---

## E-commerce order ([`order.aria`](https://github.com/AxiomMarketing/ARIA/blob/main/examples/order.aria))

Order lifecycle with cart validation, pricing, fulfillment, and returns.

**Highlights:**
- Cross-module references (imports `Money`, `Email` from other specs)
- Order state machine covering draft → confirmed → paid → shipped → delivered → refunded
- Multi-step orchestration via `steps` + rollback via `compensate`
- Timeout and retry policies on external service calls

**Try it:**

```bash
aria check examples/order.aria
aria gen examples/order.aria --target python -o generated/order/
```

---

## Patterns at a glance

| Feature | Where to see it |
|---|---|
| Refinement types | `auth.aria` (SessionToken), `payment.aria` (Money) |
| Enum with doc comments | `payment.aria` (PaymentStatus) |
| Record with nested types | `payment.aria` (CardInfo → PaymentDetails) |
| `on_failure` with `with` fields | `payment.aria` (ChargePayment) |
| `examples` with `given`/`then` | All three |
| State machine `forbidden` | `payment.aria` (PaymentLifecycle) |
| `flow` examples | `payment.aria` (happy path, refund, partial refund) |
| `steps` + `compensate` | `payment.aria` (ProcessPaymentWithCommission) |
| `depends_on`, `timeout`, `retry` | `auth.aria`, `order.aria` |
| `rate_limit` | `auth.aria` (Login) |
| Generic types (`type X of T is ...`) | See `tests/phase7.test.ts` fixtures |

---

## Writing your own

Start from a clean file:

```bash
aria init --module MyDomain -o specs/
```

Then open `specs/my-domain.aria` and follow the [tutorial](tutorial.md). The [language reference](reference.md) and [CLI reference](cli-reference.md) cover everything else.

## Using Claude Code with these examples

If you have the `/aria` skill installed (`/plugin marketplace add AxiomMarketing/ARIA`), you can use these examples interactively:

**Generate code from an example:**
```
/aria forward auth.aria
```
The skill walks through `aria check` → `aria gen` → `aria implement` → `aria test`.

**Reverse-engineer your own code into an .aria similar to these examples:**
```
/aria reverse src/auth/
```
The skill imports your existing `auth/` directory and produces a `.aria` similar in shape to `auth.aria`.

**Audit a project that has both specs and impl:**
```
/aria audit
```
Detects drift between your `.aria` specs and the corresponding `.ts` files.

## Patterns to copy

These three examples cover ~80% of what you'll need for typical backend work:

| If you're building... | Start from |
|---|---|
| User authentication | [`auth.aria`](https://github.com/AxiomMarketing/ARIA/blob/main/examples/auth.aria) |
| Money + transactions + fees | [`payment.aria`](https://github.com/AxiomMarketing/ARIA/blob/main/examples/payment.aria) |
| Multi-step orchestration with rollback | [`payment.aria`](https://github.com/AxiomMarketing/ARIA/blob/main/examples/payment.aria) (look at `ProcessPaymentWithCommission`) |
| State machine with lifecycle | [`order.aria`](https://github.com/AxiomMarketing/ARIA/blob/main/examples/order.aria) |
| Rate limiting + lockout | [`auth.aria`](https://github.com/AxiomMarketing/ARIA/blob/main/examples/auth.aria) (look at `Login`) |
| Cross-file imports | [`order.aria`](https://github.com/AxiomMarketing/ARIA/blob/main/examples/order.aria) |

Don't write your spec from scratch — copy the closest example, rename the types, adapt the contracts. The patterns transfer.
