# Changelog

All notable changes to the ARIA compiler will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.4] - 2026-04-11

### Added

- **`aria import` command (Phase 10.1)** — Reverse-engineer existing TypeScript code into `.aria` spec skeletons. Extracts interfaces/types/enums as ARIA types, exported functions as contracts (with detected throws → on_failure), and `*State`/`*Status` enums as behavior state machines. Supports single file or recursive directory mode. Skips `node_modules`, hidden dirs, `.test.ts`, and `.d.ts`. New `typescript` production dependency.
- **`aria drift` command (Phase 10.2)** — Compare an `.aria` spec with its TypeScript implementation and report incoherences: missing functions, signature mismatches, type drift, behavior state drift. Supports file/file or directory/directory mode. Outputs markdown or JSON. `--fail-on error|warning` for CI integration.
- **`src/importer/`** — New module: `ts-parser.ts` (TypeScript Compiler API extraction) + `aria-emitter.ts` (structured AST → `.aria` source text).

### Changed

- `typescript` moved from `devDependencies` to `dependencies` (required at runtime by `aria import` and `aria drift`).

## [0.1.3] - 2026-04-11

### Security

Full codebase security audit resolved 13 findings across 3 domains (5 BLOCKING CWE issues, 8 robustness improvements).

- **CWE-94 — Code injection** — `safeName()` guard validates all identifier interpolation in TypeScript/Rust/Python generators. Rejects names containing semicolons, quotes, or non-identifier characters.
- **CWE-94 — ReDoS** — `isSafeRegex()` rejects regex patterns with nested quantifiers (e.g. `(a+)+`) before emission.
- **CWE-22 — Path traversal (imports)** — `validatePathWithinRoot()` blocks `import Money from "../../../../etc/passwd"`.
- **CWE-22 — Path traversal (output)** — Output directory validation against project root.
- **CWE-214 — Secret exposure** — Removed `--api-key` CLI flag. Use `ANTHROPIC_API_KEY` environment variable only.
- **CWE-400 — DoS** — 1 MB input size guard on all MCP tool handlers (`aria_check`, `aria_gen`, `aria_diagram`, `aria_explain`).
- **CWE-59 — Symlink following** — `findAriaFiles()` now skips symbolic links to prevent traversal outside project.

### Fixed

- AI output now checked with `detectDangerousPatterns()` — warns on `require('child_process')`, `eval`, `exec`, `process.env` patterns before writing to disk.
- Anthropic client now has a 2-minute timeout to prevent hung API calls.
- `aria watch` cleans up file watcher and debounce timer on SIGINT/SIGTERM (was leaking FDs).
- `aria check <dir>` now handles permission errors gracefully with a warning instead of crashing.
- MCP server uses `catch (err: unknown)` + `toErrorMessage()` — no more `"Error: undefined"` for non-Error throws.
- Parser `BLOCK_KEYWORDS` promoted to a `static readonly Set` (was re-created on every lookup).

### Added

- **`src/security.ts`** — Centralized security utilities: `safeName`, `isSafeRegex`, `validatePathWithinRoot`, `validateInputSize`, `writeFileAtomic`, `toErrorMessage`, `detectDangerousPatterns`.

## [0.1.2] - 2026-04-10

### Fixed

- All TODO items resolved (H7-H10, M3-M12, L1-L2, S1-S6) — zero remaining
- `aria watch --gen` now actually regenerates code on file changes (was a no-op)
- Cross-file import validation: `aria check` now verifies imported types exist in source file
- Compensate `with` clause fields now stored in AST (were silently discarded)
- Parser: doc comments between record fields no longer crash; multiple consecutive doc comments accumulated
- Zod generator: negative numbers (`self > -10`), array `self > 0` → `.min(1)`, `camelCase("")` crash guard
- Test generator: `result == TypeName` without `with` and `starts_with` assertions now supported
- Parser: operator precedence fix for `parseTypeReference` List check
- Mermaid: orphan states no longer incorrectly marked as terminal
- Dead method `skipWhitespaceAndComments` removed

### Added

- HTML documentation pages (tutorial, CLI reference, language reference, examples) — navigation now works locally without Jekyll
- `aria-lang` bin alias for `npx aria-lang` compatibility

## [0.1.1] - 2026-04-10

### Fixed

- **`npx aria-lang` now works** — Added `aria-lang` as a bin alias so `npx aria-lang check ...` resolves correctly.

### Added

