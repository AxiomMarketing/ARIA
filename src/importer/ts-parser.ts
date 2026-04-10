/**
 * TypeScript source parser using the official TypeScript Compiler API.
 * Extracts types, interfaces, enums, classes, and exported functions from a
 * .ts file into a structured representation that the ARIA emitter can consume.
 *
 * Used by:
 *   - `aria import` (Phase 10.1) — generates .aria skeletons from existing TS code
 *   - `aria drift` (Phase 10.2) — compares spec with actual implementation
 */

import * as ts from "typescript";
import { readFileSync } from "node:fs";

// ============================================================================
// Public types
// ============================================================================

export interface ExtractedField {
  name: string;
  typeName: string;       // serialized type, e.g. "string", "number", "Money", "string[]"
  optional: boolean;
  jsdoc?: string;
}

export interface ExtractedRecord {
  kind: "record";
  name: string;
  fields: ExtractedField[];
  jsdoc?: string;
}

export interface ExtractedEnum {
  kind: "enum";
  name: string;
  variants: string[];
  jsdoc?: string;
}

export interface ExtractedTypeAlias {
  kind: "alias";
  name: string;
  base: string; // serialized type
  jsdoc?: string;
}

export type ExtractedType = ExtractedRecord | ExtractedEnum | ExtractedTypeAlias;

export interface ExtractedFunction {
  kind: "function";
  name: string;
  parameters: ExtractedField[];
  returnType: string;
  isAsync: boolean;
  jsdoc?: string;
  /** Detected throws — used to infer requires/on_failure */
  throws: string[];
}

export interface ExtractedSourceFile {
  filePath: string;
  types: ExtractedType[];
  functions: ExtractedFunction[];
  /** Heuristically detected state machines: an enum + functions that switch on it */
  behaviors: { name: string; states: string[]; transitions: string[] }[];
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Parse a TypeScript file and extract its structural elements.
 * Throws if the file does not exist or cannot be parsed.
 */
export function parseTsFile(filePath: string): ExtractedSourceFile {
  const source = readFileSync(filePath, "utf-8");
  return parseTsSource(source, filePath);
}

/**
 * Parse a TypeScript source string. Useful for testing and for the MCP server.
 */
export function parseTsSource(source: string, filePath: string = "anonymous.ts"): ExtractedSourceFile {
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.ES2022,
    /* setParentNodes */ true,
    ts.ScriptKind.TS
  );

  const types: ExtractedType[] = [];
  const functions: ExtractedFunction[] = [];

