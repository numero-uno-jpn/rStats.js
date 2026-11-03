// Issue #199: the weighted QR decomposition overflowing where sqrt(w) x does although x does not
// (review_fix_log_issue199.md).
import { describe, expect, it } from "vitest";
import { lm, predict } from "../src/index.js";

const x = [0.7e308, 0.8e308, 0.9e308];
const y = [1, 2, 3];
// Rmpfr, for these doubles: intercept, slope, sigma with weights 2, standard error of the intercept
const A = -5.9999999999999993347;
const B = 9.9999999999999988923e-308;
const SIGMA_W2 = 5.7614946998468822188e-16;
const SE_A = 2.316569897537909181e-15;
const rel = (v: number, ref: number): number => Math.abs(v / ref - 1);

describe("issue #199: lm with weights whose square root makes the model matrix overflow", () => {
  it("fits the matrix form (was -Inf and 1e-307; R NaN)", () => {
    const m = lm(x, y, { weights: [2, 2, 2] });
    expect(rel(m.coefficients[0]!, A)).toBeLessThan(2e-15);
    expect(rel(m.coefficients[1]!, B)).toBeLessThan(2e-15);
    expect(m.rank).toBe(2);
    expect(Number.isFinite(m.coefTable.stdError[0]!)).toBe(true);
    // the same fit as on x / 2 (exact), whose decomposition did not overflow
    const h = lm(x.map((v) => v / 2), y, { weights: [2, 2, 2] });
    expect(m.coefficients[0]).toBe(h.coefficients[0]);
    expect(m.coefficients[1]).toBe(h.coefficients[1]! / 2);
    expect(m.sigma).toBe(h.sigma);
    expect(m.residuals).toEqual(h.residuals);
    expect(m.coefTable.stdError[0]).toBe(h.coefTable.stdError[0]);
    // predict uses the decomposition of the weights divided by 2^2
    expect(predict(m, [0.8e308, 0]).seFit).toEqual(predict(h, [0.4e308, 0]).seFit);
    expect(m.qr.qr.every((r) => r.every(Number.isFinite))).toBe(true);
  });

  it("fits the formula form (was NaN; R NaN)", () => {
    const f = lm("y ~ x", { x, y, w: [2, 2, 2] }, { weights: "w" });
    expect(f.coefficients).toEqual([-5.999999999999999, 1e-307]);
    expect(rel(f.sigma, SIGMA_W2)).toBeLessThan(1e-15);
    expect(rel(f.coefTable.stdError[0]!, SE_A)).toBeLessThan(5e-15);
    // a common factor of the weights: the coefficients of the fit without weights
    const u = lm("y ~ x", { x, y });
    expect(u.coefficients).toEqual(f.coefficients);
    expect(rel(u.coefTable.stdError[0]!, SE_A)).toBeLessThan(5e-15);
  });

  it("keeps fits whose decomposition is finite as before", () => {
    const m = lm(x, y);
    expect(m.coefficients).toEqual([-6.000000000000023, 1.0000000000000025e-307]);
    const w = lm(x, y, { weights: [0.25, 0.25, 0.25] });
    expect(w.coefficients).toEqual([-6.000000000000023, 1.0000000000000025e-307]);
    expect(w.sigma).toBe(1.2212453270876724e-15);
  });
});
