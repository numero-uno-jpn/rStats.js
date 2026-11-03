// Issue #229: hist with an explicit break that is not finite is an error (review_fix_log_issue229.md)
import { describe, expect, it } from "vitest";
import { hist } from "../src/index.js";

describe("issue #229", () => {
  it("rejects infinite and NaN explicit breaks", () => {
    // R 4.5.2 returns density 0 and mids NaN for c(-Inf, Inf), mids Inf for c(0, Inf), density c(0, 0) and mids
    // c(-Inf, Inf) for c(-Inf, 0.5, Inf), density c(0, 0.5) for c(-Inf, 0, 1); c(0, NaN, 1) is R's error "some 'x' not
    // counted"
    for (const breaks of [[-Infinity, Infinity], [0, Infinity], [-Infinity, 0.5, Infinity], [-Infinity, 0, 1], [0, NaN, 1]]) {
      expect(() => hist([0, 1], { breaks })).toThrow("'breaks' are not finite");
    }
  });

  it("keeps finite breaks", () => {
    // R 4.5.2: hist(c(0, 1, 2.5), breaks = c(0, 1, 3)) counts 2 1, density 2/3 1/6, mids 0.5 2
    const h = hist([0, 1, 2.5], { breaks: [0, 1, 3] });
    expect(h.counts).toEqual([2, 1]);
    expect(h.density).toEqual([2 / 3, 1 / 6]);
    expect(h.mids).toEqual([0.5, 2]);
    // a single infinite value is a number of cells, already an error
    expect(() => hist([0, 1], { breaks: [Infinity] })).toThrow("invalid number of 'breaks'");
  });
});
