export interface SourceLocation {
  line: number;
  column: number;
  length?: number;
}

export interface AriaError {
  message: string;
  location: SourceLocation;
  hint?: string;
  source?: string; // full source text for context extraction
}

/**
 * Format an error with source line context and caret pointer
 */
export function formatError(err: AriaError): string {
  const lines: string[] = [];
  lines.push(`Error: ${err.message}`);

  if (err.source) {
    const sourceLines = err.source.split('\n');
    const lineNum = err.location.line;
    const col = err.location.column;
    const len = err.location.length || 1;

    // Show 1 line of context if available
    if (lineNum >= 1 && lineNum <= sourceLines.length) {
      const lineContent = sourceLines[lineNum - 1];
      const lineLabel = `  ${lineNum} | `;
      lines.push(`${lineLabel}${lineContent}`);
      lines.push(`${' '.repeat(lineLabel.length)}${' '.repeat(Math.max(0, col - 1))}${'^'.repeat(len)}`);
    }
  }

  if (err.hint) {
    lines.push(`Hint: ${err.hint}`);
  }

  return lines.join('\n');
}

/**
 * Detect common mistakes and suggest fixes
 */
export function suggestFix(message: string, gotKind: string): string | undefined {
  if (message.includes("Expected colon")) {
    return "Field syntax is `name: Type` — did you forget the ':'?";
  }
  if (message.includes("Expected doubleEquals") || message.includes("Expected ==")) {
    return "Use '==' for comparison, not '='";
  }
  if (message.includes("Expected identifier") && gotKind === "string") {
    return "Identifiers should not be quoted";
  }
  return undefined;
}
