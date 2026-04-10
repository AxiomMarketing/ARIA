/**
 * CLAUDE.md template section for ARIA-integrated user projects.
 * Injected by `aria setup` so that Claude Code naturally works with ARIA specs.
 */

export function getAriaClaudeMdSection(opts: {
  specsDir: string;
  target: string;
}): string {
  return `
## ARIA Specifications

This project uses [ARIA](https://github.com/aria-lang/aria) for formal specification-driven development. The AI must follow the spec-first workflow described below.

### Spec-first rule

**Before implementing any new feature or contract, write an \`.aria\` spec first.**
Do not write implementation code without a validated spec. The spec is the source of truth.

### Spec location

All \`.aria\` specification files are in \`${opts.specsDir}/\`.

### Workflow

1. **Write** — Create or update a \`.aria\` spec in \`${opts.specsDir}/\`
2. **Check** — Run \`npx aria check ${opts.specsDir}/\` to validate
3. **Generate** — Run \`npx aria gen ${opts.specsDir}/<file>.aria -t ${opts.target} -o src/\` to scaffold types + contracts + tests
4. **Implement** — Fill in the \`throw new Error("Not implemented")\` stubs OR use \`npx aria implement <file>.aria --ai claude -o src/\`
5. **Test** — Run the auto-generated tests to verify correctness

### Commands reference

\`\`\`bash
npx aria check ${opts.specsDir}/          # Validate all specs
npx aria gen <spec> -t ${opts.target} -o src/    # Generate code from spec
npx aria implement <spec> --ai claude -o src/    # AI-implement contracts
npx aria diagram <spec> -o docs/          # Generate Mermaid state diagrams
npx aria fmt ${opts.specsDir}/            # Format all spec files
npx aria watch ${opts.specsDir}/ --gen -o src/   # Watch + auto-regen
\`\`\`

### Key ARIA concepts

- **\`requires\`** — Preconditions the caller must satisfy
- **\`ensures\`** — Postconditions the implementation must guarantee
- **\`on_failure\`** — Explicit error cases with typed returns
- **\`examples\`** — Concrete \`given/then\` test cases (auto-compiled to tests)
- **\`behavior\`** — State machines with \`transitions\`, \`invariants\`, \`forbidden\`
- **\`dispatch\`** — Route to sub-contracts based on input values

### Rules for AI assistants

- Never modify generated files (\`*.types.ts\`, \`*.contracts.ts\`, \`*.behaviors.ts\`, \`*.test.ts\`) directly — regenerate from spec
- When a contract stub has \`throw new Error("Not implemented")\`, implement it to satisfy \`requires\`/\`ensures\`
- When adding a new feature, start by asking the user for a spec or proposing one
- Run \`npx aria check\` before committing spec changes
`.trim();
}
