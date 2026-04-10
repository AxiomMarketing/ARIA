/**
 * ARIA Parser
 * Converts token stream from lexer into an ARIA AST
 * Uses recursive descent parsing with position tracking
 */

import { Token, TokenKind, tokenize } from './lexer.js';
import { formatError, suggestFix } from './errors.js';
import {
  AriaModule,
  Import,
  TypeDef,
  TypeBase,
  TypeReference,
  WhereClause,
  RecordField,
  EnumVariant,
  ContractDef,
  Input,
  Assertion,
  FailureCase,
  Example,
  Effect,
  Dependency,
  TimeoutPolicy,
  RetryPolicy,
  RateLimitPolicy,
  Step,
  CompensateRule,
  DispatchRule,
  DispatchCase,
  BehaviorDef,
  State,
  Transition,
  ForbiddenTransition,
  FlowExample,
  Expression,
} from './ast.js';

export class Parser {
  private tokens: Token[];
  private position: number = 0;
  private source: string = "";

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  setSource(s: string): void {
    this.source = s;
  }

  private peek(offset: number = 0): Token {
    const pos = this.position + offset;
    return pos < this.tokens.length ? this.tokens[pos] : this.tokens[this.tokens.length - 1];
  }

  private current(): Token {
    return this.peek(0);
  }

  private advance(): Token {
    const token = this.current();
    if (token.kind !== 'eof') {
      this.position++;
    }
    return token;
  }

  /** Skip tokens until we find any of the given kinds, or eof */
  private skipUntil(...kinds: TokenKind[]): void {
    while (!this.match('eof', ...kinds)) {
      this.advance();
    }
  }

  private expect(kind: TokenKind): Token {
    const token = this.current();
    if (token.kind !== kind) {
      const message = `Expected ${kind} but got ${token.kind}`;
      const hint = suggestFix(message, token.kind);
      throw new Error(formatError({
        message,
        location: { line: token.line, column: token.column, length: (token.raw || String(token.value || '')).length || 1 },
        hint,
        source: this.source,
      }));
    }
    return this.advance();
  }

  private match(...kinds: TokenKind[]): boolean {
    return kinds.includes(this.current().kind);
  }

  private matchIdent(value: string): boolean {
    const t = this.current();
    return t.kind === 'identifier' && (t.value === value || t.raw === value);
  }

  private expectIdent(value: string): Token {
    const t = this.current();
    if (!this.matchIdent(value)) {
      throw new Error(
        `Expected identifier "${value}" but got ${t.kind}("${t.raw || t.value}") at line ${t.line}, column ${t.column}`
      );
    }
    return this.advance();
  }

  private skipNewlines(): void {
    while (this.match('newline')) {
      this.advance();
    }
  }



  private collectUntilKeyword(...keywords: TokenKind[]): string {
    const startPos = this.position;
    const parts: { text: string; kind: TokenKind }[] = [];

    while (
      !this.match('eof', 'dedent', ...keywords) &&
      !this.isBlockKeyword(this.current().kind)
    ) {
      const token = this.current();
      if (token.kind === 'newline') {
        this.advance();
        break;
      }
      const text = token.raw || this.tokenToString(token);
      parts.push({ text, kind: token.kind });
      this.advance();
    }

    // Join tokens with spaces, but no space before/after dot, lparen, rparen, comma
    let result = '';
    for (let i = 0; i < parts.length; i++) {
      const cur = parts[i];
      const prev = parts[i - 1];
      const noSpaceBefore = cur.kind === 'dot' || cur.kind === 'rparen' || cur.kind === 'comma' || cur.kind === 'lbracket' || cur.kind === 'rbracket';
      const noSpaceAfter = prev && (prev.kind === 'dot' || prev.kind === 'lparen' || prev.kind === 'lbracket');
      if (i > 0 && !noSpaceBefore && !noSpaceAfter) {
        result += ' ';
      }
      result += cur.text;
    }
    return result.trim();
  }

  private static readonly BLOCK_KEYWORDS = new Set<string>([
    'where', 'inputs', 'requires', 'ensures', 'on_failure', 'examples',
    'effects', 'depends_on', 'timeout', 'retry', 'rate_limit',
    'states', 'initial', 'transitions', 'invariants', 'forbidden',
    'steps', 'compensate',
  ]);

  private static readonly STRUCTURAL_TOKENS = new Set<string>([
    'indent', 'dedent', 'newline', 'eof', 'docComment', 'lineComment',
  ]);

  private isBlockKeyword(kind: TokenKind): boolean {
    return Parser.BLOCK_KEYWORDS.has(kind);
  }

  private tokenToString(token: Token): string {
    if (Parser.STRUCTURAL_TOKENS.has(token.kind)) return '';
    if (token.kind === 'string') return `"${token.value}"`;
    if (token.kind === 'integer') return String(token.value);
    if (token.kind === 'decimal') return String(token.value);
    if (token.kind === 'regex') return `/${token.value}/`;

    const symbols: Record<string, string> = {
      lparen: '(', rparen: ')', lbrace: '{', rbrace: '}',
      lbracket: '[', rbracket: ']', doubleEquals: '==', notEquals: '!=',
      greaterEquals: '>=', lessEquals: '<=', greater: '>', less: '<',
      arrow: '->', colon: ':', comma: ',', dot: '.', plus: '+',
      minus: '-', star: '*', slash: '/', equals: '='
    };
    if (symbols[token.kind]) return symbols[token.kind];

    // For keywords and identifiers, return the raw text or kind name
    return token.raw || String(token.value) || token.kind;
  }

  parse(): AriaModule {
    this.skipNewlines();
    return this.parseModule();
  }

