import { watch, statSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { parseFile } from "../parser.js";
import { check, formatCheckResult } from "../checker.js";
import { generateTypeScript } from "../generators/typescript.js";
import { generateRust } from "../generators/rust.js";
import { generatePython } from "../generators/python.js";
import { generateJsonSchema } from "../generators/jsonschema.js";

export interface WatchOptions {
  gen?: boolean;
  output?: string;
  target?: string;
}

function ts(): string {
  return new Date().toISOString().replace("T", " ").replace(/\.\d+Z$/, "");
}

function runOnce(filePath: string, opts: WatchOptions): void {
  console.log(`[${ts()}] Change detected: ${filePath}`);
  try {
    const source = readFileSync(filePath, "utf-8");
    const module = parseFile(source);
    const result = check(module);
    if (!result.ok) {
      console.log(formatCheckResult(result));
      return;
    }
    console.log(`  \u2713 ${module.name} - ${module.body.length} definitions`);

    if (opts.gen && opts.output) {
      const outDir = resolve(opts.output);
      if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
      const target = opts.target || "typescript";
      let files: { path: string; content: string }[] = [];
      if (target === "typescript") files = generateTypeScript(module);
      else if (target === "rust") files = generateRust(module);
      else if (target === "python") files = generatePython(module);
      else if (target === "jsonschema" || target === "json-schema") {
        const f = generateJsonSchema(module);
        files = [f];
      }
      for (const f of files) {
        writeFileSync(join(outDir, f.path), f.content, "utf-8");
      }
      console.log(`  \u2713 Generated ${files.length} file(s) → ${outDir}`);
    }
  } catch (err: any) {
    console.error(`  \u2717 ${err.message}`);
  }
}

export function runWatch(filePath: string, opts: WatchOptions = {}): void {
  const absPath = resolve(filePath);
  const stat = statSync(absPath);

  console.log(`Watching ${absPath}...`);

  // Initial run
  if (stat.isFile()) {
    runOnce(absPath, opts);
  }

  // Debounce
  let timer: NodeJS.Timeout | null = null;
  const debounced = (path: string) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => runOnce(path, opts), 100);
  };

  const watcher = watch(absPath, { recursive: stat.isDirectory() }, (eventType, fileName) => {
    if (!fileName) return;
    if (stat.isDirectory() && !fileName.endsWith(".aria")) return;
    const target = stat.isDirectory() ? resolve(absPath, fileName) : absPath;
    debounced(target);
  });

  // BE-4: Clean up timer + watcher on process exit to prevent FD leaks
  const cleanup = () => {
    if (timer) clearTimeout(timer);
    watcher.close();
    process.exit(0);
  };
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  // Keep process alive
  process.stdin.resume();
}
