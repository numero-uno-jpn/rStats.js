// Issue #473: mean losing a third band of magnitudes, as sum before #374 (review_fix_log_issue473.md).
import { describe, expect, it } from "vitest";
import { mean } from "../src/index.js";
import { meanDD } from "../src/internal/summary.js";

describe("issue #473", () => {
  it("keeps a small band that the larger bands cancel around", () => {
    // exact means of the doubles (Python fractions); R 4.5.2 gives -2.2e99 for the first
    expect(mean([1e308, 1e100, 1, -1e308, -1e100])).toBe(0.2);
    expect(mean([1e308, 1e308, 1e100, 1, -1e308, -1e308, -1e100])).toBe(1 / 7);
    expect(mean([1e20, 1e3, 1e-10, -1e20, -1e3])).toBe(2.0000000000000002e-11);
    expect(mean([1e30, 1e3, 1e-10, -1e30, -1e3])).toBe(2.0000000000000002e-11);
    // the low part too: 1/5 - 0.2 and 1e-10/5 - 2.0000000000000002e-11
    expect(meanDD([1e308, 1e100, 1, -1e308, -1e100])).toEqual([0.2, -1.1102230246251566e-17]);
    expect(meanDD([1e20, 1e3, 1e-10, -1e20, -1e3])).toEqual([2.0000000000000002e-11, -1.2924697071141058e-27]);
  });

  it("leaves ordinary means unchanged", () => {
    expect(meanDD([1, 2, 3, 4])).toEqual([2.5, 0]);
    expect(meanDD([0.1, 0.2, 0.3])).toEqual([0.2, -9.25185853854297e-18]);
    expect(meanDD([1e308, 1e308, 1e308])).toEqual([1e308, 0]);
    expect(meanDD([-1e308, -1e308, 5e-324])).toEqual([-6.666666666666666e307, -3.3264005158911995e291]);
  });
});