  private parseModule(): AriaModule {
    this.expect('module');
    const name = this.expect('identifier').value as string;
    this.skipNewlines();

    // Module header is indented under the module name
    if (this.match('indent')) {
      this.advance();
      this.skipNewlines();
    }

    let version = '1.0';
    let targets: string[] = [];
    let author: string | undefined;

    let supersedes: { module: string; version: string } | undefined;

    // Parse module header
    while (
      this.match('version', 'target', 'author', 'supersedes') &&
      this.current().kind !== 'dedent'
    ) {
      if (this.match('version')) {
        this.advance();
        version = this.expect('string').value as string;
        this.skipNewlines();
      } else if (this.match('target')) {
        this.advance();
        targets.push(this.expect('identifier').value as string);
        while (this.match('comma')) {
          this.advance();
          targets.push(this.expect('identifier').value as string);
        }
        this.skipNewlines();
      } else if (this.match('author')) {
        this.advance();
        author = this.expect('string').value as string;
        this.skipNewlines();
      } else if (this.match('supersedes')) {
        this.advance();
        const superseded = this.expect('string').value as string;
        this.expect('version');
        const superVersion = this.expect('string').value as string;
        supersedes = { module: superseded, version: superVersion };
        this.skipNewlines();
      }
    }

    // Parse imports
    const imports: Import[] = [];

    this.skipNewlines();
    while (this.match('import')) {
      this.advance();
      const importedTypes: string[] = [];
      importedTypes.push(this.expect('identifier').value as string);
      while (this.match('comma')) {
        this.advance();
        importedTypes.push(this.expect('identifier').value as string);
      }
      this.expect('from');
      const fromFile = this.expect('string').value as string;
      imports.push({ kind: 'import', types: importedTypes, from: fromFile });
      this.skipNewlines();
    }

    // Parse body
    const body: (TypeDef | ContractDef | BehaviorDef)[] = [];

    this.skipNewlines();
    while (!this.match('eof')) {
      // Handle doc comments
      let docComment: string | undefined;
      if (this.match('docComment')) {
        docComment = this.advance().value as string;
        this.skipNewlines();
      }

      if (this.match('type')) {
        const typeDef = this.parseTypeDef();
        if (docComment) typeDef.docComment = docComment;
        body.push(typeDef);
      } else if (this.match('contract')) {
        const contractDef = this.parseContractDef();
        if (docComment) contractDef.docComment = docComment;
        body.push(contractDef);
      } else if (this.match('behavior')) {
        const behaviorDef = this.parseBehaviorDef();
        if (docComment) behaviorDef.docComment = docComment;
        body.push(behaviorDef);
      } else {
        this.advance(); // skip unknown token
      }

      this.skipNewlines();
    }

    return {
      kind: 'module',
      name,
      version,
      targets,
      author,
      imports: imports.length > 0 ? imports : undefined,
      supersedes,
      body,
    };
  }

  private parseTypeDef(): TypeDef {
    this.expect('type');
    const name = this.expect('identifier').value as string;

    // Optional generic type params: `type Result of T, E is Enum`
    let typeParams: string[] | undefined;
    if (this.match('of')) {
      // Look ahead: `of` is followed by identifier(s) then `is`, not a base type keyword.
      // We distinguish by checking that after the identifier list comes `is`.
      const savedPos = this.position;
      this.advance(); // consume `of`
      const params: string[] = [];
      if (this.match('identifier')) {
        params.push(this.advance().value as string);
        while (this.match('comma')) {
          this.advance();
          params.push(this.expect('identifier').value as string);
        }
        if (this.match('is')) {
          typeParams = params;
        } else {
          // Not a type param list — rewind
          this.position = savedPos;
        }
      } else {
        this.position = savedPos;
      }
    }

    this.expect('is');

    let base: TypeBase = 'String';
    let elementType: TypeReference | undefined;

    // Parse base type
    if (this.match('identifier')) {
      const baseIdent = this.current().value as string;
      if (
        ['Integer', 'Decimal', 'String', 'Boolean', 'DateTime', 'Record', 'Enum', 'List'].includes(
          baseIdent
        )
      ) {
        base = baseIdent as TypeBase;
        this.advance();

        if (base === 'List') {
          this.expect('of');
          elementType = this.parseTypeReference();
        }
      }
    }

    this.skipNewlines();

    const whereClauses: WhereClause[] = [];
    let unit: string | undefined;
    let fields: RecordField[] | undefined;
    let variants: EnumVariant[] | undefined;

    // Parse type body
    if (this.match('indent')) {
      this.advance();
      this.skipNewlines();

      while (!this.match('dedent', 'eof')) {
        if (this.match('where')) {
          this.advance();
          const expr = this.collectUntilKeyword();
          const whereClause: WhereClause = { kind: 'where', expression: expr };
          const parsedWhere = this.tryParseExpression(expr);
          if (parsedWhere) whereClause.parsedExpression = parsedWhere;
          whereClauses.push(whereClause);
          this.skipNewlines();
        } else if (this.matchIdent('unit')) {
          this.advance();
          unit = this.expect('string').value as string;
          this.skipNewlines();
        } else if (this.match('docComment') && (base === 'Record' || base === 'Enum')) {
          // Consume doc comments between fields/variants — they attach to the NEXT field
          // Accumulate multiple consecutive doc comments into one
          const docParts: string[] = [];
          while (this.match('docComment')) {
            docParts.push(this.advance().value as string);
            this.skipNewlines();
          }
          // The accumulated doc comment will be picked up by the next field/variant
          // via the inline doc comment check below
          if (this.match('identifier')) {
            if (base === 'Record') {
              if (!fields) fields = [];
              const fieldName = this.advance().value as string;
              this.expect('colon');
              const fieldType = this.parseTypeReference();
              let computed: string | undefined;
              if (this.match('computed')) {
                this.advance();
                this.expect('as');
                computed = this.collectUntilKeyword();
              }
              // Check for inline doc comment too
              if (this.match('docComment')) {
                docParts.push(this.advance().value as string);
              }
              fields.push({
                kind: 'field',
                name: fieldName,
                type: fieldType,
                docComment: docParts.join('\n'),
                computed,
              });
            } else {
              if (!variants) variants = [];
              const variantName = this.advance().value as string;
              if (this.match('docComment')) {
                docParts.push(this.advance().value as string);
              }
              variants.push({
                kind: 'variant',
                name: variantName,
                docComment: docParts.join('\n'),
              });
            }
          }
          this.skipNewlines();
        } else if (this.match('identifier') && base === 'Record') {
          // Parse record fields
          if (!fields) fields = [];
          const fieldName = this.advance().value as string;
          this.expect('colon');
          const fieldType = this.parseTypeReference();

          // Optional `computed as <expression>` clause (Phase 7.2)
          let computed: string | undefined;
          if (this.match('computed')) {
            this.advance();
            this.expect('as');
            computed = this.collectUntilKeyword();
          }

          let fieldDocComment: string | undefined;
          if (this.match('docComment')) {
            fieldDocComment = this.advance().value as string;
          }

          fields.push({
            kind: 'field',
            name: fieldName,
            type: fieldType,
            docComment: fieldDocComment,
            computed,
          });

          this.skipNewlines();
        } else if (this.match('identifier') && base === 'Enum') {
          // Parse enum variants
          if (!variants) variants = [];
          const variantName = this.advance().value as string;

          let variantDocComment: string | undefined;
          if (this.match('docComment')) {
            variantDocComment = this.advance().value as string;
          }

          variants.push({
            kind: 'variant',
            name: variantName,
            docComment: variantDocComment,
          });

          this.skipNewlines();
        } else {
          this.advance();
        }
      }

      if (this.match('dedent')) this.advance();
    }

    return {
      kind: 'type',
      name,
      base,
      whereClauses,
      unit,
      fields,
      variants,
      elementType,
      typeParams,
    };
  }

