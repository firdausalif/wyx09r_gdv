import { describe, expect, it } from "vitest";

import { randomizeProxySessionId } from "../../src/lib/oauth/services/kiroBulkImportManager.js";

describe("randomizeProxySessionId", () => {
  it("replaces cliproxy sid while preserving credentials and endpoint", () => {
    const input = "http://r8ip1223682-region-HK-sid-WsVDBAWL-t-5:5tu5xtym@us.cliproxy.io:3010";
    const output = randomizeProxySessionId(input);

    expect(output).not.toBe(input);
    expect(output).toMatch(/^http:\/\/r8ip1223682-region-HK-sid-[a-f0-9]{10}-t-5:5tu5xtym@us\.cliproxy\.io:3010\/?$/);
  });

  it("leaves proxy URLs without sid unchanged", () => {
    const input = "http://user:pass@example.com:8080";
    expect(randomizeProxySessionId(input)).toBe(input);
  });
});
