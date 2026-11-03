// Issue #464: mean with trim = NaN is an error, as R; only an empty x gives NaN (review_fix_log_issue464.md).
import { describe, expect, it } from "vitest";
import { mean } from "../src/index.js";

describe("issue #464", () => {
  it("trim = NaN is an error for a nonempty x", () => {
    // R 4.5.2: mean(c(1, 2, 3), trim = NaN) and mean(c(NA, 1), trim = NaN, na.rm = TRUE)
    // stop with "missing value where TRUE/FALSE needed" (NaN > 0 && n is NA)
    expect(() => mean([1, 2, 3], { trim: NaN })).toThrow(RangeError);
    expect(() => mean([NaN, 1], { trim: NaN, naRm: true })).toThrow(RangeError);
  });

  it("an empty x gives NaN, as R", () => {
    // R 4.5.2: mean(numeric(0), trim = NaN) and mean(NA_real_, trim = NaN, na.rm = TRUE) are NaN (NA && 0 is FALSE)
    expect(mean([], { trim: NaN })).toBeNaN();
    expect(mean([NaN], { trim: NaN, naRm: true })).toBeNaN();
  });
});