  private parseTypeReference(): TypeReference {
    // Handle "List of X" inline type references
    const token = this.current();
    let name: string;
    let typeArgs: TypeReference[] | undefined;

    if (token.kind === 'identifier' && (token.value === 'List' || token.raw === 'List')) {
      this.advance();
      if (this.match('of')) {
        this.advance();
        // Recursively parse the element type so nested generics work:
        //   List of Result of Money, Error → List<Result<Money, Error>>
        const elementRef = this.parseTypeReference();
        name = `List<${elementRef.name}>`;
        typeArgs = [elementRef];
      } else {
        name = 'List';
      }
    } else {
      name = this.expect('identifier').value as string;

      // Generic instantiation: `Result of Money, Error`
      if (this.match('of')) {
        // Only consume `of` as a type arg list if followed by identifier(s)
        const savedPos = this.position;
        this.advance();
        if (this.match('identifier')) {
          typeArgs = [];
          typeArgs.push({ kind: 'typeRef', name: this.advance().value as string });
          while (this.match('comma')) {
            this.advance();
            typeArgs.push({ kind: 'typeRef', name: this.expect('identifier').value as string });
          }
          name = `${name}<${typeArgs.map((t) => t.name).join(', ')}>`;
        } else {
          this.position = savedPos;
        }
      }
    }

    let isOptional = false;
    if (this.current().raw === '?') {
      isOptional = true;
      this.advance();
    }

    return {
      kind: 'typeRef',
      name,
      isOptional,
      typeArgs,
    };
  }

