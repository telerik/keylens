import { describe, it, expect, vi } from "vitest";
import { SamplingTransport } from "@/mcp/sampling.js";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";

function makeMockServer(
  response: { type: string; text?: string } = {
    type: "text",
    text: "mock response",
  },
) {
  return {
    createMessage: vi.fn().mockResolvedValue({
      content: response,
    }),
  } as unknown as Server;
}

describe("SamplingTransport", () => {
  describe("query", () => {
    it("should send a text prompt via createMessage", async () => {
      const server = makeMockServer({ type: "text", text: "AI response" });
      const transport = new SamplingTransport(server);

      const result = await transport.query("What is keyboard accessibility?");

      expect(result).toBe("AI response");
      expect(server.createMessage).toHaveBeenCalledTimes(1);
      expect(server.createMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: "What is keyboard accessibility?",
              },
            },
          ],
          maxTokens: 2048,
        }),
      );
    });

    it("should return empty string for non-text responses", async () => {
      const server = makeMockServer({ type: "image" });
      const transport = new SamplingTransport(server);

      const result = await transport.query("test prompt");

      expect(result).toBe("");
    });

    it("should include model preferences", async () => {
      const server = makeMockServer({ type: "text", text: "ok" });
      const transport = new SamplingTransport(server);

      await transport.query("test");

      expect(server.createMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          modelPreferences: expect.objectContaining({
            hints: expect.arrayContaining([
              { name: "claude-3-5-haiku" },
              { name: "claude-3-haiku" },
              { name: "gpt-4o-mini" },
            ]),
            speedPriority: 0.9,
          }),
        }),
      );
    });
  });

  describe("queryVision", () => {
    it("should send images and text prompt via createMessage", async () => {
      const server = makeMockServer({
        type: "text",
        text: "Vision analysis result",
      });
      const transport = new SamplingTransport(server);

      const result = await transport.queryVision("Analyze this screenshot", [
        { base64: "abc123", mediaType: "image/png" },
      ]);

      expect(result).toBe("Vision analysis result");
      expect(server.createMessage).toHaveBeenCalledTimes(1);

      const call = (server.createMessage as ReturnType<typeof vi.fn>).mock
        .calls[0][0];
      const content = call.messages[0].content;

      // Should have image first, then text
      expect(content).toHaveLength(2);
      expect(content[0]).toEqual({
        type: "image",
        data: "abc123",
        mimeType: "image/png",
      });
      expect(content[1]).toEqual({
        type: "text",
        text: "Analyze this screenshot",
      });
    });

    it("should send multiple images", async () => {
      const server = makeMockServer({ type: "text", text: "result" });
      const transport = new SamplingTransport(server);

      await transport.queryVision("Compare these", [
        { base64: "img1", mediaType: "image/png" },
        { base64: "img2", mediaType: "image/jpeg" },
      ]);

      const call = (server.createMessage as ReturnType<typeof vi.fn>).mock
        .calls[0][0];
      const content = call.messages[0].content;

      expect(content).toHaveLength(3);
      expect(content[0].type).toBe("image");
      expect(content[1].type).toBe("image");
      expect(content[2].type).toBe("text");
    });

    it("should return empty string for non-text responses", async () => {
      const server = makeMockServer({ type: "image" });
      const transport = new SamplingTransport(server);

      const result = await transport.queryVision("test", [
        { base64: "abc", mediaType: "image/png" },
      ]);

      expect(result).toBe("");
    });

    it("should use higher maxTokens than query", async () => {
      const server = makeMockServer({ type: "text", text: "ok" });
      const transport = new SamplingTransport(server);

      await transport.queryVision("test", [
        { base64: "abc", mediaType: "image/png" },
      ]);

      expect(server.createMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          maxTokens: 4096,
        }),
      );
    });

    it("should prioritize intelligence over speed for vision", async () => {
      const server = makeMockServer({ type: "text", text: "ok" });
      const transport = new SamplingTransport(server);

      await transport.queryVision("test", [
        { base64: "abc", mediaType: "image/png" },
      ]);

      expect(server.createMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          modelPreferences: expect.objectContaining({
            intelligencePriority: 0.9,
            speedPriority: 0.3,
          }),
        }),
      );
    });
  });
});