  function visit(node: ts.Node) {
    // interface Foo { ... }
    if (ts.isInterfaceDeclaration(node)) {
      types.push(extractInterface(node));
    }
    // type Foo = { ... } | type Foo = "a" | "b"
    else if (ts.isTypeAliasDeclaration(node)) {
      const extracted = extractTypeAlias(node);
      if (extracted) types.push(extracted);
    }
    // enum Foo { A, B, C }
    else if (ts.isEnumDeclaration(node)) {
      types.push(extractEnum(node));
    }
    // export function foo(...) { ... }
    else if (ts.isFunctionDeclaration(node) && hasExportModifier(node)) {
      const fn = extractFunction(node);
      if (fn) functions.push(fn);
    }
    // export const foo = (...) => { ... }
    else if (ts.isVariableStatement(node) && hasExportModifier(node)) {
      for (const decl of node.declarationList.declarations) {
        if (decl.initializer && (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer))) {
          const fn = extractArrowFunction(decl);
          if (fn) functions.push(fn);
        }
      }
    }
    // class Foo { ... }
    else if (ts.isClassDeclaration(node) && hasExportModifier(node) && node.name) {
      types.push(extractClass(node));
      // Public methods become extracted functions too
      for (const member of node.members) {
        if (ts.isMethodDeclaration(member) && isPublicMethod(member)) {
          const method = extractMethod(member, node.name.text);
          if (method) functions.push(method);
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  // Heuristic: detect state machines
  const behaviors = detectStateMachines(types, functions);

  return {
    filePath,
    types,
    functions,
    behaviors,
  };
}

// ============================================================================
// Extractors
// ============================================================================

function extractInterface(node: ts.InterfaceDeclaration): ExtractedRecord {
  const fields: ExtractedField[] = [];
  for (const member of node.members) {
    if (ts.isPropertySignature(member) && member.name && ts.isIdentifier(member.name)) {
      fields.push({
        name: member.name.text,
        typeName: member.type ? typeNodeToString(member.type) : "unknown",
        optional: !!member.questionToken,
        jsdoc: getJsDoc(member),
      });
    }
  }
  return {
    kind: "record",
    name: node.name.text,
    fields,
    jsdoc: getJsDoc(node),
  };
}

function extractTypeAlias(node: ts.TypeAliasDeclaration): ExtractedType | null {
  const name = node.name.text;

  // type Foo = "a" | "b" | "c"  → enum
  if (ts.isUnionTypeNode(node.type) && node.type.types.every(isStringLiteralType)) {
    const variants = node.type.types
      .map((t) => (ts.isLiteralTypeNode(t) && ts.isStringLiteral(t.literal) ? t.literal.text : ""))
      .filter(Boolean);
    return {
      kind: "enum",
      name,
      variants,
      jsdoc: getJsDoc(node),
    };
  }

  // type Foo = { ... }  → record
  if (ts.isTypeLiteralNode(node.type)) {
    const fields: ExtractedField[] = [];
    for (const member of node.type.members) {
      if (ts.isPropertySignature(member) && member.name && ts.isIdentifier(member.name)) {
        fields.push({
          name: member.name.text,
          typeName: member.type ? typeNodeToString(member.type) : "unknown",
          optional: !!member.questionToken,
          jsdoc: getJsDoc(member),
        });
      }
    }
    return {
      kind: "record",
      name,
      fields,
      jsdoc: getJsDoc(node),
    };
  }

  // type Foo = SomethingElse  → alias
  return {
    kind: "alias",
    name,
    base: typeNodeToString(node.type),
    jsdoc: getJsDoc(node),
  };
}

function extractEnum(node: ts.EnumDeclaration): ExtractedEnum {
  const variants = node.members
    .map((m) => (m.name && ts.isIdentifier(m.name) ? m.name.text : ""))
    .filter(Boolean);
  return {
    kind: "enum",
    name: node.name.text,
    variants,
    jsdoc: getJsDoc(node),
  };
}

function extractClass(node: ts.ClassDeclaration): ExtractedRecord {
  const name = node.name?.text || "AnonymousClass";
  const fields: ExtractedField[] = [];
  for (const member of node.members) {
    if (ts.isPropertyDeclaration(member) && member.name && ts.isIdentifier(member.name)) {
      const isPublic = !member.modifiers?.some(
        (m) => m.kind === ts.SyntaxKind.PrivateKeyword || m.kind === ts.SyntaxKind.ProtectedKeyword
      );
      if (isPublic) {
        fields.push({
          name: member.name.text,
          typeName: member.type ? typeNodeToString(member.type) : "unknown",
          optional: !!member.questionToken,
          jsdoc: getJsDoc(member),
        });
      }
    }
  }
  return {
    kind: "record",
    name,
    fields,
    jsdoc: getJsDoc(node),
  };
}

function extractFunction(node: ts.FunctionDeclaration): ExtractedFunction | null {
  if (!node.name) return null;
  return {
    kind: "function",
    name: node.name.text,
    parameters: node.parameters.map(extractParameter),
    returnType: node.type ? typeNodeToString(node.type) : "unknown",
    isAsync: !!node.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword),
    jsdoc: getJsDoc(node),
    throws: detectThrows(node.body),
  };
}

function extractArrowFunction(decl: ts.VariableDeclaration): ExtractedFunction | null {
  if (!ts.isIdentifier(decl.name)) return null;
  const init = decl.initializer;
  if (!init || (!ts.isArrowFunction(init) && !ts.isFunctionExpression(init))) return null;

  return {
    kind: "function",
    name: decl.name.text,
    parameters: init.parameters.map(extractParameter),
    returnType: init.type ? typeNodeToString(init.type) : "unknown",
    isAsync: !!init.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword),
    jsdoc: getJsDoc(decl.parent.parent),
    throws: detectThrows(init.body),
  };
}

function extractMethod(node: ts.MethodDeclaration, className: string): ExtractedFunction | null {
  if (!node.name || !ts.isIdentifier(node.name)) return null;
  return {
    kind: "function",
    name: `${className}_${node.name.text}`,
    parameters: node.parameters.map(extractParameter),
    returnType: node.type ? typeNodeToString(node.type) : "unknown",
    isAsync: !!node.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword),
    jsdoc: getJsDoc(node),
    throws: detectThrows(node.body),
  };
}

