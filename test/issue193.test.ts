// Issue #193: rows of weight 0 whose response or x'b overflows in the scaled units of the fit (review_fix_log_issue193.md).
import { describe, expect, it } from "vitest";
import { lm, predict } from "../src/index.js";

describe("issue #193: lm rows of weight 0 with the response scaled", () => {
  it("gives the finite residual of a row of weight 0 (was Infinity; R 1e308)", () => {
    const m = lm([[], []], [1e-308, 1e308], { weights: [1, 0] });
    expect(m.coefficients).toEqual([1e-308]);
    expect(m.fittedValues).toEqual([1e-308, 1e-308]);
    expect(m.residuals).toEqual([0, 1e308]);
    const f = lm("y ~ 1", { y: [1e-308, 1e308], w: [1, 0] }, { weights: "w" });
    expect(f.fittedValues).toEqual([1e-308, 1e-308]);
    expect(f.residuals).toEqual([0, 1e308]);
    // with a slope: R's residual 5 - 1e-8
    const s = lm([1, 2, 1e300], [1e-308, 2e-308, 5], { weights: [1, 1, 0] });
    expect(s.fittedValues[2]).toBe(1e-8);
    expect(s.residuals[2]).toBe(5 - 1e-8);
  });

  it("gives the finite fitted value where x'b overflows in the scaled units (was Infinity; R 1e10)", () => {
    const m = lm([1e-300, 2e-300, 1e10], [1e-300, 2e-300, 5], { weights: [1, 1, 0], intercept: false });
    const b = m.coefficients[0]!;
    expect(b).toBe(0.9999999999999997);
    expect(m.fittedValues[2]).toBe(1e10 * b);
    expect(m.residuals[2]).toBe(5 - 1e10 * b);
  });

  it("takes the exact inner product where the products overflow and cancel (was NaN), as predict", () => {
    const X = [[1, 0], [0, 1], [1, 1], [1e308, 1e308]];
    const y = [1.9, -1.9, 0, 0];
    const m = lm(X, y, { weights: [1, 1, 1, 0], intercept: false });
    const g = lm(X.slice(0, 3), y.slice(0, 3), { intercept: false });
    expect(m.coefficients).toEqual(g.coefficients);
    const p = predict(g, [[1e308, 1e308]]).fit[0]!;
    expect(p).toBe(-6.661338147750939e292);
    expect(m.fittedValues[3]).toBe(p);
    expect(m.residuals[3]).toBe(-p);
  });

  it("keeps the rows in the fit and non-finite rows of weight 0 as before", () => {
    const m = lm([1, 2, 1e300], [1e-308, 2e-308, 5], { weights: [1, 1, 0] });
    expect(m.fittedValues.slice(0, 2)).toEqual([1e-308, 2e-308]);
    expect(m.residuals.slice(0, 2)).toEqual([0, 0]);
    const n = lm([1, 2, 3, Infinity], [1, 2, 4, 1], { weights: [1, 1, 1, 0] });
    expect(n.fittedValues[3]).toBe(Infinity);
    expect(n.residuals[3]).toBe(-Infinity);
    const r = lm([1, 2, 3, 4], [1, 2, 4, Infinity], { weights: [1, 1, 1, 0] });
    expect(r.fittedValues[3]).toBe(5.333333333333334);
    expect(r.residuals[3]).toBe(Infinity);
  });
});
