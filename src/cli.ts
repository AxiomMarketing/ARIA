#!/usr/bin/env node
/**
 * ARIA CLI — aria check / gen / diagram / test
 */

import { Command } from "commander";
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync, lstatSync } from "node:fs";
import { resolve, basename, dirname, join, relative } from "node:path";
import { validatePathWithinRoot, toErrorMessage, writeFileAtomic } from "./security.js";
import { parseFile } from "./parser.js";
import { check, formatCheckResult } from "./checker.js";
import { generateTypeScript } from "./generators/typescript.js";
import { generateRust } from "./generators/rust.js";
import { generatePython } from "./generators/python.js";
import { generateJsonSchema } from "./generators/jsonschema.js";
import { generateMermaidDoc } from "./generators/mermaid.js";
import { generateTests } from "./generators/tests.js";
import { runImplement } from "./commands/implement.js";
import { runInit } from "./commands/init.js";
import { runWatch } from "./commands/watch.js";
import { runFormat, runFormatDir } from "./commands/fmt.js";
import { runSetup } from "./commands/setup.js";
import type { ProviderName } from "./providers/index.js";

const program = new Command();

program
  .name("aria")
  .description("ARIA — AI-Readable Intent Architecture compiler")
  .version("0.1.0");

// ============================================================================
// Helper: find all .aria files in a directory recursively
// ============================================================================

function findAriaFiles(dir: string): string[] {
  const results: string[] = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    console.error(`\u26a0 Skipping inaccessible directory: ${dir}`);
    return results;
  }
  for (const entry of entries) {
    // Skip symlinks to prevent traversal outside project (CWE-59)
    if (entry.isSymbolicLink()) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findAriaFiles(full));
    } else if (entry.isFile() && entry.name.endsWith(".aria")) {
      results.push(full);
    }
  }
  return results;
}

// ============================================================================
// Helper: generate files for a given target, write to outDir, return file paths
// ============================================================================

function generateForTarget(module: any, target: string, outDir: string): string[] {
  const written: string[] = [];
  if (target === "typescript") {
    const files = generateTypeScript(module);
    for (const f of files) {
      const outPath = join(outDir, f.path);
      writeFileSync(outPath, f.content, "utf-8");
      written.push(outPath);
    }
  } else if (target === "rust") {
    const files = generateRust(module);
    for (const f of files) {
      const outPath = join(outDir, f.path);
      writeFileSync(outPath, f.content, "utf-8");
      written.push(outPath);
    }
  } else if (target === "python") {
    const files = generatePython(module);
    for (const f of files) {
      const outPath = join(outDir, f.path);
      writeFileSync(outPath, f.content, "utf-8");
      written.push(outPath);
    }
  } else if (target === "jsonschema" || target === "json-schema") {
    const file = generateJsonSchema(module);
    const outPath = join(outDir, file.path);
    writeFileSync(outPath, file.content, "utf-8");
    written.push(outPath);
  } else {
    console.error(`\u2717 Unknown target: ${target}. Supported: typescript, rust, python, jsonschema`);
    process.exit(1);
  }
  return written;
}

// ============================================================================
// aria check <file>
// ============================================================================

