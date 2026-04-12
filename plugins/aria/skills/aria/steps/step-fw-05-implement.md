---
name: step-fw-05-implement
description: Forward workflow — run aria implement to have Claude fill in the stubs
next_step: steps/step-fw-06-test.md
---

# Step FW-05 — AI Implementation via Claude

## MANDATORY EXECUTION RULES

- 🛑 NEVER call this step without `ANTHROPIC_API_KEY` being set
- 🛑 NEVER write the implementation manually — `aria implement` calls Claude
- 🛑 NEVER continue if `aria implement` fails — fix the issue first
- 🛑 NEVER allow `any` type in generated implementations — reject and re-prompt if detected
- ✅ ALWAYS verify ANTHROPIC_API_KEY before invoking the command
- ✅ ALWAYS report what was implemented and what failed
- ✅ ALWAYS run the type safety audit after implementation (see step 3.5)
- 📋 YOU ARE A DRIVER — `aria implement` does the actual work

## CONTEXT BOUNDARIES

- Coming from: `step-fw-04-gen.md` with `{output_dir}` containing scaffolding stubs
- Going to: `step-fw-06-test.md` once Claude has filled in the stubs

## YOUR TASK

Run `aria implement` to have Claude replace the `throw new Error("Not implemented")` stubs with real implementations that satisfy the contract requires/ensures/examples.

---

## EXECUTION SEQUENCE

### 1. Verify ANTHROPIC_API_KEY

```bash
echo "${ANTHROPIC_API_KEY:-NOT_SET}" | head -c 10
```

If not set, tell the user:

```
ANTHROPIC_API_KEY is not set. To run aria implement, you need to:
  export ANTHROPIC_API_KEY=sk-ant-...

Or skip this step and implement the contracts manually.
```

If `auto_mode=false`, use AskUserQuestion:

```yaml
questions:
  - header: "API key missing"
    question: "ANTHROPIC_API_KEY is not set. What now?"
    options:
      - label: "Skip aria implement"
        description: "Continue to test step; implementations stay as stubs"
      - label: "I'll set it now"
        description: "I will set the env var and you re-run /aria"
      - label: "Abort"
        description: "Stop the workflow"
    multiSelect: false
```

### 2. Run `aria implement`

Only `typescript` target is supported by `aria implement` currently.

```bash
npx aria-lang implement {spec_path} --ai claude -o {output_dir}
```

(or `npx tsx /Users/admin/WebstormProjects/ARIA/src/cli.ts implement ...` in dev mode)

This will:
1. Parse the spec
2. For each contract: build a prompt with inputs/requires/ensures/on_failure/examples
3. Call Claude API
4. Validate the AI output for dangerous patterns (security check)
5. Patch the contract file in `{output_dir}` to replace the stub with the AI implementation

### 3. Report results

Show the user:

```
✓ Implemented {N}/{total} contracts via Claude
  - {ContractName1}
  - {ContractName2}
  ...

⚠ {M} contracts had warnings:
  - {ContractNameX}: suspicious pattern detected (review recommended)

✗ {K} contracts failed:
  - {ContractNameY}: {error message}
```

### 3.5 Type safety & design patterns audit

After successful implementation, scan all generated contract files for quality issues:

```bash
# Check for forbidden patterns
grep -rn "any" {output_dir}/*.contracts.ts | grep -v "// any-ok"
grep -rn "as any" {output_dir}/*.contracts.ts
grep -rn ": any" {output_dir}/*.contracts.ts
grep -rn "any\[\]" {output_dir}/*.contracts.ts
```

**Forbidden patterns (auto-fix required):**

| Pattern | Why it's bad | Fix |
|---------|-------------|-----|
| `: any` | Bypasses type system entirely | Use the specific type from the .types.ts file |
| `as any` | Unsafe cast, hides errors | Use `as SpecificType` or type guard |
| `any[]` | Untyped array | Use `SpecificType[]` or generic `T[]` |
| `// @ts-ignore` | Silences compiler | Fix the underlying type issue |
| `// @ts-expect-error` | Silences compiler | Fix the underlying type issue |
| `Object` (capitalized) | Too broad | Use `Record<string, unknown>` or specific interface |
| `Function` (capitalized) | Untyped callable | Use specific signature `(arg: T) => R` |
| `{}` as type | Empty object, accepts anything | Use `Record<string, never>` or specific type |

If any forbidden pattern is found:
1. Read the contract spec to understand what type should be used
2. Replace with the correct type from the generated `.types.ts`
3. Re-run `npx tsc --noEmit` to verify

