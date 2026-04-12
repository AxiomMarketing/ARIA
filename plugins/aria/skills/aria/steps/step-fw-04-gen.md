---
name: step-fw-04-gen
description: Forward workflow — run aria gen to produce code scaffolding
next_step: steps/step-fw-05-implement.md
---

# Step FW-04 — Generate Code Scaffolding

## MANDATORY EXECUTION RULES

- 🛑 NEVER skip this step — `aria implement` (next step) needs the scaffolding to exist
- 🛑 NEVER manually write the generated files — use the CLI
- ✅ ALWAYS use `--target` matching `{target}` from step-fw-01
- ✅ ALWAYS verify the files exist before proceeding
- 📋 YOU ARE A DRIVER, not a code generator — let `aria gen` do the work

## CONTEXT BOUNDARIES

- Coming from: `step-fw-03-review.md` with approved `{spec_path}`
- Going to: `step-fw-05-implement.md` once scaffolding is on disk

## YOUR TASK

Run `aria gen` to generate the language-specific scaffolding (types, schemas, contract stubs, tests, behaviors) from the validated spec.

---

## EXECUTION SEQUENCE

### 1. Determine output directory

- Default: `src/{module-kebab}/`
- If the project has a different convention (e.g. `lib/`, `app/services/`), prefer that
- Set `{output_dir}` to the resolved path
- Create the directory if it does not exist

### 2. Run `aria gen`

```bash
npx aria-lang gen {spec_path} --target {target} -o {output_dir}
```

(or `npx tsx /Users/admin/WebstormProjects/ARIA/src/cli.ts gen ...` in dev mode)

### 3. List generated files

For TypeScript target, expect:
- `{module-kebab}.types.ts` — Zod schemas + branded types
- `{module-kebab}.contracts.ts` — Contract stubs with `throw new Error("Not implemented")`
- `{module-kebab}.behaviors.ts` — State machine validators (if behaviors in spec)
- `{module-kebab}.test.ts` — vitest tests from examples

For Rust:
- `{module-kebab}.types.rs`
- `{module-kebab}.contracts.rs`
- `{module-kebab}.behaviors.rs`

For Python:
- `{module-kebab}.py` (single file with all classes + contracts)

For JSON Schema:
- `{module-kebab}.schema.json`

### 4. Report

Show the user:

```
✓ Generated {N} files in {output_dir}
  - {module}.types.ts
  - {module}.contracts.ts
  - {module}.behaviors.ts (if applicable)
  - {module}.test.ts
```

### 5. Type safety smoke check

For TypeScript target, verify the generated code is strictly typed:

```bash
# Compile check
npx tsc --noEmit {output_dir}/*.ts 2>&1 | head -20

# Zero-any check: generated scaffolding must not contain any/unknown leaks
grep -rn ": any" {output_dir}/*.ts | grep -v "as any" | grep -v "// any-ok"
```

The ARIA generator should NEVER produce `z.any()` in Zod schemas. If you see `any` in the generated types file, it's a bug in the generator — report it but continue.

The `.contracts.ts` file will contain `throw new Error("Not implemented")` stubs — that's expected. The next step replaces them.

## SUCCESS METRICS

✅ All expected files exist on disk
✅ Files are non-empty
✅ For TS target, generated files import the right Zod helpers

## FAILURE MODES

❌ Skipping the CLI and writing files manually
❌ Wrong target language (mismatched with `{target}`)
❌ Output directory not created

## NEXT STEP

→ Load `steps/step-fw-05-implement.md`

<critical>
The contract files contain `throw new Error("Not implemented")` stubs. The next step (`aria implement`) replaces these with real implementations via Claude. Do NOT manually replace them here.
</critical>