  private parseContractDef(): ContractDef {
    this.expect('contract');
    const name = this.expect('identifier').value as string;
    this.skipNewlines();

    let docComment: string | undefined;
    if (this.match('docComment')) {
      docComment = this.advance().value as string;
      this.skipNewlines();
    }

    const inputs: Input[] = [];
    const requires: Assertion[] = [];
    const ensures: Assertion[] = [];
    const onFailure: FailureCase[] = [];
    const examples: Example[] = [];
    let effects: Effect[] | undefined;
    let dependsOn: Dependency[] | undefined;
    let timeout: TimeoutPolicy | undefined;
    let retry: RetryPolicy | undefined;
    let rateLimit: RateLimitPolicy | undefined;
    let steps: Step[] | undefined;
    let compensate: CompensateRule[] | undefined;
    let deprecated: string | undefined;
    let dispatch: DispatchRule | undefined;

    if (this.match('indent')) {
      this.advance();
      this.skipNewlines();

      while (!this.match('dedent', 'eof')) {
        const loopStart = this.position;
        if (this.match('inputs')) {
          this.advance();
          this.skipNewlines();
          if (this.match('indent')) {
            this.advance();
            this.skipNewlines();
            while (!this.match('dedent', 'eof')) {
              const inputName = this.expect('identifier').value as string;
              this.expect('colon');
              const inputType = this.parseTypeReference();

              let inputDocComment: string | undefined;
              if (this.match('docComment')) {
                inputDocComment = this.advance().value as string;
              }

              inputs.push({
                kind: 'input',
                name: inputName,
                type: inputType,
                docComment: inputDocComment,
              });

              this.skipNewlines();
            }
            this.advance(); // dedent
          }
        } else if (this.match('requires')) {
          this.advance();
          this.skipNewlines();
          if (this.match('indent')) {
            this.advance();
            this.skipNewlines();
            while (!this.match('dedent', 'eof')) {
              const expr = this.collectUntilKeyword();
              if (!expr) { this.advance(); this.skipNewlines(); continue; }
              const reqAssertion: Assertion = { kind: 'assertion', expression: expr };
              const parsedReq = this.tryParseExpression(expr);
              if (parsedReq) reqAssertion.parsedExpression = parsedReq;
              requires.push(reqAssertion);
              this.skipNewlines();
            }
            if (this.match('dedent')) this.advance();
          }
        } else if (this.match('ensures')) {
          this.advance();
          this.skipNewlines();
          if (this.match('indent')) {
            this.advance();
            this.skipNewlines();
            while (!this.match('dedent', 'eof')) {
              const expr = this.collectUntilKeyword();
              if (!expr) { this.advance(); this.skipNewlines(); continue; }
              const ensAssertion: Assertion = { kind: 'assertion', expression: expr };
              const parsedEns = this.tryParseExpression(expr);
              if (parsedEns) ensAssertion.parsedExpression = parsedEns;
              ensures.push(ensAssertion);
              this.skipNewlines();
            }
            if (this.match('dedent')) this.advance();
          }
        } else if (this.match('on_failure')) {
          this.advance();
          this.skipNewlines();
          if (this.match('indent')) {
            this.advance();
            this.skipNewlines();
            while (!this.match('dedent', 'eof')) {
              const onFailureLoopStart = this.position;
              if (this.match('when')) {
                this.advance();
                const whenExpr = this.collectUntilKeyword();
                // Skip newline + optional indent before return
                this.skipNewlines();
                let returnNestedIndent = false;
                if (this.match('indent')) {
                  this.advance();
                  this.skipNewlines();
                  returnNestedIndent = true;
                }
                this.expect('return');
                const returnType = this.expect('identifier').value as string;

                let returnFields: { [key: string]: string } | undefined;
                if (this.match('with')) {
                  this.advance();
                  returnFields = {};
                  while (!this.match('newline', 'dedent', 'eof')) {
                    const withLoopStart = this.position;
                    // Field name: identifier OR keyword token whose raw text is a valid identifier.
                    // This allows common reserved keywords like `max`, `reason`, `retry` to be
                    // used as field names in on_failure `with` clauses.
                    const nameToken = this.current();
                    const rawName = (nameToken.value as string) || (nameToken.raw as string) || '';
                    const isValidFieldName =
                      nameToken.kind === 'identifier' ||
                      /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(rawName);
                    if (!isValidFieldName) {
                      break;
                    }
                    this.advance();
                    const fieldName = rawName;
                    this.expect('colon');
                    const valueTokens: string[] = [];
                    while (!this.match('comma', 'newline', 'dedent', 'eof')) {
                      const t = this.current();
                      valueTokens.push(t.raw || this.tokenToString(t));
                      this.advance();
                    }
                    returnFields[fieldName] = valueTokens.join(' ').trim();
                    if (this.match('comma')) this.advance();
                    // Safety: prevent infinite loop if nothing advanced
                    if (this.position === withLoopStart) this.advance();
                  }
                }

                onFailure.push({
                  kind: 'failureCase',
                  when: whenExpr,
                  return: {
                    type: returnType,
                    fields: returnFields,
                  },
                });

                // Close the nested indent opened before `return` so outer loop
                // sees the correct DEDENT level when transitioning to next block
                this.skipNewlines();
                if (returnNestedIndent && this.match('dedent')) {
                  this.advance();
                }
              } else {
                this.advance();
              }
              this.skipNewlines();
              // Safety: prevent infinite loop
              if (this.position === onFailureLoopStart) this.advance();
            }
            if (this.match('dedent')) this.advance();
          }
        } else if (this.match('examples')) {
          this.advance();
          this.skipNewlines();
          if (this.match('indent')) {
            this.advance();
            this.skipNewlines();
            while (!this.match('dedent', 'eof')) {
              let exampleName: string | undefined;
              if (this.match('string')) {
                exampleName = this.advance().value as string;
              }

              if (this.match('given')) {
                this.advance();
                this.skipNewlines();
                const given = this.parseGivenBlock();
                this.skipNewlines();

                const thenAssertions: Assertion[] = [];
                if (this.match('then')) {
                  this.advance();
                  this.skipNewlines();
                  if (this.match('indent')) {
                    this.advance();
                    this.skipNewlines();
                    while (!this.match('dedent', 'eof')) {
                      const expr = this.collectUntilKeyword();
                      thenAssertions.push({ kind: 'assertion', expression: expr });
                      this.skipNewlines();
                    }
                    this.advance(); // dedent
                  } else {
                    const expr = this.collectUntilKeyword();
                    thenAssertions.push({ kind: 'assertion', expression: expr });
                    this.skipNewlines();
                  }
                }

                examples.push({
                  kind: 'example',
                  name: exampleName,
                  given,
                  then: thenAssertions,
                });
              }

              this.skipNewlines();
            }
            this.advance(); // dedent
          }
        } else if (this.match('effects')) {
          this.advance();
          this.skipNewlines();
          if (!effects) effects = [];
          if (this.match('indent')) {
            this.advance();
            this.skipNewlines();
            while (!this.match('dedent', 'eof')) {
              const actionKind = this.current().kind;
              if (['sends', 'writes', 'creates', 'reads', 'deletes'].includes(actionKind)) {
                const action = actionKind;
                this.advance();
                const target = this.expect('identifier').value as string;

                let details: { [key: string]: string } | undefined;

                // Optional: when condition
                if (this.match('when')) {
                  this.advance();
                  const whenCondition = this.collectUntilKeyword();
                  details = { when: whenCondition };
                }

                // Optional: with details
                if (this.match('with')) {
                  this.advance();
                  if (!details) details = {};
                  while (!this.match('newline', 'dedent', 'eof')) {
                    const fieldName = this.expect('identifier').value as string;
                    this.expect('colon');
                    // Collect value tokens until comma, newline, or dedent (without consuming newline here)
                    const valueTokens: string[] = [];
                    while (!this.match('comma', 'newline', 'dedent', 'eof')) {
                      const t = this.current();
                      valueTokens.push(t.raw || this.tokenToString(t));
                      this.advance();
                    }
                    details[fieldName] = valueTokens.join(' ').trim();
                    if (this.match('comma')) this.advance();
                  }
                }

                effects.push({
                  kind: 'effect',
                  action: action as 'sends' | 'writes' | 'creates' | 'reads' | 'deletes',
                  target,
                  details,
                });
              } else if (this.current().kind === 'identifier') {
                // Custom action verb (increments, invalidates, updates, etc.) — skip the entire line
                while (!this.match('newline', 'dedent', 'eof')) {
                  this.advance();
                }
              } else {
                this.advance();
              }
              this.skipNewlines();
            }
            this.advance(); // dedent
          }
        } else if (this.match('depends_on')) {
          this.advance();
          this.skipNewlines();
          if (!dependsOn) dependsOn = [];
          if (this.match('indent')) {
            this.advance();
            this.skipNewlines();
            while (!this.match('dedent', 'eof')) {
              const depName = this.expect('identifier').value as string;

              let depDocComment: string | undefined;
              if (this.match('docComment')) {
                depDocComment = this.advance().value as string;
              }

              dependsOn.push({
                kind: 'dependency',
                name: depName,
                docComment: depDocComment,
              });

              this.skipNewlines();
            }
            this.advance(); // dedent
          }
        } else if (this.match('timeout')) {
          this.advance();
          const value = this.expect('integer').value as number;
          const unitToken = this.advance();
          const unitRaw = unitToken.raw || unitToken.kind;
          const unitValue = unitRaw.replace(/s$/, '') as 'second' | 'minute' | 'hour' | 'day';
          timeout = { kind: 'timeout', value, unit: unitValue };
          this.skipNewlines();
        } else if (this.match('retry')) {
          this.advance();
          this.skipNewlines();
          if (this.match('indent')) {
            this.advance();
            this.skipNewlines();

            let maxRetries = 3;
            let backoffType: 'exponential' | 'linear' | 'constant' = 'exponential';
            let onExhaustAction: string | undefined;

            while (!this.match('dedent', 'eof')) {
              const retryLoopStart = this.position;
              if (this.match('max')) {
                this.advance();
                maxRetries = this.expect('integer').value as number;
              } else if (this.match('backoff')) {
                this.advance();
                // backoff accepts keyword tokens exponential/linear/constant OR identifier
                const t = this.current();
                if (t.kind === 'exponential' || t.kind === 'linear' || t.kind === 'constant') {
                  backoffType = t.kind as 'exponential' | 'linear' | 'constant';
                  this.advance();
                } else if (t.kind === 'identifier') {
                  backoffType = t.value as 'exponential' | 'linear' | 'constant';
                  this.advance();
                } else {
                  throw new Error(`Expected backoff type (exponential|linear|constant) but got ${t.kind}`);
                }
              } else if (this.match('on_exhaust')) {
                this.advance();
                this.expect('return');
                onExhaustAction = this.expect('identifier').value as string;
              } else {
                this.advance();
              }
              this.skipNewlines();
              if (this.position === retryLoopStart) this.advance();
            }

            retry = {
              kind: 'retry',
              max: maxRetries,
              backoff: backoffType,
              onExhaust: onExhaustAction,
            };

            this.advance(); // dedent
          }
        } else if (this.match('steps')) {
          this.advance();
          this.skipNewlines();
          if (!steps) steps = [];
          if (this.match('indent')) {
            this.advance();
            this.skipNewlines();
            while (!this.match('dedent', 'eof')) {
              const stepNum = this.expect('integer').value as number;
              this.expect('dot');
              const contractName = this.expect('identifier').value as string;

              const inputs: { [key: string]: string } = {};
              if (this.match('with')) {
                this.advance();
                while (!this.match('then', 'newline', 'indent', 'dedent', 'eof')) {
                  const stepParamLoopStart = this.position;
                  const paramName = this.expect('identifier').value as string;
                  if (this.match('colon')) {
                    this.advance();
                  }
                  const paramValue = this.collectUntilKeyword();
                  inputs[paramName] = paramValue;
                  if (this.match('comma')) this.advance();
                  // Safety: prevent infinite loop on unexpected input
                  if (this.position === stepParamLoopStart) this.advance();
                }
              }

              let resultName = '';
              this.skipNewlines();
              let nestedIndent = false;
              if (this.match('indent')) {
                this.advance();
                this.skipNewlines();
                nestedIndent = true;
              }

              if (this.match('then')) {
                this.advance();
                resultName = this.expect('identifier').value as string;
                this.skipNewlines();
              }

              if (nestedIndent && this.match('dedent')) {
                this.advance();
              }

              steps.push({
                kind: 'step',
                number: stepNum,
                contract: contractName,
                inputs,
                resultName,
              });

              this.skipNewlines();
            }
            this.advance(); // dedent
          }
        } else if (this.match('compensate')) {
          this.advance();
          this.skipNewlines();
          if (!compensate) compensate = [];
          if (this.match('indent')) {
            this.advance();
            this.skipNewlines();
            while (!this.match('dedent', 'eof')) {
              const compensateLoopStart = this.position;
              if (this.matchIdent('on')) {
                this.advance();
                this.expectIdent('step');
                const firstStep = this.expect('integer').value as number;
                const firstStatus = this.expect('identifier').value as string; // "failure" or "success"

                let onStepFailure: number;
                let afterStepSuccess: number;

                if (firstStatus === 'failure') {
                  // Pattern: on step N failure after step M success
                  this.expectIdent('after');
                  this.expectIdent('step');
                  const secondStep = this.expect('integer').value as number;
                  this.expectIdent('success');
                  onStepFailure = firstStep;
                  afterStepSuccess = secondStep;
                } else {
                  // Pattern: on step N success and step M failure
                  if (this.match('and')) this.advance(); else this.expectIdent('and');
                  this.expectIdent('step');
                  const secondStep = this.expect('integer').value as number;
                  this.expectIdent('failure');
                  onStepFailure = secondStep;
                  afterStepSuccess = firstStep;
                }

                this.skipNewlines();
                let compensateNestedIndent = false;
                if (this.match('indent')) {
                  this.advance();
                  this.skipNewlines();
                  compensateNestedIndent = true;
                }

                const action = this.expect('identifier').value as string;

                // Parse optional `with field: value, field: value` clause
                let compensateFields: Record<string, string> | undefined;
                if (this.match('with')) {
                  this.advance();
                  compensateFields = {};
                  while (!this.match('newline', 'dedent', 'eof')) {
                    const nameToken = this.current();
                    const rawName = (nameToken.value as string) || (nameToken.raw as string) || '';
                    const isValid = nameToken.kind === 'identifier' || /^[a-zA-Z_]\w*$/.test(rawName);
                    if (!isValid) break;
                    this.advance();
                    this.expect('colon');
                    const valueTokens: string[] = [];
                    while (!this.match('comma', 'newline', 'dedent', 'eof')) {
                      const t = this.current();
                      valueTokens.push(t.raw || this.tokenToString(t));
                      this.advance();
                    }
                    compensateFields[rawName] = valueTokens.join(' ').trim();
                    if (this.match('comma')) this.advance();
                  }
                }

                this.skipNewlines();

                if (compensateNestedIndent && this.match('dedent')) {
                  this.advance();
                }

                compensate.push({
                  kind: 'compensate',
                  onStepFailure,
                  afterStepSuccess,
                  action,
                  fields: compensateFields,
                });
              } else {
                // Unknown token in compensate body — skip it to prevent infinite loop
                this.advance();
              }
              this.skipNewlines();
              // Safety: prevent infinite loop if no progress was made
              if (this.position === compensateLoopStart) this.advance();
            }
            if (this.match('dedent')) this.advance();
          }
        } else if (this.match('rate_limit')) {
          this.advance();
          this.skipNewlines();
          rateLimit = { kind: 'rateLimit', limits: [] };
          if (this.match('indent')) {
            this.advance();
            this.skipNewlines();
            while (!this.match('dedent', 'eof')) {
              if (this.match('max')) {
                this.advance();
                const maxVal = this.expect('integer').value as number;
                this.expect('per');
                const period = this.tokenToString(this.current());
                const normalizedPeriod = period.replace(/s$/, '') as 'second' | 'minute' | 'hour' | 'day';
                this.advance();
                let perKey: string | undefined;
                if (this.match('per')) {
                  this.advance();
                  perKey = this.tokenToString(this.current());
                  this.advance();
                }
                rateLimit.limits.push({
                  max: maxVal,
                  period: normalizedPeriod,
                  perKey,
                });
              } else {
                this.advance();
              }
              this.skipNewlines();
            }
            if (this.match('dedent')) this.advance();
          }
        } else if (this.match('deprecated')) {
          this.advance();
          deprecated = this.expect('string').value as string;
          this.skipNewlines();
        } else if (this.match('dispatch')) {
          // Phase 7.3: dispatch on <field>
          //   when <value> -> <ContractName>
          this.advance();
          this.expectIdent('on');
          const dispatchField = this.expect('identifier').value as string;
          this.skipNewlines();

          const cases: DispatchCase[] = [];
          if (this.match('indent')) {
            this.advance();
            this.skipNewlines();
            while (!this.match('dedent', 'eof')) {
              const dispatchLoopStart = this.position;
              if (this.match('when')) {
                this.advance();
                const value = this.expect('identifier').value as string;
                this.expect('arrow');
                const contract = this.expect('identifier').value as string;
                cases.push({
                  kind: 'dispatchCase',
                  value,
                  contract,
                });
              } else {
                this.advance();
              }
              this.skipNewlines();
              if (this.position === dispatchLoopStart) this.advance();
            }
            if (this.match('dedent')) this.advance();
          }

          dispatch = {
            kind: 'dispatch',
            field: dispatchField,
            cases,
          };
        } else {
          this.advance();
        }

        this.skipNewlines();
        // Safety: prevent infinite loop
        if (this.position === loopStart) this.advance();
      }

      if (this.match('dedent')) this.advance();
    }

    return {
      kind: 'contract',
      name,
      docComment,
      inputs,
      requires,
      ensures,
      onFailure,
      examples,
      effects,
      dependsOn,
      timeout,
      retry,
      rateLimit,
      steps,
      compensate,
      deprecated,
      dispatch,
    };
  }

