// Issue #230: hist's Scott rule where the range and the width overflow (review_fix_log_issue230.md).
import { describe, expect, it } from "vitest";
import { hist } from "../src/index.js";

describe("issue #230", () => {
  it("chooses the number of cells for finite data whose range and Scott width overflow", () => {
    // R 4.5.2: hist(c(-1e308, 1e308), breaks = "Scott") is the error "invalid number of 'breaks'" (Inf / Inf); was the
    // same error here. R's nclass.scott of the data times 2^-1024 is 1 (ratio 0.509), and
    // hist(c(-1e308, 1e308), breaks = 1)$breaks is (-1e308, 0, 1e308)
    expect(hist([-1e308, 1e308], { breaks: "Scott" }).breaks).toEqual([-1e308, 0, 1e308]);
    // nclass.scott of the data times 2^-1024: 2 (ratio 1.191) and 1 (ratio 0.933); the breaks of those counts
    for (const [x, k] of [
      [[-1.7e308, -1e308, 0, 1e308, 1.7e308], 2],
      [[-1.7e308, -1.6e308, -1.5e308, 1.7e308], 1],
    ] as const) {
      expect(hist(x, { breaks: "Scott" }).breaks).toEqual(hist(x, { breaks: k }).breaks);
      expect(hist(x, { breaks: "Scott" }).breaks).toEqual([-1.7e308, 0, 1.7e308]);
    }
  });

  it("keeps the breaks where the range and the width are finite", () => {
    // values before the fix
    expect(hist([1, 2, 2, 3, 3, 3, 4, 10, 11.5], { breaks: "Scott" }).breaks).toEqual([0, 5, 10, 15]);
    expect(hist([1e300, 2e300, 2e300, 5e300], { breaks: "Scott" }).breaks).toEqual([0, 2e300, 4e300, 6e300]);
    expect(hist([1.7e308, 1.6e308, 1.5e308, 1e308, 0.9e308], { breaks: "Scott" }).breaks).toEqual([
      5e307, 1.1e308, 1.7e308,
    ]);
  });
});
