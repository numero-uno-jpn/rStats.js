// Issue #379: distSummary rejected pois lambda = 0 and nbinom size = 0 (all NaN), which dpois/ppois/qpois and
// dnbinom/pnbinom/qnbinom (and R) treat as the point mass at 0. User decision (2026-11-03): the point mass, with the
// mu parameterization too; skewness and kurtosis NaN as for the other point masses (review_fix_log_issue379.md).
import { describe, expect, it } from "vitest";
import { distSummary } from "../src/index.js";

const POINT = { mean: 0, variance: 0, sd: 0, median: 0, mode: 0, skewness: NaN, kurtosis: NaN };

describe("issue #379", () => {
  it("gives the point mass at 0 for lambda = 0 and size = 0", () => {
    expect(distSummary("pois", { lambda: 0 })).toEqual(POINT);
    expect(distSummary("nbinom", { size: 0, prob: 0.5 })).toEqual(POINT);
    expect(distSummary("nbinom", { size: 0, prob: 1 })).toEqual(POINT);
    expect(distSummary("nbinom", { size: 0, mu: 5 })).toEqual(POINT);
    expect(distSummary("nbinom", { size: 0, mu: 0 })).toEqual(POINT);
    // the same as the point masses already handled
    expect(distSummary("binom", { size: 0, prob: 0.3 })).toEqual(POINT);
  });

  it("keeps invalid parameters NaN and positive ones unchanged", () => {
    const nan = { mean: NaN, variance: NaN, sd: NaN, median: NaN, mode: NaN, skewness: NaN, kurtosis: NaN };
    expect(distSummary("pois", { lambda: -1 })).toEqual(nan);
    expect(distSummary("nbinom", { size: 0, prob: 0 })).toEqual(nan);
    expect(distSummary("nbinom", { size: 0 })).toEqual(nan);
    expect(distSummary("nbinom", { size: 0, mu: -1 })).toEqual(nan);
    expect(distSummary("nbinom", { size: 0, mu: Infinity })).toEqual(nan);
    expect(distSummary("pois", { lambda: 4 })).toEqual({ mean: 4, variance: 4, sd: 2, median: 4, mode: 4, skewness: 0.5, kurtosis: 0.25 });
  });
});