program
  .command("check")
  .description("Verify an .aria specification file or directory")
  .argument("<file>", "Path to .aria file or directory")
  .option("--strict", "Fail on incomplete specs (missing examples, on_failure)")
  .option("--draft", "Allow incomplete specs")
  .option("--json", "Output JSON")
  .action((file: string, opts: { strict?: boolean; draft?: boolean; json?: boolean }) => {
    const resolvedPath = resolve(file);
    const isDir = existsSync(resolvedPath) && statSync(resolvedPath).isDirectory();

    if (isDir) {
      const ariaFiles = findAriaFiles(resolvedPath);
      if (ariaFiles.length === 0) {
        if (opts.json) {
          console.log(JSON.stringify({ status: "error", errors: [{ message: "No .aria files found in directory" }] }));
        } else {
          console.error("\u2717 No .aria files found in directory");
        }
        process.exit(1);
      }

      let validCount = 0;
      const fileResults: Array<{ file: string; status: string; errors?: Array<{ message: string }> }> = [];

      for (const ariaFile of ariaFiles) {
        try {
          const source = readFileSync(ariaFile, "utf-8");
          const module = parseFile(source);

          if (module.imports) {
            const baseDir = dirname(ariaFile);
            let importError: string | null = null;
            for (const imp of module.imports) {
              const importPath = resolve(baseDir, imp.from);
              if (!existsSync(importPath)) {
                importError = `Import error: file not found: ${imp.from}`;
                break;
              }
            }
            if (importError) {
              fileResults.push({ file: ariaFile, status: "error", errors: [{ message: importError }] });
              continue;
            }
          }

          const result = check(module);
          if (!result.ok) {
            fileResults.push({ file: ariaFile, status: "error", errors: result.errors.map((e: any) => ({ message: e.message || String(e) })) });
          } else {
            validCount++;
            fileResults.push({ file: ariaFile, status: "ok" });
          }
        } catch (err: any) {
          fileResults.push({ file: ariaFile, status: "error", errors: [{ message: err.message }] });
        }
      }

      if (opts.json) {
        console.log(JSON.stringify({ status: validCount === ariaFiles.length ? "ok" : "error", total: ariaFiles.length, valid: validCount, files: fileResults }));
      } else {
        console.log(`${validCount}/${ariaFiles.length} files valid`);
        for (const r of fileResults) {
          if (r.status === "ok") {
            console.log(`  \u2713 ${r.file}`);
          } else {
            console.log(`  \u2717 ${r.file}`);
            for (const e of r.errors ?? []) {
              console.log(`      ${e.message}`);
            }
          }
        }
      }
      if (validCount < ariaFiles.length) process.exit(1);
      return;
    }

    // Single file handling
    try {
      const source = readFileSync(resolvedPath, "utf-8");
      const module = parseFile(source);

      if (module.imports) {
        const baseDir = dirname(resolvedPath);
        for (const imp of module.imports) {
          const importPath = resolve(baseDir, imp.from);
          if (!existsSync(importPath)) {
            if (opts.json) {
              console.log(JSON.stringify({ status: "error", errors: [{ message: `Import error: file not found: ${imp.from}` }] }));
            } else {
              console.log(`\u2717 Import error: file not found: ${imp.from}`);
            }
            process.exit(1);
          }
        }
      }

      // Cross-file import resolution: parse imported files and check type existence
      const resolveImport = (fromPath: string): Set<string> | null => {
        try {
          const importAbsPath = resolve(dirname(resolvedPath), fromPath);
          // SEC-3: prevent path traversal via import paths (CWE-22)
          validatePathWithinRoot(importAbsPath, process.cwd(), "import");
          if (!existsSync(importAbsPath)) return null;
          const importSource = readFileSync(importAbsPath, "utf-8");
          const importModule = parseFile(importSource);
          return new Set(
            importModule.body
              .filter((n: { kind: string }) => n.kind === "type")
              .map((n: any) => n.name)
          );
        } catch {
          return null;
        }
      };

      const result = check(module, { resolveImport });
      if (!result.ok) {
        if (opts.json) {
          console.log(JSON.stringify({ status: "error", errors: result.errors.map((e: any) => ({ message: e.message || String(e) })) }));
        } else {
          console.log(formatCheckResult(result));
        }
        process.exit(1);
      }

      const types = module.body.filter((n: { kind: string }) => n.kind === "type").length;
      const contracts = module.body.filter((n: { kind: string }) => n.kind === "contract").length;
      const behaviors = module.body.filter((n: { kind: string }) => n.kind === "behavior").length;

      if (opts.json) {
        console.log(JSON.stringify({ status: "ok", module: module.name, types, contracts, behaviors }));
      } else {
        if (result.warnings.length > 0) {
          console.log(formatCheckResult(result));
        }
        console.log(`\u2713 ${basename(file)} parsed successfully`);
        console.log(`  Module: ${module.name} v${module.version}`);
        console.log(`  Targets: ${module.targets.join(", ")}`);
        console.log(`  ${types} type(s), ${contracts} contract(s), ${behaviors} behavior(s)`);
      }

      // Strict mode checks
      if (opts.strict) {
        const issues: string[] = [];
        for (const node of module.body) {
          if (node.kind === "contract") {
            if (node.examples.length === 0) {
              issues.push(`  \u2717 Contract "${node.name}" has no examples`);
            }
            if (node.onFailure.length === 0) {
              issues.push(`  \u26a0 Contract "${node.name}" has no on_failure cases`);
            }
          }
        }
        if (issues.length > 0) {
          if (opts.json) {
            console.log(JSON.stringify({ status: "error", errors: issues.map((i) => ({ message: i.trim() })) }));
          } else {
            console.log(`\nStrict mode warnings:`);
            for (const issue of issues) {
              console.log(issue);
            }
          }
          process.exit(1);
        }
      }
    } catch (err: any) {
      if (opts.json) {
        console.log(JSON.stringify({ status: "error", errors: [{ message: err.message }] }));
      } else {
        console.error(`\u2717 Parse error: ${err.message}`);
      }
      process.exit(1);
    }
  });

