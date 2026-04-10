---
name: step-fw-01-parse
description: Forward workflow — parse user intent, detect stack
next_step: steps/step-fw-02-spec.md
---

# Step FW-01 — Parse Intent + Detect Stack

## MANDATORY EXECUTION RULES

- 🛑 NEVER write code or specs in this step — only extract intent
- 🛑 NEVER skip stack detection — it determines the target language
- ✅ ALWAYS prefer reading existing files (`CLAUDE.md`, `package.json`) over asking
- ✅ ALWAYS use AskUserQuestion (not plain text) if you must ask the user
- 📋 YOU ARE A PARSER, not an architect

## CONTEXT BOUNDARIES

- Coming from: `step-00-route.md` with `{workflow}=forward` and `{user_input}` set
- Going to: `step-fw-02-spec.md` with `{description}`, `{module_name}`, `{stack}`, `{target}` set

## YOUR TASK

Extract structured intent from `{user_input}` and determine the target language stack.

---

## EXECUTION SEQUENCE

### 1. Extract from description

From `{user_input}`, identify:

1. **Feature name** → derive `{module_name}` (PascalCase)
2. **Domain entities** → mental list of types needed
3. **Operations** → mental list of contracts needed
4. **Error cases** → for `on_failure` sections
5. **State machines** → if the feature has lifecycle states

### 2. Detect stack

In order:

1. Read `CLAUDE.md` if it exists — look for explicit `target typescript`, `target rust`, etc.
2. Read `package.json` — set `{stack}=typescript` if it exists
3. Read `Cargo.toml` — set `{stack}=rust`
4. Read `pyproject.toml` or `requirements.txt` — set `{stack}=python`
5. If ambiguous and `auto_mode=false`, ask the user via AskUserQuestion:

```yaml
questions:
  - header: "Target language"
    question: "Which language should ARIA generate code for?"
    options:
      - label: "TypeScript (Recommended)"
        description: "Zod schemas + branded types + vitest tests"
      - label: "Rust"
        description: "Structs with serde + state machines"
      - label: "Python"
        description: "Pydantic v2 BaseModel + Annotated fields"
      - label: "JSON Schema only"
        description: "Draft 2020-12 schemas without code generation"
    multiSelect: false
```

### 3. Map stack to ARIA target

| Stack | `{target}` |
|---|---|
| `typescript` | `typescript` |
| `rust` | `rust` |
| `python` | `python` |
| `jsonschema` | `jsonschema` |

## SUCCESS METRICS

✅ `{description}` is set to the cleaned user input
✅ `{module_name}` is a valid PascalCase identifier
✅ `{target}` is one of `typescript|rust|python|jsonschema`
✅ Stack detection prefers files over user prompts

## FAILURE MODES

❌ Asking the user without first reading `package.json` and `CLAUDE.md`
❌ Generating spec content here (that's step-fw-02's job)
❌ Choosing a stack the project doesn't support

## NEXT STEP

→ Load `steps/step-fw-02-spec.md`

<critical>
Stack detection is load-bearing for the rest of the forward workflow. Get it right.
</critical>
