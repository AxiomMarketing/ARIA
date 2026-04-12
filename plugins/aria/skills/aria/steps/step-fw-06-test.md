---
name: step-fw-06-test
description: Forward workflow — run generated tests and report final results
---

# Step FW-06 — Run Tests + Final Report

## MANDATORY EXECUTION RULES

- 🛑 NEVER load another step after this — this is the terminal step of the forward workflow
- 🛑 NEVER hide test failures from the user
- ✅ ALWAYS run the generated tests if a test runner is available
- ✅ ALWAYS produce a clean summary report
- 📋 YOU ARE A REPORTER — present results, don't fix anything (that's for follow-up workflows)

## CONTEXT BOUNDARIES

- Coming from: `step-fw-05-implement.md` with implementations on disk
- Going to: nowhere — workflow terminates here

## YOUR TASK

Run the auto-generated test files and produce a final summary report for the user.

---

## EXECUTION SEQUENCE

### 1. Detect test runner

- TypeScript with `package.json` → check for `vitest`, `jest`, or `mocha` in dependencies
- Rust with `Cargo.toml` → use `cargo test`
- Python with `pyproject.toml` or `requirements.txt` → use `pytest`

### 2. Run the tests

**TypeScript (vitest):**
```bash
cd {project_root} && npx vitest run {output_dir}
```

**TypeScript (jest):**
```bash
cd {project_root} && npx jest {output_dir}
```

**Rust:**
```bash
cd {project_root} && cargo test --package {module}
```

**Python:**
```bash
cd {project_root} && pytest {output_dir}
```

If no test runner is available, skip this step and just report the generated files.

### 3. Parse test results

Extract:
- Total tests
- Passed
- Failed (with names)
- Skipped

### 4. Final report

```
═══════════════════════════════════════════════
  ARIA Forward Pipeline — Complete
═══════════════════════════════════════════════

  Spec        : {spec_path}
  Module      : {module_name}
  Target      : {target}
  Output dir  : {output_dir}

  Files generated:
    • {module}.types.ts
    • {module}.contracts.ts
    • {module}.behaviors.ts (if applicable)
    • {module}.test.ts

  Implementation:
    • {N}/{total} contracts implemented via Claude
    • {M} warnings (security pattern detection)

  Test results:
    • {X} passed
    • {Y} failed
    • {Z} skipped

═══════════════════════════════════════════════
```

### 5. Next-step guidance

**If all tests pass:**
```
✓ Your feature is ready. Review the code at {output_dir}.

To regenerate after spec changes:
  npx aria-lang gen {spec_path} -o {output_dir}

To re-implement after spec changes:
  npx aria-lang implement {spec_path} --ai claude -o {output_dir}

To validate the spec:
  npx aria-lang check {spec_path}
```

**If some tests failed:**
```
⚠ {Y} test(s) failed. The implementation may need refinement.

Options:
  1. Refine the spec — add more examples or stricter ensures
     → /aria modify {spec_path}
  2. Manually fix the failing implementations
  3. Re-run aria implement with the same spec (Claude may produce a different result)
     → npx aria-lang implement {spec_path} --ai claude -o {output_dir}
```

## SUCCESS METRICS

✅ Test runner was invoked (or skipped with explanation)
✅ Final report includes all 5 sections (spec, files, impl, tests, next steps)
✅ User has clear next actions

## FAILURE MODES

❌ Loading another step after this (workflow ends here)
❌ Hiding test failures
❌ Not detecting the test runner

## FINALIZE

After presenting the report, load the finalization step to lock down the project:

→ Load `steps/step-finalize.md`

This updates CLAUDE.md with spec-driven rules, configures CI drift checks, and generates `specs/NEXT-STEPS.md`.

<critical>
Do NOT skip finalization. The CLAUDE.md update is what ensures all future AI sessions respect the specs. Without it, the next refactor will ignore the contracts.
</critical>
