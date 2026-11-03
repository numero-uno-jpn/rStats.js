// Issue #195: predict for lm where the products of the linear predictor overflow and cancel (review_fix_log_issue195.md).
import { describe, expect, it } from "vitest";
import { lm, predict } from "../src/index.js";

const fit = lm([[1, 0], [0, 1], [1, 1]], [2, -2, 0], { intercept: false });

describe("issue #195: predict(lm) with cancelling overflowing products", () => {
  it("gives the exact linear predictor (was NaN, R too)", () => {
    // the coefficients are 2 + 1 ulp and -(2 + 2 ulp), as in R; the exact x'b for x = (1e308, 1e308) is
    // -0x1.1ccf385ebc8ap+972 (Rmpfr), not 0
    expect(fit.coefficients).toEqual([2.0000000000000004, -2.000000000000001]);
    expect(predict(fit, [[1e308, 1e308]]).fit).toEqual([-4.440892098500626e292]);
    const ci = predict(fit, [[1e308, 1e308]], { interval: "confidence" });
    expect(ci.fit).toEqual([-4.440892098500626e292]);
    expect(ci.lwr![0]).toBeLessThan(ci.fit[0]!);
    expect(ci.upr![0]).toBeGreaterThan(ci.fit[0]!);
  });

  it("keeps finite plain sums and NaN rows as before", () => {
    // the plain sum at 1e300 is finite and keeps its bits (rounding noise of the products, as R)
    expect(predict(fit, [[1e300, 1e300]]).fit).toEqual([-5.948067633911132e284]);
    expect(predict(fit, [[1, 2]]).fit).toEqual([-2.0000000000000013]);
    expect(predict(fit, [[1e308, NaN]]).fit[0]).toBeNaN();
    expect(predict(fit, [[1e308, Infinity]]).fit[0]).toBeNaN();
  });
});
