// External review of ppois and pbinom beyond 2^53 (review_fix_log_20261031_54.md).
import { describe, expect, it } from "vitest";
import { dbinom, pbinom, ppois, qbinom, qpois } from "../src/index.js";

describe("review 54", () => {
  it("DIST-004: ppois and qpois where x + 1 rounds to x", () => {
    // Q(x + 1, lambda) became Q(x, lambda): below 1/2 at x = lambda, and the median 2 to 16384 above lambda. R's values
    const r: [number, number][] = [
      [1e16, 0.50000000265961519],
      [1e17, 0.50000000084104412],
      [1e20, 0.50000000002659615],
    ];
    for (const [l, want] of r) {
      expect(Math.abs(ppois(l, l) / want - 1)).toBeLessThan(1e-15);
      expect(qpois(0.5, l)).toBe(l); // the median of an integer mean is the mean
      expect(ppois(l, l) + ppois(l, l, { lowerTail: false })).toBeCloseTo(1, 15);
      expect(Math.exp(ppois(l, l, { logP: true })) / ppois(l, l) - 1).toBeCloseTo(0, 14);
    }
    expect(qpois(0.5, 2 ** 53)).toBe(2 ** 53);
    // below 2^53 as before
    expect(ppois(1e15, 1e15)).toBe(0.5000000084104418);
  });

  it("DIST-005: pbinom where x + 1 rounds to x", () => {
    // Binom(2m, 1/2) is symmetric about m: P[X <= m] = 1/2 + dbinom(m) / 2 (0.5 before; R too)
    const want = 0.5 + 0.5 * dbinom(1e16, 2e16, 0.5);
    expect(pbinom(1e16, 2e16, 0.5)).toBe(want);
    expect(pbinom(1e16, 2e16, 0.5, { lowerTail: false })).toBeCloseTo(1 - want, 15);
    expect(Math.exp(pbinom(1e16, 2e16, 0.5, { logP: true })) / want - 1).toBeCloseTo(0, 14);
    expect(qbinom(0.5, 2e16, 0.5)).toBe(1e16);
    // below 2^53 as before
    expect(pbinom(1e15, 2e15, 0.5)).toBe(0.5000000089206206);
  });
});
