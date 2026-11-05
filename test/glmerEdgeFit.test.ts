// Regression tests of glmer's fit at the edges of its input (the audit of 2026-11-05, findings A1, A2, A3, A5, A8, F1,
// F2, F3, F4; oracle/glmer-behaviour.md, "The gradient (rStats.js)"): predictors shifted or rescaled, large counts,
// tiny prior weights, near-collinear predictors, a Gamma fit whose phase 1 cannot be evaluated beyond its edge, a
// small dispersion, and the time of a fit with ten fixed effects. Where the data are a transformation of a fit that
// works, the result must be that fit transformed (logLik relative 1e-10, parameters 1e-8 relative to the largest
// element); where only lme4's (early-stopped) estimate is known, it must agree to 1e-4 and the fit's −2 logLik must
// be no worse than lme4's.
import { describe, expect, it } from "vitest";
import { glm } from "../src/models/glm.js";
import { glmer, type GlmerResult } from "../src/models/glmer.js";

const base = {
  y: [2, 3, 6, 7, 8, 1, 0, 3, 2, 5, 4, 6, 9, 8, 13, 0, 2, 1, 4, 3],
  x: [1, 2, 3, 4, 5, 1, 2, 3, 4, 5, 1, 2, 3, 4, 5, 1, 2, 3, 4, 5],
  g: ["a", "a", "a", "a", "a", "b", "b", "b", "b", "b", "c", "c", "c", "c", "c", "d", "d", "d", "d", "d"],
};
const yb = [0, 1, 0, 1, 1, 0, 0, 0, 1, 0, 1, 1, 0, 1, 1, 0, 0, 1, 0, 1];
const z = [0.3, 1.2, -0.5, 0.8, 2.1, -1.1, 0.4, 0.9, -0.2, 1.5, 0.7, -0.8, 1.1, 0.2, -0.4, 1.9, 0.1, -0.6, 0.5, 1.3];
const P = { family: "poisson" } as const;
const B = { family: "binomial" } as const;

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

