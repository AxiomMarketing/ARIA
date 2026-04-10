/**
 * ARIA Language Server
 * Provides diagnostics, completion, and hover for .aria files.
 */

import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  CompletionItem,
  CompletionItemKind,
  TextDocumentPositionParams,
  TextDocumentSyncKind,
  InitializeResult,
  Diagnostic,
  DiagnosticSeverity,
  Hover,
  MarkupKind,
} from "vscode-languageserver/node.js";
import { TextDocument } from "vscode-languageserver-textdocument";

const connection = createConnection(ProposedFeatures.all);
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

connection.onInitialize((_params: InitializeParams): InitializeResult => {
  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: {
        resolveProvider: false,
        triggerCharacters: [" ", "."],
      },
      hoverProvider: true,
    },
  };
});

// Lazy-load the ARIA compiler from the parent repo.
// In a production extension, this would be bundled or installed via npm.
async function loadCompiler(): Promise<any> {
  try {
    // Resolve relative to the server's out directory → back to the ARIA repo root
    // editors/vscode/server/out/server.js → ../../../../src/parser.js
    const parserPath = new URL("../../../../src/parser.js", import.meta.url).href;
    const checkerPath = new URL("../../../../src/checker.js", import.meta.url).href;
    const parser = await import(parserPath);
    const checker = await import(checkerPath);
    return { parseFile: parser.parseFile, check: checker.check };
  } catch (err) {
    connection.console.error("Failed to load ARIA compiler: " + err);
    return null;
  }
}

let compilerPromise: Promise<any> | null = null;
function getCompiler() {
  if (!compilerPromise) compilerPromise = loadCompiler();
  return compilerPromise;
}

// Validate on change
documents.onDidChangeContent(async (change) => {
  const text = change.document.getText();
  const diagnostics: Diagnostic[] = [];

  const compiler = await getCompiler();
  if (!compiler) {
    connection.sendDiagnostics({ uri: change.document.uri, diagnostics });
    return;
  }

  try {
    const module = compiler.parseFile(text);
    const result = compiler.check(module);

    for (const err of result.errors) {
      const line = (err.location?.line ?? 1) - 1;
      const col = err.location?.column ?? 0;
      diagnostics.push({
        severity: DiagnosticSeverity.Error,
        range: {
          start: { line, character: col },
          end: { line, character: col + 10 },
        },
        message: err.message,
        source: "aria",
      });
    }

    for (const warn of result.warnings) {
      const line = (warn.location?.line ?? 1) - 1;
      diagnostics.push({
        severity: DiagnosticSeverity.Warning,
        range: {
          start: { line, character: 0 },
          end: { line, character: 80 },
        },
        message: warn.message,
        source: "aria",
      });
    }
  } catch (err: any) {
    // Parse error — try to extract line from error message
    const msg = err.message || String(err);
    const match = msg.match(/line (\d+)/i);
    const line = match ? parseInt(match[1]) - 1 : 0;
    diagnostics.push({
      severity: DiagnosticSeverity.Error,
      range: {
        start: { line, character: 0 },
        end: { line, character: 80 },
      },
      message: msg.split("\n")[0],
      source: "aria",
    });
  }

  connection.sendDiagnostics({ uri: change.document.uri, diagnostics });
});

// Keyword completion
const KEYWORDS = [
  "module", "type", "contract", "behavior", "import", "from",
  "inputs", "requires", "ensures", "on_failure", "examples",
  "effects", "depends_on", "timeout", "retry", "steps", "compensate",
  "rate_limit", "states", "transitions", "invariants", "forbidden",
  "initial", "when", "return", "with", "given", "then", "flow",
  "where", "version", "target", "author", "and", "or", "not",
  "implies", "in", "valid", "matches", "starts_with", "exists",
  "sends", "writes", "creates", "reads", "deletes",
  "max", "backoff", "on_exhaust", "exponential", "linear",
];

const TYPES = ["Integer", "Decimal", "String", "Boolean", "DateTime", "Record", "Enum", "List"];

connection.onCompletion((_params: TextDocumentPositionParams): CompletionItem[] => {
  return [
    ...KEYWORDS.map((k, i) => ({
      label: k,
      kind: CompletionItemKind.Keyword,
      data: i,
    })),
    ...TYPES.map((t, i) => ({
      label: t,
      kind: CompletionItemKind.TypeParameter,
      data: 1000 + i,
    })),
  ];
});

// Hover provider (basic)
connection.onHover(async (params): Promise<Hover> => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) return { contents: [] };

  return {
    contents: {
      kind: MarkupKind.Markdown,
      value: "**ARIA** — AI-Readable Intent Architecture\n\nA formal specification language. See [documentation](https://github.com/aria-lang/aria).",
    },
  };
});

documents.listen(connection);
connection.listen();
