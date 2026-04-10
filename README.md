# ARIA — AI-Readable Intent Architecture

**A formal specification language where humans write the WHAT, and AI generates the HOW.**

📖 **[Documentation site](https://aria-lang.github.io)** · 🚀 **[Tutorial](docs/tutorial.md)** · 🧪 **[Examples](docs/examples.md)** · 📘 **[CLI Reference](docs/cli-reference.md)**

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

Install the `/aria` skill in Claude Code with **one command**:

```
/plugin marketplace add AxiomMarketing/ARIA
/plugin install aria@aria-lang
```

After install, type `/aria` and the skill routes to one of 4 sub-workflows automatically based on your project state and intent:

| Command | Workflow | What it does |
|---|---|---|
| `/aria <feature description>` | **forward** | Generates `.aria` spec from natural language → code → tests → AI implementation |
| `/aria reverse src/` | **reverse** | Imports existing TypeScript into `.aria` skeletons + drift detection |
| `/aria audit` | **maintain** | Validates all specs + detects spec/impl drift + proposes fixes |
| `/aria install` | **setup** | First-time install: configures `CLAUDE.md`, creates `specs/`, scaffolds an example |

The skill orchestrates all 12 ARIA CLI commands (`check`, `gen`, `diagram`, `test`, `implement`, `init`, `watch`, `fmt`, `setup`, `import`, `drift`, `aria-mcp`) via 17 progressive step files.

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
