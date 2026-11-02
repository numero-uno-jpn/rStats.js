// Issue #139: propTest formed the total of the trials for the pooled proportion, which overflows for groups of 1e308
// trials; the pooled proportion was 0 and the statistic Inf or NaN (review_fix_log_issue139.md). R gives Inf.
// Reference: Pearson's statistic on the k x 2 table in Rmpfr (300 bits) for the doubles: 7.9999999999999976928e306 for
// x = [6e307, 4e307] (and with a third group 5e307), n = 1e308 each.
import { describe, expect, it } from "vitest";
import { propTest } from "../src/index.js";

const rel = (x: number, y: number): number => Math.abs(x / y - 1);

describe("issue #139", () => {
  it("keeps the pooled proportion where the total of the trials overflows", () => {
    const a = propTest([5e307, 5e307], [1e308, 1e308], { correct: false });
    expect(a.statistic).toBe(0);
    expect(a.pValue).toBe(1);
    expect(rel(propTest([6e307, 4e307], [1e308, 1e308], { correct: false }).statistic, 7.9999999999999976928e306)).toBeLessThan(1e-15);
    expect(rel(propTest([6e307, 4e307, 5e307], [1e308, 1e308, 1e308]).statistic, 7.9999999999999976928e306)).toBeLessThan(1e-15);
    expect(propTest([Number.MAX_VALUE / 2, Number.MAX_VALUE / 2], [Number.MAX_VALUE, Number.MAX_VALUE]).statistic).toBe(0);
  });

  it("keeps the other cases as before", () => {
    expect(propTest([83, 90, 129, 70], [86, 93, 136, 82]).statistic).toBe(12.60041129712764);
    // total finite: the value of the code before the fix
    expect(propTest([6e299, 4e299], [1e300, 1e300], { correct: false }).statistic).toBe(8.000000000000001e298);
  });
});
