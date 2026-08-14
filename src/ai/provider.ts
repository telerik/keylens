import type { AIConfig } from "../types/index.js";
import { logger } from "../utils/logger.js";
import { raceWithSignal, throwIfAborted } from "../utils/execution.js";
import { AIError } from "../errors.js";
import { OpenAITransport } from "./openai-transport.js";

/** An image attachment for a vision-capable AI query. */
export interface AIVisionImage {
  base64: string;
  mediaType: "image/png" | "image/jpeg" | "image/gif" | "image/webp";
}

/** Minimal type surface for the dynamically-imported Anthropic SDK client. */
interface AnthropicContentBlock {
  type: string;
  text?: string;
}
interface AnthropicMessage {
  content: AnthropicContentBlock[];
}
interface AnthropicClient {
  messages: {
    create(
      params: Record<string, unknown>,
      options?: { signal?: AbortSignal },
    ): Promise<AnthropicMessage>;
  };
}

/**
 * Routes AI text/vision queries to the configured provider — an injected
 * `AITransport` (e.g. MCP sampling), the OpenAI Responses API, or the
 * Anthropic Messages API — and caches SDK availability checks and client
 * instances. Feature modules under `./features/` call `query()`/`queryVision()`
 * and stay unaware of which provider actually served the request.
 */
export class AIProvider {
  private sdkAvailable: boolean | null = null;
  private anthropicClient: unknown = null;
  private openaiTransport: OpenAITransport | null = null;

  constructor(
    private config: AIConfig,
    private apiKey: string | null,
    private signal?: AbortSignal,
  ) {}

  /**
   * Send a text query to the configured AI provider.
   * Routes through injected transport (e.g. MCP sampling) when available
   * and no direct API key is set; otherwise uses the direct provider API.
   */
  async query(prompt: string): Promise<string> {
    throwIfAborted(this.signal, "ai");
    let operation: Promise<string>;
    if (!this.apiKey && this.config.transport) {
      operation = this.config.transport.query(prompt, this.signal);
    } else if (this.config.provider === "openai") {
      operation = this.getOpenAITransport().query(prompt, this.signal);
    } else if (this.config.provider === "anthropic") {
      if (!(await this.checkSdkAvailable())) {
        throw new AIError("@anthropic-ai/sdk is not installed");
      }
      operation = this.queryAnthropic(prompt);
    } else {
      throw new AIError(`Unsupported AI provider: ${this.config.provider}`);
    }
    return raceWithSignal(operation, this.signal, "ai");
  }

  /**
   * Send a vision query (text + images) to the configured AI provider.
   * Routes through injected transport when available and no direct API key is set.
   */
  async queryVision(prompt: string, images: AIVisionImage[]): Promise<string> {
    throwIfAborted(this.signal, "ai");
    let operation: Promise<string>;
    if (!this.apiKey && this.config.transport) {
      operation = this.config.transport.queryVision(
        prompt,
        images,
        this.signal,
      );
    } else if (this.config.provider === "openai") {
      operation = this.getOpenAITransport().queryVision(
        prompt,
        images,
        this.signal,
      );
    } else if (this.config.provider === "anthropic") {
      if (!(await this.checkSdkAvailable())) {
        throw new AIError("@anthropic-ai/sdk is not installed");
      }
      operation = this.queryAnthropicVision(prompt, images);
    } else {
      throw new AIError(`Unsupported AI provider: ${this.config.provider}`);
    }
    return raceWithSignal(operation, this.signal, "ai");
  }

  /**
   * Check if the Anthropic SDK is installed. Result is cached.
   */
  private async checkSdkAvailable(): Promise<boolean> {
    if (this.sdkAvailable !== null) return this.sdkAvailable;
    try {
      await import("@anthropic-ai/sdk");
      this.sdkAvailable = true;
    } catch {
      logger.warn(
        "AI features require @anthropic-ai/sdk. Install it with: npm install @anthropic-ai/sdk",
      );
      this.sdkAvailable = false;
    }
    return this.sdkAvailable;
  }

  /**
   * Get or create a cached OpenAI transport instance.
   */
  private getOpenAITransport(): OpenAITransport {
    if (!this.openaiTransport) {
      if (!this.apiKey) {
        throw new AIError(
          "OpenAI provider requires an API key. Set KEYLENS_AI_API_KEY or OPENAI_API_KEY env var, or use ai.apiKey in config.",
        );
      }
      this.openaiTransport = new OpenAITransport(
        this.apiKey,
        this.config.model || "gpt-4o",
        this.config.baseURL,
      );
    }
    return this.openaiTransport;
  }

  /**
   * Query the Anthropic Claude API with text only.
   */
  private async queryAnthropic(prompt: string): Promise<string> {
    const client = (await this.getAnthropicClient()) as AnthropicClient;
    const params = {
      model: this.config.model || "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    };
    const message: AnthropicMessage = this.signal
      ? await client.messages.create(params, { signal: this.signal })
      : await client.messages.create(params);

    const textBlock = message.content.find(
      (block: AnthropicContentBlock) => block.type === "text",
    );
    return textBlock?.text ?? "";
  }

  /**
   * Query the Anthropic Claude API with text + images (vision).
   */
  private async queryAnthropicVision(
    prompt: string,
    images: AIVisionImage[],
  ): Promise<string> {
    const content: Array<
      | {
          type: "image";
          source: {
            type: "base64";
            media_type: "image/png" | "image/jpeg" | "image/gif" | "image/webp";
            data: string;
          };
        }
      | { type: "text"; text: string }
    > = [];

    // Add images first, then the text prompt
    for (const img of images) {
      content.push({
        type: "image",
        source: {
          type: "base64",
          media_type: img.mediaType,
          data: img.base64,
        },
      });
    }
    content.push({ type: "text", text: prompt });

    const client = (await this.getAnthropicClient()) as AnthropicClient;
    const params = {
      model: this.config.model || "claude-sonnet-4-20250514",
      max_tokens: 2048,
      messages: [{ role: "user", content }],
    };
    const message: AnthropicMessage = this.signal
      ? await client.messages.create(params, { signal: this.signal })
      : await client.messages.create(params);

    const textBlock = message.content.find(
      (block: AnthropicContentBlock) => block.type === "text",
    );
    return textBlock?.text ?? "";
  }

  /**
   * Get or create a cached Anthropic client instance.
   */
  private async getAnthropicClient(): Promise<unknown> {
    if (this.anthropicClient) return this.anthropicClient;
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    this.anthropicClient = new Anthropic({ apiKey: this.apiKey! });
    return this.anthropicClient;
  }
}

/**
 * Shared context passed to each AI feature module: the resolved config (for
 * per-feature flags and limits), the provider (for `query()`/`queryVision()`),
 * and the cancellation signal.
 */
export interface AIFeatureContext {
  config: AIConfig;
  provider: AIProvider;
  signal?: AbortSignal;
}
