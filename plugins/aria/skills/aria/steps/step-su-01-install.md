---
name: step-su-01-install
description: Setup workflow — install aria-lang as a project dependency
next_step: steps/step-su-02-configure.md
---

# Step SU-01 — Install aria-lang

## MANDATORY EXECUTION RULES

- 🛑 NEVER install globally — always use `--save-dev` or `npm install --save-dev`
- 🛑 NEVER skip detection — only install if not already present
- ✅ ALWAYS verify the install succeeded before proceeding
- ✅ ALWAYS use the user's package manager (npm/pnpm/yarn) detected from lockfile
- 📋 YOU ARE AN INSTALLER, not a configurer — config is su-02

## CONTEXT BOUNDARIES

- Coming from: `step-00-route.md` with `{workflow}=setup`
- Going to: `step-su-02-configure.md` once aria-lang is installed

## YOUR TASK

Install `aria-lang` as a development dependency in the user's project.

---

## EXECUTION SEQUENCE

### 1. Detect package manager

```bash
ls package-lock.json yarn.lock pnpm-lock.yaml bun.lockb 2>/dev/null
```

| File | Manager |
|---|---|
| `package-lock.json` | npm |
| `yarn.lock` | yarn |
| `pnpm-lock.yaml` | pnpm |
| `bun.lockb` | bun |

If none found, default to npm and warn the user.

### 2. Check if already installed

```bash
cat package.json | grep '"aria-lang"' || echo "NOT_INSTALLED"
```

If already installed, set `{has_aria_lang}=true` and skip installation.

If installed but version is outdated (< 0.1.4), offer to upgrade:

```yaml
questions:
  - header: "Upgrade"
    question: "aria-lang is installed but outdated. Upgrade?"
    options:
      - label: "Yes, upgrade to latest (Recommended)"
        description: "Run npm install --save-dev aria-lang@latest"
      - label: "Keep current version"
        description: "Continue with the existing version"
    multiSelect: false
```

### 3. Install (if not present)

Pick the right command for the detected manager:

| Manager | Command |
|---|---|
| npm | `npm install --save-dev aria-lang` |
| yarn | `yarn add --dev aria-lang` |
| pnpm | `pnpm add --save-dev aria-lang` |
| bun | `bun add --dev aria-lang` |

Run it and capture the output.

### 4. Verify

```bash
npx aria-lang --version
```

Should print `0.1.4` or newer. If it doesn't work, troubleshoot:
- Permission issues → suggest `sudo` or fix npm permissions
- Network issues → check network and retry
- Registry issues → suggest `npm config set registry https://registry.npmjs.org/`

### 5. Report

```
✓ Installed aria-lang@{version} as devDependency
  Package manager: {npm|yarn|pnpm|bun}
  CLI binary    : npx aria-lang
  MCP server    : npx aria-mcp
```

## SUCCESS METRICS

✅ `aria-lang` is in `package.json` devDependencies
✅ `npx aria-lang --version` prints a version number
✅ User informed of the install and the CLI usage

## FAILURE MODES

❌ Installing globally (`-g`) without user request
❌ Skipping the version verification
❌ Continuing past install failures

## NEXT STEP

→ Load `steps/step-su-02-configure.md`

<critical>
The CLI is the gateway to all ARIA features. Verify it works before moving on.
</critical>
