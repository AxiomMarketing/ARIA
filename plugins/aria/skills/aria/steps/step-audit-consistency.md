---
name: step-audit-consistency
description: Cross-spec consistency audit — detects duplicate/inconsistent types across .aria files and proposes shared-types extraction
---

# Step AUDIT — Cross-Spec Consistency Audit

## MANDATORY EXECUTION RULES

- 🛑 NEVER auto-apply fixes for inconsistent types — require user choice for canonical version
- 🛑 NEVER delete type definitions without replacing them with an import
- 🛑 NEVER create shared-types.aria if no duplicates/inconsistencies are found
- 🛑 NEVER create ad-hoc directories — all output goes in `specs/CONSISTENCY-REPORT.md`
- 🛑 NEVER introduce circular imports — shared-types.aria must NOT import from domain specs
- ✅ ALWAYS read ALL `.aria` files before making any changes
- ✅ ALWAYS run `aria check specs/` after applying any fix
- ✅ ALWAYS produce `specs/CONSISTENCY-REPORT.md` even if no issues found
- ✅ ALWAYS ask user approval before modifying files (unless `{auto_mode}=true` AND fix is Tier 1)
- 📋 YOU ARE AN AUDITOR — detect, report, propose. The user decides.

## CONTEXT BOUNDARIES

This step is shared across workflows:

| `{workflow}` | Coming from | Going to |
|---|---|---|
| `reverse` | `step-rv-03-enrich.md` (enriched specs) | `step-rv-04-drift.md` |
| `maintain` | `step-mt-01-check.md` (validated specs) | `step-mt-02-drift.md` |
| `project` | `step-pj-03-generate-all.md` (all specs generated) | `step-pj-04-review.md` |

## YOUR TASK

Scan all `.aria` files in `{specs_dir}` to detect duplicate type definitions, inconsistent enums/records, missing imports, and near-duplicate names. Produce a structured report. Propose fixes (extract shared types, add imports). Apply only with user approval.

---

## EXECUTION SEQUENCE

### Phase 1: Inventory all types

Read every `.aria` file in `{specs_dir}`. For each file, extract:

- **Type name** (e.g., `DeathSource`)
- **Base type** (`Enum`, `Record`, `Integer`, `String`, etc.)
- **Variants** (for Enum: list of variant names)
- **Fields** (for Record: list of `{name, type}` pairs)
- **Where clauses** (for refined types: list of constraint strings)

Build a **type registry**: `type_name → [{file, base, variants/fields, where_clauses}]`

Also extract:
- **Type references**: all types used in contract inputs, record fields, behavior transitions
- **Existing imports**: what each file already imports and from where

### Phase 2: Detect exact duplicates

For each type name appearing in 2+ files, compare definitions structurally:

Two types are **exact duplicates** if:
- Same base type
- Same variants (order-insensitive for Enum)
- Same fields (order-insensitive for Record, matching name AND type)
- Same where clauses (after whitespace normalization)

Classify as: `EXACT_DUPLICATE`

### Phase 3: Detect inconsistent types

For each type name appearing in 2+ files that is NOT an exact duplicate:

| Classification | Condition |
|---|---|
| `INCONSISTENT_ENUM` | Same name, both Enum, different variant sets |
| `INCONSISTENT_RECORD` | Same name, both Record, different field sets |
| `INCONSISTENT_CONSTRAINT` | Same name, same base, different where clauses |
| `TYPE_CONFLICT` | Same name, different base type (Enum vs Record) |

For each inconsistency, compute a **proposed canonical version**:
- **Enum**: union of all variant names from all files. Flag naming inconsistencies (e.g., `village_vote` vs `vote`)
- **Record**: union of all fields. Flag type conflicts for same-named fields
- **Constraints**: flag the difference, ask user which is correct

### Phase 4: Detect near-duplicates

Compare all type names across files for potential unintentional divergence:

- **Suffix swap**: `PlayerStatus` vs `PlayerState`, `GamePhase` vs `GameStage`
- **Prefix variation**: `DeathSource` vs `GameDeathSource`
- **Abbreviation**: `VoteResult` vs `VoteRes`
- **Same fields, different names**: two Records with 80%+ field overlap

Report these as candidates, not errors. The user decides if they are the same concept.

