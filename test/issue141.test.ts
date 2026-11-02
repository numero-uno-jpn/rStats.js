// Issue #141: chisqTest's goodness of fit formed the total of the counts first, which overflows for counts of 1e308;
// the expected counts were Inf and the statistic NaN (review_fix_log_issue141.md). R gives NaN as well.
// Reference: Rmpfr (300 bits) for the doubles 1.2e308 and 0.8e308.
import { describe, expect, it } from "vitest";
import { chisqTest } from "../src/index.js";

const rel = (x: number, y: number): number => Math.abs(x / y - 1);
const close = (got: readonly number[], want: readonly number[]): void => {
  expect(got.length).toBe(want.length);
  got.forEach((v, i) => expect(rel(v, want[i]!)).toBeLessThan(1e-15));
};

describe("issue #141", () => {
  it("keeps the expected counts where the total overflows", () => {
    const a = chisqTest([1e308, 1e308]);
    expect(a.statistic).toBe(0);
    expect(a.pValue).toBe(1);
    expect(a.expected).toEqual([1e308, 1e308]);
    expect(a.residuals).toEqual([0, 0]);

    const b = chisqTest([1.2e308, 0.8e308]);
    expect(rel(b.statistic, 7.999999999999998092e306)).toBeLessThan(1e-15);
    expect(b.pValue).toBe(0);
    close(b.expected as number[], [9.9999999999999996108e307, 9.9999999999999996108e307]);
    close(b.residuals as number[], [1.9999999999999997615e153, -1.9999999999999997615e153]);
    close(b.stdres as number[], [2.8284271247461897603e153, -2.8284271247461897603e153]);

    const c = chisqTest([1.2e308, 0.8e308], { p: [0.3, 0.7] });
    expect(rel(c.statistic, 8.5714285714285705927e307)).toBeLessThan(1e-15);
    close(c.expected as number[], [5.9999999999999995445e307, 1.3999999999999998567e308]);
    close(c.residuals as number[], [7.745966692414833792e153, -5.0709255283710986079e153]);
    close(c.stdres as number[], [9.2582009977255145681e153, -9.2582009977255123655e153]);

    // four groups (units of 2^2): 3 (2.5e307)^2 / 7.5e307 + 7.5e307
    expect(rel(chisqTest([1e308, 1e308, 1e308, 0]).statistic, 1e308)).toBeLessThan(1e-15);
  });

  it("keeps the other cases as before", () => {
    // total finite: the values of the code before the fix
    const a = chisqTest([1.2e300, 0.8e300], { p: [0.3, 0.7] });
    expect(a.statistic).toBe(8.571428571428571e299);
    expect(a.residuals).toEqual([7.745966692414834e149, -5.070925528371099e149]);
    expect(chisqTest([3, 5, 9]).statistic).toBe(3.294117647058824);
    // a simulation cannot draw an overflowing total
    expect(() => chisqTest([1e308, 1e308], { simulatePValue: true })).toThrow(RangeError);
  });
});
