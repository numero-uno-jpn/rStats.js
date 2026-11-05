// Regression tests of the numerical edges of glmer, its summary, comparison and prediction, and of lmer's standard
// errors (the audit of 2026-11-05, findings A4, A6, A7, A8, A9, A10, F1, F2, B1, B2, B3, B4; the second fix): offsets
// far from the data, means whose squares overflow, responses below lme4's bound of the mean, large and small prior
// weights, non-integer poisson counts, nAGQ in (−1, 0), near-collinear predictors, predictors of scale 1e±120 and
// 1e-160, weight-0 rows in a likelihood-ratio comparison, and predictions whose sums of squares or products overflow.
// Where the data are a transformation of a fit that works, the result must be that fit transformed (logLik relative
// 1e-10, parameters 1e-8 relative to the largest element); where only lme4's (early-stopped) estimate is known, it
// must agree to 1e-4 and the fit's −2 logLik must be no worse than lme4's.
import { describe, expect, it } from "vitest";
import { glmer, type GlmerResult } from "../src/models/glmer.js";
import { glmerAnova } from "../src/models/glmerAnova.js";
import { glmerSummary } from "../src/models/glmerSummary.js";
import { lmer } from "../src/models/lmer.js";
import { lmerSummary } from "../src/models/lmerTest.js";
import { glmerPredict, lmerPredict } from "../src/models/mixedPredict.js";

const base = {
  y: [2, 3, 6, 7, 8, 1, 0, 3, 2, 5, 4, 6, 9, 8, 13, 0, 2, 1, 4, 3],
  x: [1, 2, 3, 4, 5, 1, 2, 3, 4, 5, 1, 2, 3, 4, 5, 1, 2, 3, 4, 5],
  g: ["a", "a", "a", "a", "a", "b", "b", "b", "b", "b", "c", "c", "c", "c", "c", "d", "d", "d", "d", "d"],
};
const yb = [0, 1, 0, 1, 1, 0, 0, 0, 1, 0, 1, 1, 0, 1, 1, 0, 0, 1, 0, 1];
const yg = [1.2, 2.3, 3.1, 4.5, 6.2, 0.8, 1.1, 2.2, 2.0, 3.9, 2.4, 3.6, 5.1, 6.8, 9.3, 0.5, 1.4, 1.2, 2.6, 2.9];
const z = [0.3, 1.2, -0.5, 0.8, 2.1, -1.1, 0.4, 0.9, -0.2, 1.5, 0.7, -0.8, 1.1, 0.2, -0.4, 1.9, 0.1, -0.6, 0.5, 1.3];
const P = { family: "poisson" } as const;
const B = { family: "binomial" } as const;
const GL = { family: "Gamma", link: "log" } as const;

const relative = (a: number, b: number): number => (a === b ? 0 : Math.abs(a - b) / Math.abs(b));
/** Each element within tol × the largest |element| of the expected vector */
function expectVector(actual: readonly number[], expected: readonly number[], tol: number, what: string): void {
  expect(actual.length, what).toBe(expected.length);
  const scale = Math.max(...expected.map(Math.abs));
  actual.forEach((v, i) => expect(Math.abs(v - expected[i]!) / scale, `${what}[${i}]: ${v} vs ${expected[i]}`).toBeLessThanOrEqual(tol));
}
/** Agreement with lme4's estimate to 1e-4 and −2 logLik no worse than lme4's */
function expectAtLeastLme4(r: GlmerResult, lme4: { fixef: number[]; theta: number[]; logLik: number }): void {
  expectVector(r.fixef, lme4.fixef, 1e-4, "fixef");
  expectVector(r.theta, lme4.theta, 1e-4, "theta");
  expect(r.logLik).toBeGreaterThanOrEqual(lme4.logLik - 1e-10 * Math.abs(lme4.logLik));
}

