import { watch, statSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseFile } from "../parser.js";
import { check, formatCheckResult } from "../checker.js";

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
    // TODO: run gen if opts.gen
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

  watch(absPath, { recursive: stat.isDirectory() }, (eventType, fileName) => {
    if (!fileName) return;
    if (stat.isDirectory() && !fileName.endsWith(".aria")) return;
    const target = stat.isDirectory() ? resolve(absPath, fileName) : absPath;
    debounced(target);
  });

  // Keep process alive
  process.stdin.resume();
}
