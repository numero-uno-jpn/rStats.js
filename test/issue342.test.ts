// Issue #342: mauchlyTest with one tested dimension (review_fix_log_issue342.md).
import { describe, expect, it } from "vitest";
import { mauchlyTest } from "../src/index.js";

describe("issue #342", () => {
  it("rejects a one-dimensional contrast space", () => {
    // R 4.5.2: mauchly.test(lm(Y ~ 1), M = diag(3), X = diag(3)[, 1:2]) gives W 1 and p 1 whatever the data;
    // was W 1 and p 1 here
    expect(() => mauchlyTest([[1], [2], [4], [8]])).toThrow("one tested dimension");
    const Y = [[1, 2, 3], [2, 1, 3], [4, 5, 1], [8, 3, 9]];
    expect(() => mauchlyTest(Y.map((r) => r.slice(0, 2)), { X: "~1" })).toThrow("one tested dimension");
  });

  it("keeps two or more dimensions", () => {
    // R: W 0.47639, p 0.4764 (the value before the fix)
    const r = mauchlyTest([[1, 2, 3], [2, 1, 3], [4, 5, 1], [8, 3, 9]], { X: "~1" });
    expect(r.statistic).toBe(0.47638962579195404);
    expect(r.pValue).toBe(0.4763896257919541);
  });
});
