// Issue #174: glmPredict with new data where the products of the linear predictor overflow and cancel
// (review_fix_log_issue174.md).
import { describe, expect, it } from "vitest";
import { glm, glmPredict } from "../src/index.js";

describe("issue #174: glmPredict with cancelling overflowing products", () => {
  // the fit is on y / 2 (scaledView); in its units the slopes are about 2 and -2, so their products with 1e308
  // overflow and the plain sum was NaN (R too)
  const fit = glm([[0.5, 0], [0, 0.5], [0.5, 0.5]], [2, -2, 0], { family: "gaussian" });

  it("gives the exact linear predictor (was NaN, R too)", () => {
    // the slopes are 4 + 2 ulp and -(4 + 1 ulp); the exact x'b for x = (1e308, 1e308) is 0x1.1ccf385ebc8ap+973 (Rmpfr)
    expect(fit.coefficients).toEqual([-0, 4.000000000000002, -4.000000000000001]);
    expect(glmPredict(fit, { newdata: [[1e308, 1e308]] }).fit).toEqual([8.881784197001252e292]);
    expect(glmPredict(fit, { newdata: [[1e308, 1e308]], type: "response" }).fit).toEqual([8.881784197001252e292]);
    // with an offset of 2^973 (the sum is exact)
    expect(glmPredict(fit, { newdata: [[1e308, 1e308]], newoffset: [2 ** 973] }).fit).toEqual([2 ** 974 * (1 + 0x0e679c2f5e45 / 2 ** 48)]);
  });

  it("keeps finite plain sums and NaN rows as before", () => {
    expect(glmPredict(fit, { newdata: [[1e300, 1e300]] }).fit).toEqual([1.1896135267822265e285]);
    expect(glmPredict(fit, { newdata: [[1, 2]] }).fit).toEqual([-4]);
    expect(glmPredict(fit, { newdata: [[1e308, NaN]] }).fit[0]).toBeNaN();
    expect(glmPredict(fit, { newdata: [[1e308, Infinity]] }).fit[0]).toBeNaN();
    // the issue's fit: the plain sum in the units of the fit is finite and keeps its bits (0x1p+972; the exact x'b
    // for its coefficients 2 + 2 ulp and -(2 + 1 ulp) is 0x1.1ccf385ebc8ap+972, not 0)
    const issue = glm([[1, 0], [0, 1], [1, 1]], [2, -2, 0], { family: "gaussian" });
    expect(glmPredict(issue, { newdata: [[1e308, 1e308]] }).fit).toEqual([2 ** 972]);
  });
});