// ============================================================================
// aria gen <file>
// ============================================================================

program
  .command("gen")
  .description("Generate code from .aria specification or directory")
  .argument("<file>", "Path to .aria file or directory")
  .option("-o, --output <dir>", "Output directory", "./generated")
  .option("-t, --target <lang>", "Target language (typescript, rust, python, jsonschema)", "typescript")
  .option("--json", "Output JSON")
  .action((file: string, opts: { output: string; target: string; json?: boolean }) => {
    const resolvedPath = resolve(file);
    const isDir = existsSync(resolvedPath) && statSync(resolvedPath).isDirectory();

    if (isDir) {
      const ariaFiles = findAriaFiles(resolvedPath);
      if (ariaFiles.length === 0) {
        if (opts.json) {
          console.log(JSON.stringify({ status: "error", errors: [{ message: "No .aria files found in directory" }] }));
        } else {
          console.error("\u2717 No .aria files found in directory");
        }
        process.exit(1);
      }

      const allGeneratedFiles: string[] = [];
      const outDir = resolve(opts.output);

      for (const ariaFile of ariaFiles) {
        try {
          const source = readFileSync(ariaFile, "utf-8");
          const module = parseFile(source);

          const checkResult = check(module);
          if (!checkResult.ok) {
            if (opts.json) {
              console.log(JSON.stringify({ status: "error", errors: [{ message: `${ariaFile}: spec has errors` }] }));
            } else {
              console.log(`\u2717 ${ariaFile}: spec has errors`);
              console.log(formatCheckResult(checkResult));
            }
            process.exit(1);
          }

          const relDir = relative(resolvedPath, dirname(ariaFile));
          const fileOutDir = relDir ? join(outDir, relDir) : outDir;
          mkdirSync(fileOutDir, { recursive: true });

          const generatedFiles = generateForTarget(module, opts.target, fileOutDir);
          allGeneratedFiles.push(...generatedFiles);

          if (!opts.json) {
            for (const f of generatedFiles) {
              console.log(`  \u2713 ${f}`);
            }
          }
        } catch (err: any) {
          if (opts.json) {
            console.log(JSON.stringify({ status: "error", errors: [{ message: err.message }] }));
          } else {
            console.error(`\u2717 Error processing ${ariaFile}: ${err.message}`);
          }
          process.exit(1);
        }
      }

      if (opts.json) {
        console.log(JSON.stringify({ status: "ok", files: allGeneratedFiles, target: opts.target }));
      } else {
        console.log(`\n\u2713 Generated ${allGeneratedFiles.length} file(s) in ${outDir}`);
      }
      return;
    }

    // Single file handling
    try {
      const source = readFileSync(resolvedPath, "utf-8");
      const module = parseFile(source);

      const checkResult = check(module);
      if (!checkResult.ok) {
        if (opts.json) {
          console.log(JSON.stringify({ status: "error", errors: checkResult.errors.map((e: any) => ({ message: e.message || String(e) })) }));
        } else {
          console.log("\u2717 Cannot generate: spec has errors");
          console.log(formatCheckResult(checkResult));
        }
        process.exit(1);
      }

      const outDir = resolve(opts.output);
      mkdirSync(outDir, { recursive: true });

      const generatedFiles = generateForTarget(module, opts.target, outDir);

      if (opts.json) {
        console.log(JSON.stringify({ status: "ok", files: generatedFiles, target: opts.target }));
      } else {
        for (const f of generatedFiles) {
          console.log(`  \u2713 ${f}`);
        }
        console.log(`\n\u2713 Generated ${generatedFiles.length} file(s) in ${outDir}`);
      }
    } catch (err: any) {
      if (opts.json) {
        console.log(JSON.stringify({ status: "error", errors: [{ message: err.message }] }));
      } else {
        console.error(`\u2717 Error: ${err.message}`);
      }
      process.exit(1);
    }
  });

