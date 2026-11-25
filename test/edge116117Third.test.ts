import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { lm, glm, setSeed } from "../src/index.js";
import { sobelTest, mediationMonteCarlo, moderatedMediation, johnsonNeyman } from "../src/entries/causal.js";
import { tobit, tobitSummary, betareg, betaregConfint, betaregSummary, betaregPredict, loglm } from "../src/entries/regression.js";

// The third edge-case pass over 1.16.0 and 1.17.0 (done in 1.18.0; experiments/qccbt118-log.md 22, 23): overflow,
// underflow and cancellation at scales 1e+-150 to 1e+-300, against R where R computes (experiments/qccbt118-old-extreme.R).
const R = JSON.parse(readFileSync(new URL("../experiments/qccbt118-old-extreme.json", import.meta.url), "utf8")) as Record<string, any>;
const rel = (a: number, b: number) => (a === b ? 0 : Math.abs(a - b) / Math.abs(b));
const d0 = {
  X: [0, 0, 0, 0, 0, 1, 1, 1, 1, 1], M: [1.1, 0.4, 0.9, 1.6, 0.2, 1.9, 1.3, 2.6, 1.0, 1.8],
  Y: [2.0, 1.1, 1.5, 2.4, 0.8, 3.1, 2.2, 3.9, 1.9, 2.8], W: [3.1, 2.2, 4.0, 2.8, 3.5, 2.9, 3.8, 2.4, 3.3, 4.2],
  B: [0, 0, 1, 1, 0, 1, 1, 1, 0, 1],
};
const scaled = (f: Record<string, number>, add: Record<string, number> = {}) =>
  Object.fromEntries(Object.entries(d0).map(([k, v]) => [k, v.map((x) => x * (f[k] ?? 1) + (add[k] ?? 0))])) as typeof d0;

describe("1.16.0: Sobel, Monte Carlo, moderated mediation, Johnson-Neyman", () => {
  const sob = (d: typeof d0) => sobelTest(lm("M ~ X", d), lm("Y ~ X + M", d), { treat: "X", mediator: "M" });
  it.each([1e150, 1e-150])("Sobel with M and Y times %s: ab and SE scale, p stays", (s) => {
    const a = sob(d0), b = sob(scaled({ M: s, Y: s }));
    expect(rel(b.ab / s, a.ab)).toBeLessThan(1e-13);
    expect(rel(b.se / s, a.se)).toBeLessThan(1e-13);
    expect(rel(b.p, a.p)).toBeLessThan(1e-12);
  });
  it.each([1e200, 1e-200])("Sobel and Monte Carlo at %s: an error (the variances are not doubles; R's are NA or 0)", (s) => {
    expect(R.lm_var[s > 1 ? "s200" : "sm200"].some((v: number | null) => v === null || v === 0)).toBe(true);
    expect(() => sob(scaled({ M: s, Y: s }))).toThrow("out of the double range");
    const d = scaled({ M: s, Y: s });
    expect(() => mediationMonteCarlo(lm("M ~ X", d), lm("Y ~ X + M", d), { treat: "X", mediator: "M", nmc: 100 })).toThrow("out of the double range");
  });
  const jn = (d: typeof d0) => johnsonNeyman(lm("Y ~ X * W", d), d, { pred: "X", modx: "W", alpha: 0.1 }).bounds;
  it("Johnson-Neyman equals R's and is exact under scaling (R fails at Y x 1e+-150)", () => {
    const b0 = jn(d0);
    b0.forEach((v, i) => expect(rel(v, R.jn.base[i])).toBeLessThan(1e-12));
    expect(R.jn.y150.error).toBeDefined();
    for (const s of [1e150, 1e-150]) {
      jn(scaled({ Y: s })).forEach((v, i) => expect(rel(v, b0[i]!)).toBeLessThan(1e-13));
      jn(scaled({ W: s })).forEach((v, i) => expect(rel(v / s, b0[i]!)).toBeLessThan(1e-13));
    }
    expect(() => jn(scaled({ Y: 1e300 }))).toThrow("out of the double range");
    // W + 1e8: the interaction is aliased, as in R (R's coefficients are NA there)
    expect(R.jn.wshift_coef.slice(2)).toEqual([null, null]);
    expect(() => jn(scaled({}, { W: 1e8 }))).toThrow("aliased");
  });
  it("moderated mediation with W times 1e150: the same distribution (different draws from the graded covariance)", () => {
    const run = (s: number, seed: number) => {
      const d = scaled({ W: s });
      setSeed(seed);
      return moderatedMediation(glm("B ~ X + W", d, { family: "binomial" }), lm("Y ~ X + B * W", d), d,
        { treat: "X", mediator: "B", moderator: "W", sims: 2000 }).index.estimate;
    };
    const a = [1, 2, 3].map((k) => run(1, k)), b = [1, 2, 3].map((k) => run(1e150, k));
    const mean = (v: number[]) => v.reduce((x, y) => x + y) / v.length;
    expect(Math.abs(mean(a) - mean(b))).toBeLessThan(0.03); // Monte Carlo sd of a mean of 3 runs: about 0.007
  });
});