function extractParameter(param: ts.ParameterDeclaration): ExtractedField {
  const name = ts.isIdentifier(param.name) ? param.name.text : "_unknown";
  return {
    name,
    typeName: param.type ? typeNodeToString(param.type) : "unknown",
    optional: !!param.questionToken || !!param.initializer,
  };
}

// ============================================================================
// Helpers
// ============================================================================

function hasExportModifier(node: ts.Node): boolean {
  const modifiers = (node as any).modifiers as ts.ModifiersArray | undefined;
  return !!modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
}

function isPublicMethod(method: ts.MethodDeclaration): boolean {
  return !method.modifiers?.some(
    (m) => m.kind === ts.SyntaxKind.PrivateKeyword || m.kind === ts.SyntaxKind.ProtectedKeyword
  );
}

function isStringLiteralType(t: ts.TypeNode): boolean {
  return ts.isLiteralTypeNode(t) && ts.isStringLiteral(t.literal);
}

function getJsDoc(node: ts.Node | undefined): string | undefined {
  if (!node) return undefined;
  // ts.getJSDocCommentsAndTags returns nodes; we want the comment text
  const tags = ts.getJSDocCommentsAndTags(node);
  if (tags.length === 0) return undefined;
  for (const tag of tags) {
    if (ts.isJSDoc(tag) && tag.comment) {
      return typeof tag.comment === "string" ? tag.comment : tag.comment.map((c) => c.text).join(" ");
    }
  }
  return undefined;
}

function typeNodeToString(node: ts.TypeNode): string {
  // Use the printer to serialize the type node back to its source representation
  const printer = ts.createPrinter({ removeComments: true });
  const sourceFile = ts.createSourceFile("temp.ts", "", ts.ScriptTarget.ES2022);
  return printer.printNode(ts.EmitHint.Unspecified, node, sourceFile);
}

function detectThrows(body: ts.Node | undefined): string[] {
  if (!body) return [];
  const throws: string[] = [];

  function walk(node: ts.Node) {
    if (ts.isThrowStatement(node) && node.expression) {
      // throw new ErrorType(...) → "ErrorType"
      if (ts.isNewExpression(node.expression) && node.expression.expression && ts.isIdentifier(node.expression.expression)) {
        throws.push(node.expression.expression.text);
      }
      // throw "string"
      else if (ts.isStringLiteral(node.expression)) {
        throws.push(node.expression.text);
      }
    }
    ts.forEachChild(node, walk);
  }

  walk(body);
  return throws;
}

// ============================================================================
// State machine detection (heuristic)
// ============================================================================

function detectStateMachines(
  types: ExtractedType[],
  functions: ExtractedFunction[]
): { name: string; states: string[]; transitions: string[] }[] {
  const machines: { name: string; states: string[]; transitions: string[] }[] = [];

  // Heuristic: an enum named *State or *Status with at least 3 variants is likely a state machine
  for (const type of types) {
    if (type.kind === "enum" && type.variants.length >= 3 && /State|Status|Phase|Step/.test(type.name)) {
      machines.push({
        name: type.name.replace(/State|Status$/, "Lifecycle") || `${type.name}Behavior`,
        states: type.variants,
        transitions: [], // We do not detect transitions automatically — left as TODO in the .aria
      });
    }
  }

  return machines;
}
