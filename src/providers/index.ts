/**
 * AI Provider Interface
 * Abstracts the LLM call so we can swap providers (Claude, OpenAI, local).
 */

export interface AIProvider {
  name: string;
  generate(prompt: string, opts?: GenerateOptions): Promise<string>;
}

export interface GenerateOptions {
  maxTokens?: number;
  temperature?: number;
  stopSequences?: string[];
}

export type ProviderName = "claude" | "openai" | "local";

import { createClaudeProvider } from "./claude.js";

export function createProvider(name: ProviderName, opts?: { apiKey?: string; model?: string }): AIProvider {
  switch (name) {
    case "claude":
      return createClaudeProvider(opts);
    case "openai":
      throw new Error("OpenAI provider not yet implemented");
    case "local":
      throw new Error("Local provider not yet implemented");
    default:
      throw new Error(`Unknown provider: ${name}`);
  }
}
