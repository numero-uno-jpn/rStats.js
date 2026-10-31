// Fixes of the 26th review round (review_fix_log_20261031_26.md): integrate, optimize and uniroot on intervals whose
// width overflows; integrate with reversed infinite limits; uniroot's extendInt with tiny values; glm with weight 0;
// coxph with an unchanged log likelihood; SANN's temperature.
import { describe, expect, it } from "vitest";
import { coxph, glm, glmResiduals, integrate, optim, optimize, uniroot } from "../src/index.js";

const rel = (a: number, b: number): number => Math.abs(a - b) / Math.abs(b);
const g = (x: number): number => Math.exp(-x * x);
const HALF_SQRT_PI = Math.sqrt(Math.PI) / 2;

describe("review 26", () => {
  it("integrate takes the sign of an infinite limit", () => {
    expect(rel(integrate(g, 0, -Infinity).value, -HALF_SQRT_PI)).toBeLessThan(1e-10); // R 4.5.2: +0.886
    expect(integrate(g, Infinity, 1).value).toBe(-integrate(g, 1, Infinity).value); // R 4.5.2: 1.633
    expect(integrate(g, Infinity, -Infinity).value).toBe(-integrate(g, -Infinity, Infinity).value); // R 4.5.2: +1.772
    expect(integrate(g, -Infinity, 0).value).toBe(integrate(g, 0, -Infinity).value * -1);
    expect(integrate(g, Infinity, Infinity).value).toBe(0); // R 4.5.2: the whole line
    expect(integrate(g, -Infinity, -Infinity).value).toBe(0);
  });
  it("integrate, optimize and uniroot where upper - lower overflows", () => {
    const dens = (x: number): number => Math.exp(-((x / 1e307) ** 2) / 2) / Math.sqrt(2 * Math.PI) / 1e307;
    expect(integrate(dens, -1e308, 1e308).value).toBeCloseTo(1, 8); // R 4.5.2: "roundoff error was detected"
    // the search did not return
    const m = optimize((x) => -((x / 1e308 - 0.5) ** 2), -1e308, 1e308, { maximum: true });
    expect(rel(m.optimum, 5e307)).toBeLessThan(1e-6);
    expect(optimize((x) => (x / 1e308) ** 2, -1e308, 1e308).objective).toBe(0);
    expect(uniroot((x) => x, -1e308, 1e308).root).toBe(0); // was -Infinity
    expect(rel(uniroot((x) => x / 1e308 - 0.25, -1e308, 1e308, { tol: 1e-300 }).root, 2.5e307)).toBeLessThan(1e-12);
    // a width in range is unchanged
    expect(integrate(() => 1e-300, 1e308, 1.1e308).value).toBeCloseTo(1e7, 6);
  });
  it("uniroot's extendInt = 'yes' with values whose product underflows", () => {
    expect(uniroot((x) => 1e-300 * (x - 5), 1, 2, { extendInt: "yes" }).root).toBeCloseTo(5, 6); // R 4.5.2: error
    expect(uniroot((x) => x - 5, 1, 2, { extendInt: "yes" }).root).toBeCloseTo(5, 6);
  });
  it("glm: an observation of weight 0 adds nothing to the deviance", () => {
    const fit = glm([[], []], [1e308, 1], { family: "poisson", intercept: false, weights: [0, 1] });
    expect(fit.deviance).toBe(0); // R 4.5.2: NaN
    const x = [[1], [2], [3], [4]];
    const y = [1e308, 1, 2, 4];
    const w = glm(x, y, { family: "poisson", weights: [0, 1, 1, 1] });
    const ref = glm(x.slice(1), y.slice(1), { family: "poisson" });
    expect(w.deviance).toBeCloseTo(ref.deviance, 10);
    expect(glmResiduals(w)[0]).toBe(0);
  });
  it("coxph with an unchanged log likelihood of 0 converges", () => {
    const m = coxph([1], [1], [[0]]);
    expect(m.warnings).toEqual([]); // R 4.5.2: "Ran out of iterations and did not converge"
  });
  it("SANN's temperature must be positive and finite", () => {
    const fn = (x: number[]): number => x[0]! ** 2;
    expect(() => optim([1], fn, { method: "SANN", control: { temp: 0 } })).toThrow("'temp' must be a positive finite number");
    expect(() => optim([1], fn, { method: "SANN", control: { temp: -1 } })).toThrow("'temp' must be a positive finite number");
    expect(() => optim([1], fn, { method: "SANN", control: { temp: Infinity } })).toThrow("'temp' must be a positive finite number");
  });
});
