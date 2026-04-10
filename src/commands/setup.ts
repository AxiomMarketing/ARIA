/**
 * `aria setup` command
 * Injects the ARIA section into the project's CLAUDE.md file.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { getAriaClaudeMdSection } from "../templates/claude-md.js";

export interface SetupOptions {
  output?: string;       // Path to CLAUDE.md (default: ./CLAUDE.md)
  specsDir?: string;     // Specs directory (default: "specs")
  target?: string;       // Default target language (default: "typescript")
  force?: boolean;       // Overwrite existing ARIA section
}

export interface SetupResult {
  path: string;
  action: "created" | "appended" | "skipped";
  message: string;
}

const ARIA_SECTION_MARKER = "## ARIA Specifications";

export function runSetup(opts: SetupOptions = {}): SetupResult {
  const claudeMdPath = resolve(opts.output || "CLAUDE.md");
  const specsDir = opts.specsDir || "specs";
  const target = opts.target || "typescript";

  const section = getAriaClaudeMdSection({ specsDir, target });

  // Ensure specs directory exists
  const specsDirPath = resolve(specsDir);
  if (!existsSync(specsDirPath)) {
    mkdirSync(specsDirPath, { recursive: true });
  }

  if (!existsSync(claudeMdPath)) {
    // Create new CLAUDE.md with header + ARIA section
    const content = [
      "# CLAUDE.md",
      "",
      "This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.",
      "",
      section,
      "",
    ].join("\n");
    writeFileSync(claudeMdPath, content, "utf-8");
    return {
      path: claudeMdPath,
      action: "created",
      message: `Created ${claudeMdPath} with ARIA section`,
    };
  }

  // File exists — check if ARIA section is already present
  const existing = readFileSync(claudeMdPath, "utf-8");

  if (existing.includes(ARIA_SECTION_MARKER)) {
    if (!opts.force) {
      return {
        path: claudeMdPath,
        action: "skipped",
        message: `ARIA section already exists in ${claudeMdPath}. Use --force to replace.`,
      };
    }
    // Replace existing section (from marker to next ## or end of file)
    const markerIndex = existing.indexOf(ARIA_SECTION_MARKER);
    const afterMarker = existing.slice(markerIndex + ARIA_SECTION_MARKER.length);
    const nextSection = afterMarker.search(/\n## (?!ARIA)/);
    const before = existing.slice(0, markerIndex).trimEnd();
    const after = nextSection >= 0 ? afterMarker.slice(nextSection) : "";
    const updated = `${before}\n\n${section}\n${after}`;
    writeFileSync(claudeMdPath, updated, "utf-8");
    return {
      path: claudeMdPath,
      action: "appended",
      message: `Replaced ARIA section in ${claudeMdPath}`,
    };
  }

  // Append ARIA section to existing file
  const updated = `${existing.trimEnd()}\n\n${section}\n`;
  writeFileSync(claudeMdPath, updated, "utf-8");
  return {
    path: claudeMdPath,
    action: "appended",
    message: `Appended ARIA section to ${claudeMdPath}`,
  };
}
