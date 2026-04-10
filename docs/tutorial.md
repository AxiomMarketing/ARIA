---
layout: default
title: Tutorial
description: Build your first ARIA spec in under 10 minutes — install, write, validate, generate, implement.
---

# Tutorial — Your First ARIA Spec

This tutorial takes you from zero to a working, AI-implemented contract in under 10 minutes.

## Why spec-first development?

Before we dive in, let's address the fundamental question: **why write a spec before code?**

Traditional development looks like this:

```
Idea → Code → Tests → Bugs → Fix → More bugs → Refactor → Documentation drift
```

The problem isn't that you write bugs. It's that you write code **before** you've fully thought through the requirements. By the time the bug shows up in production, the original intent is lost — buried in commits, comments, and tribal knowledge.

ARIA flips this:

```
Idea → Spec (formal) → Code (generated) → Implementation (AI) → Tests (auto) → Done
```

The spec becomes the **source of truth**. Tests, types, validators, contract guards, even the AI implementation — they all derive from one document. When requirements change, you change the spec, regenerate, and the whole stack stays consistent.

**Why this matters with AI:**
- AI assistants like Claude Code work best when given precise, structured intent. A `.aria` file is exactly that.
- A natural-language prompt like "build a payment processor" is too ambiguous. A `contract Charge` with explicit `requires`/`ensures`/`on_failure` leaves no room for interpretation.
- AI-generated code can drift over time. ARIA's `aria drift` command catches that drift automatically.

In short: **you write the WHAT once, the AI writes the HOW every time you ask.**

## Two ways to use ARIA

ARIA can be used standalone (CLI) or via a Claude Code skill. Pick whichever fits your workflow:

| Mode | Best for | How to install |
|---|---|---|
| **CLI** | Editor-agnostic, scripting, CI integration | `npm install -g aria-lang` |
| **Claude Code skill** | Interactive development with Claude | `/plugin marketplace add AxiomMarketing/ARIA` |

You can use both at the same time. The skill calls the CLI under the hood.

## 1. Install

### Option A — Install the CLI globally

```bash
npm install -g aria-lang

# Verify
aria --version
# → 0.1.4

# Or run without installing:
npx aria-lang --version
```

### Option B — Install the Claude Code skill

In any Claude Code session, run:

```
/plugin marketplace add AxiomMarketing/ARIA
/plugin install aria@aria-lang
```

The skill is now available in every Claude Code session via `/aria`.

### Option C — Both (recommended)

Install the CLI globally **and** the Claude Code skill. The skill orchestrates the CLI and adds 4 high-level workflows on top.

## 2. Write your first spec

We'll build a commission calculator: when a sale happens on a marketplace, split the money between the artist (70%) and the platform (30%), with a minimum 100-cent platform commission.

### Method A — Write the spec yourself

Create a file `commission.aria`:

```aria
module Marketplace
  version "1.0"
  target typescript

type Money is Integer
  where self > 0
  where self <= 10_000_000
  unit "cents"

type ArtistStatus is Enum
  active
  suspended

type Artist is Record
  id: String
  status: ArtistStatus

contract CalculateCommission
  --- Splits a sale between the artist (70%) and the platform (30%).
  --- Enforces a minimum 100-cent platform commission.

  inputs
    sale_amount: Money
    artist: Artist

  requires
    sale_amount > 0
    artist.status == active

  ensures
    result.artist_share + result.platform_share == sale_amount
    result.platform_share >= 100
    result.artist_share >= 0

  on_failure
    when artist.status != active
      return InactiveArtist with id: artist.id
    when sale_amount <= 0
      return InvalidAmount with reason: "must be positive"

  examples
    given
      sale_amount: 1000
      artist: { id: "art_001", status: active }
    then
      result.artist_share == 700
      result.platform_share == 300

    given
      sale_amount: 200
      artist: { id: "art_002", status: active }
    then
      result.artist_share == 100
      result.platform_share == 100
```

This spec declares:
- **Types** — `Money` is a positive integer capped at 10 million cents. `Artist` is a record with an enum status.
- **Contract** — `CalculateCommission` takes a sale amount and an artist, with explicit pre/post conditions and error cases.
- **Examples** — Two concrete cases that the compiler will turn into automated tests.

### Method B — Let Claude write the spec for you

