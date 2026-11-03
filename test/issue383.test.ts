// Issue #383: distSummary("weibull") formed the variance as scale * scale * v (v the variance for scale 1); for
// scale 1e155 the square overflows and the variance was Infinity for 1.31e308. Where the variance leaves the normal
// range it is now formed from the scale scaled to [1, 2) (review_fix_log_issue383.md). Reference: Rmpfr (2000 bits),
// scale^2 (Gamma(6/5) - Gamma(11/10)^2) on the exact double.
import { describe, expect, it } from "vitest";
import { distSummary } from "../src/index.js";

describe("issue #383", () => {
  it("gives the finite variance of weibull(10, 1e155)", () => {
    const s = distSummary("weibull", { shape: 10, scale: 1e155 });
    // Rmpfr 0x1.751d04363908cp+1023 and sd 0x1.b5130c02d461cp+511
    expect(s.variance).toBe(0x1751d04363908c * 2 ** (1023 - 52));
    expect(s.sd).toBe(0x1b5130c02d461c * 2 ** (511 - 52));
  });

  it("keeps the values in the normal range", () => {
    const v1 = distSummary("weibull", { shape: 10, scale: 1 }).variance;
    expect(distSummary("weibull", { shape: 10, scale: 1e150 }).variance).toBe(1e150 * 1e150 * v1);
    expect(distSummary("weibull", { shape: 10, scale: 1e160 }).variance).toBe(Infinity);
  });
});