// ============================================================================
// aria diagram <file>
// ============================================================================

program
  .command("diagram")
  .description("Generate Mermaid state diagrams from .aria behaviors")
  .argument("<file>", "Path to .aria file")
  .option("-o, --output <file>", "Output markdown file")
  .option("--json", "Output JSON")
  .action((file: string, opts: { output?: string; json?: boolean }) => {
    try {
      const source = readFileSync(resolve(file), "utf-8");
      const module = parseFile(source);

      const doc = generateMermaidDoc(module);

      if (opts.json) {
        console.log(JSON.stringify({ status: "ok", module: module.name, diagram: doc }));
      } else if (opts.output) {
        const outPath = resolve(opts.output);
        mkdirSync(dirname(outPath), { recursive: true });
        writeFileSync(outPath, doc, "utf-8");
        console.log(`\u2713 Diagram written to ${outPath}`);
      } else {
        console.log(doc);
      }
    } catch (err: any) {
      if (opts.json) {
        console.log(JSON.stringify({ status: "error", errors: [{ message: err.message }] }));
      } else {
        console.error(`\u2717 Error: ${err.message}`);
      }
      process.exit(1);
    }
  });

// ============================================================================
// aria test <file>
// ============================================================================

program
  .command("test")
  .description("Generate test files from .aria contract examples")
  .argument("<file>", "Path to .aria file")
  .option("-o, --output <dir>", "Output directory", "./generated")
  .option("-f, --framework <fw>", "Test framework", "vitest")
  .option("--json", "Output JSON")
  .action((file: string, opts: { output: string; framework: string; json?: boolean }) => {
    try {
      const source = readFileSync(resolve(file), "utf-8");
      const module = parseFile(source);

      const fw = opts.framework as "vitest" | "jest";
      const testContent = generateTests(module, fw);

      const outDir = resolve(opts.output);
      mkdirSync(outDir, { recursive: true });

      const moduleName = module.name
        .replace(/([a-z])([A-Z])/g, "$1-$2")
        .replace(/[\s_]+/g, "-")
        .toLowerCase();

      const outPath = join(outDir, `${moduleName}.test.ts`);
      writeFileSync(outPath, testContent, "utf-8");

      if (opts.json) {
        console.log(JSON.stringify({ status: "ok", file: outPath, framework: fw }));
      } else {
        console.log(`\u2713 Tests written to ${outPath}`);
      }
    } catch (err: any) {
      if (opts.json) {
        console.log(JSON.stringify({ status: "error", errors: [{ message: err.message }] }));
      } else {
        console.error(`\u2717 Error: ${err.message}`);
      }
      process.exit(1);
    }
  });

// ============================================================================
// aria implement <file>
// ============================================================================

