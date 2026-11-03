// Issue #231: hist's Freedman-Diaconis rule where the range and the width overflow (review_fix_log_issue231.md).
import { describe, expect, it } from "vitest";
import { hist } from "../src/index.js";

describe("issue #231", () => {
  it("chooses the number of cells for finite data whose range and FD width overflow", () => {
    // R 4.5.2: hist(c(-1e308, 1e308), breaks = "FD") is the error "invalid number of 'breaks'" (Inf / Inf); was the same
    // error here. R: diff(range(x 2^-1024)) / (2 IQR(signif(x, 5) 2^-1024)) n^(1/3) is 1.26 (2 cells), and
    // hist(c(-1e308, 1e308), breaks = 2)$breaks is (-1e308, 0, 1e308)
    expect(hist([-1e308, 1e308], { breaks: "FD" }).breaks).toEqual([-1e308, 0, 1e308]);
    // the same ratio in R: 1.453 (2 cells) and 2.917 (3 cells); R's hist(x, breaks = 2 or 3)$breaks are (-1.7e308, 0, 1.7e308)
    for (const [x, k] of [
      [[-1.7e308, -1e308, 0, 1e308, 1.7e308], 2],
      [[-1.7e308, -1.6e308, -1.5e308, 1.7e308], 3],
    ] as const) {
      expect(hist(x, { breaks: "FD" }).breaks).toEqual(hist(x, { breaks: k }).breaks);
      expect(hist(x, { breaks: "Freedman-Diaconis" }).breaks).toEqual([-1.7e308, 0, 1.7e308]);
    }
  });

  it("keeps the breaks where the range and the width are finite", () => {
    // values before the fix (the same as R 4.5.2's)
    expect(hist([1, 2, 2, 3, 3, 3, 4, 10, 11.5], { breaks: "FD" }).breaks).toEqual([0, 2, 4, 6, 8, 10, 12]);
    expect(hist([1e300, 2e300, 2e300, 5e300], { breaks: "FD" }).breaks).toEqual([1e300, 2e300, 3e300, 4e300, 5e300]);
    expect(hist([1.7e308, 1.6e308, 1.5e308, 1e308, 0.9e308], { breaks: "FD" }).breaks).toEqual([
      5e307, 1.1e308, 1.7e308,
    ]);
  });
});
