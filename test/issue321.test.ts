// Issue #321: the exact jonckheereTest has a size limit on its convolution (review_fix_log_issue321.md).
import { describe, expect, it } from "vitest";
import { jonckheereTest } from "../src/index.js";

const groups = (sizes: number[]): [number[], number[]] => {
  const x: number[] = [];
  const g: number[] = [];
  sizes.forEach((s, k) => {
    for (let i = 0; i < s; i++) {
      x.push(x.length);
      g.push(k);
    }
  });
  return [x, g];
};

describe("issue #321", () => {
  it("is a RangeError above 2^32 multiply-adds (boundary)", () => {
    // three groups of 215: 4273732377 multiply-adds <= 2^32 (8.5 s on the development machine; not run here);
    // 216: 4353797954
    const [x, g] = groups([216, 216, 216]);
    expect(() => jonckheereTest(x, g, { exact: true })).toThrow(/4353797954 steps.*use exact: false/);
  });

  it("is a RangeError above 2^24 values, before the Mann-Whitney tables are built", () => {
    // two groups: one convolution step, but 4096 * 4097 + 1 > 2^24 values
    const [x, g] = groups([4096, 4097]);
    expect(() => jonckheereTest(x, g, { exact: true })).toThrow(/16781313 values/);
    expect(jonckheereTest(x, g, { exact: false }).pValue).toBe(0);
  });

  it("keeps the exact test below the limit", () => {
    const [x, g] = groups([3, 4, 5]);
    // all in increasing order: JT is its maximum, P = 1 / (12! / (3! 4! 5!)) = 1 / 27720
    const r = jonckheereTest(x, g, { exact: true, alternative: "increasing" });
    expect(r.statistic).toBe(47);
    expect(r.pValue).toBeCloseTo(1 / 27720, 15);
  });
});