- **IDE support for Cursor, JetBrains, and Neovim** — Cursor MCP config template, JetBrains TextMate bundle import + External Tools + File Watcher instructions, Neovim syntax highlighting (`syntax/aria.vim`) + file type detection (`ftdetect/aria.vim`) + keybinding examples + mcp.nvim integration. All in `editors/`. (Phase 9.4)
- **MCP Server (`aria-mcp`)** — Model Context Protocol server exposing ARIA as 5 tools for any MCP-compatible client (Claude Desktop, Cursor, etc.): `aria_check` (validate), `aria_gen` (generate code), `aria_diagram` (Mermaid), `aria_explain` (structured summary), `aria_spec` (generate spec from description). Runs via `npx aria-mcp` on stdio transport. (Phase 9.3)
- **`aria setup` command** — Adds the `## ARIA Specifications` section to your project's `CLAUDE.md` with spec-first rules, workflow, commands reference, and AI assistant guidelines. Supports `--specs-dir`, `--target`, `--force`. Creates the specs directory if missing. (Phase 9.2)
- **Polymorphic dispatch** — Contracts can route to sub-contracts based on an input field's value using `dispatch on <field>` with `when <value> -> <ContractName>` cases. TypeScript generates a `switch/case` dispatcher function. Checker validates that the dispatch field exists in inputs and target contracts are defined. (Phase 7.3)
- **Computed fields** — Record fields can be derived from other fields with `computed as <expression>`. The Zod schema excludes computed fields; TypeScript emits a `<Name>Computed` intersection interface, Rust emits `impl` methods, Python emits `@computed_field @property`. (Phase 7.2)
- **Temporal assertions** — `invariants` blocks in `behavior` now support temporal operators: `always`, `never`, `eventually`, `leads_to X -> Y within N hours`. Generators propagate them as Mermaid notes, TypeScript `@invariant` JSDoc + runtime array, and Rust `///` doc comments. No runtime verification engine — these are structured documentation. (Phase 7.4)
- **Generic types** — Types can declare type parameters with `type Result of T, E is Enum`. Generic instantiation works in field types and contract inputs: `field: Box of Money`. TypeScript emits `export type Result<T, E> = ...`, checker resolves type params in scope. (Phase 7.1)
- **Versioned modules** — Module header supports `supersedes "OldModule" version "1.0"`. Contracts support `deprecated "reason"` which emits `@deprecated` JSDoc in TypeScript output. (Phase 7.5)
- **Documentation website** — Static site at `docs/` deployable to GitHub Pages via Jekyll. Includes landing page, tutorial, CLI reference, language reference, and examples gallery. (Phase 8.2)
- **GitHub Actions CI** — Workflows for CI (Node 18/20/22 matrix with typecheck + test + build + examples validation) and npm publish with OIDC provenance support. (Phase 8.3)
- **npm package ready** — `package.json` with full metadata, `files` allowlist, `exports`, `prepublishOnly`, `LICENSE` (MIT), `engines >= 18`. Tarball verified at 82 kB / 68 files. (Phase 8.1)

### Fixed

- **Parser infinite loops resolved** — `compensate with` clause consumption, `on_failure` DEDENT imbalance, `retry backoff` keyword/identifier mismatch, `parseValue` missing EOF guard, `steps with` missing EOF guard. All 7 previously deferred tests now pass. `payment.aria` and `order.aria` parse fully. (Phase 2.2)

### Breaking

- New reserved keywords: `supersedes`, `deprecated` (Phase 7.5), `always`, `never`, `eventually`, `leads_to`, `within` (Phase 7.4), `computed`, `as` (Phase 7.2), `dispatch` (Phase 7.3). Any existing `.aria` spec using these as identifiers will need renaming.

## [0.1.0] - 2026-04-10

Initial public release.

### Added

**Language core:**
- Module system with `version`, `target`, `author`, `imports`
- Primitive types: `Integer`, `Decimal`, `String`, `Boolean`, `DateTime`
- Composite types: `Record`, `Enum`, `List of T`
- Refinement types via `where` clauses (e.g., `where self > 0`, `where self matches /regex/`)
- Contracts with `inputs`, `requires`, `ensures`, `on_failure`, `examples`
- Contract effects (`sends`, `writes`, `creates`, `reads`, `deletes`)
- Contract `depends_on`, `timeout`, `retry` (with `exponential`/`linear`/`constant` backoff), `rate_limit`
- Contract orchestration via `steps` + `compensate` (saga pattern)
- State machine `behavior` blocks with `states`, `transitions`, `invariants`, `forbidden`, `flow` examples
- Doc comments (`---`) preserved in generated output

**Compiler pipeline:**
- Indentation-based lexer with INDENT/DEDENT tracking
- Recursive descent parser producing discriminated-union AST
- Semantic checker: type resolution, state validation, duplicates, imports, generic unwrapping
- Structured error messages with line context and caret pointers

**Code generators (4 targets):**
- **TypeScript + Zod** — schemas, contract stubs, test files, behavior validators
- **Rust** — structs with serde derives, enums, contract signatures, state machine enums
- **Python** — Pydantic v2 BaseModel with Annotated fields, Enum classes
- **JSON Schema** — Draft 2020-12 with `$defs` and `$ref`
- **Mermaid** — `stateDiagram-v2` with transitions, terminal states, forbidden notes

**CLI (8 commands):**
- `aria check <file|dir>` — validate spec (`--strict`, `--draft`, `--json`)
- `aria gen <file> -t <target> -o <dir>` — generate code (default: typescript)
- `aria diagram <file> -o <file>` — generate Mermaid documentation
- `aria test <file> -o <dir>` — generate vitest test files
- `aria implement <file> --ai claude` — AI implementation via Anthropic API
- `aria init [--module Name]` — scaffold new `.aria` file
- `aria watch <path>` — re-run check/gen on file changes (`--gen`, `-o`, `-t`)
- `aria fmt <file|dir> [--check]` — format `.aria` files

**Developer tools:**
- VS Code extension (`editors/vscode/`, **developer preview**) — TextMate grammar, 9 snippets, LSP server with diagnostics/completion/hover, 4 palette commands. Not yet packaged for marketplace.
- Claude Code skill `/aria` — orchestrates the full pipeline from natural-language description

**Tests:** 205 passing across 13 test files, 0 TypeScript errors.

### Known limitations

- Expression storage is string-based; `parsedExpression` AST is optional and not yet consumed by generators
- Multi-line `with` clauses in `on_failure` are not supported (single line only)
- `compensate with field: value` fields are parsed but discarded (AST has no slot for them)
- Mermaid live preview in VS Code extension is a placeholder (developer preview only)
- `aria implement` only supports `typescript` target currently
- `aria implement` only supports `typescript` target currently

[Unreleased]: https://github.com/AxiomMarketing/ARIA/compare/v0.1.4...HEAD
[0.1.4]: https://github.com/AxiomMarketing/ARIA/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/AxiomMarketing/ARIA/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/AxiomMarketing/ARIA/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/AxiomMarketing/ARIA/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/AxiomMarketing/ARIA/releases/tag/v0.1.0
