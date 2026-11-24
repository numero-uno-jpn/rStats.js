// Edge cases of mediate, simSlopes and mvrnorm (experiments/mediation116-edge.R; R's results where R works, theory
// where it does not)
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { mediate, type MediateResult } from "../src/causal/mediate.js";
import { simSlopes } from "../src/causal/moderation.js";
import { mvrnorm, symmetricSqrt } from "../src/random/mvrnorm.js";
import { lm } from "../src/models/lm.js";
import { glm } from "../src/models/glm.js";
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

// The second pass (experiments/mediation116-edge2.R)
const E2 = JSON.parse(readFileSync(new URL("../experiments/mediation116-edge2.json", import.meta.url), "utf8")) as any;
const D2 = E2.data as DataFrame;
const run2 = (fm: string, fy: string, med: string, opts: Record<string, unknown> = {}, glmM = false, glmY = false): MediateResult => {
  setSeed(1234);
  const m = glmM ? glm(fm, D2, { family: "binomial" }) : lm(fm, D2);
  const y = glmY ? glm(fy, D2, { family: "binomial" }) : lm(fy, D2);
  return mediate(m, y, D2, { treat: "X", mediator: med, sims: 100, ...opts });
};

describe("mediate: the second pass against R", () => {
  it("a binary mediator separated by a covariate (glm stops at 25 iterations as R, coefficients to 1e-5)", () => {
    const r = run2("Ms ~ X + C", "Y ~ X + Ms + C", "Ms", {}, true);
    const w = E2.separation.result;
    // the draws depend on the unconverged coefficients (334 for C) only through probabilities within 1e-5 of 0 or 1
    for (const [rk, tk] of KEYS.slice(0, 5)) w[rk].sims.forEach((v: number, j: number) => expect(Math.abs(r[tk].sims[j]! - v)).toBeLessThan(1e-3));
  });
  it("sims = 2 with the bootstrap as R; sims = 1 refused (R fails without the bootstrap)", () => {
    againstR(run2("M ~ X", "Y ~ X + M", "M", { boot: true, sims: 2 }), E2.boot_sims2, 1e-10);
    expect(E2.quasi_sims1.error).toBe("dim(X) must have a positive length");
    expect(() => run2("M ~ X", "Y ~ X + M", "M", { sims: 1 })).toThrow("sims must be at least 2");
  });
  it("robustSE with the bootstrap: ignored with R's warning", () => {
    const r = run2("M ~ X", "Y ~ X + M", "M", { boot: true, sims: 30, robustSE: true });
    againstR(r, E2.boot_robust, 1e-10);
    expect(r.warnings).toEqual([E2.boot_robust.warnings].flat());
  });
  it("a logit outcome on scales x 1e+-150: the bootstrap as R (and equivariant)", () => {
    for (const w of E2.logit_scales) {
      const d: DataFrame = { ...D2, M: (D2.M as number[]).map((v) => v * w.s), C: (D2.C as number[]).map((v) => v * w.s) };
      setSeed(1234);
      const r = mediate(lm("M ~ X + C", d), glm("Ybin ~ X + M + C", d, { family: "binomial" }), d, { treat: "X", mediator: "M", sims: 30, boot: true });
      againstR(r, w.boot, 1e-9);
    }
  });
  it("a total effect near 0, and confidence levels near 0 and 1", () => {
    againstR(run2("M ~ X", "Yt ~ X + M", "M", { sims: 200 }), E2.tau_near_zero, 1e-10);
    for (const [level, w] of [[0.001, E2.conf_tiny], [0.999, E2.conf_huge]] as const) {
      const r = run2("M ~ X", "Y ~ X + M", "M", { confLevel: level });
      for (const [rk, tk] of KEYS) w.result[rk].ci.forEach((v: number, i: number) => expect(Math.abs(r[tk].ci[i]! - v)).toBeLessThan(1e-10 * Math.max(1, Math.abs(v))));
    }
  });
  it("refused where R errors or warns: a covariate not in the models, a factor treatment, a resample losing a level", () => {
    expect(E2.covariate_absent.error).toBe("undefined columns selected");
    expect(() => run2("M ~ X", "Y ~ X + M", "M", { covariates: { C: 1 } })).toThrow("covariates must be variables of the models");
    // R accepts a factor treatment with a warning and takes its levels; rStats.js asks for a numeric one
    expect([E2.factor_treat.warnings].flat()[0]).toMatch("treatment and control values do not match factor levels");
    expect(() => { setSeed(1); mediate(lm("M ~ Xf", D2), lm("Y ~ Xf + M", D2), D2, { treat: "Xf", mediator: "M", sims: 10 }); }).toThrow("'Xf' must be numeric");
    expect(E2.rare_level_boot.error).toBe("contrasts can be applied only to factors with 2 or more levels");
    expect(() => run2("M ~ X + R3", "Y ~ X + M", "M", { boot: true, sims: 30 })).toThrow();
  });
});

describe("mvrnorm: the second pass against R", () => {
  it("n = 0 is R's error; a nonsymmetric 2 x 2 Sigma reads the lower triangle; a slightly negative eigenvalue within tol", () => {
    expect(E2.mvrnorm_n0.error).toBe("non-conformable arguments");
    expect(() => mvrnorm(0, [0, 0], [[1, 0], [0, 1]])).toThrow("non-conformable arguments");
    setSeed(42);
    mvrnorm(3, [0, 0], [[2, 0.9], [0.5, 1]]).forEach((r, i) => r.forEach((v, j) => expect(rel(v, E2.mvrnorm_nonsym.value[i][j])).toBeLessThan(1e-14)));
    setSeed(42);
    mvrnorm(2, [0, 0], [[1, 1 + 1e-9], [1 + 1e-9, 1]]).forEach((r, i) => r.forEach((v, j) => expect(rel(v, E2.mvrnorm_neg_tol.value[i][j])).toBeLessThan(1e-12)));
  });
  it("a rank-1 Sigma in 3 dimensions: R's draws up to the eigenvector's sign", () => {
    // the two eigenvalues that are 0 in theory come out as rounding (about 1e-15) of either sign, and their square
    // roots (about 3e-8) enter the draws, in R as here
    setSeed(42);
    mvrnorm(3, [0, 0, 0], [[1, 2, 3], [2, 4, 6], [3, 6, 9]]).forEach((r, i) => r.forEach((v, j) => expect(rel(Math.abs(v), Math.abs(E2.mvrnorm_semidef.value[i][j]))).toBeLessThan(1e-6)));
  });
});
