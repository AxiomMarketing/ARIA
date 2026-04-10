/**
 * ARIA — AI-Readable Intent Architecture
 * A formal specification language for AI-driven development
 */

export * from "./ast.js";
export * from "./errors.js";
export { tokenize, Lexer } from "./lexer.js";
export { parse, parseFile } from "./parser.js";
export { generateTypeScript } from "./generators/typescript.js";
export { generateMermaid, generateMermaidDoc } from "./generators/mermaid.js";
export { generateTests } from "./generators/tests.js";
export { generateRust } from "./generators/rust.js";
export type { GeneratedFile as RustGeneratedFile } from "./generators/rust.js";
export { generatePython } from "./generators/python.js";
export type { GeneratedFile as PythonGeneratedFile } from "./generators/python.js";
export { generateJsonSchema } from "./generators/jsonschema.js";
export type { GeneratedFile as JsonSchemaGeneratedFile } from "./generators/jsonschema.js";
export { check, formatCheckResult } from "./checker.js";
export type { CheckResult, CheckIssue } from "./checker.js";
export { buildImplementPrompt } from "./prompt.js";
export type { PromptContext } from "./prompt.js";
export { createProvider } from "./providers/index.js";
export type { AIProvider, GenerateOptions, ProviderName } from "./providers/index.js";
export { runInit } from "./commands/init.js";
export { runWatch } from "./commands/watch.js";
export { runFormat, formatAria } from "./commands/fmt.js";
