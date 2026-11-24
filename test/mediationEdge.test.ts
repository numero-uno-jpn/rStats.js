// Edge cases of mediate, simSlopes and mvrnorm (experiments/mediation116-edge.R; R's results where R works, theory
// where it does not)
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { mediate, type MediateResult } from "../src/causal/mediate.js";
import { simSlopes } from "../src/causal/moderation.js";
import { mvrnorm, symmetricSqrt } from "../src/random/mvrnorm.js";
import { lm } from "../src/models/lm.js";
import { setSeed } from "../src/random/rng.js";
import type { DataFrame } from "../src/models/modelFrame.js";

const E = JSON.parse(readFileSync(new URL("../experiments/mediation116-edge.json", import.meta.url), "utf8")) as any;
const D = E.data;
const rel = (a: number, b: number) => Math.abs(a - b) / Math.max(1e-300, Math.abs(b));
const KEYS = [["d0", "d0"], ["d1", "d1"], ["z0", "z0"], ["z1", "z1"], ["tau", "tau"], ["n0", "n0"], ["n1", "n1"], ["d.avg", "dAvg"], ["z.avg", "zAvg"], ["n.avg", "nAvg"]] as const;
const scaled = (s: number, cv = 0): DataFrame => ({ X: D.X, M: D.M.map((v: number) => v * s + cv), Y: D.Y.map((v: number) => v * s), C: D.C.map((v: number) => v * s + cv) });
const run = (d: DataFrame, opts: Record<string, unknown> = {}, fm = "M ~ X + C", fy = "Y ~ X + M + C", med = "M"): MediateResult => {
  setSeed(1234);
  return mediate(lm(fm, d), lm(fy, d), d, { treat: "X", mediator: med, sims: 100, ...opts });
};
/** Our result against R's (experiments/mediation116-edge.json), every draw */
function againstR(r: MediateResult, want: any, tol: number, scale = 1): void {
  for (const [rk, tk] of KEYS) {
    const w = want.result[rk], g = r[tk];
    const s = rk.startsWith("n") ? 1 : scale;
    w.sims.forEach((v: number, j: number) => expect(Math.abs(g.sims[j]! - v) / Math.max(s, Math.abs(v))).toBeLessThan(tol));
    expect(Math.abs(g.estimate - w.est) / Math.max(s, Math.abs(w.est))).toBeLessThan(tol);
    expect(g.p).toBe(w.p);
  }
}

describe("mediate on extreme scales", () => {
  const one = run(scaled(1), { boot: true });
  for (const s of [1e-150, 1e150, 1e-300, 1e300]) {
    it(`the bootstrap is exactly equivariant at x ${s} (R: ${s === 1e300 ? "an error" : "the same"})`, () => {
      const r = run(scaled(s), { boot: true });
      for (const [, tk] of KEYS) {
        const f = tk.startsWith("n") ? 1 : s;
        r[tk].sims.forEach((v, j) => expect(rel(v, one[tk].sims[j]! * f)).toBeLessThan(1e-10));
      }
      const R = E.scales.find((x: any) => x.s === s).boot;
      if (s === 1e300) expect(R.error).toBe("missing value where TRUE/FALSE needed");
      else againstR(r, R, 1e-10, s);
    });
  }
  it("quasi-Bayes at x 1e+-150: the same distribution as at x 1 (R's draws break down there)", () => {
    const base = run(scaled(1), { sims: 4000 });
    for (const s of [1e-150, 1e150]) {
      const r = run(scaled(s), { sims: 4000 });
      for (const tk of ["d0", "z0", "tau"] as const) {
        const v = base[tk].sims, m = v.reduce((a, b) => a + b, 0) / v.length;
        const sd = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (v.length - 1));
        r[tk].ci.forEach((c, i) => expect(Math.abs(c / s - base[tk].ci[i]!)).toBeLessThan(0.15 * sd));
      }
      // R: d0 of 2e251 at x 1e150, of 1.3e-151 with a proportion mediated of 5.6e-144 at x 1e-150
      expect(Math.abs(E.scales.find((x: any) => x.s === s).quasi.result.n0.est - base.n0.estimate)).toBeGreaterThan(0.1);
    }
  });
  it("quasi-Bayes at x 1e+-300: an error (the covariance leaves the double range; R errors too)", () => {
    for (const s of [1e-300, 1e300]) {
      expect(() => run(scaled(s))).toThrow("out of the double range");
      expect(E.scales.find((x: any) => x.s === s).quasi.error).toBe("infinite or missing values in 'x'");
    }
  });
  it("the symmetric square root of a graded covariance is accurate (S S = V to the diagonal's scale)", () => {
    for (const s of [1e-150, 1e150, 1e-100, 1e100]) {
      const V = [[4 * s * s, 1.2 * s, 0.3 * s], [1.2 * s, 1, -0.2], [0.3 * s, -0.2, 0.5]];
      const S = symmetricSqrt(V);
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
        const ss = S[i]!.reduce((a, v, k) => a + v * S[k]![j]!, 0);
        expect(Math.abs(ss - V[i]![j]!) / (Math.sqrt(V[i]![i]!) * Math.sqrt(V[j]![j]!))).toBeLessThan(1e-13);
      }
    }
  });
  it("large common values: an error for the aliased coefficient, as R", () => {
    for (const cv of [1e8, 1e15]) {
      expect(() => run(scaled(1, cv))).toThrow("aliased");
      expect(E.common.find((x: any) => x.cv === cv).quasi.error).toBe("NA in model coefficients; rerun models with nonsingular design matrix");
    }
  });
});

