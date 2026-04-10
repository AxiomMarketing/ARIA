---
name: step-00-route
description: Parse user input, detect project context, route to the right ARIA workflow
---

# Step 00 — Router

## MANDATORY EXECUTION RULES (READ FIRST)

- 🛑 NEVER load a workflow-specific step (fw/rv/mt/su) before this router has set `{workflow}`
- 🛑 NEVER guess the workflow — analyze the user input AND the project context
- ✅ ALWAYS read `package.json`, `CLAUDE.md`, and check for `specs/` before deciding
- ✅ ALWAYS use AskUserQuestion if intent is ambiguous (and `auto_mode` is false)
- 📋 YOU ARE A ROUTER, not an executor — your only job is to set state and load the next file
- 💬 FOCUS on detection and routing only — leave actual work to sub-workflows

## EXECUTION PROTOCOLS

- 🎯 Detect intent BEFORE asking the user
- 💾 Initialize all state variables defined in SKILL.md
- 📖 Load exactly ONE workflow step file at the end
- 🚫 FORBIDDEN to do file generation, parsing, or CLI calls in this step

## CONTEXT BOUNDARIES

- Variables from SKILL.md are available
- Project context (cwd, files) must be discovered, not assumed
- The user input is the only initial signal

## YOUR TASK

Determine which ARIA workflow (forward / reverse / maintain / setup) matches the user's intent and project state, then load the corresponding workflow entry step.

---

## EXECUTION SEQUENCE

### 1. Parse user input

The user said `/aria <something>`. Extract:

- `{user_input}` — the raw description after `/aria`
- `{auto_mode}` — true if input contains `-a`, `--auto`, `auto`
- Explicit workflow keyword (if any): `forward`, `feature`, `project`, `reverse`, `import`, `audit`, `check`, `drift`, `setup`, `install`

### 2. Detect project context

Run these reads in parallel:

```bash
# Check current working directory
pwd
# → set {cwd}

# Check if aria-lang is installed
cat package.json 2>/dev/null
# → set {has_aria_lang} = true if "aria-lang" in dependencies/devDependencies

# Check if specs directory exists with .aria files
ls specs/*.aria 2>/dev/null
# → set {has_specs_dir} = true if any files

# Check if CLAUDE.md has the ARIA section
grep -l "## ARIA Specifications" CLAUDE.md 2>/dev/null
# → set {has_claude_md} = true if found

# Detect primary language stack
ls package.json Cargo.toml pyproject.toml 2>/dev/null
# → set {stack}: typescript if package.json, rust if Cargo.toml, python if pyproject.toml
```

### 3. Determine workflow

Use this decision matrix:

| User input contains | Project state | → Workflow |
|---|---|---|
| `setup`, `install`, `bootstrap`, `first time` | Any | → **setup** |
| `import`, `reverse`, `existing code`, `from src` | Has source code, no specs/ | → **reverse** |
| `import`, `reverse` | Has source code AND specs/ | Ask: replace existing? → **reverse** |
| `audit`, `check`, `drift`, `validate`, `lint specs` | `has_specs_dir = true` | → **maintain** |
| `audit`, `check` | `has_specs_dir = false` | → **setup** (with audit follow-up) |
| `project`, `whole app`, `entire system`, `bootstrap project`, `decompose this idea` | Any | → **project** |
| Multi-domain description (mentions 3+ distinct features/areas) | Any | → **project** |
| Single feature description (one operation) | `has_aria_lang = true` | → **forward** |
| Single feature description | `has_aria_lang = false` | → **setup** (then forward) |
| Empty input | Any | → ask user via AskUserQuestion |

### 3a. Heuristic for "single feature" vs "project"

When the user gives a free-form description without an explicit keyword, count:
- **Distinct domains/nouns**: auth, payment, products, orders, users, etc.
- **Distinct operations/verbs**: login, charge, refund, calculate, etc.
- **Sentence length**: > 200 chars often indicates project scope
- **Connecting words**: "and ... and ...", "with ... where ... and", "I'm building"

Decision rules:
- 1 domain + 1-2 operations → **forward** (single feature)
- 2+ domains OR 3+ operations OR > 200 chars → **project** (multi-module)
- Sentence starts with "I'm building", "I want to make a", "my app does", "we're working on" → almost always **project**
- Explicit `project` keyword → always **project**
- Explicit `forward` or `feature` keyword → always **forward**

When unclear, ask the user (see step 4).

### 4. Confirm with user (if auto_mode=false and intent is ambiguous)

**If `{auto_mode}` = true:** apply the matrix decision automatically.

**If `{auto_mode}` = false AND intent is ambiguous:**

Use AskUserQuestion:

```yaml
questions:
  - header: "Workflow"
    question: "Which ARIA workflow do you want to run?"
    options:
      - label: "Build a new feature (forward)"
        description: "One spec, one module, one contract or two — fastest path"
      - label: "Bootstrap a whole project (project)"
        description: "Multiple specs covering multiple domains — interview + iterate"
      - label: "Import existing code (reverse)"
        description: "Reverse-engineer TypeScript files into .aria spec skeletons"
      - label: "Audit existing specs (maintain)"
        description: "Validate all specs, detect drift between specs and implementation"
      - label: "First-time setup"
        description: "Install aria-lang, configure CLAUDE.md, scaffold an example spec"
    multiSelect: false
```

### 5. Set state and load workflow

Set `{workflow}` to one of: `forward`, `project`, `reverse`, `maintain`, `setup`.

Then load exactly ONE file:

| `{workflow}` | Load |
|---|---|
| `forward` | `steps/step-fw-01-parse.md` |
| `project` | `steps/step-pj-01-discover.md` |
| `reverse` | `steps/step-rv-01-scan.md` |
| `maintain` | `steps/step-mt-01-check.md` |
| `setup` | `steps/step-su-01-install.md` |

## SUCCESS METRICS

✅ `{workflow}` is set to a valid value
✅ All context variables (`{cwd}`, `{has_aria_lang}`, `{has_specs_dir}`, `{stack}`) are populated
✅ Exactly one workflow entry step is loaded
✅ User has confirmed the choice (or auto_mode skipped confirmation)

## FAILURE MODES

❌ Loading a workflow step before setting `{workflow}`
❌ Asking the user without first attempting auto-detection
❌ Doing file generation or CLI calls (not this step's job)
❌ Loading multiple workflow steps in parallel

## NEXT STEP

Load the file mapped from `{workflow}` in the table above.

<critical>
The router is the single source of truth for workflow selection. Do not allow downstream steps to "switch workflow" mid-execution. If a user changes their mind, restart from this router.
</critical>
