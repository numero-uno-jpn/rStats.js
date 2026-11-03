// Issue #316: Kendall's exact corTest has a sample-size limit (review_fix_log_issue316.md).
import { describe, expect, it } from "vitest";
import { corTest } from "../src/index.js";

const rotation = (n: number): [number[], number[]] => [
  Array.from({ length: n }, (_, i) => i),
  Array.from({ length: n }, (_, i) => (i + Math.floor(n / 2)) % n),
];

describe("issue #316", () => {
  it("is a RangeError above n = 1290 (boundary)", () => {
    // n = 1290 takes 4.9 s on the development machine (not run here)
    const [x, y] = rotation(1291);
    expect(() => corTest(x, y, { method: "kendall", exact: true })).toThrow(/n = 1291 .*use exact: false/);
  });

  it("is a RangeError before the tables are allocated (the issue's size)", () => {
    const [x, y] = rotation(10000);
    expect(() => corTest(x, y, { method: "kendall", exact: true })).toThrow(RangeError);
    // the approximation and tied data are not limited
    expect(corTest(x, y, { method: "kendall", exact: false }).statisticName).toBe("z");
    expect(corTest(x, y.map((v) => Math.floor(v / 2)), { method: "kendall", exact: true }).statisticName).toBe("z");
  });

  it("keeps the exact test below the limit", () => {
    const [x, y] = rotation(60);
    const r = corTest(x, y, { method: "kendall", exact: true });
    expect(r.statisticName).toBe("T");
    expect(r.statistic).toBe(870);
  });
});