  private parseGivenBlock(): { [key: string]: unknown } {
    const result: { [key: string]: unknown } = {};

    this.skipNewlines();
    if (this.match('indent')) {
      this.advance();
      this.skipNewlines();

      while (!this.match('dedent', 'eof')) {
        const key = this.expect('identifier').value as string;
        this.expect('colon');

        let value: unknown = null;
        if (this.match('lbrace')) {
          // Parse object literal
          this.advance();
          const obj: { [k: string]: unknown } = {};
          while (!this.match('rbrace', 'eof')) {
            const objKey = this.expect('identifier').value as string;
            this.expect('colon');
            const objValue = this.parseValue();
            obj[objKey] = objValue;
            if (this.match('comma')) this.advance();
          }
          this.expect('rbrace');
          value = obj;
        } else if (this.match('lbracket')) {
          // Parse array literal
          this.advance();
          const arr: unknown[] = [];
          while (!this.match('rbracket', 'eof')) {
            arr.push(this.parseValue());
            if (this.match('comma')) this.advance();
          }
          this.expect('rbracket');
          value = arr;
        } else {
          value = this.parseValue();
        }

        result[key] = value;
        this.skipNewlines();
      }

      this.advance(); // dedent
    }

    return result;
  }

  private parseValue(): unknown {
    if (this.match('string')) {
      return this.advance().value;
    } else if (this.match('integer', 'decimal')) {
      return this.advance().value;
    } else if (this.match('true')) {
      this.advance();
      return true;
    } else if (this.match('false')) {
      this.advance();
      return false;
    } else if (this.match('identifier')) {
      return this.advance().value;
    } else if (this.match('lbrace')) {
      this.advance();
      const obj: { [k: string]: unknown } = {};
      while (!this.match('rbrace', 'eof')) {
        const valueLoopStart = this.position;
        const key = this.expect('identifier').value as string;
        this.expect('colon');
        obj[key] = this.parseValue();
        if (this.match('comma')) this.advance();
        // Safety guard against infinite loop
        if (this.position === valueLoopStart) this.advance();
      }
      if (this.match('rbrace')) this.advance();
      return obj;
    }
    return null;
  }

