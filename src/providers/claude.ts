/**
 * Claude AI Provider
 * Uses @anthropic-ai/sdk to call Claude API.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { AIProvider, GenerateOptions } from "./index.js";

export interface ClaudeProviderOptions {
  apiKey?: string;
  model?: string;
}

export function createClaudeProvider(opts: ClaudeProviderOptions = {}): AIProvider {
  const apiKey = opts.apiKey || process.env.ANTHROPIC_API_KEY;
  const model = opts.model || "claude-sonnet-4-5-20250929";

  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY environment variable is required (or pass apiKey option)");
  }

  const client = new Anthropic({ apiKey, timeout: 120_000 /* 2 min */ });

  return {
    name: "claude",
    async generate(prompt: string, options: GenerateOptions = {}): Promise<string> {
      try {
        const response = await client.messages.create({
          model,
          max_tokens: options.maxTokens || 4096,
          temperature: options.temperature ?? 0.2,
          messages: [
            { role: "user", content: prompt }
          ],
          stop_sequences: options.stopSequences,
        });

        // Extract text from the first content block
        const block = response.content[0];
        if (block.type === "text") {
          return block.text;
        }
        throw new Error("Unexpected response format from Claude");
      } catch (err: any) {
        if (err.status === 401) {
          throw new Error("Invalid Claude API key");
        }
        if (err.status === 429) {
          throw new Error("Claude API rate limit exceeded");
        }
        throw new Error(`Claude API error: ${err.message}`);
      }
    },
  };
}
