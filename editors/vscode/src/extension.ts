import * as path from "path";
import { workspace, ExtensionContext, commands, window, ViewColumn } from "vscode";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from "vscode-languageclient/node.js";

let client: LanguageClient;

export function activate(context: ExtensionContext) {
  // LSP server module path (compiled output)
  const serverModule = context.asAbsolutePath(
    path.join("server", "out", "server.js")
  );

  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: { execArgv: ["--nolazy", "--inspect=6009"] },
    },
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: "file", language: "aria" }],
    synchronize: {
      fileEvents: workspace.createFileSystemWatcher("**/*.aria"),
    },
  };

  client = new LanguageClient(
    "ariaLanguageServer",
    "ARIA Language Server",
    serverOptions,
    clientOptions
  );

  client.start();

  // Command: Preview Mermaid diagram
  context.subscriptions.push(
    commands.registerCommand("aria.preview", async () => {
      const editor = window.activeTextEditor;
      if (!editor || editor.document.languageId !== "aria") {
        window.showWarningMessage("Open an .aria file to preview");
        return;
      }

      const panel = window.createWebviewPanel(
        "ariaPreview",
        `Preview: ${path.basename(editor.document.fileName)}`,
        ViewColumn.Beside,
        { enableScripts: true }
      );

      panel.webview.html = getPreviewHtml(editor.document.fileName);
    })
  );

  // Command: Check current file
  context.subscriptions.push(
    commands.registerCommand("aria.check", async () => {
      const editor = window.activeTextEditor;
      if (!editor) return;
      const terminal = window.createTerminal("ARIA Check");
      terminal.sendText(`npx aria check "${editor.document.fileName}"`);
      terminal.show();
    })
  );

  // Command: Generate code
  context.subscriptions.push(
    commands.registerCommand("aria.gen", async () => {
      const editor = window.activeTextEditor;
      if (!editor) return;
      const terminal = window.createTerminal("ARIA Gen");
      terminal.sendText(`npx aria gen "${editor.document.fileName}" -o ./generated`);
      terminal.show();
    })
  );

  // Command: Format file
  context.subscriptions.push(
    commands.registerCommand("aria.format", async () => {
      const editor = window.activeTextEditor;
      if (!editor) return;
      const terminal = window.createTerminal("ARIA Format");
      terminal.sendText(`npx aria fmt "${editor.document.fileName}"`);
      terminal.show();
    })
  );
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) return undefined;
  return client.stop();
}

function getPreviewHtml(fileName: string): string {
  const baseName = path.basename(fileName);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ARIA Preview</title>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 20px; }
    code { background: #f0f0f0; padding: 2px 6px; border-radius: 3px; }
    .instructions { background: #fffbea; border-left: 4px solid #ffb400; padding: 12px; margin: 16px 0; }
  </style>
</head>
<body>
  <h1>ARIA Mermaid Preview</h1>
  <p>File: <code>${baseName}</code></p>

  <div class="instructions">
    <strong>Live preview not yet implemented.</strong><br>
    To generate a Mermaid diagram, run:
    <pre><code>npx aria diagram ${baseName}</code></pre>
    Copy the Mermaid output and paste it into a diagram viewer.
  </div>

  <script>
    mermaid.initialize({ startOnLoad: true, theme: 'default' });
  </script>
</body>
</html>`;
}