describe("1.17.0: tobit, betareg, loglm", () => {
  const td = {
    y: [0, 0.4, 1.3, 0, 2.2, 0.9, 0, 3.1, 1.7, 0, 2.6, 1.1],
    x: [0.5, 1.2, 2.1, 0.3, 3.4, 1.8, 0.9, 4.2, 2.6, 0.2, 3.8, 2.3], z: [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8],
  };
  it("tobit with x + 1e8 gives R's fit (it was NaN: collinear with the intercept to the Cholesky tolerance)", () => {
    const f = tobit("y ~ x + z", { ...td, x: td.x.map((v) => v + 1e8) }), r = R.tobit.shift;
    f.coefficients.forEach((v, j) => expect(rel(v, r.coef[j])).toBeLessThan(1e-9));
    expect(rel(tobitSummary(f).wald!.statistic, r.wald)).toBeLessThan(1e-8);
    tobitSummary(f).se.forEach((v, j) => expect(rel(v, r.se[j])).toBeLessThan(1e-7));
  });
  it.each([1e300, 1e-300])("tobit with x times %s: coefficients, SE and the Wald test scale exactly (R fails)", (s) => {
    const a = tobit("y ~ x + z", td), b = tobit("y ~ x + z", { ...td, x: td.x.map((v) => v * s) });
    const sa = tobitSummary(a), sb = tobitSummary(b);
    expect(rel(b.coefficients[1]! * s, a.coefficients[1]!)).toBeLessThan(1e-14);
    expect(rel(sb.se[1]! * s, sa.se[1]!)).toBeLessThan(1e-13);
    expect(rel(sb.wald!.statistic, sa.wald!.statistic)).toBeLessThan(1e-13);
  });
  const bd = { y: [0.21, 0.35, 0.3, 0.52, 0.48, 0.66, 0.6, 0.81, 0.44, 0.73, 0.27, 0.58], x: [1, 2, 3, 4, 5, 6, 7, 8, 4.5, 7.5, 2.5, 5.5] };
  it.each([1e300, 1e-300])("betareg with x times %s: confint and SE scale exactly for ML, BC and BR (R fails)", (s) => {
    for (const type of ["ML", "BC", "BR"] as const) {
      const a = betareg("y ~ x", bd, { type }), b = betareg("y ~ x", { ...bd, x: bd.x.map((v) => v * s) }, { type });
      const ca = betaregConfint(a), cb = betaregConfint(b);
      expect(rel(cb.lower[1]! * s, ca.lower[1]!)).toBeLessThan(1e-11);
      expect(rel(cb.upper[1]! * s, ca.upper[1]!)).toBeLessThan(1e-11);
      expect(rel(betaregSummary(b).mean.se[1]! * s, betaregSummary(a).mean.se[1]!)).toBeLessThan(1e-11);
      const p = betaregPredict(b, { newdata: { x: [2 * s] } }) as number[], q = betaregPredict(a, { newdata: { x: [2] } }) as number[];
      expect(rel(p[0]!, q[0]!)).toBeLessThan(1e-11);
    }
  });
  it("betareg with a response of 1e-300: an error (R: NaNs produced)", () => {
    expect(R.betareg.y0.warning).toBe("NaNs produced");
    expect(() => betareg("y ~ x", { ...bd, y: bd.y.map((v, i) => (i === 0 ? 1e-300 : v)) })).toThrow("singular");
  });
  it("loglm's deviance is proportional to counts times 1e+-300 (the fit stops at R's absolute eps = 0.1, as R)", () => {
    const tab = { counts: [32, 11, 10, 3, 53, 50, 25, 15, 10, 10, 7, 7, 3, 30, 5, 8], dim: [2, 2, 4], names: ["A", "B", "C"] };
    const a = loglm("~ A + B + C", tab);
    for (const s of [1e300, 1e-300]) expect(rel(loglm("~ A + B + C", { ...tab, counts: tab.counts.map((v) => v * s) }).deviance / s, a.deviance)).toBeLessThan(1e-12);
  });
  it("tobit fits 1e5 rows within seconds", () => {
    const n = 100000, x = Array.from({ length: n }, (_, i) => Math.sin(i)), y = x.map((v, i) => Math.max(0, 0.5 + v + Math.cos(3 * i)));
    const t0 = performance.now();
    expect(tobit("y ~ x", { y, x }).coefficients.every(Number.isFinite)).toBe(true);
    expect(performance.now() - t0).toBeLessThan(10000);
  });
});
