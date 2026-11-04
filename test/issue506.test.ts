// Issue #506: the normal-approximation interval of ansariTest with no positive ratio in the search range (all x on
// one side of 0 and all y on the other) is NaN, as the exact path, instead of a RangeError from uniroot
// (review_fix_log_issue506.md).
import { describe, expect, it } from "vitest";
import { ansariTest } from "../src/index.js";

describe("issue #506", () => {
  it("returns NaN limits and estimate when the search range is empty", () => {
    // R 4.5.2: warning "samples differ in location: cannot compute confidence set, returning NA", then the error
    // "invalid 'xmin' value"; the statistic 3 and p-value 1 are R's
    const two = ansariTest([1, 2], [-1, -2], { exact: false, confInt: true });
    expect(two.statistic).toBe(3);
    expect(two.pValue).toBe(1);
    expect(two.confInt).toEqual([NaN, NaN]);
    expect(two.estimate).toBeNaN();
    expect(ansariTest([1, 2], [-1, -2], { exact: false, confInt: true, alternative: "less" }).confInt).toEqual([0, NaN]);
    expect(ansariTest([1, 2], [-1, -2], { exact: false, confInt: true, alternative: "greater" }).confInt).toEqual([
      NaN,
      Infinity,
    ]);
    const rev = ansariTest([-1, -2], [1, 2], { exact: false, confInt: true });
    expect(rev.confInt).toEqual([NaN, NaN]);
    expect(rev.estimate).toBeNaN();
    // the same as the exact path on these data
    const exact = ansariTest([1, 2], [-1, -2], { exact: true, confInt: true });
    expect(exact.confInt).toEqual([NaN, NaN]);
    expect(exact.estimate).toBeNaN();
  });
});
