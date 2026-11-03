// The binomial deviance contribution of y = 0 is -2 w log(1 - mu). The direct form rounds 1 - mu first, a relative
// error of about eps/(2 mu), and gives 0 for mu below 1.1e-16 (R 4.5.2 the same; true 2 w mu). For mu < 0.1 it is
// now -2 w log1p(-mu); from mu = 0.1 on, R's form and bits (review_fix_log_binomial_y0.md).
import { describe, expect, it } from "vitest";
import { makeFamily } from "../src/models/glmFamily.js";

// -log(1 - m) = m + m^2/2 + m^3/3 + ..., summed from the small end
const minusLog1m = (m: number): number => {
  let s = 0;
  for (let k = 40; k >= 1; k--) s += m ** k / k;
  return s;
};
const rel = (x: number, y: number): number => Math.abs(x / y - 1);

describe("binomial deviance at y = 0 with a small mean", () => {
  it("is 2 w mu where 1 - mu rounds to 1 (was 0)", () => {
    for (const f of ["binomial", "quasibinomial", { family: "quasi", variance: "mu(1-mu)" }] as const) {
      const b = makeFamily(f);
      expect(b.devContribution(0, 1e-20, 1)).toBe(2e-20);
      expect(b.devContribution(0, 5e-52, 3)).toBe(3e-51);
    }
  });

  it("is accurate for small means", () => {
    const b = makeFamily("binomial");
    for (const m of [1e-12, 1e-8, 1e-5, 1e-3, 0.01]) {
      expect(rel(b.devContribution(0, m, 1), 2 * minusLog1m(m))).toBeLessThan(4e-16);
    }
  });

  it("keeps R's form from mu = 0.1 on", () => {
    const b = makeFamily("binomial");
    for (const m of [0.1, 0.25, 0.9]) expect(b.devContribution(0, m, 1)).toBe(2 * Math.log(1 / (1 - m)));
    expect(b.devContribution(0, 0.4, 1)).toBe(1.0216512475319814);
  });
});
