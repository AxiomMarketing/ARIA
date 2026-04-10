# Changelog

All notable changes to the ARIA VS Code extension will be documented in this file.

## [0.1.0] - 2026-04-10

### Added
- Initial release
- TextMate grammar for `.aria` syntax highlighting
  - Keywords, types, operators, strings, regex, numbers, comments
- 9 snippets for common ARIA patterns (module, type, record, enum, contract, behavior, example, onfail)
- Language Server Protocol (LSP) integration
  - Real-time diagnostics from the ARIA compiler
  - Keyword and type completion
  - Hover documentation
- 4 commands in the command palette:
  - ARIA: Preview Mermaid Diagram
  - ARIA: Check Current File
  - ARIA: Generate Code
  - ARIA: Format File
- Language configuration with auto-closing brackets, comment toggling, indentation rules

### Known Issues
- Mermaid preview is a placeholder (displays instructions instead of rendered diagram)
- LSP server uses relative path imports (works in dev, needs bundling for release)
