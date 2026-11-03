// Issue #479: the inverse Gaussian AIC where 2 pi deviance overflows although deviance / sum(w) is finite
// (review_fix_log_issue479.md).
import { describe, expect, it } from "vitest";
import { familyAic, makeFamily, Warnings } from "../src/models/glmFamily.js";

const fam = makeFamily("inverse.gaussian");
const aic = (y: number[], w: number[], dev: number): number => familyAic(fam, y, y, w, undefined, dev, new Warnings());

describe("issue #479", () => {
  it("gives the finite AIC where 2 pi dev overflows", () => {
    // sw = 1e308, dev = 3e307: R 4.5.2 (dev / sw 2 pi) and Rmpfr 0x1.d159f41411c0cp+1023; log(2 pi) + log(dev / sw)
    // is one ulp below (was Infinity)
    const v = aic([1], [1e308], 3e307);
    expect(Math.abs(v - 0x1d159f41411c0c * 2 ** 971)).toBeLessThanOrEqual(2 ** 971);
    // sw = 1e-10, dev = 1e308 (dev / sw overflows too, R Inf): Rmpfr 0x1.0000009dda58fp+1
    expect(aic([1], [1e-10], 1e308)).toBe(0x10000009dda58f * 2 ** -51);
  });

  it("keeps the AIC where 2 pi dev is finite", () => {
    // R 4.5.2: inverse.gaussian()$aic(c(1.5, 2.5), NULL, mu, c(3, 4), 0.7) = 0x1.46447ab0cae94p+4
    expect(aic([1.5, 2.5], [3, 4], 0.7)).toBe(0x146447ab0cae94 * 2 ** -48);
  });
});