**Design pattern recommendations (suggest, don't force):**

When reviewing the implementation, recommend patterns from https://refactoring.guru/design-patterns/typescript where they match ARIA spec structures. All 22 GoF patterns mapped to ARIA:

**Creational Patterns — how objects are created:**

| ARIA spec pattern | Recommended pattern | When to use |
|---|---|---|
| Multiple type variants (Enum with many values) | **Factory Method** — centralized creation with subclass override | Creating role instances, action handlers, error types |
| Family of related types (Record + sub-Records) | **Abstract Factory** — produce families of related objects | Creating entire game configs, UI theme sets, API client sets |
| Complex Record with many fields + computed | **Builder** — step-by-step fluent construction | Building GameConfig, complex query objects, multi-step forms |
| Type reused across modules (from shared-types) | **Prototype** — clone existing instances | Copying player state, duplicating game snapshots, template configs |
| Contract with `depends_on` single service | **Singleton** — ensure one instance of a service | Database connections, game engine instance, event bus |

**Structural Patterns — how objects compose:**

| ARIA spec pattern | Recommended pattern | When to use |
|---|---|---|
| Contract wrapping external service (`depends_on`) | **Adapter** — normalize third-party API to your interface | Wrapping Stripe, DB drivers, WebSocket libraries |
| Generic type `Result of T, E` with variants | **Bridge** — separate abstraction from implementation | Decoupling rendering from game logic, transport from protocol |
| Nested Record types (Record of Records) | **Composite** — treat tree structures uniformly | Game state trees, UI component hierarchies, permission trees |
| Contract with `rate_limit` / `timeout` / `retry` | **Decorator** — add behavior without modifying original | Adding logging, caching, rate limiting, auth checks to any contract |
| Module with many contracts behind one entry | **Facade** — simplified interface to a complex subsystem | GameEngine exposing start/stop/action instead of 20 internal contracts |
| Shared type used in 100+ places (Enum, small Record) | **Flyweight** — share immutable state across instances | RoleDef instances, card definitions, static game rules |
| Contract that validates before delegating | **Proxy** — control access to the real implementation | Auth proxy, validation proxy, lazy-loading proxy, logging proxy |

**Behavioral Patterns — how objects communicate:**

| ARIA spec pattern | Recommended pattern | When to use |
|---|---|---|
| Contract with ordered `requires` checks | **Chain of Responsibility** — pass request along handler chain | Validation pipelines, middleware stacks, permission checks |
| Saga `steps` + `compensate` | **Command** — encapsulate operation for undo/redo/queue | Reversible game actions, transaction rollback, action history |
| List types iterated in contracts | **Iterator** — traverse collections without exposing internals | Iterating players, processing vote lists, scanning game events |
| Dispatch to multiple sub-contracts | **Mediator** — centralize complex communication | Game event bus, phase coordinator, notification dispatcher |
| Behavior with state history / `old()` references | **Memento** — capture and restore state snapshots | Save/load game, undo last action, state rollback |
| Behavior `invariants` + event system | **Observer** — notify subscribers of state changes | Phase change events, death notifications, vote updates |
| Behavior with `states` + `transitions` | **State** — each state is a class with its own behavior | Game phases, player lifecycle, connection states |
| Dispatch `on field when X -> ContractX` | **Strategy** — swap algorithms at runtime | Role-specific night actions, different vote counting methods |
| Multiple contracts sharing same flow structure | **Template Method** — define skeleton, subclasses fill steps | Night phase template (each role overrides performAction) |
| Contract that transforms Record fields | **Visitor** — add operations to objects without modifying them | Stat calculators, serializers, report generators on game state |

Choose patterns based on what the ARIA spec describes, not what seems clever. A spec with `dispatch` naturally maps to Strategy; a spec with `behavior` + `states` maps to State. Don't force patterns where the code is simple enough without them.

### 4. If failures occurred

For each failed contract:
- Show the error
- Suggest: refine the spec (add more examples, clearer ensures), or implement manually

If `auto_mode=false` and there are failures, ask the user:

```yaml
questions:
  - header: "Failures"
    question: "{K} contracts failed. What now?"
    options:
      - label: "Continue to tests anyway"
        description: "Tests will mark failed contracts as errors"
      - label: "Refine spec and retry"
        description: "Go back to step-fw-02 to enrich the spec"
      - label: "Abort"
        description: "Stop here"
    multiSelect: false
```

## SUCCESS METRICS

✅ `aria implement` returned exit code 0
✅ All contract stubs in `{output_dir}` no longer contain `throw new Error("Not implemented")`
✅ No security warnings on AI output
✅ User informed of any failures

## FAILURE MODES

❌ Running without checking ANTHROPIC_API_KEY first
❌ Manually editing contract files (Claude should do it via the CLI)
❌ Continuing past failures without notifying the user
❌ Ignoring security warnings on AI output

## NEXT STEP

→ Load `steps/step-fw-06-test.md`

<critical>
This is the most expensive step (Claude API calls). If you reach here in error or with the wrong spec, abort and go back to step-fw-02 instead of burning tokens.
</critical>
