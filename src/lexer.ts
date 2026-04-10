/**
 * ARIA Lexer/Tokenizer
 * Converts .aria source text into a token stream
 */

export type TokenKind =
  // Keywords
  | "module"
  | "version"
  | "target"
  | "author"
  | "type"
  | "is"
  | "where"
  | "self"
  | "contract"
  | "inputs"
  | "requires"
  | "ensures"
  | "on_failure"
  | "when"
  | "return"
  | "with"
  | "examples"
  | "given"
  | "then"
  | "effects"
  | "sends"
  | "writes"
  | "creates"
  | "reads"
  | "deletes"
  | "depends_on"
  | "timeout"
  | "retry"
  | "max"
  | "backoff"
  | "on_exhaust"
  | "rate_limit"
  | "per"
  | "behavior"
  | "states"
  | "initial"
  | "transitions"
  | "invariants"
  | "forbidden"
  | "flow"
  | "steps"
  | "compensate"
  | "old"
  | "length"
  | "exists"
  | "matches"
  | "starts_with"
  | "in"
  | "valid"
  | "implies"
  | "not"
  | "and"
  | "or"
  | "once"
  | "increased_by"
  | "now"
  | "of"
  | "seconds"
  | "minutes"
  | "hours"
  | "days"
  | "exponential"
  | "linear"
  | "constant"
  | "result"
  | "true"
  | "false"
  | "import"
  | "from"
  | "supersedes"
  | "deprecated"
  | "always"
  | "never"
  | "eventually"
  | "leads_to"
  | "within"
  | "computed"
  | "as"
  | "dispatch"

  // Symbols
  | "arrow" // ->
  | "doubleEquals" // ==
  | "notEquals" // !=
  | "greaterEquals" // >=
  | "lessEquals" // <=
  | "greater" // >
  | "less" // <
  | "lparen" // (
  | "rparen" // )
  | "lbrace" // {
  | "rbrace" // }
  | "lbracket" // [
  | "rbracket" // ]
  | "colon" // :
  | "comma" // ,
  | "dot" // .
  | "plus" // +
  | "minus" // -
  | "star" // *
  | "slash" // /
  | "equals" // =

  // Literals
  | "integer"
  | "decimal"
  | "string"
  | "regex"

  // Identifier
  | "identifier"

  // Comments
  | "docComment" // ---
  | "lineComment" // --

  // Whitespace
  | "indent"
  | "dedent"
  | "newline"

  // EOF
  | "eof";

export interface Token {
  kind: TokenKind;
  value: string | number | null;
  line: number;
  column: number;
  raw?: string; // original text
}

const KEYWORDS: { [key: string]: TokenKind } = {
  module: "module",
  version: "version",
  target: "target",
  author: "author",
  type: "type",
  is: "is",
  where: "where",
  self: "self",
  contract: "contract",
  inputs: "inputs",
  requires: "requires",
  ensures: "ensures",
  on_failure: "on_failure",
  when: "when",
  return: "return",
  with: "with",
  examples: "examples",
  given: "given",
  then: "then",
  effects: "effects",
  sends: "sends",
  writes: "writes",
  creates: "creates",
  reads: "reads",
  deletes: "deletes",
  depends_on: "depends_on",
  timeout: "timeout",
  retry: "retry",
  max: "max",
  backoff: "backoff",
  on_exhaust: "on_exhaust",
  rate_limit: "rate_limit",
  per: "per",
  behavior: "behavior",
  states: "states",
  initial: "initial",
  transitions: "transitions",
  invariants: "invariants",
  forbidden: "forbidden",
  flow: "flow",
  steps: "steps",
  compensate: "compensate",
  old: "old",
  length: "length",
  exists: "exists",
  matches: "matches",
  starts_with: "starts_with",
  in: "in",
  valid: "valid",
  implies: "implies",
  not: "not",
  and: "and",
  or: "or",
  once: "once",
  increased_by: "increased_by",
  now: "now",
  of: "of",
  seconds: "seconds",
  minutes: "minutes",
  hours: "hours",
  days: "days",
  exponential: "exponential",
  linear: "linear",
  constant: "constant",
  result: "result",
  true: "true",
  false: "false",
  import: "import",
  from: "from",
  supersedes: "supersedes",
  deprecated: "deprecated",
  always: "always",
  never: "never",
  eventually: "eventually",
  leads_to: "leads_to",
  within: "within",
  computed: "computed",
  as: "as",
  dispatch: "dispatch",
};

