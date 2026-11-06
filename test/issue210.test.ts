// Issue #210: wilcoxTest where the difference of a finite observation from mu overflows (review_fix_log_issue210.md).
import { describe, expect, it } from "vitest";
import { wilcoxTest } from "../src/index.js";

const s = 2 ** -1074;

describe("issue #210: wilcoxTest with overflowing differences from mu", () => {
  it("one sample: the differences keep their order (was a three-way tie at Infinity, R too)", () => {
    // as wilcox.test(c(1, 1.1, 1.2), mu = -1): V = 6, exact p = 0.25, interval (-Inf, Inf) at level 1 (R 4.6.2)
    const r = wilcoxTest([1e308, 1.1e308, 1.2e308], { mu: -1e308, confInt: true });
    expect(r.statistic).toBe(6);
    expect(r.pValue).toBe(0.25);
    expect(r.method).toBe("Wilcoxon signed rank exact test");
    expect(r.confInt).toEqual([-Infinity, Infinity]);
    expect(r.confLevel).toBe(1);
    expect(r.estimate).toBe(1.1e308);
  });

  it("two samples: x - mu ranked against y (was tied at Infinity, R too)", () => {
    // as wilcox.test(c(1, 1.1, 1.2), c(1, 2, 3) * 1e-300, mu = -1): W = 9, exact p = 0.1
    const r = wilcoxTest([1e308, 1.1e308, 1.2e308], [1, 2, 3], { mu: -1e308 });
    expect(r.statistic).toBe(9);
    expect(r.pValue).toBe(0.1);
    expect(r.method).toBe("Wilcoxon rank sum exact test");
    // subnormal y are not merged by halving, and x = mu ties with y = 0 only: the ties of
    // wilcox.test(c(2, 2.1, 0), c(3e-300, 4e-300, 0, -1, 5e-200)), p = 0x1.2492492492494p-2 in R 4.6.2 (exact
    // conditional)
    const t = wilcoxTest([1e308, 1.1e308, -1e308], [3 * s, 4 * s, 0, -1e308, 5], { mu: -1e308 });
    expect(t.statistic).toBe(11.5);
    // (a few ulps from R's: the conditional distribution is summed differently)
    expect(Math.abs(t.pValue - 0.2857142857142858)).toBeLessThan(1e-15);
    // a single overflowing difference is not tied with y = 1e308
    expect(wilcoxTest([1e308], [1e308], { mu: -1e308 }).statistic).toBe(1);
  });

  it("keeps the results where the differences are finite, and orders infinite observations", () => {
    expect(wilcoxTest([1, 1.1, 1.2], { mu: -1 }).pValue).toBe(0.25);
    expect(wilcoxTest([1, 1.1, 1.2], [1e-300, 2e-300, 3e-300], { mu: -1 }).pValue).toBe(0.1);
    // 1e308 - mu overflows; Infinity - mu stays above it and ties with y = Infinity: as
    // wilcox.test(c(2, Inf, 1), c(Inf, 0.2, 0.1)), exact conditional p = 0.5 in R 4.6.2
    const r = wilcoxTest([1e308, Infinity, 3], [Infinity, 2, 1], { mu: -1e308 });
    expect(r.statistic).toBe(6.5);
    expect(r.pValue).toBe(0.5);
  });
});