In a Claude Code session, type:

```
/aria a commission calculator that splits sale 70/30 between artist and platform,
with a minimum 100-cent platform commission, rejecting inactive artists
```

The skill walks through the **forward workflow** (parse intent → generate spec → review → check → gen → implement → test) and produces a similar spec. It will pause to ask you to approve before generating code.

## 3. Validate the spec

```bash
aria check commission.aria
```

Output:

```
✓ commission.aria parsed successfully
  Module: Marketplace v1.0
  Targets: typescript
  3 type(s), 1 contract(s), 0 behavior(s)
```

If you make a typo — say, rename `Artist` to `Artst` in the `inputs` block — the semantic checker catches it immediately:

```
✗ Error: Contract "CalculateCommission" input "artist" references unknown type "Artst"
  Hint: Defined types: Money, ArtistStatus, Artist
```

This is why specs catch bugs **before** they reach the code: the checker validates references, types, and constraints at compile time.

## 4. Generate code

```bash
aria gen commission.aria -o src/
```

This creates:

```
src/
├── marketplace.types.ts      # Zod schemas + branded TypeScript types
├── marketplace.contracts.ts  # Contract stubs (to be implemented)
└── marketplace.test.ts       # Tests generated from your examples
```

Let's look at what got generated.

**`marketplace.types.ts`** — your domain types as Zod schemas:

```typescript
// Generated by ARIA compiler
import { z } from "zod";

export const MoneySchema = z.number().int().gt(0).lte(10_000_000);
export type Money = z.infer<typeof MoneySchema>;

export const ArtistStatusSchema = z.enum(["active", "suspended"]);
export type ArtistStatus = z.infer<typeof ArtistStatusSchema>;

export const ArtistSchema = z.object({
  id: z.string(),
  status: ArtistStatusSchema,
});
export type Artist = z.infer<typeof ArtistSchema>;
```

**`marketplace.contracts.ts`** — the contract stub:

```typescript
import * as T from "./marketplace.types.js";

export interface CalculateCommissionInput {
  sale_amount: T.Money;
  artist: T.Artist;
}

export interface InactiveArtist { kind: "InactiveArtist"; id: string; }
export interface InvalidAmount { kind: "InvalidAmount"; reason: string; }

export type CalculateCommissionResult =
  | { success: true; artist_share: T.Money; platform_share: T.Money }
  | InactiveArtist
  | InvalidAmount;

/**
 * Splits a sale between the artist (70%) and the platform (30%).
 *
 * @requires
 *   - sale_amount > 0
 *   - artist.status == active
 *
 * @ensures
 *   - result.artist_share + result.platform_share == sale_amount
 *   - result.platform_share >= 100
 *   - result.artist_share >= 0
 */
export async function calculateCommission(
  input: CalculateCommissionInput,
): Promise<CalculateCommissionResult> {
  throw new Error("Not implemented — generate with: aria implement commission.aria");
}
```

**`marketplace.test.ts`** — your `examples` block compiled to vitest tests:

```typescript
import { describe, it, expect } from "vitest";
import { calculateCommission } from "./marketplace.contracts.js";

describe("CalculateCommission", () => {
  it("example 1", async () => {
    const result = await calculateCommission({
      sale_amount: 1000,
      artist: { id: "art_001", status: "active" },
    });
    expect(result).toMatchObject({
      artist_share: 700,
      platform_share: 300,
    });
  });

  it("example 2", async () => {
    const result = await calculateCommission({
      sale_amount: 200,
      artist: { id: "art_002", status: "active" },
    });
    expect(result).toMatchObject({
      artist_share: 100,
      platform_share: 100,
    });
  });
});
```

Notice: **you didn't write any tests**. They came from the `examples` block in the spec.

## 5. Have Claude implement it

The contract stub throws `Not implemented`. You can either fill it in manually, or let Claude do it:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
aria implement commission.aria --ai claude -o src/
```

What happens:
1. ARIA parses the spec
2. For each contract (just one here: `CalculateCommission`), ARIA builds a Claude prompt that includes:
   - The contract signature
   - All `requires` clauses (preconditions)
   - All `ensures` clauses (postconditions)
   - All `on_failure` cases (error handling)
   - All `examples` (concrete test cases)
   - The current scaffolding stub
3. ARIA sends the prompt to Claude API
4. Claude returns an implementation that satisfies all the contracts
5. ARIA validates the response for dangerous patterns (security check) and patches the file

Output:

```
→ Implementing 1 contract(s) via claude...
  Implementing CalculateCommission...
  ✓ CalculateCommission implemented

