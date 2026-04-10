---
name: step-rv-01-scan
description: Reverse workflow — scan the project to detect what to import
next_step: steps/step-rv-02-import.md
---

# Step RV-01 — Scan Codebase

## MANDATORY EXECUTION RULES

- 🛑 NEVER scan node_modules, dist, build, .git, hidden dirs
- 🛑 NEVER overwrite existing specs without confirmation
- ✅ ALWAYS detect the project structure (TS source dirs, test dirs)
- ✅ ALWAYS report what will be imported BEFORE doing it
- 📋 YOU ARE A SCANNER, not an importer — actual import is step-rv-02

## CONTEXT BOUNDARIES

- Coming from: `step-00-route.md` with `{workflow}=reverse`
- Going to: `step-rv-02-import.md` with `{import_source}` and `{import_count}` set

## YOUR TASK

Identify the TypeScript source directories to import, count the files, and present a plan to the user.

---

## EXECUTION SEQUENCE

### 1. Detect source directories

Look for the standard locations in order:

```bash
ls src/         # Most common
ls lib/         # Library projects
ls app/         # Next.js / Rails-style
ls source/      # Less common
```

Set `{import_source}` to the first one found.

If multiple exist, present them to the user via AskUserQuestion.

### 2. Count importable files

```bash
find {import_source} -name "*.ts" -not -name "*.test.ts" -not -name "*.spec.ts" -not -name "*.d.ts" \
  -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/dist/*" -not -path "*/build/*" | wc -l
```

Set `{import_count}` to this number.

### 3. Check for existing specs

```bash
ls specs/*.aria 2>/dev/null
```

If specs already exist, set `{has_existing_specs}=true` and ask the user:

```yaml
questions:
  - header: "Existing specs"
    question: "There are already .aria files in specs/. What should I do?"
    options:
      - label: "Skip files that already have specs (Recommended)"
        description: "Only import .ts files without a matching .aria"
      - label: "Overwrite all"
        description: "Replace existing specs with fresh skeletons"
      - label: "Abort"
        description: "Do not run import"
    multiSelect: false
```

### 4. Present the plan

```
Reverse engineering plan:
  Source directory : {import_source}
  Files to import  : {import_count}
  Output directory : ./specs/
  Existing specs   : {N existing or "none"}

This will:
  1. Run `aria-lang import {import_source} -o specs/ --recursive`
  2. Generate {import_count} .aria skeleton files
  3. Each skeleton will contain TODOs to fill in
  4. Step rv-03 will help enrich them via Claude
  5. Step rv-04 will detect drift between specs and impl
```

### 5. Confirmation (skip if auto_mode)

**If `{auto_mode}` = true:** continue automatically.

**If `{auto_mode}` = false:** Use AskUserQuestion:

```yaml
questions:
  - header: "Start import"
    question: "Ready to import {import_count} files?"
    options:
      - label: "Yes, import everything (Recommended)"
        description: "Run aria import with the plan above"
      - label: "Limit to a subset"
        description: "I'll specify a subdirectory or file pattern"
      - label: "Abort"
        description: "Stop the workflow"
    multiSelect: false
```

If "Limit to a subset", ask for the path/pattern and update `{import_source}` accordingly.

## SUCCESS METRICS

✅ `{import_source}` is set to a valid existing directory
✅ `{import_count}` reflects actual `.ts` files (excluding tests, types, node_modules)
✅ User has confirmed the plan (or auto_mode skipped)
✅ Existing specs handled per user choice

## FAILURE MODES

❌ Scanning node_modules
❌ Importing without checking for existing specs
❌ Counting `.test.ts` or `.d.ts` files

## NEXT STEP

→ Load `steps/step-rv-02-import.md`

<critical>
This is a read-only scan. No file is created or modified in this step.
</critical>