program
  .command("implement")
  .description("Generate AI implementations for contracts in an .aria specification")
  .argument("<file>", "Path to .aria file")
  .option("--ai <provider>", "AI provider to use (claude)", "claude")
  .option("-t, --target <lang>", "Target language", "typescript")
  .option("-o, --output <dir>", "Output directory", "./generated")
  // SEC-5: --api-key removed (CWE-214: secrets in process listings/shell history).
  // Use ANTHROPIC_API_KEY environment variable instead.
  .option("--model <model>", "AI model to use")
  .action(async (file: string, opts: { ai: string; target: string; output: string; model?: string }) => {
    if (opts.target !== "typescript") {
      console.error(`\u2717 Only "typescript" target is supported for implement.`);
      process.exit(1);
    }
    await runImplement(file, {
      ai: opts.ai as ProviderName,
      target: "typescript",
      output: opts.output,
      apiKey: undefined,
      model: opts.model,
    });
  });

// ============================================================================
// aria init
// ============================================================================

program
  .command("init")
  .description("Scaffold a new .aria specification file")
  .option("--module <name>", "Module name", "MyModule")
  .option("-o, --output <dir>", "Output directory", ".")
  .action((opts) => {
    try {
      const result = runInit(opts);
      console.log(`\u2713 Created ${result.path}`);
      console.log(`  Module: ${result.module}`);
    } catch (err: any) {
      console.error(`\u2717 ${err.message}`);
      process.exit(1);
    }
  });

// ============================================================================
// aria watch <path>
// ============================================================================

program
  .command("watch")
  .description("Watch .aria files and re-check on change")
  .argument("<path>", "File or directory to watch")
  .option("--gen", "Also regenerate on change")
  .option("-o, --output <dir>", "Output directory for gen")
  .option("-t, --target <lang>", "Target language", "typescript")
  .action((path, opts) => {
    try {
      runWatch(path, opts);
    } catch (err: any) {
      console.error(`\u2717 ${err.message}`);
      process.exit(1);
    }
  });

// ============================================================================
// aria fmt <path>
// ============================================================================

program
  .command("fmt")
  .description("Format .aria files")
  .argument("<path>", "File or directory to format")
  .option("--check", "Check only, don't write (exit 1 if changes needed)")
  .action((path, opts) => {
    try {
      const stat = statSync(path);
      const results = stat.isDirectory()
        ? runFormatDir(path, opts)
        : [runFormat(path, opts)];

      const changed = results.filter(r => r.changed);
      if (opts.check && changed.length > 0) {
        console.log(`\u2717 ${changed.length} file(s) need formatting:`);
        for (const r of changed) console.log(`  ${r.path}`);
        process.exit(1);
      }
      if (changed.length > 0) {
        console.log(`\u2713 Formatted ${changed.length} file(s)`);
      } else {
        console.log(`\u2713 All files already formatted`);
      }
    } catch (err: any) {
      console.error(`\u2717 ${err.message}`);
      process.exit(1);
    }
  });

// ============================================================================
// aria setup
// ============================================================================

program
  .command("setup")
  .description("Add ARIA section to your project's CLAUDE.md for AI-assisted development")
  .option("-o, --output <path>", "Path to CLAUDE.md", "CLAUDE.md")
  .option("--specs-dir <dir>", "Specs directory to reference", "specs")
  .option("-t, --target <lang>", "Default target language", "typescript")
  .option("--force", "Replace existing ARIA section if present")
  .action((opts: { output: string; specsDir: string; target: string; force?: boolean }) => {
    try {
      const result = runSetup(opts);
      if (result.action === "skipped") {
        console.log(`⚠ ${result.message}`);
      } else {
        console.log(`✓ ${result.message}`);
        console.log(`  Specs directory: ${opts.specsDir}/`);
        console.log(`  Target: ${opts.target}`);
      }
    } catch (err: any) {
      console.error(`✗ ${err.message}`);
      process.exit(1);
    }
  });

program.parse();
