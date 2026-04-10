---
name: step-su-02-configure
description: Setup workflow — configure CLAUDE.md, specs/ dir, .gitignore
next_step: steps/step-su-03-init.md
---

# Step SU-02 — Configure Project for ARIA

## MANDATORY EXECUTION RULES

- 🛑 NEVER overwrite existing CLAUDE.md content — append the ARIA section
- 🛑 NEVER write generated code paths to git (use `.gitignore`)
- ✅ ALWAYS use `aria-lang setup` to inject the CLAUDE.md section
- ✅ ALWAYS create `specs/` directory if missing
- 📋 YOU ARE A CONFIGURER, not a code generator

## CONTEXT BOUNDARIES

- Coming from: `step-su-01-install.md` with aria-lang installed
- Going to: `step-su-03-init.md` once project is configured

## YOUR TASK

Configure the project for ARIA-driven development: create `specs/` directory, inject `## ARIA Specifications` section into `CLAUDE.md`, and update `.gitignore` to exclude generated code.

---

## EXECUTION SEQUENCE

### 1. Detect target language

Re-detect (or reuse from router):
- `package.json` → `typescript`
- `Cargo.toml` → `rust`
- `pyproject.toml` → `python`

Set `{target}` accordingly.

### 2. Run aria setup

```bash
npx aria-lang setup --specs-dir specs -t {target}
```

This will:
- Create `specs/` if missing
- Create `CLAUDE.md` if missing, OR append the ARIA section if it lacks one
- Skip silently if the ARIA section is already present

If user wants to force regeneration:

```yaml
questions:
  - header: "CLAUDE.md exists"
    question: "ARIA section already in CLAUDE.md. Update it?"
    options:
      - label: "Keep existing (Recommended)"
        description: "Do not modify the file"
      - label: "Replace with latest template"
        description: "Run aria setup --force"
    multiSelect: false
```

### 3. Update .gitignore

Add these lines to `.gitignore` (if not already present):

```
# ARIA generated code (regenerate via `aria gen`)
src/generated/
generated/

# ARIA local state
specs/.aria-state.json
specs/DRIFT.md
```

Use a check-then-append pattern — do NOT duplicate lines.

### 4. (Optional) Install MCP server config

Detect if the user has a Claude Code, Claude Desktop, or Cursor config:

```bash
ls .claude/settings.json 2>/dev/null
ls .cursor/mcp.json 2>/dev/null
ls ~/Library/Application\ Support/Claude/claude_desktop_config.json 2>/dev/null
```

If any exists, offer to add the `aria-mcp` server:

```yaml
questions:
  - header: "MCP server"
    question: "Add aria-mcp to your IDE's MCP config so the AI can use ARIA tools?"
    options:
      - label: "Yes, add to all detected configs (Recommended)"
        description: "Adds aria-mcp to .claude/settings.json, .cursor/mcp.json, and Claude Desktop"
      - label: "Add only to Claude Code (.claude/settings.json)"
        description: "Local project config only"
      - label: "Skip"
        description: "I'll configure manually later"
    multiSelect: false
```

If accepted, add this to the chosen config(s):

```json
{
  "mcpServers": {
    "aria": {
      "command": "npx",
      "args": ["aria-mcp"]
    }
  }
}
```

### 5. Verify configuration

Check that:
- `specs/` directory exists
- `CLAUDE.md` contains `## ARIA Specifications`
- `.gitignore` excludes generated paths

### 6. Report

```
✓ Project configured for ARIA
  - specs/ directory created
  - CLAUDE.md updated with ARIA section
  - .gitignore excludes generated code
  - MCP server configured: {yes|no}
```

## SUCCESS METRICS

✅ `specs/` exists
✅ `CLAUDE.md` has the ARIA section
✅ `.gitignore` excludes generated paths
✅ MCP config done (or explicitly skipped)

## FAILURE MODES

❌ Overwriting existing CLAUDE.md content (use append, not replace)
❌ Duplicating .gitignore entries
❌ Skipping MCP config without informing the user

## NEXT STEP

→ Load `steps/step-su-03-init.md`

<critical>
Configuration is idempotent — running setup twice should not break anything.
</critical>
