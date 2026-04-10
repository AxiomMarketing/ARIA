---
name: step-pj-02-decompose
description: Project workflow — decompose project into ARIA modules
next_step: steps/step-pj-03-generate-all.md
---

# Step PJ-02 — Decompose into Modules

## MANDATORY EXECUTION RULES

- 🛑 NEVER generate `.aria` files in this step — that's pj-03
- 🛑 NEVER skip the boundary analysis — separate domains by responsibility
- 🛑 NEVER create > 8 modules in one go (cognitive limit; suggest splitting if more)
- ✅ ALWAYS produce a domain map with explicit module boundaries
- ✅ ALWAYS show the plan to the user before proceeding (unless auto_mode)
- 📋 YOU ARE A SOFTWARE ARCHITECT — your job is decomposition, not implementation

## CONTEXT BOUNDARIES

- Coming from: `step-pj-01-discover.md` with `{project_description}` and `{project_name}` set
- Going to: `step-pj-03-generate-all.md` with `{domains}` array set

## YOUR TASK

Decompose the project into 3-7 cohesive modules, each becoming one `.aria` file. Identify cross-module dependencies and pick a generation order.

---

## EXECUTION SEQUENCE

### 1. Identify candidate domains

From `{project_description}`, list candidate modules. Common patterns:

| Project type | Typical modules |
|---|---|
| **SaaS app** | `auth`, `users`, `billing`, `notifications`, `admin` |
| **Marketplace** | `auth`, `products`, `orders`, `payments`, `commission`, `fulfillment` |
| **Social app** | `auth`, `users`, `posts`, `feed`, `notifications`, `moderation` |
| **E-commerce** | `auth`, `catalog`, `cart`, `checkout`, `payments`, `orders`, `shipping` |
| **B2B / multi-tenant** | `auth`, `organizations`, `members`, `permissions`, `billing`, `audit` |
| **Booking / reservation** | `auth`, `availability`, `bookings`, `payments`, `notifications`, `cancellation` |
| **Content / CMS** | `auth`, `content`, `categories`, `search`, `comments`, `moderation` |

Pick the modules that match `{project_description}`. Add project-specific modules as needed.

### 2. Apply boundary rules

For each candidate module, check:

- **Single responsibility**: does it handle ONE coherent thing? If not, split.
- **Independent lifecycle**: can it exist without the others? (auth must, billing might not)
- **Clear ownership of types**: which module "owns" `User`, `Order`, `Payment`?
- **Testable in isolation**: can you write `examples` for it without invoking other modules?

If a candidate fails 2+ rules, merge or split it.

### 3. Limit to 3-7 modules

If you have > 7, group related ones (e.g. `notifications` + `email_templates` → just `notifications`).

If you have < 3, the project might be a `forward` workflow case, not `project`. Tell the user:

```
Your project has only 2 modules. The forward workflow might be a better fit.
Run `/aria forward <feature description>` for each module instead.
Continue anyway? [y/N]
```

### 4. Identify cross-module references

For each module, list which OTHER module's types it imports:

```
auth          → (no imports — foundational)
users         → auth (User type comes from auth)
products      → users (Artist references User)
orders        → products, users (Order references Product + Customer)
payments      → orders (Payment references Order)
commission    → payments, users (split between Artist + Platform)
fulfillment   → orders (FulfillmentRequest references Order)
```

Set generation order: foundational modules first (no imports), then leaf modules.

### 5. Build the {domains} array

Final structure (mental, not a file):

```yaml
domains:
  - name: auth
    file: specs/auth.aria
    description: User authentication, sessions, password reset
    types: [User, Email, SessionToken, PasswordHash]
    contracts: [SignUp, LogIn, LogOut, ResetPassword]
    behaviors: [LoginFlow]
    imports: []
    order: 1

  - name: products
    file: specs/products.aria
    description: Artist art catalog, uploads, categories
    types: [Product, ProductId, Category]
    contracts: [CreateProduct, UpdateProduct, DeleteProduct, ListByCategory]
    behaviors: [ProductLifecycle]
    imports: [auth.User]
    order: 2

  ...
```

Set `{domains}` to this array.

### 6. Present the plan

Show the user:

```
═══════════════════════════════════════════════
  Project Decomposition: ArtMarketplace
═══════════════════════════════════════════════

  Modules: 6
  Generation order: based on dependency graph

  1. auth        (no deps)         — foundational
  2. products    (auth)            — catalog
  3. orders      (auth, products)  — purchases
  4. payments    (orders)          — Stripe integration
  5. commission  (payments, auth)  — 70/30 split
  6. fulfillment (orders)          — Printful integration

  Each module will become a separate .aria file in specs/.
  The commission module will reference 70/30 split + minimum 100 cents.
  The auth module will include sign-up, login, password reset, and a LoginFlow state machine.

═══════════════════════════════════════════════
```

If `auto_mode=false`, ask:

```yaml
questions:
  - header: "Decomposition"
    question: "Approve this module decomposition?"
    options:
      - label: "Yes, generate all 6 specs (Recommended)"
        description: "Proceed to spec generation"
      - label: "Add or remove a module"
        description: "I want to refine the module list"
      - label: "Merge some modules"
        description: "Too many modules, combine some"
      - label: "Split a module"
        description: "One module is too big, split it"
    multiSelect: false
```

Handle the answer:
- **Yes** → continue
- **Add/remove/merge/split** → ask which one, update `{domains}`, re-show
- **Loop** until user approves or hits 3 iterations

## SUCCESS METRICS

✅ `{domains}` array has 3-7 entries
✅ Each domain has a unique name, file path, and explicit imports
✅ Generation order respects dependency (no module imports a later one)
✅ User has approved (or auto_mode skipped)

## FAILURE MODES

❌ Writing `.aria` files in this step
❌ More than 7 modules (cognitive overload)
❌ Less than 3 modules (use forward workflow instead)
❌ Circular imports between modules
❌ Skipping boundary analysis

## NEXT STEP

→ Load `steps/step-pj-03-generate-all.md`

<critical>
A clean decomposition makes the next steps trivial. A messy one cascades into spec rework. Take time here.
</critical>