### Phase 5: Detect missing imports

For each `.aria` file, scan all type references in:
- Record field types
- Contract input/output types
- Behavior state/transition types

For each referenced type name:
1. Is it defined locally in this file? → OK
2. Is it imported from another file? → OK
3. Is it a primitive (`Integer`, `String`, `Boolean`, `DateTime`, `Decimal`)? → OK
4. Is it defined in another `.aria` file but not imported? → `MISSING_IMPORT`
5. Is it undefined anywhere? → `UNDEFINED_TYPE`

### Phase 5.5: Feature upgrade detection

Scan all specs for opportunities to use ARIA advanced features that aren't currently used:

| Pattern in spec | Suggested upgrade |
|---|---|
| Same type name in 2+ files | Extract to `shared-types.aria` with `import` |
| Record with field that could be derived | Use `computed as` expression |
| Contract with no `rate_limit` but has auth inputs | Consider `rate_limit` |
| Contract calling external service but no `depends_on` | Add `depends_on ServiceName` |
| Contract with no `timeout` but has external dependency | Add `timeout N seconds` |
| Behavior with no `invariants` | Add temporal assertions (`always`, `never`, `eventually`) |
| Contract with no `retry` but depends on unreliable service | Add `retry max N backoff exponential` |
| Multiple contracts that could be dispatched from one | Consider `dispatch on field` |
| Old contracts that should be phased out | Add `deprecated "Use X instead"` |

Report these as **suggestions** (not errors) in the CONSISTENCY-REPORT.md under a new section:

```markdown
## Feature Upgrade Suggestions

| Spec | Contract/Type | Suggestion | Impact |
|------|--------------|------------|--------|
| auth.aria | Login | Add `rate_limit max 5 per minute per ip` | Security |
| order.aria | PlaceOrder | Add `timeout 30 seconds` for Stripe call | Reliability |
| game.aria | GameLifecycle | Add `invariants` with `eventually game.ended == true` | Correctness |
```

These are non-blocking suggestions. Include them in the report but don't prompt the user to fix them unless they ask.

### Phase 6: Generate report + propose fixes

Write `specs/CONSISTENCY-REPORT.md`:

```markdown
# Cross-Spec Consistency Report — {date}

## Summary
- Specs scanned: {N}
- Total type definitions: {T}
- Exact duplicates: {D} (in {F} files)
- Inconsistent types: {I}
- Near-duplicate candidates: {ND}
- Missing imports: {MI}
- Undefined types: {U}

## Exact Duplicates
| Type | Base | Files | Action |
|------|------|-------|--------|
| Money | Integer | payment.aria, order.aria | Extract to shared-types.aria |

## Inconsistent Types

### DeathSource (Enum)
| File | Variants |
|------|----------|
| chasseur.aria | wolf, village_vote, sorciere_poison, lover_chagrin |
| chevalier.aria | wolf, vote, sorciere, lover |
| game-state.aria | wolves, witch, hunter, vote, lovers (12 values) |

**Naming conflicts:**
- `village_vote` vs `vote` vs `wolves` — pick canonical name
- `sorciere_poison` vs `sorciere` vs `witch` — pick canonical name

**Proposed canonical (union):**
```aria
type DeathSource is Enum
  wolf
  village_vote
  sorciere_poison
  lover_chagrin
  hunter_shot
  --- ... (all unique values merged)
```

### ... (repeat for each inconsistent type)

## Near-Duplicate Candidates
| Type A | File A | Type B | File B | Reason |
|--------|--------|--------|--------|--------|
| PlayerStatus | game.aria | PlayerState | player.aria | Suffix swap |

## Missing Imports
| File | Uses Type | Defined In | Fix |
|------|-----------|------------|-----|
| order.aria | Email | auth.aria | `import Email from "./auth.aria"` |

## Proposed shared-types.aria
```aria
module SharedTypes
  version "1.0"
  target {target}

--- Canonical type definitions shared across all specs

type DeathSource is Enum
  wolf
  village_vote
  sorciere_poison
  ...
```

## Feature Upgrade Suggestions
{table from Phase 5.5}
```

### Phase 7: Apply fixes (with approval)

Present fixes in 3 tiers:

