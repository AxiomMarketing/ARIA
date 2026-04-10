# ARIA — AI-Readable Intent Architecture

**A formal specification language where humans write the WHAT, and AI generates the HOW.**

🚀 **[Tutorial](docs/tutorial.md)** · 🧪 **[Examples](docs/examples.md)** · 📘 **[CLI Reference](docs/cli-reference.md)** · 📖 **[Language Reference](LANGUAGE.md)**

## Install

**Via npm (CLI + library):**
```bash
npm install -g aria-lang
# or
npx aria-lang --version
```

**Via Claude Code (skill + workflows):**
```
/plugin marketplace add AxiomMarketing/ARIA
/plugin install aria@aria-lang
```

After installing the Claude Code plugin, type `/aria` to access 4 automatic workflows (forward / reverse / maintain / setup). See the [Claude Code Plugin](#claude-code-plugin) section below for details.

---

ARIA is a specification language designed from the ground up for AI-driven development. You write contracts, types, and state machines in `.aria` files. The ARIA compiler generates TypeScript + Zod schemas, Mermaid diagrams, and test suites. AI agents (Claude, GPT, Gemini) then implement the actual code, guided by your specifications.

```aria
contract TransferFunds
  --- Transfer funds between two accounts

  inputs
    from: Account
    to: Account
    amount: Money

  requires
    from.balance >= amount
    from.status == active

  ensures
    from.balance == old(from.balance) - amount
    to.balance == old(to.balance) + amount

  on_failure
    when from.balance < amount
      return InsufficientFunds with remaining: from.balance

  examples
    given
      from: { id: "acc_abc", balance: 10000, status: active }
      to:   { id: "acc_xyz", balance: 5000,  status: active }
      amount: 3000
    then
      from.balance == 7000
      to.balance == 8000
```

## Why ARIA?

| Problem | ARIA's Solution |
|---------|----------------|
| AI hallucinates APIs | Contracts define exact inputs/outputs/errors |
| Silent logic bugs | `ensures` clauses verify correctness |
| No error handling | `on_failure` makes error cases first-class |
| Specs rot | Specs compile to code + tests — they can't drift |
| State machine complexity | `behavior` blocks with visual Mermaid output |
| Ecosystem lock-in | Compiles to TypeScript, Rust, Python (planned) |

## Quick Start

```bash
# Install dependencies
npm install

# Check a spec file
npx tsx src/cli.ts check examples/payment.aria

# Generate TypeScript + Zod schemas
npx tsx src/cli.ts gen examples/payment.aria -o generated/

# Generate Mermaid state diagrams
npx tsx src/cli.ts diagram examples/order.aria -o docs/order.md

# Generate test files
npx tsx src/cli.ts test examples/payment.aria -o generated/
```

## The Pipeline

```
WRITE              VERIFY             GENERATE            IMPLEMENT
 .aria files  -->  aria check    -->  aria gen         -->  AI fills TODOs
 (human)          (compile-time)     (scaffolding)        (Claude/GPT)
                                                               |
                                                               v
                                                         VALIDATE
                                                          aria test
                                                         (auto-generated)
```

## Language Overview

### Types with Refinement

```aria
type Money is Integer
  where self > 0
  where self <= 1_000_000
  unit "cents"

type Email is String
  where self matches /^[^@]+@[^@]+\.[^@]+$/
  where length(self) <= 255
```

Compiles to Zod schemas:

```typescript
export const MoneySchema = z.number().int().gt(0).lte(1_000_000);
export type Money = z.infer<typeof MoneySchema>;
```

### Contracts (Pre/Post/Failure/Examples)

Contracts are the core of ARIA. They describe:
- **inputs** — what goes in
- **requires** — preconditions (caller's obligations)
- **ensures** — postconditions (function's guarantees)
- **on_failure** — explicit error cases
- **examples** — concrete test cases (auto-generate tests)

### Behaviors (State Machines)

```aria
behavior OrderLifecycle
  states
    draft, confirmed, paid, shipped, delivered

  initial draft

  transitions
    draft -> confirmed
      when items.length > 0

  forbidden
    delivered -> draft
```

Compiles to Mermaid diagrams and transition validator code.

### Effects & Dependencies

```aria
contract SendEmail
  effects
    sends Email to user.email
    writes AuditLog
  depends_on
    EmailService
  timeout 30 seconds
```

Side effects are declared, not hidden.

## Project Structure

```
ARIA/
├── LANGUAGE.md          # Complete language reference
├── src/
│   ├── ast.ts           # AST type definitions
│   ├── lexer.ts         # Tokenizer
│   ├── parser.ts        # Parser (tokens -> AST)
│   ├── cli.ts           # CLI commands
│   ├── index.ts         # Public API
│   └── generators/
│       ├── typescript.ts # TypeScript + Zod generator
│       ├── mermaid.ts    # Mermaid diagram generator
│       └── tests.ts      # Test file generator
├── examples/
│   ├── payment.aria     # Payment processing spec
│   ├── auth.aria        # Authentication spec
│   └── order.aria       # E-commerce order spec
└── tests/
```

## Design Principles

1. **ASCII-only** — No mathematical symbols. AI tokenizes ASCII better.
2. **Contracts native** — `requires` / `ensures` / `on_failure` built into the language.
3. **Examples mandatory** — Every contract should have `given/then` examples.
4. **Each line parseable alone** — No implicit context needed.
5. **Compiles to existing languages** — Zero ecosystem to build.
6. **Incremental specs** — Start incomplete, refine iteratively.

## Inspiration

ARIA combines the best ideas from:
- **Dafny** — `requires`/`ensures` contract syntax
- **Eiffel** — Design by Contract philosophy
- **Gherkin** — Human-readable `given/then` examples
- **TLA+** — State machine and temporal reasoning (simplified)
- **Klar** — Every line parseable without context
- **Unison** — Content-addressed, deterministic code identity

See [LANGUAGE.md](LANGUAGE.md) for the complete reference.

## Claude Code Plugin

The `/aria` plugin gives Claude Code a complete spec-first workflow. Install it once, then use it in any project.

### Install

```
/plugin marketplace add AxiomMarketing/ARIA
/plugin install aria@aria-lang
```

This downloads the skill files into your local Claude Code plugin cache (`~/.claude/plugins/cache/`). After install, type `/aria` followed by what you want to do — the skill auto-detects which workflow to run based on your project state and your intent.

### How the skill works

When you type `/aria <something>`, the skill goes through these phases:

```
1. ROUTE        Read your project (package.json, specs/, CLAUDE.md)
   ↓            Detect intent from your input
   ↓            Pick one of 4 workflows: forward / reverse / maintain / setup
   ↓
2. EXECUTE      Run a sequence of small step files (3-6 per workflow)
   ↓            Each step is focused: parse, validate, generate, implement, test
   ↓            Steps call the underlying ARIA CLI (check, gen, implement, etc.)
   ↓
3. CONFIRM      Pause at decision points (skip with -a/--auto)
   ↓            Show progress, ask for approval before expensive ops (AI calls)
   ↓
4. REPORT       Final summary with files created, tests results, next steps
```

The skill is **stateful across steps** but **stateless across invocations** — every `/aria` call starts from scratch and re-detects the project state.

### The 4 workflows

| Command | Workflow | Trigger | Steps |
|---|---|---|---|
| `/aria <feature description>` | **forward** | New feature from natural language | parse → spec → review → gen → implement → test |
| `/aria reverse src/` | **reverse** | Existing TypeScript codebase | scan → import → enrich → drift |
| `/aria audit` | **maintain** | Existing ARIA project | check → drift → propose fixes |
| `/aria install` | **setup** | First-time install in a project | install → configure → scaffold |

The router detects intent automatically — you can also be explicit by saying `/aria forward ...`, `/aria reverse src/`, `/aria audit`, etc.

### Example 1 — Build a new feature from scratch (forward)

You're building a marketplace and need to compute commission splits. You type:

```
/aria a commission calculator that splits sale 70/30 between artist and platform,
with a minimum 100-cent platform commission, rejecting inactive artists
```

The skill walks through:

1. **Parse** — extracts module name (`Marketplace`), detects target language (TypeScript from `package.json`)
2. **Spec** — writes `specs/marketplace.aria` with the `CalculateCommission` contract, `Money` type, `Artist` record, requires/ensures/examples
3. **Review** — shows you the spec, runs `aria check`, asks for approval
4. **Gen** — runs `aria gen specs/marketplace.aria -o src/marketplace/` → produces `marketplace.types.ts`, `marketplace.contracts.ts`, `marketplace.test.ts`
5. **Implement** — runs `aria implement` → Claude fills the `throw new Error("Not implemented")` stubs with real code that satisfies requires/ensures
6. **Test** — runs `npx vitest src/marketplace/` and reports pass/fail

End result : a fully tested `calculateCommission` function in 1 prompt.

### Example 2 — Import an existing codebase (reverse)

You have a Next.js project with no specs and want to retrofit ARIA on top. You type:

```
/aria reverse src/
```

The skill walks through:

1. **Scan** — counts your `.ts` files (skipping `node_modules`, `*.test.ts`, `*.d.ts`), checks for existing specs, presents the plan
2. **Import** — runs `aria import src/ -o specs/ --recursive` → generates a `.aria` skeleton per `.ts` file
3. **Enrich** — for each skeleton, reads the source `.ts` AND its tests, fills in the `requires` / `ensures` / `examples` / `on_failure` TODOs based on what the actual code does
4. **Drift** — runs `aria drift specs/ src/` → produces `specs/DRIFT.md` with all incoherences, then proposes an action plan

End result : you have formal specs for code you've already shipped, and a concrete list of what to fix.

### Example 3 — Audit an existing ARIA project (maintain)

You've been using ARIA for weeks and want to verify nothing has drifted. You type:

```
/aria audit
```

The skill walks through:

1. **Check** — runs `aria check specs/` and `aria fmt --check` on every spec
2. **Drift** — runs `aria drift specs/ src/` and parses the report
3. **Fix** — for each finding, proposes a concrete edit (in spec or in code), shows the diff, asks for approval, applies, re-validates

End result : your specs and your code are back in sync, or you have a clear list of intentional divergences.

### Example 4 — First-time setup in a fresh project (setup)

You just installed `aria-lang` and want to bootstrap your project. You type:

```
/aria install
```

The skill walks through:

1. **Install** — detects your package manager (npm/yarn/pnpm/bun), runs `<pm> install --save-dev aria-lang`
2. **Configure** — runs `aria setup` to inject the `## ARIA Specifications` section into your `CLAUDE.md`, creates `specs/`, updates `.gitignore` to exclude `src/generated/`, optionally adds `aria-mcp` to your IDE's MCP config
3. **Scaffold** — runs `aria init --module Example -o specs/` to create your first spec, validates it, prints a "first commands" guide

End result : a project ready for spec-first development in 30 seconds.

### CLI commands integrated by the skill

The 4 workflows together call all 12 ARIA CLI commands:

| Command | Used by |
|---|---|
| `aria check` | forward, maintain, reverse, setup |
| `aria gen` | forward, setup |
| `aria diagram` | forward, maintain |
| `aria test` | forward |
| `aria implement --ai claude` | forward |
| `aria init` | forward, setup |
| `aria fmt` | maintain |
| `aria setup` | setup |
| `aria import` | reverse |
| `aria drift` | reverse, maintain |
| `aria watch` | (available standalone) |
| `aria-mcp` | setup (MCP config injection) |

### Tips

- **Skip prompts with `-a` or `--auto`** : `/aria -a build a payment processor` runs the full forward workflow without asking for confirmations.
- **Auto-detection is heuristic** : if the skill picks the wrong workflow, be explicit with `/aria reverse src/` or `/aria audit`.
- **The skill never modifies your code without permission** — every destructive op (overwrite, AI implement) is gated behind a confirmation (unless `--auto`).
- **Tokens cost** : the `forward` workflow's `implement` step calls Claude API per contract. Set `ANTHROPIC_API_KEY` and expect ~1k-5k tokens per contract.

The skill orchestrates all 12 ARIA CLI commands via 17 progressive step files. See `plugins/aria/skills/aria/` in this repo for the source.

## Editor Support

| Editor | Syntax | AI integration | Setup |
|--------|--------|---------------|-------|
| **VS Code** | TextMate grammar + snippets + LSP | Built-in extension | [`editors/vscode/`](editors/vscode/) |
| **Cursor** | VS Code grammar (shared) | MCP server | [`editors/cursor/`](editors/cursor/) |
| **JetBrains** | TextMate bundle import | MCP + External Tools | [`editors/jetbrains/`](editors/jetbrains/) |
| **Neovim** | Vim syntax file | mcp.nvim + keybindings | [`editors/neovim/`](editors/neovim/) |
| **Claude Code** | N/A | `/aria` skill + MCP | [CLI Reference](docs/cli-reference.md) |

## Documentation

- **[Tutorial](docs/tutorial.md)** — Build your first spec in 10 minutes
- **[CLI Reference](docs/cli-reference.md)** — Every command and flag
- **[Language Reference](docs/reference.md)** — Grammar and semantics index
- **[Examples Gallery](docs/examples.md)** — Real-world specs you can copy
- **[Full Language Specification](LANGUAGE.md)** — The complete reference

## License

MIT
