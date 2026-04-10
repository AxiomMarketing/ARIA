# ARIA for JetBrains IDEs

WebStorm, IntelliJ IDEA, PyCharm, RustRover, and other JetBrains IDEs support ARIA via TextMate grammar import and MCP integration.

## 1. Syntax highlighting (TextMate bundle)

JetBrains IDEs can import TextMate grammars for syntax highlighting:

1. Go to **Settings > Editor > TextMate Bundles**
2. Click **+** and select the directory `editors/vscode/syntaxes/`
3. The grammar file `aria.tmLanguage.json` will be imported
4. Associate `.aria` files: **Settings > Editor > File Types** > add `*.aria` pattern under the TextMate bundle

Alternatively, register the file type manually:

1. **Settings > Editor > File Types > New**
2. Name: `ARIA Specification`
3. Line comment: `--`
4. Block comment: (none)
5. Registered patterns: `*.aria`

## 2. MCP integration

JetBrains IDEs with AI Assistant support MCP servers. Configure in your project:

Create `.idea/mcp.json` (or configure via IDE settings):

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

This gives the AI assistant access to ARIA tools (check, gen, diagram, explain, spec).

## 3. External tools (run from IDE)

Add ARIA CLI commands as External Tools for quick access:

1. **Settings > Tools > External Tools > +**
2. Configure:
   - **Name:** ARIA Check
   - **Program:** `npx`
   - **Arguments:** `aria check $FilePath$`
   - **Working directory:** `$ProjectFileDir$`

Repeat for `aria gen`, `aria diagram`, `aria fmt`.

You can then run these from **Tools > External Tools** or bind them to keyboard shortcuts.

## 4. File watcher (auto-check on save)

1. **Settings > Tools > File Watchers > +**
2. Configure:
   - **File type:** ARIA Specification (or `*.aria`)
   - **Program:** `npx`
   - **Arguments:** `aria check $FilePath$`
   - **Output paths:** (leave empty)

The IDE will automatically validate specs on every save.
