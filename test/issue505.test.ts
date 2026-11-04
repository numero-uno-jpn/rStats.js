// Issue #505: merge matches a numeric key with its text ("1", "1.5"), as R's merge; the trailing zeros of
// toPrecision(15) are dropped by Number() before the text is formed (review_fix_log_issue505.md).
import { describe, expect, it } from "vitest";
import { merge } from "../src/index.js";

describe("issue #505", () => {
  it("numeric keys match their text, as R 4.5.2", () => {
    // R 4.5.2: merge(data.frame(id = 1, x = 10), data.frame(id = "1", y = 20)) has one row, id num 1 (also 1.5)
    expect(merge({ id: [1], x: [10] }, { id: ["1"], y: [20] })).toEqual({ id: [1], x: [10], y: [20] });
    expect(merge({ id: [1.5], x: [10] }, { id: ["1.5"], y: [20] })).toEqual({ id: [1.5], x: [10], y: [20] });
    expect(merge({ id: [1], k: ["a"], x: [10] }, { id: ["1"], k: ["a"], y: [20] })).toEqual({
      id: [1],
      k: ["a"],
      x: [10],
      y: [20],
    });
    expect(merge({ id: [1e5], x: [10] }, { id: ["1e+05"], y: [20] })).toEqual({ id: [1e5], x: [10], y: [20] });
  });
});