**Tier 1 — Auto-fixable** (exact duplicates, no conflicts):
- Create/update `{specs_dir}/shared-types.aria` with extracted types
- In each file that had the duplicate: remove local type, add `import X from "./shared-types.aria"`
- Auto-apply if `{auto_mode}=true`, otherwise ask:

```yaml
questions:
  - header: "Tier 1 fixes"
    question: "{N} exact duplicate types can be extracted to shared-types.aria automatically. Apply?"
    options:
      - label: "Apply all (Recommended)"
        description: "Extract duplicates to shared-types.aria and replace with imports"
      - label: "Review each one"
        description: "I'll approve each extraction individually"
      - label: "Skip"
        description: "Don't extract, keep local definitions"
    multiSelect: false
```

**Tier 2 — Guided** (inconsistent types):
For each inconsistent type, use `AskUserQuestion` to resolve:

```yaml
questions:
  - header: "DeathSource"
    question: "DeathSource is defined differently in 3 files. Which version is canonical?"
    options:
      - label: "Use game-state.aria version (most complete)"
        description: "12 variants: wolves, witch, hunter, vote, lovers..."
      - label: "Merge all variants (union)"
        description: "Combine all unique variants from all files into one enum"
      - label: "Skip — intentionally different"
        description: "These are different concepts sharing a name"
    multiSelect: false
```

After user choice: create/update shared-types.aria, replace locals with imports.

**Tier 3 — Report only** (near-duplicates, undefined types):
Just included in the report. No automatic action.

### Phase 8: Validate after changes

After applying any fixes:

```bash
npx aria-lang check {specs_dir}/shared-types.aria   # new file is valid
npx aria-lang check {specs_dir}/                     # all imports resolve
```

If validation fails: revert the specific fix, report the failure, continue with other fixes.

## SKIP CONDITIONS

If Phase 2-5 find **zero issues** (no duplicates, no inconsistencies, no missing imports):

```
✓ Cross-spec consistency audit passed
  - {N} specs scanned, {T} types checked
  - No duplicates, no inconsistencies, no missing imports
  
  → Skipping to next step
```

Write a minimal `specs/CONSISTENCY-REPORT.md` and proceed directly to next step.

## EDGE CASES

### Intentional divergence
If user marks a type as "intentionally different", add a doc comment to both files:
```aria
--- Intentionally distinct from chevalier.aria::DeathSource
type DeathSource is Enum
  ...
```
This prevents future audits from re-flagging the same pair.

### shared-types.aria already exists
Read existing content. Merge new types into it (append, don't overwrite). Update existing import statements in other files rather than adding duplicate import lines.

### File emptied by extraction
If ALL types in a file are extracted to shared-types.aria and only contracts/behaviors remain, that's fine — the contracts will import from shared-types. If the file becomes completely empty (no types, no contracts, no behaviors), warn the user and suggest deletion.

### Types used only in one file
A type defined in only one file is NOT a candidate for shared-types, even if it seems "common". Only extract types that are actually duplicated or imported by multiple files.

## SUCCESS METRICS

✅ `specs/CONSISTENCY-REPORT.md` exists with accurate counts
✅ All exact duplicates either extracted to shared-types or explicitly skipped
✅ All inconsistent types resolved (canonical chosen) or explicitly skipped
✅ All missing imports flagged
✅ Feature upgrade suggestions included in report (even if zero)
✅ `aria check specs/` passes after all fixes
✅ No ad-hoc directories created

## FAILURE MODES

❌ Auto-applying Tier 2 fixes (inconsistent types) without user input
❌ Creating shared-types.aria when no duplicates exist
❌ Deleting type definitions without replacing with imports
❌ Introducing circular imports (shared-types importing from domain specs)
❌ Skipping validation after changes
❌ Missing types in the inventory (not reading all files)

## NEXT STEP

Route based on `{workflow}`:

| `{workflow}` | Next step |
|---|---|
| `reverse` | → Load `steps/step-rv-04-drift.md` |
| `maintain` | → Load `steps/step-mt-02-drift.md` |
| `project` | → Load `steps/step-pj-04-review.md` |

<critical>
This step catches the #1 quality problem in multi-file ARIA projects: type duplication and inconsistency. A project with inconsistent types will generate broken code — catching this HERE saves hours of debugging later. Take the time to inventory every type thoroughly.
</critical>
