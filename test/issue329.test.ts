// Issue #329: flignerTest with a group whose median is infinite (review_fix_log_issue329.md).
import { describe, expect, it } from "vitest";
import { flignerTest } from "../src/index.js";

describe("issue #329: flignerTest with infinite values", () => {
  it("an infinite group median is an error", () => {
    expect(() => flignerTest([1, Infinity, 2, 3], ["a", "a", "b", "b"])).toThrow(/infinite median/);
    expect(() => flignerTest([[-Infinity, Infinity], [2, 3, 5]])).toThrow(/infinite median/);
  });

  it("an infinite value about a finite median ranks last, as in R", () => {
    // fligner.test(c(1, Inf, 5, 2, 3), c("a", "a", "a", "b", "b")): 0.54581122989749336, p 0.46003429246081247
    const r = flignerTest([1, Infinity, 5, 2, 3], ["a", "a", "a", "b", "b"]);
    expect(r.statistic).toBeCloseTo(0.54581122989749336, 13);
    expect(r.pValue).toBeCloseTo(0.46003429246081247, 13);
  });
});
