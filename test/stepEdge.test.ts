import { describe, expect, it } from "vitest";
import { lm, glm } from "../src/entries/tests.js";
import { step, drop1, add1 } from "../src/models/step.js";
import { setSeed, rnorm, rpois, rbinom, runif } from "../src/entries/distributions.js";

// The edge cases of step (experiments/step115-edge.R, Issue #565): the search does not depend on the scale of the
// response, the predictors or the weights, on a common value, or on the scale of an offset; R breaks at some of these
// (a response of 1e300: no move; 1e-300: "AIC is -infinity"; a common value of 1e15: the AIC off by 0.4), rStats.js
// gives the path of the unscaled data with the criterion shifted as theory says.
setSeed(20261201);
const n = 80;
const col = (v: ArrayLike<number>) => Array.from(v);
const base: Record<string, (number | string)[]> = {
  x1: col(rnorm(n) as Float64Array), x2: col(rnorm(n) as Float64Array), x3: col(rnorm(n) as Float64Array),
  x4: col(rnorm(n) as Float64Array), x5: col(rnorm(n) as Float64Array),
};
const num = (k: string) => base[k] as number[];
base.f = num("x1").map((_, i) => ["a", "b", "c"][i % 3]!);
const noise = col(rnorm(n) as Float64Array);
base.y = num("x1").map((v, i) => 1 + 0.9 * v - 0.5 * num("x2")[i]! + 0.25 * num("x3")[i]! + 0.3 * (base.f![i] === "c" ? 1 : 0) + noise[i]!);
base.w = col(runif(n, 0.3, 3) as Float64Array);
base.e = col(runif(n, 1, 3) as Float64Array);
base.cnt = num("x1").map((v, i) => (rpois(1, Math.exp(0.4 + 0.5 * v + 0.3 * num("x3")[i]!)) as Float64Array)[0]!);
base.yb = num("x1").map((v, i) => (rbinom(1, 1, 1 / (1 + Math.exp(-(0.2 + 1.2 * v - 0.8 * num("x2")[i]!)))) as Float64Array)[0]!);
const upper = "~ x1 + x2 + x3 + x4 + x5 + f";
const withCol = (name: string, f: (v: number) => number, d = base) => ({ ...d, [name]: (d[name] as number[]).map(f) });
const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));

describe("step on extreme inputs", () => {
  const plain = step(lm("y ~ 1", base), base, { scope: upper });

  it("selects the same terms and shifts the criterion by n log(c²) when the response is scaled by c", () => {
    for (const c of [1e150, 1e-150, 1e300, 1e-300]) {
      const d = withCol("y", (v) => v * c);
      const r = step(lm("y ~ 1", d), d, { scope: upper });
      expect(r.anova.step).toEqual(plain.anova.step);
      r.anova.aic.forEach((a, i) => expect(near(a, plain.anova.aic[i]! + 2 * n * Math.log(c), 1e-13), `${c} ${i}`).toBe(true));
    }
  });

  it("does not depend on the scale of the predictors", () => {
    for (const c of [1e150, 1e300, 1e-300]) {
      const d = withCol("x2", (v) => v / c, withCol("x1", (v) => v * c));
      const r = step(lm("y ~ 1", d), d, { scope: upper });
      expect(r.anova.step).toEqual(plain.anova.step);
      r.anova.aic.forEach((a, i) => expect(near(a, plain.anova.aic[i]!, 1e-13)).toBe(true));
    }
  });

  it("gives the path of the rounded data with a common value of 1e8 or 1e15 in the response", () => {
    for (const c of [1e8, 1e15]) {
      const d = withCol("y", (v) => v + c);
      const back = withCol("y", (v) => v - c, d); // exact: the rounded data without the common value
      const r = step(lm("y ~ 1", d), d, { scope: upper });
      const b = step(lm("y ~ 1", back), back, { scope: upper });
      expect(r.anova.step).toEqual(b.anova.step);
      r.anova.aic.forEach((a, i) => expect(near(a, b.anova.aic[i]!, 1e-12), `${c} ${i}`).toBe(true));
      // R's warning on Σ w y² (the common value makes every fit look perfect)
      expect(r.warnings).toEqual(["attempting model selection on an essentially perfect fit is nonsense"]);
    }
  });

  it("shifts the criterion by n log c when the weights are scaled by c", () => {
    const w1 = step(lm("y ~ x1 + x2 + x3 + x4 + x5 + f", base, { weights: "w" }), base);
    for (const c of [1e200, 1e-200, 1e300]) {
      const d = withCol("w", (v) => v * c);
      const r = step(lm("y ~ x1 + x2 + x3 + x4 + x5 + f", d, { weights: "w" }), d);
      expect(r.anova.step).toEqual(w1.anova.step);
      r.anova.aic.forEach((a, i) => expect(near(a, w1.anova.aic[i]! + n * Math.log(c), 1e-13)).toBe(true));
    }
  });

  it("glm: does not depend on the scale of the predictors or of an offset", () => {
    const loge = (d: Record<string, (number | string)[]>) => ({ ...d, loge: (d.e as number[]).map(Math.log) });
    const p = step(glm("cnt ~ 1", loge(base), { family: "poisson", offset: "loge" }), loge(base), { scope: upper });
    const shifted = loge(withCol("e", (v) => v * Math.exp(100)));
    const s = step(glm("cnt ~ 1", shifted, { family: "poisson", offset: "loge" }), shifted, { scope: upper });
    expect(s.anova.step).toEqual(p.anova.step);
    s.anova.aic.forEach((a, i) => expect(near(a, p.anova.aic[i]!, 1e-12)).toBe(true));
    const b = step(glm("yb ~ 1", base, { family: "binomial" }), base, { scope: upper });
    const scaled = withCol("x2", (v) => v * 1e-150, withCol("x1", (v) => v * 1e150));
    const bs = step(glm("yb ~ 1", scaled, { family: "binomial" }), scaled, { scope: upper });
    expect(bs.anova.step).toEqual(b.anova.step);
    bs.anova.aic.forEach((a, i) => expect(near(a, b.anova.aic[i]!, 1e-12)).toBe(true));
  });

  it("drop1 and add1 keep the criterion finite for a response of 1e300", () => {
    const d = withCol("y", (v) => v * 1e300);
    const t = drop1(lm("y ~ x1 + x2 + x3", d), d);
    expect(t.aic.every(Number.isFinite)).toBe(true);
    const a = add1(lm("y ~ 1", d), d, { scope: "~ x1 + x2" });
    expect(a.aic.every(Number.isFinite)).toBe(true);
  });
});
