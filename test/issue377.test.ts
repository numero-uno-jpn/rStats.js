// Issue #377: distSummary("exp") formed the variance as 1 / (rate * rate); for rate 1e155 the square overflows and
// the variance was 0 for 1e-310. Where the variance leaves the normal range it is now formed from the rate scaled to
// [1, 2) (review_fix_log_issue377.md). Reference: Rmpfr (2000 bits) on the exact double.
import { describe, expect, it } from "vitest";
import { distSummary } from "../src/index.js";

describe("issue #377", () => {
  it("gives the subnormal variance of exp(1e155)", () => {
    const s = distSummary("exp", { rate: 1e155 });
    // Rmpfr 0x1.2688b70e62bp-1030
    expect(s.variance).toBe(0x12688b70e62b * 2 ** -1074);
    expect(s.sd).toBe(1e-155);
  });

  it("keeps the values in the normal range", () => {
    expect(distSummary("exp", { rate: 4 }).variance).toBe(1 / 16);
    expect(distSummary("exp", { rate: 1e150 }).variance).toBe(1 / (1e150 * 1e150));
    expect(distSummary("exp", { rate: 1e-160 }).variance).toBe(Infinity);
  });
});
