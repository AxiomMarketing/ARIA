# ARIA Language Support for VS Code

Syntax highlighting, snippets, diagnostics, and Mermaid preview for [ARIA](https://github.com/aria-lang/aria) formal specification files (`.aria`).

## Features

### Syntax Highlighting
Full TextMate grammar covering:
- Keywords (`module`, `type`, `contract`, `behavior`, `requires`, `ensures`, `on_failure`, etc.)
- Type primitives (`Integer`, `Decimal`, `String`, `Boolean`, `DateTime`, `Record`, `Enum`, `List`)
- Operators (`==`, `!=`, `->`, `>=`, `<=`, `and`, `or`, `implies`)
- Comments (`--` line, `---` documentation)
- Strings, regex literals, numbers with underscores

### Snippets
Type one of these prefixes and press Tab:
- `module` — Full module header
- `type-int` / `type-str` — Integer/String type with constraints
- `record` — Record type with fields
- `enum` — Enum type with variants
- `contract` — Full contract with all sections
- `behavior` — State machine
- `example` — Given/then example
- `onfail` — on_failure case

### Language Server Protocol (LSP)
Real-time validation powered by the ARIA compiler:
- **Diagnostics** — Parse errors and semantic warnings inline
- **Completion** — Keyword and type completion
- **Hover** — Contextual documentation

### Commands
Run from the command palette (`Cmd+Shift+P`):
- **ARIA: Preview Mermaid Diagram** — Open Mermaid preview panel
- **ARIA: Check Current File** — Run `aria check` in terminal
- **ARIA: Generate Code** — Run `aria gen` in terminal
- **ARIA: Format File** — Run `aria fmt` in terminal

## Installation

### Development (from source)

```bash
# Clone the repo
git clone https://github.com/aria-lang/aria
cd aria/editors/vscode

# Install dependencies
npm install
cd server && npm install && cd ..

# Compile
npm run compile

# Launch extension development host
# Open this folder in VS Code, then press F5
```

### Packaging

```bash
npm install -g @vscode/vsce
vsce package
# Produces: aria-lang-0.1.0.vsix
code --install-extension aria-lang-0.1.0.vsix
```

## Requirements

- VS Code 1.85.0 or higher
- Node.js 18+ (for LSP server)
- ARIA compiler (`npm install -g @aria-lang/compiler` or use `npx`)

## Example

Create a file `payment.aria`:

```aria
module Payment
  version "1.0"
  target typescript

type Money is Integer
  where self > 0
  where self <= 1_000_000

contract Transfer
  inputs
    amount: Money
  requires
    amount > 0
  ensures
    result.success == true
  on_failure
    when amount <= 0
      return InvalidAmount
```

The extension will provide syntax highlighting, validate the file in real-time, and offer completions.

## Known Issues

- Mermaid preview is currently a placeholder. Full live preview requires bundling the ARIA compiler into the extension.
- LSP server imports the compiler via relative path — works in development but not after packaging.
- Hover documentation is generic. Symbol-aware hover is planned.

## Release Notes

### 0.1.0

Initial release:
- TextMate grammar for syntax highlighting
- 9 snippets for common ARIA patterns
- Language Server with diagnostics, completion, hover
- 4 commands for check/gen/format/preview

## Links

- [ARIA repository](https://github.com/aria-lang/aria)
- [Language reference](../../LANGUAGE.md)
- [Roadmap](../../.claude/ROADMAP.md)

## License

MIT
