// Issue #25: dcauchy where pi * scale overflows (review_fix_log_issue25.md).
import { describe, expect, it } from "vitest";
import { dcauchy } from "../src/index.js";

describe("issue #25", () => {
  it("gives the (subnormal) density for a scale above 5.7e307, as its logarithm", () => {
    // pi * scale overflowed: 0 (R's too)
    const cases: [number, number, number][] = [
      [1.1e308, 0, 1e308], // |z| > 1
      [0.5e308, 0, 1e308], // |z| <= 1
      [5, 0, 1e308],
      [1.7e308, -1.7e308, 1e308], // x - location overflows
    ];
    for (const [x, location, scale] of cases) {
      const d = dcauchy(x, { location, scale });
      const want = Math.exp(dcauchy(x, { location, scale, log: true }));
      expect(d).toBeGreaterThan(0);
      // subnormal: to a few units of 2^-1074 times the relative error of the logarithm's exp
      expect(Math.abs(d - want)).toBeLessThan(1e-12 * want + 8 * Number.MIN_VALUE);
    }
  });

  it("leaves ordinary scales as before", () => {
    expect(dcauchy(1, { scale: 2 })).toBe(1 / (Math.PI * 2 * (1 + 0.25)));
    expect(dcauchy(1e308, { scale: 3e307 })).toBe(8.7608225555172e-310);
  });
});
