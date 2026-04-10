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
- ✅ ALWAYS verify ANTHROPIC_API_KEY before invoking the command
- ✅ ALWAYS report what was implemented and what failed
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
