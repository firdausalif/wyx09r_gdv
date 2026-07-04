import { describe, expect, it } from "vitest";
import { stripUnsupportedParams } from "../../open-sse/translator/concerns/paramSupport.js";

describe("stripUnsupportedParams", () => {
  it("applies provider-wide Cloudflare content flattening without match errors", () => {
    const body = {
      messages: [
        { role: "user", content: [{ type: "text", text: "hi" }] },
      ],
    };

    stripUnsupportedParams("cloudflare-ai", "@cf/zai-org/glm-5.2", body);

    expect(body.messages[0].content).toBe("hi");
  });
});
