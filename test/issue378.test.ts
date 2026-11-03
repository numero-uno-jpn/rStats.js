// Issue #378: distSummary("nbinom") formed the variance as size q / (prob * prob); for size 1e-300, prob 1e-200 the
// square underflows and the variance was Infinity for 1e100. Where the variance leaves the normal range it is now
// formed from size and prob scaled to [1, 2) (review_fix_log_issue378.md). Reference: Rmpfr (2000 bits).
import { describe, expect, it } from "vitest";
import { distSummary } from "../src/index.js";

describe("issue #378", () => {
  it("gives the finite variance where prob^2 underflows", () => {
    const s = distSummary("nbinom", { size: 1e-300, prob: 1e-200 });
    // Rmpfr 0x1.249ad2594c37dp+332 (1e100)
    expect(s.variance).toBe(0x1249ad2594c37d * 2 ** (332 - 52));
    expect(Math.abs(s.sd / 1e50 - 1)).toBeLessThan(2.3e-16);
    expect(s.mean).toBe(1e-100);
  });

  it("keeps the values in the normal range", () => {
    expect(distSummary("nbinom", { size: 3, prob: 0.25 }).variance).toBe(36);
    expect(distSummary("nbinom", { size: 1e-100, prob: 1e-100 }).variance).toBe((1e-100 * (1 - 1e-100)) / (1e-100 * 1e-100));
    expect(distSummary("nbinom", { size: 1, prob: 1e-200 }).variance).toBe(Infinity);
  });
});
