// Revision of review 60: pairwiseTTest with a pooled SD and onewayTest with equal variances reject a pooled
// within-group variance of 0, as tukeyTest (review_fix_log_20261031_60_rev.md).
import { describe, expect, it } from "vitest";
import { onewayTest, pairwiseTTest, tukeyTest } from "../src/index.js";

const g = ["a", "a", "b", "b", "c", "c"];
const MSG = "the pooled within-group variance is 0";

describe("review 60 revision: pooled within-group variance 0", () => {
  it("pairwiseTTest (pooled) is an error (R 4.5.2: p 0, or NaN for equal means)", () => {
    expect(() => pairwiseTTest([1, 1, 2, 2, 3, 3], g)).toThrow(MSG);
    expect(() => pairwiseTTest([1, 1, 1, 1, 3, 3], g)).toThrow(MSG);
    expect(() => tukeyTest([1, 1, 2, 2, 3, 3], g)).toThrow(MSG);
  });
  it("pairwiseTTest with groups of one observation has no residual degrees of freedom (R: NaN)", () => {
    expect(() => pairwiseTTest([1, 2, 3], ["a", "b", "c"])).toThrow("no residual degrees of freedom");
  });
  it("onewayTest (equal variances) is an error (R 4.5.2: F Inf, p 0)", () => {
    expect(() => onewayTest([1, 1, 2, 2, 3, 3], g, { varEqual: true })).toThrow(MSG);
    expect(() => onewayTest([1, 1, 1, 1, 1, 1], g, { varEqual: true })).toThrow(MSG);
  });
  it("keeps a variance that is tiny but not 0, and the Welch test of one constant group", () => {
    const x = [1, 1 + 2 ** -52, 2, 2, 3, 3];
    expect(pairwiseTTest(x, g).pValue[0]![0]).toBeGreaterThanOrEqual(0);
    expect(onewayTest(x, g, { varEqual: true }).pValue).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(onewayTest([1, 1, 2, 3, 3, 5], g).statistic)).toBe(true);
  });
});