  private parseBehaviorDef(): BehaviorDef {
    this.expect('behavior');
    const name = this.expect('identifier').value as string;
    this.skipNewlines();

    let behaviorDoc: string | undefined;
    if (this.match('docComment')) {
      behaviorDoc = this.advance().value as string;
      this.skipNewlines();
    }

    const states: State[] = [];
    let initialState = '';
    const transitions: Transition[] = [];
    const invariants: Assertion[] = [];
    const forbidden: ForbiddenTransition[] = [];
    const examples: FlowExample[] = [];

    if (this.match('indent')) {
      this.advance();
      this.skipNewlines();

      while (!this.match('dedent', 'eof')) {
        const behaviorLoopStart = this.position;
        if (this.match('states')) {
          this.advance();
          this.skipNewlines();
          if (this.match('indent')) {
            this.advance();
            this.skipNewlines();
            while (!this.match('dedent', 'eof')) {
              const stateName = this.expect('identifier').value as string;

              let stateDocComment: string | undefined;
              if (this.match('docComment')) {
                stateDocComment = this.advance().value as string;
              }

              states.push({
                kind: 'state',
                name: stateName,
                docComment: stateDocComment,
              });

              this.skipNewlines();
            }
            this.advance(); // dedent
          }
        } else if (this.match('initial')) {
          this.advance();
          initialState = this.expect('identifier').value as string;
          this.skipNewlines();
        } else if (this.match('transitions')) {
          this.advance();
          this.skipNewlines();
          if (this.match('indent')) {
            this.advance();
            this.skipNewlines();
            while (!this.match('dedent', 'eof')) {
              const from = this.expect('identifier').value as string;
              this.expect('arrow');
              const to = this.expect('identifier').value as string;

              const whens: string[] = [];
              const transEnsures: Assertion[] = [];

              this.skipNewlines();
              if (this.match('indent')) {
                this.advance();
                this.skipNewlines();

                while (!this.match('dedent', 'eof')) {
                  if (this.match('when')) {
                    this.advance();
                    const whenExpr = this.collectUntilKeyword();
                    whens.push(whenExpr);
                    this.skipNewlines();
                  } else if (this.match('ensures')) {
                    this.advance();
                    this.skipNewlines();
                    while (!this.match('dedent', 'when', 'ensures', 'eof')) {
                      const expr = this.collectUntilKeyword();
                      if (!expr) { this.advance(); this.skipNewlines(); continue; }
                      const transEnsAssertion: Assertion = { kind: 'assertion', expression: expr };
                      const parsedTransEns = this.tryParseExpression(expr);
                      if (parsedTransEns) transEnsAssertion.parsedExpression = parsedTransEns;
                      transEnsures.push(transEnsAssertion);
                      this.skipNewlines();
                    }
                  } else {
                    this.advance(); // skip unknown token to avoid infinite loop
                    this.skipNewlines();
                  }
                }

                this.advance(); // dedent
              }

              transitions.push({
                kind: 'transition',
                from,
                to,
                when: whens,
                ensures: transEnsures,
              });

              this.skipNewlines();
            }
            this.advance(); // dedent
          }
        } else if (this.match('invariants')) {
          this.advance();
          this.skipNewlines();
          if (this.match('indent')) {
            this.advance();
            this.skipNewlines();
            while (!this.match('dedent', 'eof')) {
              const expr = this.collectUntilKeyword();
              const invAssertion: Assertion = { kind: 'assertion', expression: expr };
              const parsedInv = this.tryParseExpression(expr);
              if (parsedInv) invAssertion.parsedExpression = parsedInv;
              invariants.push(invAssertion);
              this.skipNewlines();
            }
            this.advance(); // dedent
          }
        } else if (this.match('forbidden')) {
          this.advance();
          this.skipNewlines();
          if (this.match('indent')) {
            this.advance();
            this.skipNewlines();
            while (!this.match('dedent', 'eof')) {
              const from = this.expect('identifier').value as string;
              this.expect('arrow');
              const to = this.expect('identifier').value as string;

              let forbiddenDocComment: string | undefined;
              if (this.match('docComment')) {
                forbiddenDocComment = this.advance().value as string;
              }

              forbidden.push({
                kind: 'forbiddenTransition',
                from,
                to,
                docComment: forbiddenDocComment,
              });

              this.skipNewlines();
            }
            this.advance(); // dedent
          }
        } else if (this.match('flow')) {
          this.advance();
          const flowName = this.expect('string').value as string;
          this.skipNewlines();

          const path: string[] = [];
          if (this.match('indent')) {
            this.advance();
            this.skipNewlines();
            while (!this.match('dedent', 'eof')) {
              const state = this.expect('identifier').value as string;
              path.push(state);
              if (this.match('arrow')) {
                this.advance();
              }
              this.skipNewlines();
            }
            this.advance(); // dedent
          }

          examples.push({
            kind: 'flowExample',
            name: flowName,
            path,
          });
        } else {
          this.advance();
        }

        this.skipNewlines();
        if (this.position === behaviorLoopStart) this.advance();
      }

      if (this.match('dedent')) this.advance();
    }

    return {
      kind: 'behavior',
      name,
      docComment: behaviorDoc,
      states,
      initialState,
      transitions,
      invariants,
      forbidden,
      examples,
    };
  }

