/**
 * ARIA Semantic Checker
 * Validates an AriaModule for type/state/contract references and duplicates.
 */

import type {
  AriaModule,
  TypeDef,
  ContractDef,
  BehaviorDef,
} from "./ast.js";

export interface CheckIssue {
  severity: "error" | "warning";
  message: string;
  location?: { line: number; column: number };
  hint?: string;
}

export interface CheckResult {
  errors: CheckIssue[];
  warnings: CheckIssue[];
  ok: boolean;
}

export interface CheckOptions {
  /**
   * Optional function to resolve an import path and return the set of type
   * names exported by that module. When provided, the checker validates that
   * each imported type actually exists in the source file.
   */
  resolveImport?: (fromPath: string) => Set<string> | null;
}

const PRIMITIVE_TYPES = new Set([
  "Integer", "Decimal", "String", "Boolean", "DateTime",
  "Record", "Enum", "List",
]);

export function check(module: AriaModule, options: CheckOptions = {}): CheckResult {
  const errors: CheckIssue[] = [];
  const warnings: CheckIssue[] = [];

  const types = module.body.filter((n): n is TypeDef => n.kind === "type");
  const contracts = module.body.filter((n): n is ContractDef => n.kind === "contract");
  const behaviors = module.body.filter((n): n is BehaviorDef => n.kind === "behavior");

  // Build type/contract name registries
  const typeNames = new Set(types.map((t) => t.name));
  const contractNames = new Set(contracts.map((c) => c.name));

  // Build imported types set + validate cross-file references
  const importedTypes = new Set<string>();
  if (module.imports) {
    for (const imp of module.imports) {
      // Cross-file validation: if resolveImport is provided, check that each
      // imported type name actually exists in the source module.
      if (options.resolveImport) {
        const exportedTypes = options.resolveImport(imp.from);
        if (exportedTypes) {
          for (const t of imp.types) {
            if (!exportedTypes.has(t)) {
              errors.push({
                severity: "error",
                message: `Import error: type "${t}" not found in "${imp.from}"`,
                hint: `Exported types: ${[...exportedTypes].join(", ") || "(none)"}`,
              });
            }
          }
        }
      }
      for (const t of imp.types) {
        importedTypes.add(t);
      }
    }
  }

  // 1. Duplicate detection
  const seenTypes = new Set<string>();
  for (const t of types) {
    if (seenTypes.has(t.name)) {
      errors.push({
        severity: "error",
        message: `Duplicate type definition: ${t.name}`,
      });
    }
    seenTypes.add(t.name);
  }

  const seenContracts = new Set<string>();
  for (const c of contracts) {
    if (seenContracts.has(c.name)) {
      errors.push({
        severity: "error",
        message: `Duplicate contract definition: ${c.name}`,
      });
    }
    seenContracts.add(c.name);
  }

  const seenBehaviors = new Set<string>();
  for (const b of behaviors) {
    if (seenBehaviors.has(b.name)) {
      errors.push({
        severity: "error",
        message: `Duplicate behavior definition: ${b.name}`,
      });
    }
    seenBehaviors.add(b.name);
  }

  // Split a comma-separated generic arg list while respecting nested `<>`.
  // e.g., "Result<List<Money>, Error>, Foo" -> ["Result<List<Money>, Error>", "Foo"]
  const splitGenericArgs = (argsStr: string): string[] => {
    const parts: string[] = [];
    let depth = 0;
    let current = "";
    for (const ch of argsStr) {
      if (ch === "<") {
        depth++;
        current += ch;
      } else if (ch === ">") {
        depth--;
        current += ch;
      } else if (ch === "," && depth === 0) {
        parts.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    if (current.trim()) parts.push(current.trim());
    return parts;
  };

  // Helper: check if a type reference is valid
  const isValidType = (name: string): boolean => {
    // Strip List<X> wrappers (legacy path)
    const listMatch = name.match(/^List<(.+)>$/);
    if (listMatch) {
      return isValidType(listMatch[1]);
    }
    // Unwrap other generic instantiations: `Foo<A, B>` → base must be defined, args must be valid
    // Match only the outermost angle brackets to handle nested generics.
    const outerGeneric = name.match(/^([A-Za-z_]\w*)<(.+)>$/);
    if (outerGeneric) {
      const baseName = outerGeneric[1];
      const argsStr = outerGeneric[2];
      if (!PRIMITIVE_TYPES.has(baseName) && !typeNames.has(baseName) && !importedTypes.has(baseName)) {
        return false;
      }
      const args = splitGenericArgs(argsStr);
      return args.every((a) => isValidType(a));
    }
    return PRIMITIVE_TYPES.has(name) || typeNames.has(name) || importedTypes.has(name);
  };

  // Helper: check if a type reference is valid within a scope of generic params
  const isValidTypeInScope = (name: string, scope: Set<string>): boolean => {
    if (scope.has(name)) return true;
    // Unwrap generic instantiation: `Result<Money, Error>` → check base + args
    const genericMatch = name.match(/^([A-Za-z_]\w*)<(.+)>$/);
    if (genericMatch) {
      const baseName = genericMatch[1];
      const argsStr = genericMatch[2];
      if (!isValidType(baseName) && !scope.has(baseName)) return false;
      const args = splitGenericArgs(argsStr);
      return args.every((a) => isValidTypeInScope(a, scope));
    }
    return isValidType(name);
  };

  // 2. Type reference validation in type fields
  for (const t of types) {
    const scope = new Set<string>(t.typeParams ?? []);
    if (t.fields) {
      for (const f of t.fields) {
        if (!isValidTypeInScope(f.type.name, scope)) {
          errors.push({
            severity: "error",
            message: `Type "${t.name}" references unknown type "${f.type.name}" in field "${f.name}"`,
            hint: `Defined types: ${[...typeNames].join(", ") || "(none)"}`,
          });
        }
      }
    }
    if (t.elementType && !isValidTypeInScope(t.elementType.name, scope)) {
      errors.push({
        severity: "error",
        message: `List type "${t.name}" references unknown element type "${t.elementType.name}"`,
      });
    }
  }

  // 3. Type reference validation in contract inputs
  for (const c of contracts) {
    for (const inp of c.inputs) {
      if (!isValidType(inp.type.name)) {
        errors.push({
          severity: "error",
          message: `Contract "${c.name}" input "${inp.name}" references unknown type "${inp.type.name}"`,
          hint: `Defined types: ${[...typeNames].join(", ") || "(none)"}`,
        });
      }
    }

    // 4. Step contract references
    if (c.steps) {
      for (const s of c.steps) {
        if (!contractNames.has(s.contract)) {
          errors.push({
            severity: "error",
            message: `Contract "${c.name}" step ${s.number} references unknown contract "${s.contract}"`,
            hint: `Defined contracts: ${[...contractNames].join(", ") || "(none)"}`,
          });
        }
      }
    }

    // 5. Compensate references
    if (c.compensate) {
      for (const comp of c.compensate) {
        if (!contractNames.has(comp.action)) {
          errors.push({
            severity: "error",
            message: `Contract "${c.name}" compensate action references unknown contract "${comp.action}"`,
          });
        }
      }
    }

    // 5b. Dispatch validation (Phase 7.3)
    if (c.dispatch) {
      const inputNames = new Set(c.inputs.map((inp) => inp.name));
      if (!inputNames.has(c.dispatch.field)) {
        errors.push({
          severity: "error",
          message: `Contract "${c.name}" dispatch field "${c.dispatch.field}" is not in inputs`,
          hint: `Declared inputs: ${[...inputNames].join(", ") || "(none)"}`,
        });
      }
      for (const dc of c.dispatch.cases) {
        if (!contractNames.has(dc.contract)) {
          errors.push({
            severity: "error",
            message: `Contract "${c.name}" dispatch case "${dc.value}" references unknown contract "${dc.contract}"`,
            hint: `Defined contracts: ${[...contractNames].join(", ") || "(none)"}`,
          });
        }
      }
    }
  }

  // 6. Behavior validation
  for (const b of behaviors) {
    const stateNames = new Set(b.states.map((s) => s.name));

    // Initial state must exist
    if (b.initialState && !stateNames.has(b.initialState)) {
      errors.push({
        severity: "error",
        message: `Behavior "${b.name}" initial state "${b.initialState}" is not in states list`,
        hint: `Available states: ${[...stateNames].join(", ")}`,
      });
    }

    // Transitions must reference valid states
    for (const t of b.transitions) {
      if (!stateNames.has(t.from)) {
        errors.push({
          severity: "error",
          message: `Behavior "${b.name}" transition references unknown 'from' state "${t.from}"`,
        });
      }
      if (!stateNames.has(t.to)) {
        errors.push({
          severity: "error",
          message: `Behavior "${b.name}" transition references unknown 'to' state "${t.to}"`,
        });
      }
    }

    // Forbidden transitions must reference valid states
    for (const f of b.forbidden) {
      if (!stateNames.has(f.from)) {
        errors.push({
          severity: "error",
          message: `Behavior "${b.name}" forbidden references unknown 'from' state "${f.from}"`,
        });
      }
      if (!stateNames.has(f.to)) {
        errors.push({
          severity: "error",
          message: `Behavior "${b.name}" forbidden references unknown 'to' state "${f.to}"`,
        });
      }
    }

    // Forbidden vs transitions conflict
    for (const f of b.forbidden) {
      const isAlsoTransition = b.transitions.some(
        (t) => t.from === f.from && t.to === f.to
      );
      if (isAlsoTransition) {
        warnings.push({
          severity: "warning",
          message: `Behavior "${b.name}" has forbidden transition "${f.from} -> ${f.to}" that is also in transitions`,
        });
      }
    }

    // Flow examples must follow valid paths
    for (const flow of b.examples) {
      for (let i = 0; i < flow.path.length - 1; i++) {
        const from = flow.path[i];
        const to = flow.path[i + 1];
        if (!stateNames.has(from)) {
          errors.push({
            severity: "error",
            message: `Behavior "${b.name}" flow "${flow.name}" references unknown state "${from}"`,
          });
        }
        if (!stateNames.has(to)) {
          errors.push({
            severity: "error",
            message: `Behavior "${b.name}" flow "${flow.name}" references unknown state "${to}"`,
          });
        }
      }
    }

    // Warning: states with no incoming transitions (except initial)
    const reachable = new Set<string>([b.initialState]);
    for (const t of b.transitions) {
      reachable.add(t.to);
    }
    for (const s of b.states) {
      if (!reachable.has(s.name)) {
        warnings.push({
          severity: "warning",
          message: `Behavior "${b.name}" state "${s.name}" is unreachable (no incoming transitions, not initial)`,
        });
      }
    }
  }

  return {
    errors,
    warnings,
    ok: errors.length === 0,
  };
}

/**
 * Format check results for CLI output.
 */
export function formatCheckResult(result: CheckResult): string {
  const lines: string[] = [];

  for (const err of result.errors) {
    lines.push(`✗ Error: ${err.message}`);
    if (err.hint) lines.push(`  Hint: ${err.hint}`);
  }

  for (const warn of result.warnings) {
    lines.push(`⚠ Warning: ${warn.message}`);
    if (warn.hint) lines.push(`  Hint: ${warn.hint}`);
  }

  if (result.errors.length === 0 && result.warnings.length === 0) {
    lines.push("✓ No issues found");
  } else {
    lines.push("");
    lines.push(`${result.errors.length} error(s), ${result.warnings.length} warning(s)`);
  }

  return lines.join("\n");
}