describe("glmer's numerical edges (audit findings, second fix)", () => {
  const poisson = glmer("y ~ x + (1 | g)", base, P);
  const gamma = glmer("y ~ x + (1 | g)", { ...base, y: yg }, GL);

  it("A4: constant offsets far from the data shift the intercept; log(exposure) fits (R and lme4's start fail)", () => {
    for (const o of [-4, -1000, 100]) {
      const r = glmer("y ~ x + (1 | g)", base, { ...P, offset: base.y.map(() => o) });
      expect(relative(r.logLik, poisson.logLik)).toBeLessThanOrEqual(1e-10);
      expectVector(r.theta, poisson.theta, 1e-8, `theta (offset ${o})`);
      expectVector(r.fixef, [poisson.fixef[0]! - o, poisson.fixef[1]!], 1e-8, `fixef (offset ${o})`);
    }
    const bin = glmer("y ~ x + (1 | g)", { ...base, y: yb }, B);
    for (const o of [5, -5]) {
      const r = glmer("y ~ x + (1 | g)", { ...base, y: yb }, { ...B, offset: base.y.map(() => o) });
      expect(relative(r.logLik, bin.logLik)).toBeLessThanOrEqual(1e-10);
      expectVector(r.fixef, [bin.fixef[0]! - o, bin.fixef[1]!], 1e-8, `fixef (binomial offset ${o})`);
    }
    // log(0.01 x): the fit of the offset log(x) (which lme4 fits: intercept 0.3348019, slope −0.02924789, θ 0.5422069,
    // logLik −39.1914541 with its optimiser tightened) with the intercept shifted by log(100)
    const r = glmer("y ~ x + (1 | g)", base, { ...P, offset: base.x.map((v) => Math.log(0.01 * v)) });
    const plain = glmer("y ~ x + (1 | g)", base, { ...P, offset: base.x.map((v) => Math.log(v)) });
    // (lme4's intercept is 2.5e-4 off even so: within 1e-3, and −2 logLik no worse than lme4's)
    expectVector(plain.fixef, [0.3348019286, -0.0292478899], 1e-3, "fixef (offset log(x))");
    expectVector(plain.theta, [0.5422069378], 1e-4, "theta (offset log(x))");
    expect(plain.logLik).toBeGreaterThanOrEqual(-39.191454114693);
    expect(relative(r.logLik, plain.logLik)).toBeLessThanOrEqual(1e-10);
    expectVector(r.fixef, [plain.fixef[0]! + Math.log(100), plain.fixef[1]!], 1e-8, "fixef (log exposure)");
  });

  it("A6: Gamma means beyond 1.3e154 (μ'² and V overflowed) give the fit shifted (R fails)", () => {
    for (const k of [1e155, 1e200, 1e300]) {
      const r = glmer("y ~ x + (1 | g)", { ...base, y: yg.map((v) => v * k) }, GL);
      expect(relative(r.logLik, gamma.logLik - 20 * Math.log(k))).toBeLessThanOrEqual(1e-10);
      expectVector(r.theta, gamma.theta, 1e-8, `theta (y × ${k})`);
      expectVector(r.fixef, [gamma.fixef[0]! + Math.log(k), gamma.fixef[1]!], 1e-8, `fixef (y × ${k})`);
      expect(relative(r.sigma, gamma.sigma)).toBeLessThanOrEqual(1e-8);
      expectVector(r.pearsonResiduals, gamma.pearsonResiduals, 1e-8, "Pearson residuals");
      expectVector(r.coefTable.stdError, gamma.coefTable.stdError, 1e-8, "standard errors");
    }
  });

  it("A7: Gamma responses below lme4's bound of the mean 2^-52 give the fit shifted (R fails or gives θ 0)", () => {
    for (const k of [1e-20, 1e-150, 1e-300]) {
      const r = glmer("y ~ x + (1 | g)", { ...base, y: yg.map((v) => v * k) }, GL);
      expect(relative(r.logLik, gamma.logLik - 20 * Math.log(k))).toBeLessThanOrEqual(1e-10);
      expectVector(r.theta, gamma.theta, 1e-8, `theta (y × ${k})`);
      expectVector(r.fixef, [gamma.fixef[0]! + Math.log(k), gamma.fixef[1]!], 1e-8, `fixef (y × ${k})`);
      expect(relative(r.sigma, gamma.sigma)).toBeLessThanOrEqual(1e-8);
      expectVector(r.coefTable.stdError, gamma.coefTable.stdError, 1e-8, "standard errors");
      expectVector(r.fitted.map((m) => m / k), gamma.fitted, 1e-8, "fitted / k");
      expectVector(r.residuals, gamma.residuals, 1e-8, "deviance residuals");
    }
  });

  it("A8: prior weights 2^25 and 2^30 (poisson, binomial) and cbind × 2^30 fit, as in R", () => {
    // (R: lme4 2.0.6, its default control)
    expectAtLeastLme4(glmer("y ~ x + (1 | g)", base, { ...P, weights: base.y.map(() => 2 ** 25) }), {
      fixef: [0.2268430, 0.3242485],
      theta: [0.5829],
      logLik: -1128614572.6,
    });
    for (const w of [2 ** 30]) {
      const r = glmer("y ~ x + (1 | g)", base, { ...P, weights: base.y.map(() => w) });
      expectVector(r.fixef, [0.2268430, 0.3242485], 1e-6, "fixef (poisson, 2^30)");
      expectVector(r.theta, [0.58288], 1e-4, "theta (poisson, 2^30)");
    }
    const bin = glmer("y ~ x + (1 | g)", { ...base, y: yb }, { ...B, weights: base.y.map(() => 2 ** 30) });
    expectVector(bin.theta, [1.2397], 1e-3, "theta (binomial, 2^30)");
    const s = yb.map((v) => v * 2 ** 30);
    const f = yb.map((v) => (1 - v) * 2 ** 30 + 2 ** 30);
    expect(Number.isFinite(glmer("cbind(s, f) ~ x + (1 | g)", { ...base, s, f }, B).logLik)).toBe(true);
  });

  it("A9: non-integer poisson counts: a RangeError for nAGQ 0 and 1 (logLik −Inf everywhere), R's fit for nAGQ > 1", () => {
    const d = { ...base, y: base.y.map((v, i) => (i === 0 ? 2.5 : v)) };
    for (const nAGQ of [0, 1]) expect(() => glmer("y ~ x + (1 | g)", d, { ...P, nAGQ })).toThrow(/non-integer count \(2\.5\)/);
    expect(() => glmer("y ~ x + (1 | g)", d, P)).toThrow(RangeError);
    const r = glmer("y ~ x + (1 | g)", d, { ...P, nAGQ: 5 });
    expect(r.warnings).toEqual(["non-integer x = 2.500000"]);
    expect(r.logLik).toBe(-Infinity);
    // (R: fixef (0.2866606959, 0.3157307575), θ 0.5460867790)
    expectVector(r.fixef, [0.2866606959, 0.3157307575], 1e-4, "fixef");
    expectVector(r.theta, [0.546086779], 1e-4, "theta");
  });

  it("A10: nAGQ −0.5 is truncated to 0 first (as R); negative after truncation a RangeError", () => {
    const r = glmer("y ~ x + (1 | g)", base, { ...P, nAGQ: -0.5 });
    expect(Object.is(r.nAGQ, 0)).toBe(true);
    expect(r.logLik).toBe(glmer("y ~ x + (1 | g)", base, { ...P, nAGQ: 0 }).logLik);
    expect(() => glmer("y ~ x + (1 | g)", base, { ...P, nAGQ: -1 })).toThrow(RangeError);
  });

  it("F1: near-collinear predictors (x + 1e-6 z) give the fit of y ~ x + z reparametrised (R fits)", () => {
    const zfit = glmer("y ~ x + z + (1 | g)", { ...base, z }, P);
    const e = 1e-6;
    const r = glmer("y ~ x + x2 + (1 | g)", { ...base, x2: base.x.map((v, i) => v + e * z[i]!) }, P);
    expect(relative(r.logLik, zfit.logLik)).toBeLessThanOrEqual(1e-10);
    expectVector(r.theta, zfit.theta, 1e-8, "theta");
    // β_x2 = β_z / e, β_x = β_x(z fit) − β_x2
    const [b0, bx, bz] = zfit.fixef as [number, number, number];
    expectVector(r.fixef, [b0, bx - bz / e, bz / e], 1e-6, "fixef");
  });

  it("G21: a response scale the Laplace criterion cannot resolve is a RangeError, not θ = 0 or lme4's PIRLS message", () => {
    const scale = /outside what the Laplace criterion can resolve/;
    const IG = { family: "inverse.gaussian", link: "log" } as const;
    // inverse.gaussian with the log link times 1e200 returned θ = 0 from a region flat to rounding (the optimum is
    // near θ = 1e100); times 1e20 to 1e100 "did not converge"
    for (const k of [1e20, 1e100, 1e200]) expect(() => glmer("y ~ x + (1 | g)", { ...base, y: yg.map((v) => v * k) }, IG)).toThrow(scale);
    // poisson counts times 1e14 and 1e16, prior weights 2^40, gaussian with the log link times 1e10 and 1e-10
    for (const k of [1e14, 1e16]) expect(() => glmer("y ~ x + (1 | g)", { ...base, y: base.y.map((v) => v * k) }, P)).toThrow(scale);
    expect(() => glmer("y ~ x + (1 | g)", base, { ...P, weights: base.y.map(() => 2 ** 40) })).toThrow(scale);
    for (const k of [1e10, 1e-10]) {
      expect(() => glmer("y ~ x + (1 | g)", { ...base, y: yg.map((v) => v * k) }, { family: "gaussian", link: "log" })).toThrow(scale);
    }
    expect(() => glmer("y ~ x + (1 | g)", { ...base, y: yg.map((v) => v * 1e200) }, IG)).toThrow(RangeError);
    // still fitted: inverse.gaussian times 1e12 (θ near 1.67e6, the √k of the plain fit's), poisson counts times
    // 1e10 (information 2^38.5; times 1e12, 2^45, is the error at once, as its fit depended on the platform's last
    // bits), binomial prior weights 2^-50 (θ 0, as R's at 2^-20: the criterion is not flat relative to its tiny
    // deviance)
    const ig = glmer("y ~ x + (1 | g)", { ...base, y: yg }, IG);
    const ig12 = glmer("y ~ x + (1 | g)", { ...base, y: yg.map((v) => v * 1e12) }, IG);
    expect(relative(ig12.theta[0]!, ig.theta[0]! * 1e6)).toBeLessThan(0.05);
    expect(glmer("y ~ x + (1 | g)", { ...base, y: base.y.map((v) => v * 1e10) }, P).theta[0]).toBeCloseTo(0.58288, 4);
    expect(() => glmer("y ~ x + (1 | g)", { ...base, y: base.y.map((v) => v * 1e12) }, P)).toThrow(scale);
    expect(glmer("y ~ x + (1 | g)", { ...base, y: yb }, { ...B, weights: base.y.map(() => 2 ** -50) }).theta).toEqual([0]);
  });

  it("G21: gaussian with the log link is not scale invariant in lme4's criterion: ×1e4 has its optimum at θ = 0", () => {
    // lme4's Laplace weights μ'² / V = μ² leave out the dispersion, so scaling y by c scales W by c²: the optimum θ
    // moves (×1: 0.6313 in R and here; ×1e3: 0.4498 in both). At ×1e4 lme4 stops at θ 0.4498 with −2 logLik
    // 461.1302, while its own deviance function at θ = 0 with its β gives 447.3895: the boundary is the optimum
    const G = { family: "gaussian", link: "log" } as const;
    expect(glmer("y ~ x + (1 | g)", { ...base, y: yg }, G).theta[0]).toBeCloseTo(0.63125, 4);
    const r = glmer("y ~ x + (1 | g)", { ...base, y: yg.map((v) => v * 1e4) }, G);
    expect(r.theta).toEqual([0]);
    expect(-2 * r.logLik).toBeLessThanOrEqual(447.3894995475116);
  });

  it("logLik of a deviance of 0 is 0, not −0", () => {
    const r = glmer("y ~ x + (1 | g)", { ...base, y: yb }, { ...B, weights: base.y.map(() => 2 ** -10) });
    expect(Object.is(r.logLik, 0)).toBe(true);
  });
});

