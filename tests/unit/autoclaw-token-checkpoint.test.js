import { describe, expect, it } from "vitest";

import {
  buildAutoclawCheckpointId,
  __test__,
} from "../../src/lib/oauth/services/autoclawTokenCheckpoint.js";

describe("autoclaw token checkpoint", () => {
  it("encrypts token payload without plaintext token in envelope", () => {
    const payload = {
      accessToken: "access-secret-token",
      refreshToken: "refresh-secret-token",
      deviceId: "device-1",
    };

    const envelope = __test__.encryptPayload(payload);
    const raw = JSON.stringify(envelope);

    expect(raw).not.toContain(payload.accessToken);
    expect(raw).not.toContain(payload.refreshToken);
    expect(__test__.decryptEnvelope(envelope)).toEqual(payload);
  });

  it("builds stable checkpoint IDs from job/account identity", () => {
    expect(buildAutoclawCheckpointId({ jobId: "job-1", email: "a@example.com", line: 1 }))
      .toBe(buildAutoclawCheckpointId({ jobId: "job-1", email: "a@example.com", line: 1 }));
    expect(buildAutoclawCheckpointId({ jobId: "job-1", email: "a@example.com", line: 1 }))
      .not.toBe(buildAutoclawCheckpointId({ jobId: "job-1", email: "b@example.com", line: 2 }));
  });
});
