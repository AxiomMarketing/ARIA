import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";

export interface InitOptions {
  module?: string;
  output?: string;
}

const TEMPLATE = (moduleName: string) => `module ${moduleName}
  version "1.0"
  target typescript

--- Example type with constraints
type Money is Integer
  where self > 0
  where self <= 1_000_000

--- Example record
type Account is Record
  id: String
  email: String
  balance: Money

--- Example enum
type Status is Enum
  active
  frozen
  closed

--- Example contract
contract Transfer
  --- Transfers money between accounts
  inputs
    from: Account
    to: Account
    amount: Money
  requires
    from.balance >= amount
    from.status == active
  ensures
    from.balance == old(from.balance) - amount
    to.balance == old(to.balance) + amount
  on_failure
    when from.balance < amount
      return InsufficientFunds with remaining: from.balance

--- Example behavior
behavior TransferFlow
  states
    pending
    completed
    failed
  initial pending
  transitions
    pending -> completed
      when payment.status == success
    pending -> failed
      when payment.status == declined
  forbidden
    completed -> pending
    failed -> completed
`;

function kebabCase(s: string): string {
  return s.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
}

export function runInit(opts: InitOptions = {}): { path: string; module: string } {
  const moduleName = opts.module || "MyModule";
  const outputDir = opts.output || ".";
  const fileName = `${kebabCase(moduleName)}.aria`;
  const filePath = resolve(outputDir, fileName);

  if (existsSync(filePath)) {
    throw new Error(`File already exists: ${filePath}`);
  }

  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, TEMPLATE(moduleName), "utf-8");

  return { path: filePath, module: moduleName };
}
