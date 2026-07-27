import type { AITransport } from "../types/index.js";
import { logger } from "../utils/logger.js";

/** Minimal type surface for the dynamically-imported OpenAI SDK client. */
interface OpenAIClient {
  responses: {
    create(
      params: Record<string, unknown>,
      options?: { signal?: AbortSignal },
    ): Promise<{ output_text: string | null }>;
  };
}

/**
 * AI transport that uses the OpenAI Responses API.
 *
 * Works with any OpenAI-compatible endpoint — OpenAI itself,
 * Azure AI Foundry, Azure OpenAI, or self-hosted servers (Ollama, vLLM, etc.).
 * Set `baseURL` to point at a custom endpoint.
 */
export class OpenAITransport implements AITransport {
  private client: OpenAIClient | null = null;
  private sdkChecked = false;

  constructor(
    private apiKey: string,
    private model: string,
    private baseURL?: string,
  ) {}

  async query(prompt: string, signal?: AbortSignal): Promise<string> {
    const client = await this.getClient();
    const params = {
      model: this.model,
      max_output_tokens: 1024,
      input: [{ role: "user", content: prompt }],
      store: false,
    };
    const response = signal
      ? await client.responses.create(params, { signal })
      : await client.responses.create(params);

    return response.output_text ?? "";
  }

  async queryVision(
    prompt: string,
    images: Array<{ base64: string; mediaType: string }>,
    signal?: AbortSignal,
  ): Promise<string> {
    const content: Array<
      | { type: "input_image"; image_url: string }
      | { type: "input_text"; text: string }
    > = [];

    for (const img of images) {
      content.push({
        type: "input_image",
        image_url: `data:${img.mediaType};base64,${img.base64}`,
      });
    }
    content.push({ type: "input_text", text: prompt });

    const client = await this.getClient();
    const params = {
      model: this.model,
      max_output_tokens: 2048,
      input: [{ role: "user", content }],
      store: false,
    };
    const response = signal
      ? await client.responses.create(params, { signal })
      : await client.responses.create(params);

    return response.output_text ?? "";
  }

  private async getClient(): Promise<OpenAIClient> {
    if (this.client) return this.client;

    if (!this.sdkChecked) {
      this.sdkChecked = true;
      try {
        const { default: OpenAI } = await import("openai");
        const opts: Record<string, unknown> = { apiKey: this.apiKey };
        if (this.baseURL) opts.baseURL = this.baseURL;
        this.client = new OpenAI(opts) as unknown as OpenAIClient;
      } catch {
        logger.warn(
          "OpenAI provider requires the openai package. Install it with: npm install openai",
        );
        throw new Error("openai package is not installed");
      }
    }

    if (!this.client) {
      throw new Error("openai package is not installed");
    }
    return this.client;
  }
}
