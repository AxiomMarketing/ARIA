/**
 * ARIA Abstract Syntax Tree (AST) Types
 * Complete TypeScript representation of the ARIA specification language
 */

// ============================================================================
// MODULE LEVEL
// ============================================================================

export interface Import {
  kind: "import";
  types: string[];  // e.g., ["Money", "AccountId"]
  from: string;     // e.g., "payment.aria"
}

export interface AriaModule {
  kind: "module";
  name: string;
  version: string;
  targets: string[]; // typescript, rust, python, etc.
  author?: string;
  imports?: Import[];
  supersedes?: { module: string; version: string };
  body: (TypeDef | ContractDef | BehaviorDef)[];
}

// ============================================================================
// TYPES
// ============================================================================

export type TypeBase =
  | "Integer"
  | "Decimal"
  | "String"
  | "Boolean"
  | "DateTime"
  | "Record"
  | "Enum"
  | "List";

export interface TypeDef {
  kind: "type";
  name: string;
  base: TypeBase;
  whereClauses: WhereClause[];
  unit?: string; // e.g., "cents", "seconds"
  fields?: RecordField[]; // for Record
  variants?: EnumVariant[]; // for Enum
  elementType?: TypeReference; // for List
  docComment?: string;
  typeParams?: string[]; // Generic parameters, e.g., ["T", "E"] for `type Result of T, E is Enum`
}

// ============================================================================
// EXPRESSIONS (optional AST representation)
// ============================================================================

export type Expression =
  | BinaryExpr
  | UnaryExpr
  | MemberExpr
  | CallExpr
  | LiteralExpr
  | IdentExpr;

export interface BinaryExpr {
  kind: "binary";
  op: string; // ==, !=, <, <=, >, >=, +, -, *, /, &&, ||, and, or
  left: Expression;
  right: Expression;
}

export interface UnaryExpr {
  kind: "unary";
  op: string; // !, -, not
  operand: Expression;
}

export interface MemberExpr {
  kind: "member";
  object: Expression;
  property: string;
}

export interface CallExpr {
  kind: "call";
  callee: string; // old, length, now, etc
  args: Expression[];
}

export interface LiteralExpr {
  kind: "literal";
  value: string | number | boolean;
}

export interface IdentExpr {
  kind: "ident";
  name: string;
}

export interface WhereClause {
  kind: "where";
  expression: string; // e.g., "self > 0", "length(self) <= 255", "self matches /regex/"
  parsedExpression?: Expression;
}

export interface RecordField {
  kind: "field";
  name: string;
  type: TypeReference;
  docComment?: string;
  computed?: string; // Phase 7.2: raw expression string for `computed as <expr>`
}

export interface EnumVariant {
  kind: "variant";
  name: string;
  docComment?: string;
}

export interface TypeReference {
  kind: "typeRef";
  name: string;
  isOptional?: boolean;
  typeArgs?: TypeReference[]; // Generic instantiation: Result of Money, Error → typeArgs=[Money, Error]
}

// ============================================================================
// CONTRACTS
// ============================================================================

export interface DispatchCase {
  kind: "dispatchCase";
  value: string;     // The value to match on, e.g., "card", "bank_transfer"
  contract: string;  // The contract to delegate to, e.g., "ProcessCardPayment"
}

export interface DispatchRule {
  kind: "dispatch";
  field: string;          // The input field to dispatch on, e.g., "method"
  cases: DispatchCase[];  // The match cases
}

export interface ContractDef {
  kind: "contract";
  name: string;
  docComment?: string;
  inputs: Input[];
  requires: Assertion[];
  ensures: Assertion[];
  onFailure: FailureCase[];
  examples: Example[];
  effects?: Effect[];
  dependsOn?: Dependency[];
  timeout?: TimeoutPolicy;
  retry?: RetryPolicy;
  rateLimit?: RateLimitPolicy;
  steps?: Step[];
  compensate?: CompensateRule[];
  deprecated?: string; // Reason string from `deprecated "..."` clause
  dispatch?: DispatchRule; // Phase 7.3: polymorphic dispatch on input field
}

export interface Input {
  kind: "input";
  name: string;
  type: TypeReference;
  docComment?: string;
}

export interface Assertion {
  kind: "assertion";
  expression: string; // e.g., "from.balance >= amount", "result.success == true"
  parsedExpression?: Expression;
}

export interface FailureCase {
  kind: "failureCase";
  when: string; // condition, e.g., "from.balance < amount"
  return: {
    type: string; // error type, e.g., "InsufficientFunds"
    fields?: { [key: string]: string }; // optional fields to return with error
  };
}

export interface Example {
  kind: "example";
  name?: string;
  given: { [key: string]: unknown }; // input record literal
  then: Assertion[]; // expected postconditions
}

export interface Effect {
  kind: "effect";
  action: "sends" | "writes" | "creates" | "reads" | "deletes";
  target: string; // e.g., "Email", "AuditLog"
  details?: { [key: string]: string }; // optional metadata
}

export interface Dependency {
  kind: "dependency";
  name: string; // e.g., "EmailService", "Database"
  docComment?: string;
}

export interface TimeoutPolicy {
  kind: "timeout";
  value: number;
  unit: "second" | "minute" | "hour" | "day";
}

export interface RetryPolicy {
  kind: "retry";
  max: number;
  backoff: "exponential" | "linear" | "constant";
  onExhaust?: string; // what to return when retries exhausted
}

export interface RateLimitPolicy {
  kind: "rateLimit";
  limits: {
    max: number;
    period: "second" | "minute" | "hour" | "day";
    perKey?: string; // e.g., "per ip_address", "per email"
  }[];
}

export interface Step {
  kind: "step";
  number: number;
  contract: string; // contract name to invoke
  inputs: { [key: string]: string }; // input bindings
  resultName: string; // variable to bind result
}

export interface CompensateRule {
  kind: "compensate";
  onStepFailure: number;
  afterStepSuccess: number;
  action: string; // contract to call for compensation
}

// ============================================================================
// BEHAVIORS (STATE MACHINES)
// ============================================================================

export interface BehaviorDef {
  kind: "behavior";
  name: string;
  docComment?: string;
  states: State[];
  initialState: string;
  transitions: Transition[];
  invariants: Assertion[];
  forbidden: ForbiddenTransition[];
  examples: FlowExample[];
}

export interface State {
  kind: "state";
  name: string;
  docComment?: string;
}

export interface Transition {
  kind: "transition";
  from: string;
  to: string;
  when: string[]; // list of conditions
  ensures: Assertion[];
}

export interface ForbiddenTransition {
  kind: "forbiddenTransition";
  from: string;
  to: string;
  docComment?: string;
}

export interface FlowExample {
  kind: "flowExample";
  name: string;
  path: string[]; // sequence of state names, e.g., ["draft", "confirmed", "paid"]
}

// ============================================================================
// COMPOSITION & HELPERS
// ============================================================================

export type AstNode =
  | AriaModule
  | Import
  | TypeDef
  | ContractDef
  | BehaviorDef
  | WhereClause
  | RecordField
  | EnumVariant
  | TypeReference
  | Input
  | Assertion
  | FailureCase
  | Example
  | Effect
  | Dependency
  | TimeoutPolicy
  | RetryPolicy
  | RateLimitPolicy
  | Step
  | CompensateRule
  | State
  | Transition
  | ForbiddenTransition
  | FlowExample
  | Expression;

export interface Location {
  line: number;
  column: number;
}

export interface AstError {
  message: string;
  location: Location;
  context?: string;
}