  /**
   * Try to parse a collected expression string into an Expression AST.
   * Returns undefined if parsing fails — string fallback is used.
   */
  private tryParseExpression(expr: string): Expression | undefined {
    try {
      const parser = new ExpressionParser(expr);
      return parser.parseOr();
    } catch {
      return undefined;
    }
  }
}

class ExpressionParser {
  private tokens: string[];
  private pos: number = 0;

  constructor(input: string) {
    this.tokens = this.tokenize(input);
  }

  private tokenize(input: string): string[] {
    const result: string[] = [];
    let i = 0;
    while (i < input.length) {
      const c = input[i];
      if (/\s/.test(c)) { i++; continue; }
      // Multi-char operators
      if ((c === '=' || c === '!' || c === '<' || c === '>') && input[i+1] === '=') {
        result.push(c + '='); i += 2; continue;
      }
      // Single-char operators
      if ('()+-*/<>'.includes(c)) {
        result.push(c); i++; continue;
      }
      // String literals
      if (c === '"') {
        let s = c; i++;
        while (i < input.length && input[i] !== '"') { s += input[i]; i++; }
        if (i < input.length) { s += input[i]; i++; }
        result.push(s); continue;
      }
      // Regex literals
      if (c === '/') {
        let s = c; i++;
        while (i < input.length && input[i] !== '/') { s += input[i]; i++; }
        if (i < input.length) { s += input[i]; i++; }
        result.push(s); continue;
      }
      // Identifiers, numbers, dotted paths
      let token = '';
      while (i < input.length && /[\w.]/.test(input[i])) {
        token += input[i]; i++;
      }
      if (token) { result.push(token); continue; }
      // Unknown — skip
      i++;
    }
    return result;
  }

