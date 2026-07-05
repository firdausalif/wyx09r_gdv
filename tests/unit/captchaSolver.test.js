import { describe, it, expect } from "vitest";
import { getTrace } from "../../src/lib/oauth/utils/captchaSolver.js";

describe("getTrace", () => {
  it("returns trace array with x, y, timestamp entries", () => {
    const { trace } = getTrace(200);
    expect(trace.length).toBeGreaterThan(1);
    for (const point of trace) {
      expect(Array.isArray(point)).toBe(true);
      expect(point.length).toBe(3);
      expect(typeof point[0]).toBe("number");
      expect(typeof point[1]).toBe("number");
      expect(typeof point[2]).toBe("number");
    }
  });

  it("starts near 0 and ends near target distance", () => {
    const distance = 180;
    const { trace } = getTrace(distance);
    const lastX = trace[trace.length - 1][0];
    expect(trace[0][0]).toBeLessThanOrEqual(5);
    expect(lastX).toBeGreaterThanOrEqual(distance - 10);
  });

  it("produces monotonically increasing x values (except overshoot correction at tail)", () => {
    const { trace } = getTrace(250);
    let prev = -1;
    let corrections = 0;
    for (let i = 0; i < trace.length; i++) {
      const x = trace[i][0];
      if (x < prev) corrections++;
      prev = x;
    }
    // Allow ~5 overshoot corrections at the very end
    expect(corrections).toBeLessThanOrEqual(8);
  });

  it("y offsets stay within reasonable jitter range", () => {
    const { trace } = getTrace(200);
    const yOffsets = trace.map((p) => p[1]);
    const maxY = Math.max(...yOffsets);
    const minY = Math.min(...yOffsets);
    expect(maxY - minY).toBeLessThanOrEqual(8);
  });

  it("timestamps are monotonically increasing", () => {
    const { trace } = getTrace(200);
    for (let i = 1; i < trace.length; i++) {
      expect(trace[i][2]).toBeGreaterThanOrEqual(trace[i - 1][2]);
    }
  });

  it("returns totalTime greater than last trace timestamp", () => {
    const { trace, totalTime } = getTrace(200);
    const lastTs = trace[trace.length - 1][2];
    expect(totalTime).toBeGreaterThan(lastTs);
  });

  it("works for small distances", () => {
    const { trace } = getTrace(30);
    const lastX = trace[trace.length - 1][0];
    expect(lastX).toBeGreaterThanOrEqual(20);
  });

  it("works for large distances", () => {
    const { trace } = getTrace(400);
    const lastX = trace[trace.length - 1][0];
    expect(lastX).toBeGreaterThanOrEqual(390);
  });
});