export class Lexer {
  private source: string;
  private position: number = 0;
  private line: number = 1;
  private column: number = 1;
  private tokens: Token[] = [];
  private indentStack: number[] = [0];

  constructor(source: string) {
    this.source = source;
  }

  private peek(offset: number = 0): string | null {
    const pos = this.position + offset;
    return pos < this.source.length ? this.source[pos] : null;
  }

  private advance(): string | null {
    if (this.position >= this.source.length) return null;
    const char = this.source[this.position];
    this.position++;
    if (char === "\n") {
      this.line++;
      this.column = 1;
    } else {
      this.column++;
    }
    return char;
  }

  private skipWhitespace(preserveNewlines: boolean = false): void {
    while (this.peek() && /[ \t]/.test(this.peek()!)) {
      this.advance();
    }
  }

  private readString(quote: string): string {
    this.advance(); // opening quote
    let result = "";
    while (this.peek() && this.peek() !== quote) {
      if (this.peek() === "\\") {
        this.advance();
        const next = this.advance();
        if (next === "n") result += "\n";
        else if (next === "t") result += "\t";
        else if (next === "r") result += "\r";
        else if (next === "\\") result += "\\";
        else if (next === quote) result += quote;
        else result += next || "";
      } else {
        result += this.advance();
      }
    }
    if (this.peek() === quote) this.advance(); // closing quote
    return result;
  }

  private readNumber(): { kind: "integer" | "decimal"; value: number } {
    let result = "";
    while (this.peek() && /[0-9_]/.test(this.peek()!)) {
      if (this.peek() !== "_") {
        result += this.advance();
      } else {
        this.advance();
      }
    }
    if (this.peek() === "." && this.peek(1) !== null && /[0-9]/.test(this.peek(1)!)) {
      result += this.advance(); // consume "."
      while (this.peek() && /[0-9_]/.test(this.peek()!)) {
        if (this.peek() !== "_") {
          result += this.advance();
        } else {
          this.advance();
        }
      }
      return { kind: "decimal", value: parseFloat(result) };
    }
    return { kind: "integer", value: parseInt(result, 10) };
  }

  private readIdentifier(): string {
    let result = "";
    while (this.peek() && /[a-zA-Z0-9_]/.test(this.peek()!)) {
      result += this.advance();
    }
    return result;
  }

  private readRegex(): string {
    this.advance(); // opening /
    let result = "";
    while (this.peek() && this.peek() !== "/") {
      if (this.peek() === "\\") {
        result += this.advance();
        result += this.advance();
      } else {
        result += this.advance();
      }
    }
    if (this.peek() === "/") this.advance(); // closing /
    return result;
  }

  private readDocComment(): string {
    this.advance(); // first -
    this.advance(); // second -
    this.advance(); // third -
    let result = "";
    while (this.peek() && this.peek() !== "\n") {
      result += this.advance();
    }
    return result.trim();
  }

  private readLineComment(): void {
    this.advance(); // first -
    this.advance(); // second -
    while (this.peek() && this.peek() !== "\n") {
      this.advance();
    }
  }

  private addToken(kind: TokenKind, value: string | number | null = null, raw?: string): void {
    this.tokens.push({
      kind,
      value,
      line: this.line,
      column: this.column - (raw?.length || 1),
      raw,
    });
  }