describe("mediate: other edges against R", () => {
  const d: DataFrame = { ...D };
  it("all draws of one sign: p = 0", () => againstR(run(d, {}, "M ~ X", "Yp ~ X + M"), E.one_sign, 1e-10));
  it("missing values on the same rows", () => {
    const keep = D.Mna.map((v: number | null, i: number) => v !== null && D.Yna[i] !== null);
    const d2: DataFrame = Object.fromEntries(Object.entries(D).map(([k, v]) => [k, (v as unknown[]).filter((_, i) => keep[i])])) as DataFrame;
    againstR(run(d2, {}, "Mna ~ X + C", "Yna ~ X + Mna + C", "Mna"), E.missing_same, 1e-10);
  });
  it("a factor covariate (quasi-Bayes and bootstrap)", () => {
    againstR(run(d, {}, "M ~ X + G", "Y ~ X + M + G"), E.factor, 1e-10);
    againstR(run(d, { boot: true }, "M ~ X + G", "Y ~ X + M + G"), E.factor_boot, 1e-10);
  });
  it("errors as R", () => {
    expect(() => run(d, {}, "Mna ~ X + C", "Yna ~ X + Mna + C", "Mna")).toThrow(E.missing_different.error);
    expect(E.no_treat_in_y.error).toBe("undefined columns selected");
    expect(() => run(d, {}, "M ~ X + C", "Y ~ M + C")).toThrow("'X' is not a variable of the outcome model");
    const d1 = { ...d, one: D.X.map((_: number, i: number) => (i === 6 ? 1 : 0)) };
    expect(E.hc3_leverage1.error).toBe("infinite or missing values in 'x'");
    expect(() => run(d1, { robustSE: true }, "M ~ X + one", "Y ~ X + M")).toThrow("hat values of 1");
  });
});

describe("simSlopes and mvrnorm on extreme scales against R", () => {
  for (const w of E.slopes_scales) {
    it(`simSlopes at x ${w.s}`, () => {
      const d: DataFrame = { M: D.M.map((v: number) => v * w.s), Y: D.Y.map((v: number) => v * w.s), C: D.C };
      const r = simSlopes(lm("Y ~ M * C", d), d, { pred: "M", modx: "C" });
      w.est.forEach((v: number, i: number) => expect(rel(r.estimate[i]!, v)).toBeLessThan(1e-12));
      w.se.forEach((v: number, i: number) => expect(rel(r.se[i]!, v)).toBeLessThan(1e-12));
      w.p.forEach((v: number, i: number) => expect(rel(r.p[i]!, v)).toBeLessThan(1e-11));
      w.bounds.forEach((v: number, i: number) => expect(rel(r.jn!.bounds[i]!, v)).toBeLessThan(1e-11));
      expect(r.jn!.inside).toBe(w.inside);
    });
  }
  it("mvrnorm with variances of 1e-300 and 1e300", () => {
    for (const [S, want] of [[[[1e-300, 1e-301], [1e-301, 1e-300]], E.mvrnorm_tiny.value], [[[1e300, 1e299], [1e299, 1e300]], E.mvrnorm_huge.value]] as const) {
      setSeed(42);
      const x = mvrnorm(3, [0, 0], S);
      (want as number[][]).forEach((r, i) => r.forEach((v, j) => expect(rel(x[i]![j]!, v)).toBeLessThan(1e-14)));
    }
  });
});
