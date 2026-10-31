// Fixes found during the 45th round (review_fix_log_20261031_46.md): distSummary's negative binomial mode beyond 2^53.
import { describe, expect, it } from "vitest";
import { distSummary, dwilcox, pwilcox, qwilcox } from "../src/index.js";

describe("review 46", () => {
  it("wilcox near the center of large samples: exact values or a RangeError, never NaN", () => {
    // exact log probabilities from BigInt counts (Harding's method on integers; R fails at m = n = 500)
    const exact: [number, number, number, number, number][] = [
      [500, 500, 125000, -9.3459210519550666, -0.69305986350122595],
      [600, 600, 150000, -22.168893845187284, -15.125912005841307],
      [700, 700, 120000, -155.37529420165728, -149.38551191107609],
      [700, 700, 0, -966.55796910206368, -966.55796910206368],
    ];
    for (const [m, n, x, d, p] of exact) {
      expect(dwilcox(x, m, n, { log: true }) / d - 1, `${m} ${x}`).toBeCloseTo(0, 14);
      expect(pwilcox(x, m, n, { logP: true }) / p - 1, `${m} ${x}`).toBeCloseTo(0, 14);
    }
    // the table's entries break down above about 150438 (600) and 187255 (700): they were NaN
    expect(() => dwilcox(180000, 600, 600)).toThrow(RangeError);
    expect(() => pwilcox(200000, 700, 700)).toThrow(RangeError);
    expect(() => qwilcox(0.5, 700, 700)).toThrow(/cannot be computed accurately/);
    // the tails of the same sizes stay available, and unequal sizes with a small m to the center
    expect(pwilcox(1000, 700, 700, { logP: true }) / -891.06243214173662 - 1).toBeCloseTo(0, 14);
    expect(Number.isFinite(dwilcox(1000000, 100, 20000))).toBe(true);
  });
  it("the negative binomial mode beyond 2^53 returns at once", () => {
    // the search stepped by mode + 1, which equals mode there (prob = 4e-201 did not return)
    const t0 = performance.now();
    expect(distSummary("nbinom", { size: 3, prob: 4e-201 }).mode).toBe(5e200);
    expect(distSummary("nbinom", { size: 3, prob: 1e-17 }).mode).toBe(2e17);
    expect(distSummary("nbinom", { size: 1e300, mu: 1e300 }).mode).toBe(1e300);
    expect(performance.now() - t0).toBeLessThan(1000);
    // below 2^53 the exact search: floor(2 (1 - 1e-15) / 1e-15) = 1999999999999998 is not the mode, 1999999999999997 is
    expect(distSummary("nbinom", { size: 3, prob: 1e-15 }).mode).toBe(1999999999999997);
    expect(distSummary("nbinom", { size: 3, prob: 0.4 }).mode).toBe(2);
  });
});
