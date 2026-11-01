// Issue #12: lmer and a response with a large constant added (review_fix_log_issue12.md).
import { describe, expect, it } from "vitest";
import { lmer } from "../src/models/lmer.js";

const g = ["a", "a", "a", "b", "b", "b", "c", "c", "c"];
const base = [0, 20, 40, 60, 100, 120, 140, 160, 180];

describe("issue #12", () => {
  it("fits a response with a large constant added as the data themselves", () => {
    // 1e16 was rejected as fitted exactly by the fixed effects (64 eps max|y| = 142 above residuals of about 90)
    const a = lmer("y ~ 1 + (1 | g)", { y: base, g });
    for (const c of [1e12, 1e14, 1e15, 1e16]) {
      const b = lmer("y ~ 1 + (1 | g)", { y: base.map((v) => c + v), g });
      const ulp = 2 ** (Math.floor(Math.log2(c)) - 52);
      // the intercept carries the rounding of c + mean (one ulp of c), the rest is that of the centred data
      expect(Math.abs(b.fixef[0]! - c - a.fixef[0]!)).toBeLessThanOrEqual(ulp);
      expect(Math.abs(b.sigma / a.sigma - 1)).toBeLessThan(1e-12);
      expect(Math.abs(b.varCorr[0]!.sd[0]! / a.varCorr[0]!.sd[0]! - 1)).toBeLessThan(1e-12);
    }
  });

  it("still rejects a response in the column space of the fixed effects", () => {
    expect(() => lmer("y ~ 1 + (1 | g)", { y: g.map(() => 1e16), g })).toThrow(/fitted exactly by the fixed effects/);
    expect(() => lmer("y ~ 1 + (1 | g)", { y: g.map(() => 5), g })).toThrow(/fitted exactly by the fixed effects/);
  });
});