  private handleIndentation(): void {
    let indentLevel = 0;
    const lineStart = this.position;

    // Count leading spaces/tabs
    while (this.peek() && /[ \t]/.test(this.peek()!)) {
      if (this.peek() === "\t") {
        indentLevel += 4; // treat tab as 4 spaces
      } else {
        indentLevel += 1;
      }
      this.advance();
    }

    // Skip empty lines and comments
    if (!this.peek() || this.peek() === "\n" || (this.peek() === "-" && this.peek(1) === "-")) {
      return;
    }

    const currentIndent = this.indentStack[this.indentStack.length - 1];

    if (indentLevel > currentIndent) {
      this.indentStack.push(indentLevel);
      this.addToken("indent");
    } else if (indentLevel < currentIndent) {
      while (this.indentStack.length > 1 && this.indentStack[this.indentStack.length - 1] > indentLevel) {
        this.indentStack.pop();
        this.addToken("dedent");
      }
    }
  }

  tokenize(): Token[] {
    while (this.position < this.source.length) {
      const char = this.peek();

      if (char === "\n") {
        this.addToken("newline");
        this.advance();
        // Handle indentation on next line
        this.handleIndentation();
        continue;
      }

      // Skip spaces/tabs (but indentation is handled elsewhere)
      if (char === " " || char === "\t") {
        this.advance();
        continue;
      }

      // Comments
      if (char === "-" && this.peek(1) === "-" && this.peek(2) === "-") {
        const docText = this.readDocComment();
        this.addToken("docComment", docText);
        continue;
      }

      if (char === "-" && this.peek(1) === "-") {
        this.readLineComment();
        continue;
      }

      // Two-character operators
      if (char === "-" && this.peek(1) === ">") {
        this.advance();
        this.advance();
        this.addToken("arrow");
        continue;
      }

      if (char === "=" && this.peek(1) === "=") {
        this.advance();
        this.advance();
        this.addToken("doubleEquals");
        continue;
      }

      if (char === "!" && this.peek(1) === "=") {
        this.advance();
        this.advance();
        this.addToken("notEquals");
        continue;
      }

      if (char === ">" && this.peek(1) === "=") {
        this.advance();
        this.advance();
        this.addToken("greaterEquals");
        continue;
      }

      if (char === "<" && this.peek(1) === "=") {
        this.advance();
        this.advance();
        this.addToken("lessEquals");
        continue;
      }

      // Regex (context: after 'matches' keyword) — MUST be before symbol map
      if (char === "/" && this.tokens.length > 0 && this.tokens[this.tokens.length - 1].kind === "matches") {
        const regexValue = this.readRegex();
        this.addToken("regex", regexValue);
        continue;
      }

      // Strings
      if (char === '"' || char === "'") {
        const stringValue = this.readString(char);
        this.addToken("string", stringValue);
        continue;
      }

      // Single-character symbols
      const symbolMap: { [key: string]: TokenKind } = {
        "(": "lparen",
        ")": "rparen",
        "{": "lbrace",
        "}": "rbrace",
        "[": "lbracket",
        "]": "rbracket",
        ":": "colon",
        ",": "comma",
        ".": "dot",
        "+": "plus",
        "-": "minus",
        "*": "star",
        "/": "slash",
        "=": "equals",
        ">": "greater",
        "<": "less",
      };

      if (symbolMap[char!]) {
        this.addToken(symbolMap[char!]);
        this.advance();
        continue;
      }

      // Numbers
      if (/[0-9]/.test(char!)) {
        const { kind, value } = this.readNumber();
        this.addToken(kind, value);
        continue;
      }

      // Identifiers and keywords
      if (/[a-zA-Z_]/.test(char!)) {
        const ident = this.readIdentifier();
        const kind = KEYWORDS[ident] || "identifier";
        this.addToken(kind as TokenKind, kind === "identifier" ? ident : null, ident);
        continue;
      }

      // Unknown character
      throw new Error(`Unexpected character '${char}' at line ${this.line}, column ${this.column}`);
    }

    // Emit remaining dedents
    while (this.indentStack.length > 1) {
      this.indentStack.pop();
      this.addToken("dedent");
    }

    this.addToken("eof");
    return this.tokens;
  }
}

export function tokenize(source: string): Token[] {
  const lexer = new Lexer(source);
  return lexer.tokenize();
}