describe("results of glmer and lmer at numerical edges (audit findings, second fix)", () => {
  const d = { ...base, z };

  it("B1: glmerSummary's correlation does not overflow or underflow for predictors of scale 1e±120", () => {
    const plain = glmerSummary(glmer("y ~ x + z + (1 | g)", d, P)).correlation[1]![2]!;
    for (const k of [1e120, 1e-120]) {
      const c = glmerSummary(glmer("y ~ x + z + (1 | g)", { ...d, x: d.x.map((v) => v * k), z: z.map((v) => v * k) }, P)).correlation[1]![2]!;
      expect(relative(c, plain)).toBeLessThanOrEqual(1e-9);
    }
  });

  it("B2: the comparison tests nestedness on the rows of positive weight (R: Chisq 0.03005, p 0.8624)", () => {
    const dw = { ...d, w: base.x.map((_, i) => (i === 0 ? 0 : 1)), x2: base.x.map((v, i) => (i === 0 ? 100 : v)) };
    const a = glmerAnova([glmer("y ~ x2 + (1 | g)", dw, { ...P, weights: "w" }), glmer("y ~ x + z + (1 | g)", dw, { ...P, weights: "w" })]);
    expect(a.Df[1]).toBe(1);
    expect(a.Chisq[1]).toBeCloseTo(0.03005, 4);
    expect(a.pValue[1]).toBeCloseTo(0.8624, 3);
    // offsets that differ on a row of weight 0 only are the same offset
    const off = { ...d, w: dw.w, o: base.x.map((_, i) => (i === 0 ? 7 : 0.5)), o2: base.x.map(() => 0.5) };
    const b = glmerAnova([glmer("y ~ x + (1 | g)", off, { ...P, weights: "w", offset: "o" }), glmer("y ~ x + z + (1 | g)", off, { ...P, weights: "w", offset: "o2" })]);
    expect(Number.isFinite(b.Chisq[1]!)).toBe(true);
  });

  it("B3: seFit of newdata 1e200 is finite (glmerPredict; lmerPredict with σ of 1e-200)", () => {
    const f = glmer("y ~ x + z + (1 | g)", d, P);
    const [big, ref] = glmerPredict(f, { newdata: { x: [1e200, 1e155], z: [0, 0], g: ["a", "a"] }, seFit: true }).seFit!;
    expect(relative(big!, ref! * 1e45)).toBeLessThanOrEqual(1e-9);
    const dl = { ...d, y: base.y.map((v, i) => (v + 0.1 * z[i]!) * 1e-200) };
    const fl = lmer("y ~ x + (1 | g)", dl);
    const [bigL, refL] = lmerPredict(fl, { newdata: { x: [1e200, 1e150], g: ["a", "a"] }, seFit: true }).seFit!;
    expect(relative(bigL!, refL! * 1e50)).toBeLessThanOrEqual(1e-9);
  });

  it("B4: a linear predictor whose products overflow while they cancel is finite (glmerPredict, lmerPredict)", () => {
    const ds = { ...d, x: base.x.map((v) => v * 1e-3), z: z.map((v) => v * 1e-3) };
    const xv = 1e306;
    const f = glmer("y ~ x + z + (1 | g)", ds, P);
    const [, bx, bz] = f.fixef as [number, number, number];
    const zv = -(xv / bz) * bx;
    expect(bx * xv + bz * zv).toBeNaN();
    expect(Number.isFinite(glmerPredict(f, { newdata: { x: [xv], z: [zv], g: ["a"] } }).fit[0]!)).toBe(true);
    const fl = lmer("y ~ x + z + (1 | g)", ds);
    const [, cx, cz] = fl.fixef as [number, number, number];
    const zl = -(xv / cz) * cx;
    expect(Number.isFinite(lmerPredict(fl, { newdata: { x: [xv], z: [zl], g: ["a"] } }).fit[0]!)).toBe(true);
  });

  it("F2: lmer's and lmerSummary's standard errors with predictors times 1e-160 are those of the plain fit scaled", () => {
    const plain = lmer("y ~ x + z + (1 | g)", d, { REML: false });
    const ps = lmerSummary(plain);
    const k = 1e-160;
    const scaled = lmer("y ~ x + z + (1 | g)", { ...d, x: base.x.map((v) => v * k), z: z.map((v) => v * k) }, { REML: false });
    const ss = lmerSummary(scaled);
    const expected = plain.coefTable.stdError.map((v, i) => (i === 0 ? v : v / k));
    expectVector(scaled.coefTable.stdError.map((v, i) => v / expected[i]!), [1, 1, 1], 1e-9, "lmer stdError");
    expectVector(ss.stdError.map((v, i) => v / expected[i]!), [1, 1, 1], 1e-9, "lmerSummary stdError");
    expectVector(ss.df!, ps.df!, 1e-9, "df");
    expectVector(ss.pValue!, ps.pValue!, 1e-9, "pValue");
  });
});
