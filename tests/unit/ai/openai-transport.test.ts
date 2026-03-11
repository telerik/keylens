import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock logger
vi.mock("@/utils/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
  },
}));

// Use vi.hoisted so mock factory can reference these
const { mockCreate, constructorCalls } = vi.hoisted(() => {
  const mockCreate = vi.fn();
  const constructorCalls: Array<Record<string, unknown>> = [];
  return { mockCreate, constructorCalls };
});

vi.mock("openai", () => {
  class FakeOpenAI {
    _opts: Record<string, unknown>;
    responses = { create: mockCreate };
    constructor(opts: Record<string, unknown>) {
      this._opts = opts;
      constructorCalls.push(opts);
    }
  }
  return { default: FakeOpenAI, OpenAI: FakeOpenAI };
});

// Import AFTER mocks are set up (Vitest hoists vi.mock calls above imports)
import { OpenAITransport } from "@/ai/openai-transport.js";

describe("OpenAITransport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    constructorCalls.length = 0;
  });

  describe("query", () => {
    it("should call responses.create with correct params", async () => {
      mockCreate.mockResolvedValue({
        output_text: "test response",
      });

      const transport = new OpenAITransport("sk-test", "gpt-4o");
      const result = await transport.query("test prompt");

      expect(result).toBe("test response");
      expect(mockCreate).toHaveBeenCalledWith({
        model: "gpt-4o",
        max_output_tokens: 1024,
        input: [{ role: "user", content: "test prompt" }],
        store: false,
      });
    });

    it("should return empty string when output_text is null", async () => {
      mockCreate.mockResolvedValue({
        output_text: null,
      });

      const transport = new OpenAITransport("sk-test", "gpt-4o");
      const result = await transport.query("test prompt");

      expect(result).toBe("");
    });

    it("should pass baseURL to OpenAI client", async () => {
      mockCreate.mockResolvedValue({
        output_text: "ok",
      });

      const transport = new OpenAITransport(
        "azure-key",
        "gpt-4o",
        "https://my-resource.azure.com/openai",
      );

      await transport.query("test");

      expect(constructorCalls).toHaveLength(1);
      expect(constructorCalls[0]).toEqual({
        apiKey: "azure-key",
        baseURL: "https://my-resource.azure.com/openai",
      });
    });
  });

  describe("queryVision", () => {
    it("should format images as input_image content parts", async () => {
      mockCreate.mockResolvedValue({
        output_text: "vision response",
      });

      const transport = new OpenAITransport("sk-test", "gpt-4o");
      const result = await transport.queryVision("describe this", [
        { base64: "iVBOR...base64data", mediaType: "image/png" },
      ]);

      expect(result).toBe("vision response");
      expect(mockCreate).toHaveBeenCalledWith({
        model: "gpt-4o",
        max_output_tokens: 2048,
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_image",
                image_url: "data:image/png;base64,iVBOR...base64data",
              },
              { type: "input_text", text: "describe this" },
            ],
          },
        ],
        store: false,
      });
    });

    it("should handle multiple images", async () => {
      mockCreate.mockResolvedValue({
        output_text: "multi-image response",
      });

      const transport = new OpenAITransport("sk-test", "gpt-4o");
      await transport.queryVision("compare", [
        { base64: "img1data", mediaType: "image/png" },
        { base64: "img2data", mediaType: "image/jpeg" },
      ]);

      const call = mockCreate.mock.calls[0][0];
      const content = call.input[0].content;
      expect(content).toHaveLength(3); // 2 images + 1 text
      expect(content[0].type).toBe("input_image");
      expect(content[1].type).toBe("input_image");
      expect(content[2].type).toBe("input_text");
    });
  });

  describe("client caching", () => {
    it("should reuse the client across multiple calls", async () => {
      mockCreate.mockResolvedValue({
        output_text: "ok",
      });

      const transport = new OpenAITransport("sk-test", "gpt-4o");
      await transport.query("first");
      await transport.query("second");

      // OpenAI constructor should only be called once
      expect(constructorCalls).toHaveLength(1);
    });
  });
});
