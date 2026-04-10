---
name: step-pj-01-discover
description: Project workflow — interview the user about their project
next_step: steps/step-pj-02-decompose.md
---

# Step PJ-01 — Project Discovery

## MANDATORY EXECUTION RULES

- 🛑 NEVER skip the discovery — guessing leads to wrong domains
- 🛑 NEVER ask too many questions at once — max 2 rounds of questions
- 🛑 NEVER write any spec in this step — that's pj-03
- ✅ ALWAYS use AskUserQuestion for clarification (not plain text)
- ✅ ALWAYS gather these 5 things: domain, users, key flows, integrations, constraints
- 📋 YOU ARE A PRODUCT ANALYST — your job is to extract intent

## CONTEXT BOUNDARIES

- Coming from: `step-00-route.md` with `{workflow}=project` and `{user_input}` set
- Going to: `step-pj-02-decompose.md` with `{project_description}`, `{project_name}`, and a structured intent map

## YOUR TASK

Take the user's high-level project description and enrich it with structured details (users, flows, integrations, constraints) so the next step can decompose it into modules.

---

## EXECUTION SEQUENCE

### 1. Parse the initial description

Extract from `{user_input}`:
- **Project name** → derive `{project_name}` (PascalCase, e.g. `ArtMarketplace`, `TodoApp`)
- **Domain hints** → words like "marketplace", "social", "ecommerce", "saas", "auth", "payment"
- **Mentioned features** → list of nouns/verbs that suggest distinct modules

Example: "I'm building a marketplace where artists upload art, customers buy prints, payments are split, and orders are fulfilled by Printful"

→ `{project_name}` = `ArtMarketplace`
→ Mentioned features: artists/upload (auth + products), customers/buy (orders + payments), splits (commission), Printful (fulfillment)

### 2. Identify what's missing

From the parsed description, mentally fill in:

| Field | Did the user mention? | If yes | If no |
|---|---|---|---|
| **Users / actors** | who uses the app | use them | ask "who are the users?" |
| **Key operations** | login, buy, upload, etc. | use them | ask "what are the main actions?" |
| **External integrations** | Stripe, Printful, S3, etc. | use them | ask "any third-party services?" |
| **Constraints** | rate limits, money, time bounds | use them | ask "any specific business rules?" |
| **Tech stack** | TypeScript, Next.js, Adonis | use them OR detect from package.json | ask "what stack?" |

### 3. Ask clarifying questions (if auto_mode=false)

Maximum 2 rounds. Use AskUserQuestion in each round.

**Round 1 — Scope and users:**

```yaml
questions:
  - header: "Users"
    question: "Who are the main user types in your project?"
    options:
      - label: "End users only"
        description: "One type of user (e.g. customers, players, readers)"
      - label: "End users + admins"
        description: "Two types: regular users and an admin/staff role"
      - label: "Multi-sided marketplace"
        description: "Buyers + sellers (or artists + customers, hosts + guests, etc.)"
      - label: "B2B / multi-tenant"
        description: "Organizations with multiple users each"
    multiSelect: false

  - header: "Scale"
    question: "What level of detail do you want for the specs?"
    options:
      - label: "MVP — core flows only (Recommended)"
        description: "Auth + main feature + 1-2 supporting modules"
      - label: "Full v1 — production ready"
        description: "Auth + payments + admin + edge cases + state machines"
      - label: "POC / sandbox"
        description: "Just the happy path for the main feature"
    multiSelect: false
```

**Round 2 — Integrations and rules (only if needed):**

```yaml
questions:
  - header: "Integrations"
    question: "Any external services your project depends on?"
    options:
      - label: "None / I'll figure out later"
        description: "Spec the domain logic without external deps"
      - label: "Payment provider (Stripe, etc.)"
        description: "Include payment integration in the spec"
      - label: "Multiple integrations"
        description: "I will list them in chat"
    multiSelect: false
```

**If `auto_mode=true`:** skip both rounds and use sensible defaults (MVP scope, end users + admins, no external integrations unless mentioned in `{user_input}`).

### 4. Build the structured intent

Compile everything into a structured object (mental model, not a file yet):

```yaml
project_name: ArtMarketplace
description: |
  Multi-sided marketplace where artists upload art, customers
  buy prints, payments are split 70/30, fulfillment via Printful.
users:
  - artists (upload art, receive payments)
  - customers (browse, buy, track orders)
  - admins (moderate, refund, payouts)
operations:
  - artist_signup
  - artist_upload_art
  - customer_browse_catalog
  - customer_purchase
  - calculate_commission
  - fulfill_order
  - issue_refund
integrations:
  - Stripe (payments)
  - Printful (fulfillment)
constraints:
  - 70/30 commission split
  - minimum 100 cents platform fee
  - artists must be active to receive payments
stack: typescript
scope: full v1
```

Set `{project_description}` to a refined paragraph version of this structure.

### 5. Show the user a summary

```
Project discovery complete.

Project: ArtMarketplace
Scope:   Full v1
Stack:   TypeScript

Users:
  - Artists (upload art, receive payments)
  - Customers (browse, buy, track orders)
  - Admins (moderate, refund, payouts)

Key operations identified:
  - Artist signup, upload art
  - Customer purchase, browse catalog
  - Commission calculation (70/30)
  - Order fulfillment via Printful
  - Refunds

External integrations:
  - Stripe (payments)
  - Printful (fulfillment)

Business rules:
  - 70/30 commission split
  - Minimum 100 cents platform fee
  - Artists must be active

Proceeding to decomposition...
```

If `auto_mode=false`, ask the user to confirm or correct:

```yaml
questions:
  - header: "Confirm intent"
    question: "Is this an accurate summary of your project?"
    options:
      - label: "Yes, proceed (Recommended)"
        description: "Move on to spec generation"
      - label: "Add more details"
        description: "I want to specify more before generating"
      - label: "Start over"
        description: "Re-describe the project from scratch"
    multiSelect: false
```

## SUCCESS METRICS

✅ `{project_name}` is set to a valid PascalCase identifier
✅ `{project_description}` is a concrete paragraph with users + operations + integrations
✅ User has confirmed (or auto_mode skipped)
✅ NO `.aria` files written yet (that's pj-03)

## FAILURE MODES

❌ Writing specs in this step
❌ Asking more than 2 rounds of questions
❌ Skipping discovery and going straight to decomposition with vague intent

## NEXT STEP

→ Load `steps/step-pj-02-decompose.md`

<critical>
The quality of the discovery determines the quality of every subsequent spec. Take your time here. A 30-second extra interview prevents 30 minutes of regeneration.
</critical>
