// Issue #270: bartlettTest where a group's variance underflows on the common scale of all groups
// (review_fix_log_issue270.md).
import { describe, expect, it } from "vitest";
import { bartlettTest } from "../src/index.js";

const rel = (a: number, b: number): number => Math.abs(a / b - 1);

describe("issue #270", () => {
  it("takes each variance on its own scale where one underflows on the common one", () => {
    // Rmpfr from the double data: 874.08426145434560992; was Infinity and p 0, R NaN
    const r = bartlettTest([[1e200, 1.000000000000001e200], [0, 1e-100]]);
    expect(rel(r.statistic, 874.08426145434560992)).toBeLessThan(1e-15);
    expect(rel(r.pValue, 4.223594675994746e-192)).toBeLessThan(1e-12);
    // variances 1e400 apart: Rmpfr 1471.4363885383974127 (p 6.3240402667679607e-322, subnormal); was Infinity
    expect(rel(bartlettTest([[1e200, 2e200, 4e200], [1, 2, 4]]).statistic, 1471.4363885383974127)).toBeLessThan(1e-15);
    // Rmpfr 659.18897633124663058 (p 2.2423906094229280e-145); was Infinity
    const b = bartlettTest([[1e300, 2e300], [1e100, 1e100 + 1e85]]);
    expect(rel(b.statistic, 659.18897633124663058)).toBeLessThan(1e-15);
    expect(rel(b.pValue, 2.242390609422928e-145)).toBeLessThan(1e-12);
    // Rmpfr 2945.0908480545866505; was Infinity
    expect(rel(bartlettTest([[1e200, 2e200, 4e200], [1e-200, 2e-200, 4e-200]]).statistic, 2945.0908480545866505)).toBeLessThan(1e-15);
    // Rmpfr 1561.5149042266899381; was Infinity
    expect(rel(bartlettTest([[1e200, 2e200, 4e200], [1, 1 + 2 ** -40, 1 + 2 ** -39]]).statistic, 1561.5149042266899381)).toBeLessThan(1e-15);
  });

  it("leaves the other cases as before", () => {
    const r = bartlettTest([[1, 2, 3, 5], [2, 4, 4, 9], [1, 1, 2, 3]]);
    expect(r.statistic).toBe(3.055541389783424);
    expect(r.pValue).toBe(0.21701892985496135);
    // a constant group: log 0, as in R
    expect(bartlettTest([[1, 2, 3], [5, 5, 5]]).statistic).toBe(Infinity);
    expect(bartlettTest([[5, 5], [5, 5]]).statistic).toBeNaN();
  });
});