  private peek(): string | undefined { return this.tokens[this.pos]; }
  private consume(): string | undefined { return this.tokens[this.pos++]; }

  parseOr(): Expression {
    let left = this.parseAnd();
    while (this.peek() === 'or' || this.peek() === '||') {
      const op = this.consume()!;
      const right = this.parseAnd();
      left = { kind: 'binary', op, left, right };
    }
    return left;
  }

  parseAnd(): Expression {
    let left = this.parseEquality();
    while (this.peek() === 'and' || this.peek() === '&&') {
      const op = this.consume()!;
      const right = this.parseEquality();
      left = { kind: 'binary', op, left, right };
    }
    return left;
  }

  parseEquality(): Expression {
    let left = this.parseComparison();
    while (this.peek() === '==' || this.peek() === '!=') {
      const op = this.consume()!;
      const right = this.parseComparison();
      left = { kind: 'binary', op, left, right };
    }
    return left;
  }

  parseComparison(): Expression {
    let left = this.parseAdditive();
    while (this.peek() === '<' || this.peek() === '<=' || this.peek() === '>' || this.peek() === '>=') {
      const op = this.consume()!;
      const right = this.parseAdditive();
      left = { kind: 'binary', op, left, right };
    }
    return left;
  }

  parseAdditive(): Expression {
    let left = this.parseMultiplicative();
    while (this.peek() === '+' || this.peek() === '-') {
      const op = this.consume()!;
      const right = this.parseMultiplicative();
      left = { kind: 'binary', op, left, right };
    }
    return left;
  }

  parseMultiplicative(): Expression {
    let left = this.parseUnary();
    while (this.peek() === '*' || this.peek() === '/') {
      const op = this.consume()!;
      const right = this.parseUnary();
      left = { kind: 'binary', op, left, right };
    }
    return left;
  }

  parseUnary(): Expression {
    if (this.peek() === 'not' || this.peek() === '!' || this.peek() === '-') {
      const op = this.consume()!;
      const operand = this.parseUnary();
      return { kind: 'unary', op, operand };
    }
    return this.parsePrimary();
  }

  parsePrimary(): Expression {
    const tok = this.consume();
    if (!tok) throw new Error('Unexpected end of expression');

    if (tok === '(') {
      const expr = this.parseOr();
      if (this.consume() !== ')') throw new Error('Expected )');
      return expr;
    }

    if (/^-?\d+(\.\d+)?$/.test(tok)) {
      return { kind: 'literal', value: parseFloat(tok) };
    }

    if (tok.startsWith('"') && tok.endsWith('"')) {
      return { kind: 'literal', value: tok.slice(1, -1) };
    }

    if (tok === 'true') return { kind: 'literal', value: true };
    if (tok === 'false') return { kind: 'literal', value: false };

    if (this.peek() === '(') {
      this.consume(); // (
      const args: Expression[] = [];
      if (this.peek() !== ')') {
        args.push(this.parseOr());
        while (this.peek() === ',') {
          this.consume();
          args.push(this.parseOr());
        }
      }
      if (this.consume() !== ')') throw new Error('Expected )');
      return { kind: 'call', callee: tok, args };
    }

    if (tok.includes('.')) {
      const parts = tok.split('.');
      let expr: Expression = { kind: 'ident', name: parts[0] };
      for (let i = 1; i < parts.length; i++) {
        expr = { kind: 'member', object: expr, property: parts[i] };
      }
      return expr;
    }

    return { kind: 'ident', name: tok };
  }
}

export function parse(tokens: Token[]): AriaModule {
  const parser = new Parser(tokens);
  return parser.parse();
}

export function parseFile(source: string): AriaModule {
  const tokens = tokenize(source);
  const parser = new Parser(tokens);
  parser.setSource(source);
  return parser.parse();
}