describe("glmer at the edges of its input (audit findings)", () => {
  const poisson = glmer("y ~ x + (1 | g)", base, P);

  it("A1: a predictor shifted by 1000 or 2000 gives the fit reparametrised (failed in the boundary sub-problem)", () => {
    for (const shift of [1000, 2000]) {
      const r = glmer("y ~ x + (1 | g)", { ...base, x: base.x.map((v) => v + shift) }, P);
      expect(relative(r.logLik, poisson.logLik)).toBeLessThanOrEqual(1e-10);
      expectVector(r.theta, poisson.theta, 1e-8, `theta (x + ${shift})`);
      const [b0, b1] = poisson.fixef as [number, number];
      expectVector(r.fixef, [b0 - shift * b1, b1], 1e-8, `fixef (x + ${shift})`);
    }
    const bin = glmer("y ~ x + (1 | g)", { ...base, y: yb }, B);
    const shifted = glmer("y ~ x + (1 | g)", { ...base, y: yb, x: base.x.map((v) => v + 2000) }, B);
    expect(relative(shifted.logLik, bin.logLik)).toBeLessThanOrEqual(1e-10);
    expectVector(shifted.fixef, [bin.fixef[0]! - 2000 * bin.fixef[1]!, bin.fixef[1]!], 1e-8, "fixef (binomial, x + 2000)");
  });

  it("A1: large counts (y × 1e4, cbind × 1e6) fit, as in R", () => {
    // (R: lme4 2.0.6, its default control)
    expectAtLeastLme4(glmer("y ~ x + (1 | g)", { ...base, y: base.y.map((v) => v * 1e4) }, P), {
      fixef: [9.4371888956, 0.3242485486],
      theta: [0.5828809864],
      logLik: -45005.6650756,
    });
    const s = yb.map((v, i) => (v + (i % 3)) * 1e6);
    const f = yb.map((v, i) => (1 - v + (i % 2)) * 1e6);
    expectAtLeastLme4(glmer("cbind(s, f) ~ x + (1 | g)", { ...base, s, f }, B), {
      fixef: [-0.3131447858, 0.2398403048],
      theta: [0.5337060006],
      logLik: -11335303.7348,
    });
    for (const k of [1e5, 1e6]) expect(Number.isFinite(glmer("y ~ x + (1 | g)", { ...base, y: base.y.map((v) => v * k) }, P).logLik)).toBe(true);
  });

  it("A2: binomial prior weights 2^-10 and 2^-20 (a deviance flat in β at θ = 0) give R's fit at once", () => {
    const coef = glm(base.x.map((v) => [v]), yb, { family: "binomial" }).coefficients;
    for (const w of [2 ** -10, 2 ** -20]) {
      const started = performance.now();
      const r = glmer("y ~ x + (1 | g)", { ...base, y: yb }, { ...B, weights: base.y.map(() => w) });
      expect(performance.now() - started).toBeLessThan(5000);
      expect(r.theta).toEqual([0]);
      expect(r.logLik === 0).toBe(true);
      expectVector(r.fixef, coef, 1e-9, "fixef");
    }
  });

  it("A3: ten fixed effects with 4000 rows fit in seconds (5-point differences took minutes)", { timeout: 60000 }, () => {
    // (the audit's seeded generator)
    let state = 9;
    const unif = (): number => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return (state + 0.5) / 4294967296;
    };
    const norm = (): number => Math.sqrt(-2 * Math.log(unif())) * Math.cos(2 * Math.PI * unif());
    const ng = 200;
    const re = Array.from({ length: ng }, () => 0.5 * norm());
    const d: Record<string, (number | string)[]> = { x: [], g: [], y: [] };
    for (let i = 0; i < 4000; i++) {
      const xi = unif() * 2 - 1;
      d.x!.push(xi);
      d.g!.push(`g${i % ng}`);
      const m = Math.exp(0.5 * xi + re[i % ng]!);
      let k = 0;
      let p = Math.exp(-m);
      let c = p;
      const r = unif();
      while (r > c) {
        k++;
        p *= m / k;
        c += p;
      }
      d.y!.push(k);
    }
    for (let j = 1; j <= 8; j++) d[`z${j}`] = d.x!.map((_, i) => Math.sin(i * j));
    const started = performance.now();
    const r = glmer("y ~ x + z1 + z2 + z3 + z4 + z5 + z6 + z7 + z8 + (1 | g)", d as Record<string, number[]>, P);
    expect(performance.now() - started).toBeLessThan(30000);
    expect(r.fixef).toHaveLength(10);
    expect(r.vcovFrom).toBe("hessian");
  });

  it("A5: Gamma with the identity link, whose phase 1 cannot be evaluated beyond θ = 2.28, fits as in R", () => {
    const y = [1.2, 2.3, 3.1, 4.5, 6.2, 0.8, 1.1, 2.2, 2.0, 3.9, 2.4, 3.6, 5.1, 6.8, 9.3, 0.5, 1.4, 1.2, 2.6, 2.9];
    expectAtLeastLme4(glmer("y ~ x + (1 | g)", { ...base, y }, { family: "Gamma", link: "identity" }), {
      fixef: [1.2635554208, 0.7506518835],
      theta: [2.353557209],
      logLik: -23.4350872595,
    });
  });

  it("A8: poisson prior weights 2^-20: the boundary fit, β of the weighted glm", () => {
    const w = 2 ** -20;
    const r = glmer("y ~ x + (1 | g)", base, { ...P, weights: base.y.map(() => w) });
    // (the unweighted glm: the same estimate, which glm's own convergence test misses by 2e-6 with these weights, as
    // R's does: its deviance is below the 0.1 of the test's denominator)
    const g = glm(base.x.map((v) => [v]), base.y, { family: "poisson" });
    expect(r.theta).toEqual([0]);
    expectVector(r.fixef, g.coefficients, 1e-9, "fixef");
    // (at θ = 0 the Laplace deviance is the weighted −2 log-likelihood, w (aic − 2 rank) of the unweighted glm)
    expect(relative(r.logLik, (-w * (g.aic - 2 * g.rank)) / 2)).toBeLessThanOrEqual(1e-9);
  });

  it("F1: near-collinear predictors (x2 = x + e z) give the fit of y ~ x + z reparametrised", () => {
    const xz = glmer("y ~ x + z + (1 | g)", { ...base, z }, P);
    const [b0, bx, bz] = xz.fixef as [number, number, number];
    for (const e of [0.1, 0.01, 1e-3, 1e-4]) {
      const r = glmer("y ~ x + x2 + (1 | g)", { ...base, x2: base.x.map((v, i) => v + e * z[i]!) }, P);
      expect(relative(r.logLik, xz.logLik)).toBeLessThanOrEqual(1e-10);
      expectVector(r.theta, xz.theta, 1e-8, `theta (e = ${e})`);
      expectVector(r.fixef, [b0, bx - bz / e, bz / e], 1e-8, `fixef (e = ${e})`);
    }
  });

  it("F2: predictors times 1e-160 and 1e160: the same fit, finite standard errors", () => {
    const one = glmer("y ~ x + z + (1 | g)", { ...base, z }, P);
    for (const k of [1e-160, 1e160]) {
      const r = glmer("y ~ x + z + (1 | g)", { ...base, x: base.x.map((v) => v * k), z: z.map((v) => v * k) }, P);
      expect(relative(r.logLik, one.logLik)).toBeLessThanOrEqual(1e-12);
      expectVector(r.theta, one.theta, 1e-9, `theta (k = ${k})`);
      r.fixef.forEach((b, i) => expect(relative(b, i === 0 ? one.fixef[i]! : one.fixef[i]! / k)).toBeLessThanOrEqual(1e-8));
      r.coefTable.stdError.forEach((se, i) => expect(relative(se, i === 0 ? one.coefTable.stdError[i]! : one.coefTable.stdError[i]! / k)).toBeLessThanOrEqual(1e-7));
      expect(r.vcovFrom).toBe("hessian");
    }
  });

  it("F3: a random slope times 1e-160, 1e160 and 1e-300: the same singular fit, finite variance components", () => {
    const one = glmer("y ~ x + (x | g)", base, P);
    expect(one.theta[2]).toBe(0);
    for (const k of [1e-160, 1e160, 1e-300]) {
      const r = glmer("y ~ x + (x | g)", { ...base, x: base.x.map((v) => v * k) }, P);
      expect(relative(r.logLik, one.logLik)).toBeLessThanOrEqual(1e-12);
      expect(r.theta[2]).toBe(0);
      const sd = r.varCorr[0]!.sd;
      expect(relative(sd[0]!, one.varCorr[0]!.sd[0]!)).toBeLessThanOrEqual(1e-8);
      expect(relative(sd[1]!, one.varCorr[0]!.sd[1]! / k)).toBeLessThanOrEqual(1e-8);
      expect(r.varCorr[0]!.corr[0]![1]).toBeCloseTo(-1, 12);
    }
  });

  it("F4: Gamma with a small dispersion: the standard errors of the exact Hessian (lme4's slope SE is 44% off)", () => {
    const u: Record<string, number> = { a: 0.1, b: -0.2, c: 0.3, d: -0.2 };
    const y = base.x.map((v, i) => Number((Math.exp(0.2 + 0.3 * v + u[base.g[i]!]!) * (1 + 1e-4 * z[i]!)).toPrecision(17)));
    const r = glmer("y ~ x + (1 | g)", { ...base, y }, { family: "Gamma", link: "log" });
    expect(r.vcovFrom).toBe("hessian");
    // (the Hessian of the deviance in 110-bit arithmetic at this optimum, central differences with step 1e-9, through
    // oracle/glmer.R's functions; lme4 2.0.6 gives 0.1499875 and 1.95147e-5)
    expect(relative(r.coefTable.stdError[0]!, 0.1499919565)).toBeLessThanOrEqual(1e-6);
    expect(relative(r.coefTable.stdError[1]!, 1.356538842e-5)).toBeLessThanOrEqual(1e-6);
  });
});
