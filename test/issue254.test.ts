// Issue #254: survfit's median and its confidence limits follow survival's survmean (minmin): NaN points are
// dropped, and the midpoint is taken only where a later point is lower (review_fix_log_issue254.md).
import { describe, expect, it } from "vitest";
import { survfit } from "../src/index.js";

describe("issue #254", () => {
  it("does not take the midpoint with a NaN limit", () => {
    // R 4.5.2, survival 3.8.3: survfit(Surv(c(1, 2, 3), c(1, 0, 1)) ~ 1, conf.type = "plain",
    // conf.int = 0x1.d6bdd9fd76617p-2): lower 0x1.00000055e63b9p-1 (within sqrt(eps) of 0.5) at 1 and 2, NaN at 3;
    // summary(fit)$table: median 3, LCL 1, UCL NA (the midpoint (1 + 3) / 2 = 2 before the fix)
    const fit = survfit([1, 2, 3], [1, 0, 1], { confType: "plain", confInt: 0.45970860108863704 });
    expect(fit.median).toEqual([[3, 1, NaN]]);
  });

  it("takes the midpoint only toward a lower point", () => {
    // R 4.5.2: survfit(Surv(1:4, rep(1, 4)) ~ 1, conf.type = "plain", conf.int = 2 * pnorm(2 / sqrt(3)) - 1
    // (0x1.80ea371e98fe2p-1)): lower 0.5, 0.211, 0, NaN; upper 1, 0.789, 0.5, NaN; summary(fit)$table median 2.5,
    // LCL 1.5 (toward the lower 0.211), UCL 3 (the upper is NaN after 0.5; 3.5 before the fix)
    const fit = survfit([1, 2, 3, 4], [1, 1, 1, 1], { confType: "plain", confInt: 0.75178692101007645 });
    expect(fit.median).toEqual([[2.5, 1.5, 3]]);
    // default log intervals, as R: median 2.5, LCL 1, UCL NA; with censoring 4, 3, NA
    expect(survfit([1, 2, 3, 4], [1, 1, 1, 1]).median).toEqual([[2.5, 1, NaN]]);
    expect(survfit([1, 2, 3, 4, 5, 6], [1, 0, 1, 1, 0, 1]).median).toEqual([[4, 3, NaN]]);
  });
});