✓ Implementation complete. Files written to ./src/
```

The contract file now has a real implementation that respects all the requires/ensures.

## 6. Run the tests

```bash
cd src && npx vitest run
```

```
✓ marketplace.test.ts (2 tests)
  ✓ CalculateCommission > example 1
  ✓ CalculateCommission > example 2

Test Files  1 passed (1)
Tests       2 passed (2)
```

If a test fails, the AI implementation didn't satisfy your spec. Refine the spec (add more examples or stricter `ensures`) and re-run `aria implement`.

## What just happened

In 6 commands, you:
1. Wrote a formal specification of what you want
2. Got it validated by a semantic checker
3. Generated TypeScript types, contract stubs, and tests
4. Had an AI implement the function that satisfies your spec
5. Verified it works via auto-generated tests

**The spec is the source of truth.** If the requirements change, you update the `.aria` file, regenerate, and re-implement. The code stays in sync because it's derived, not authored by hand.

## Using Claude Code with ARIA

The `/aria` skill (installed via `/plugin install aria@aria-lang`) is your daily driver in Claude Code. It auto-detects what you want and runs the right workflow.

### Forward workflow — "build me a feature"

```
/aria a JWT auth middleware that validates tokens, refreshes expired ones,
and returns 401 on missing or invalid tokens
```

Claude walks through parse → spec → review → gen → implement → test, pausing at the review stage for you to approve.

### Reverse workflow — "import my existing code"

```
/aria reverse src/
```

Claude scans your `src/` directory, runs `aria import`, then enriches each generated `.aria` skeleton by reading the source code AND the test files. Finally, it runs `aria drift` to surface any incoherences.

### Maintain workflow — "audit my project"

```
/aria audit
```

Claude validates all your specs, runs drift detection, and proposes fixes for each finding (with diffs).

### Setup workflow — "first time install in this project"

```
/aria install
```

Claude installs `aria-lang`, configures `CLAUDE.md` with the spec-first rules, creates `specs/`, and scaffolds an example spec.

## What you should remember

1. **Humans write intent (the WHAT). AI writes code (the HOW).** The spec is the contract; the code is the implementation.

2. **Specs catch bugs at compile time.** Type mismatches, missing examples, invalid state transitions — all caught before any code runs.

3. **Tests are generated, not written.** Your `examples` block becomes vitest assertions automatically.

4. **The spec stays in sync via `aria drift`.** Run it in CI to fail builds on spec/code divergence.

5. **AI works better with structure.** A `.aria` file gives Claude unambiguous intent — much better than a chat prompt.

6. **Specs are incremental.** Start with `requires` and `ensures` empty, refine over time. `aria check --draft` accepts incomplete specs; `--strict` enforces completeness before a release.

7. **Specs survive code rewrites.** When you migrate from TypeScript to Rust (or add Python alongside), regenerate from the same `.aria` file. The contracts don't change.

## Next steps

- **[CLI Reference](cli-reference.md)** — every command and flag
- **[Language Reference](reference.md)** — complete grammar
- **[Examples gallery](examples.md)** — auth, payment, e-commerce
- **[Full Language Specification](https://github.com/AxiomMarketing/ARIA/blob/main/LANGUAGE.md)** — the formal grammar
- **[GitHub repository](https://github.com/AxiomMarketing/ARIA)** — source, issues, contributions

## A working philosophy

ARIA isn't trying to be a new programming language. It's trying to be the **place where intent lives**, separate from implementation. You can implement the same `.aria` spec in TypeScript today and Rust tomorrow — the contract doesn't care.

This separation matters for AI development specifically. AI assistants are excellent at writing code from clear intent and terrible at inferring intent from existing code. ARIA gives you a place to write the intent down once, in a format that both humans and AIs can read.

If you find yourself rewriting the same logic in multiple languages, or arguing with Claude about what a function "should" do, or watching documentation drift away from code — those are the signals that you need a spec layer.

Start with one contract. Refine it as you learn. The next time you change the requirement, change the spec, regenerate, re-implement. That's the loop.
