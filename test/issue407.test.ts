// Issue #407: rsignrank draws one uniform per rank with no bound on n, so a finite n such as 1e12 runs for hours and
// 1e100 never ends (i++ stops advancing past 2^53). R 4.5.2 runs up to 2147483647 (about 64 s here; 1e8 takes 3 s,
// set.seed(1); rsignrank(1, 1e8) = 2499930287935997, as here) and gives 0 without drawing beyond its integer range.
// n (after half-to-even rounding) must now be below 2^27, the domain of dsignrank, and a larger n throws before any
// uniform is drawn (review_fix_log_issue407.md).
import { describe, expect, it } from "vitest";
import { rsignrank, runif, setSeed } from "../src/index.js";

const message = "n must be less than 2^27 (134217728)";

describe("issue #407", () => {
  it("rejects n = 2^27 before drawing a uniform", () => {
    setSeed(1);
    const next = runif(1)[0];
    setSeed(1);
    expect(() => rsignrank(1, 2 ** 27)).toThrow(new RangeError(message));
    // 2^27 - 0.5 rounds half to even, to 2^27
    expect(() => rsignrank(3, 2 ** 27 - 0.5)).toThrow(RangeError);
    expect(runif(1)[0]).toBe(next);
  });

  it("rejects huge finite n before drawing a uniform", () => {
    setSeed(1);
    const next = runif(1)[0];
    setSeed(1);
    for (const n of [2147483647, 1e12, 2 ** 53 + 2, 1e100, Number.MAX_VALUE])
      expect(() => rsignrank(1, n)).toThrow(new RangeError(message));
    expect(runif(1)[0]).toBe(next);
    // nothing is generated for nn = 0
    expect(rsignrank(0, 1e100)).toEqual([]);
  });

  it("keeps small n and the invalid values", () => {
    setSeed(1);
    expect(rsignrank(5, 10)).toEqual([37, 33, 13, 29, 40]);
    expect(rsignrank(2, Infinity)).toEqual([NaN, NaN]);
    expect(rsignrank(1, -1)).toEqual([NaN]);
  });
});
