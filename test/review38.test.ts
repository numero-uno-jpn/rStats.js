// Fixes of the 38th review round (review_fix_log_20261031_38.md): mauchlyTest with fewer residual degrees of freedom
// than dimensions.
import { describe, expect, it } from "vitest";
import { mauchlyTest } from "../src/index.js";

describe("review 38", () => {
  it("mauchlyTest needs at least as many residual df as dimensions", () => {
    // R 4.5.2: NaN; W = 0 with p = 1; W 2e-17 with p 9e-4. Here W was 4e-33 or even -3.2e-33, p NaN or 1
    expect(() => mauchlyTest([[1, 2], [3, 7]])).toThrow("too few residual degrees of freedom for the test: 1 for 2 dimension(s)");
    expect(() => mauchlyTest([[1, 2, 5], [3, 7, 4]])).toThrow("1 for 3 dimension(s)");
    expect(() => mauchlyTest([[1, 2, 5], [3, 7, 4], [2, 1, 9]])).toThrow("2 for 3 dimension(s)");
    // n = pp: a test
    const r = mauchlyTest([[1, 2, 5], [3, 7, 4], [2, 1, 9], [4, 4, 2]]);
    expect(r.statistic).toBeCloseTo(0.17282089212562585, 12);
    expect(r.pValue).toBeCloseTo(0.7377087397776683, 12);
  });
});
