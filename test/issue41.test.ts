// Issue #41: pkolmogorovLimit at subnormal x, where sqrt(2 pi) / x overflowed (review_fix_log_issue41.md).
import { describe, expect, it } from "vitest";
import { pkolmogorovLimit } from "../src/htest/core/kolmogorov.js";

describe("issue #41", () => {
  it("is 0 (lower) and 1 (upper) where the series underflows and the prefactor overflows", () => {
    // Inf * 0 gave NaN
    for (const x of [5e-324, 1e-310, 1e-308]) {
      expect(pkolmogorovLimit(x, true)).toBe(0);
      expect(pkolmogorovLimit(x, false)).toBe(1);
    }
  });

  it("leaves other values as before", () => {
    expect(pkolmogorovLimit(1e-200, true)).toBe(0);
    expect(pkolmogorovLimit(1e-200, false)).toBe(1);
    expect(pkolmogorovLimit(0.05, true)).toBe(2.423167479157699e-213);
    expect(pkolmogorovLimit(0.5, true)).toBe(0.0360547563351249);
    expect(pkolmogorovLimit(1.5, false)).toBe(0.022217962616525127);
  });
});
