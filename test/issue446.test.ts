// Issue #446: pivotLonger's namesTransform is not applied to an unmatched optional capture (review_fix_log_issue446.md).
import { describe, expect, it } from "vitest";
import { pivotLonger } from "../src/index.js";

describe("issue #446", () => {
  it("keeps an unmatched optional group missing through namesTransform (tidyr's as.integer: 1, NA)", () => {
    const opts = { cols: ["x1", "x"], namesTo: ["prefix", "index"], namesPattern: "(x)(\\d+)?" };
    expect(pivotLonger({ x1: [10], x: [20] }, { ...opts, namesTransform: { index: Number } })).toEqual({
      prefix: ["x", "x"],
      index: [1, null],
      value: [10, 20],
    });
    expect(pivotLonger({ x1: [10], x: [20] }, opts).index).toEqual(["1", null]);
  });
});
