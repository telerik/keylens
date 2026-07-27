import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type { AITransport } from "../types/index.js";

/**
 * AI transport that delegates queries to the MCP client via sampling.
 *
 * Instead of calling an external AI API directly, this sends
 * `sampling/createMessage` requests back to the MCP client, which uses
 * whatever model it has configured (Copilot, Claude, etc.).
 * No separate API key required.
 *
 * Text-only queries prioritize speed (batch fix suggestions, summaries),
 * while vision queries prioritize intelligence (focus order analysis,
 * focus indicator quality scoring).
 */
export class SamplingTransport implements AITransport {
  constructor(private server: Server) {}

  async query(prompt: string, signal?: AbortSignal): Promise<string> {
    const params = {
      messages: [
        {
          role: "user" as const,
          content: { type: "text" as const, text: prompt },
        },
      ],
      modelPreferences: {
        hints: [
          { name: "claude-3-5-haiku" },
          { name: "claude-3-haiku" },
          { name: "gpt-4o-mini" },
        ],
        intelligencePriority: 0.5,
        speedPriority: 0.9,
      },
      maxTokens: 2048,
    };
    const result = signal
      ? await this.server.createMessage(params, { signal })
      : await this.server.createMessage(params);

    if (result.content.type === "text") return result.content.text;
    return "";
  }

  async queryVision(
    prompt: string,
    images: Array<{ base64: string; mediaType: string }>,
    signal?: AbortSignal,
  ): Promise<string> {
    const content: Array<
      | { type: "image"; data: string; mimeType: string }
      | { type: "text"; text: string }
    > = [];

    for (const img of images) {
      content.push({
        type: "image",
        data: img.base64,
        mimeType: img.mediaType,
      });
    }
    content.push({ type: "text", text: prompt });

    const params = {
      messages: [{ role: "user" as const, content }],
      modelPreferences: {
        hints: [{ name: "claude-3-5-sonnet" }, { name: "gpt-4o" }],
        intelligencePriority: 0.9,
        speedPriority: 0.3,
      },
      maxTokens: 4096,
    };
    const result = signal
      ? await this.server.createMessage(params, { signal })
      : await this.server.createMessage(params);

    if (result.content.type === "text") return result.content.text;
    return "";
  }
}
