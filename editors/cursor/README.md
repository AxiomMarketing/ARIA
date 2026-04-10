# ARIA for Cursor

Cursor supports ARIA via the MCP server and the VS Code TextMate grammar (Cursor is VS Code-based).

## Setup

### 1. Syntax highlighting

Cursor uses VS Code extensions. Install the ARIA VS Code extension:

```bash
cd editors/vscode
npm install && npm run compile
# Then in Cursor: Extensions > Install from VSIX
```

Or copy the TextMate grammar manually:

1. Open Cursor Settings (`Cmd+,`)
2. Search "textmate"
3. Add `editors/vscode/syntaxes/aria.tmLanguage.json` as a grammar for `.aria` files

### 2. MCP integration (AI-assisted specs)

Copy `mcp.json` from this directory to your project:

```bash
mkdir -p .cursor
cp editors/cursor/mcp.json .cursor/mcp.json
```

Or add manually to `.cursor/mcp.json`:

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

Restart Cursor. The AI agent now has access to 5 ARIA tools:

| Tool | Description |
|---|---|
| `aria_check` | Validate `.aria` source |
| `aria_gen` | Generate TypeScript/Rust/Python/JSON Schema |
| `aria_diagram` | Generate Mermaid state diagrams |
| `aria_explain` | Summarize a spec in natural language |
| `aria_spec` | Generate a spec skeleton from a description |

### 3. Project integration

Run `aria setup` in your project to add ARIA rules to `CLAUDE.md`:

```bash
npx aria setup --specs-dir specs -t typescript
```
