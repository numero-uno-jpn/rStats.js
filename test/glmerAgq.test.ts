// Adaptive Gauss-Hermite quadrature (nAGQ > 1) against the fixtures glmerAgqDeviance (oracle/glmeragqdev.R) and
// glmerAgq (oracle/glmeragq.R); oracle/glmer-behaviour.md, "Adaptive Gauss-Hermite quadrature (stage 2e)", with
// G11's tolerances and the choices G12 and G13.
//
// The deviance at given (θ, β), against the 110-bit reference at the exact mode with the exact rule: deviance,
// devResid relative 1e-10; ldL2, ussq, quad absolute 1e-10 × max(1, |value|); u, b, mu within 1e-9 × the largest
// absolute element; condSd relative 1e-10; the rule's nodes within 1e-14 × max(1, |z|), its weights relative 1e-11.
// Against lme4: a guard of 1e-4 (relative) on the deviance, the largest differences printed.
//
// The fit, against the reference at the exact optimum of the AGQ deviance: as test/glmer.test.ts (logLik, AIC, BIC
// relative 1e-10; deviance relative 1e-7; vectors 1e-7, vcov and SEs 1e-6 of the largest absolute value; zeros of θ
// exactly 0; the rest equal), except that logLik, AIC and BIC are the true log-likelihood (G12): R's logLik minus
// half the saturated model's constant aic − Σ d_i, computed here from the case's data by its formula, and the
// Gamma, inverse.gaussian and gaussian cases are G13's RangeError.
import { describe, expect, it } from "vitest";
import { glmer, type GlmerOptions, type GlmerResult } from "../src/models/glmer.js";
import { gaussHermiteRule, glmerAgqDeviance } from "../src/models/glmerDeviance.js";
import { glmerStructure } from "../src/models/glmerStructure.js";
import type { GlmerFamilyName } from "../src/models/glmerFamily.js";
import type { GlmLinkName } from "../src/models/glmFamily.js";
import { lchoose } from "../src/special/choose.js";
import { lgamma } from "../src/special/gamma.js";
import { num } from "./helpers/fixture.js";
import { dataFrameOf, loadAnovaFixture } from "./helpers/anova.js";

const devFixture = loadAnovaFixture("glmerAgqDeviance");
const fitFixture = loadAnovaFixture("glmerAgq");

const nums = (v: unknown): number[] => (v as string[]).map((x) => num(x));
const maxAbs = (v: readonly number[]): number => Math.max(0, ...v.map(Math.abs));
/** |actual − expected| / scale, 0 when the two are equal (also when the scale is 0, or both NaN) */
const scaledError = (actual: number, expected: number, scale: number): number =>
  actual === expected || (Number.isNaN(actual) && Number.isNaN(expected)) ? 0 : Math.abs(actual - expected) / scale;

function optionsOf(a: Record<string, unknown>): GlmerOptions {
  const options: GlmerOptions = { family: a.family as GlmerFamilyName, link: a.link as GlmLinkName, nAGQ: num(a.nAGQ as string) };
  if (a.weights !== undefined) options.weights = nums(a.weights);
  if (a.offset !== undefined) options.offset = nums(a.offset);
  return options;
}

describe("gaussHermiteRule", () => {
  it("is exact for polynomials of degree up to 2K − 1, symmetric, with 0 in the middle of an odd rule", () => {
    expect(gaussHermiteRule(2)).toEqual({ nodes: [-1, 1], weights: [0.5, 0.5] });
    const r3 = gaussHermiteRule(3);
    expect(r3.nodes[1]).toBe(0);
    expect(r3.nodes[2]).toBeCloseTo(Math.sqrt(3), 15);
    expect(r3.weights[1]).toBeCloseTo(2 / 3, 15);
    for (const k of [1, 4, 7, 20, 51, 100]) {
      const { nodes, weights } = gaussHermiteRule(k);
      expect(nodes).toHaveLength(k);
      nodes.forEach((z, i) => {
        expect(z + nodes[k - 1 - i]!).toBe(0);
        expect(weights[i]).toBe(weights[k - 1 - i]);
        if (i > 0) expect(z).toBeGreaterThan(nodes[i - 1]!);
      });
      // E Z^(2m) = (2m − 1)!! for 2m ≤ 2K − 1 (small m: the sums are then not dominated by rounding)
      let doubleFactorial = 1;
      for (let m = 0; m <= Math.min(k - 1, 6); m++) {
        if (m > 0) doubleFactorial *= 2 * m - 1;
        const moment = nodes.reduce((sum, z, i) => sum + weights[i]! * z ** (2 * m), 0);
        expect(Math.abs(moment / doubleFactorial - 1)).toBeLessThan(1e-13);
      }
    }
    expect(() => gaussHermiteRule(101)).toThrow(RangeError);
  });
});

describe("glmerAgqDeviance", () => {
  it(`matches the exact mode with the exact rule (${devFixture.r_version})`, () => {
    const failures: string[] = [];
    const worst = new Map<string, { lme4: number; ref: number }>();
    const note = (field: string, lme4: number, ref: number): void => {
      const w = worst.get(field) ?? { lme4: 0, ref: 0 };
      worst.set(field, { lme4: Math.max(w.lme4, lme4), ref: Math.max(w.ref, ref) });
    };
    devFixture.cases.forEach((c, index) => {
      const a = c.args;
      const nAGQ = num(a.nAGQ as string);
      const s = glmerStructure(a.formula as string, dataFrameOf(a.data, a.dataTypes), {
        family: a.family as GlmerFamilyName,
        link: a.link as GlmLinkName,
        nAGQ,
        ...(a.weights === undefined ? {} : { weights: nums(a.weights) }),
        ...(a.offset === undefined ? {} : { offset: nums(a.offset) }),
      });
      const r = glmerAgqDeviance(s, nums(a.theta), nums(a.beta), nAGQ);
      const e = c.expected;
      const ref = c.reference!;
      const where = `case ${index} (${String(a.formula)}, ${String(a.family)} ${String(a.link)}, nAGQ = ${nAGQ})`;
      const scalar = (f: "deviance" | "devResid" | "ldL2" | "ussq" | "quad", absolute: boolean): void => {
        const x = num(ref[f] as string);
        const l = num(e[f] as string);
        const errRef = scaledError(r[f], x, absolute ? Math.max(1, Math.abs(x)) : Math.abs(x));
        const errLme4 = scaledError(r[f], l, absolute ? Math.max(1, Math.abs(l)) : Math.abs(l));
        note(f, errLme4, errRef);
        if (!(errRef <= 1e-10)) failures.push(`${where} ${f}: reference ${x}, got ${r[f]} (error ${errRef.toExponential(1)})`);
        if (f === "deviance" && !(errLme4 <= 1e-4)) failures.push(`${where} deviance: lme4 ${l}, got ${r[f]}`);
      };
      scalar("deviance", false);
      scalar("devResid", false);
      for (const f of ["ldL2", "ussq", "quad"] as const) scalar(f, true);
      for (const f of ["u", "b", "mu"] as const) {
        const x = nums(ref[f]);
        const l = nums(e[f]);
        if (r[f].length !== x.length) {
          failures.push(`${where} ${f}: length ${r[f].length}, expected ${x.length}`);
          continue;
        }
        r[f].forEach((v, k) => {
          const errRef = scaledError(v, x[k]!, maxAbs(x));
          note(f, scaledError(v, l[k]!, maxAbs(l)), errRef);
          if (!(errRef <= 1e-9)) failures.push(`${where} ${f}[${k}]: reference ${x[k]}, got ${v} (error ${errRef.toExponential(1)})`);
        });
      }
      const sd = nums(ref.condSd);
      r.condSd.forEach((v, k) => {
        const err = scaledError(v, sd[k]!, Math.abs(sd[k]!));
        note("condSd", 0, err);
        if (!(err <= 1e-10)) failures.push(`${where} condSd[${k}]: reference ${sd[k]}, got ${v}`);
      });
      const rule = gaussHermiteRule(nAGQ);
      nums(ref.nodes).forEach((z, k) => {
        const err = scaledError(rule.nodes[k]!, z, Math.max(1, Math.abs(z)));
        note("nodes", scaledError(rule.nodes[k]!, nums(e.nodes)[k]!, Math.max(1, Math.abs(z))), err);
        if (!(err <= 1e-14)) failures.push(`${where} nodes[${k}]: reference ${z}, got ${rule.nodes[k]}`);
      });
      nums(ref.weights).forEach((w, k) => {
        const err = scaledError(rule.weights[k]!, w, w);
        note("weights", scaledError(rule.weights[k]!, nums(e.weights)[k]!, w), err);
        if (!(err <= 1e-11)) failures.push(`${where} weights[${k}]: reference ${w}, got ${rule.weights[k]} (error ${err.toExponential(1)})`);
      });
    });
    const summary = [...worst].map(([f, w]) => `${f} ${w.lme4.toExponential(1)}/${w.ref.toExponential(1)}`).join(", ");
    console.log(`glmerAgqDeviance: ${devFixture.cases.length} cases; largest error against lme4/reference: ${summary}`);
    expect(failures, failures.slice(0, 30).join("\n")).toEqual([]);
  });
});

/**
 * The saturated model's −2 log-likelihood, aic − Σ d_i (independent of μ): binomial −2 Σ [log C(m, k) + k log y +
 * (m − k) log(1 − y)] with m the prior weights and k = m y; poisson −2 Σ w [y log y − y − log y!]; rows with weight 0
 * left out (G8)
 */
function saturatedConstant(family: string, y: readonly number[], w: readonly number[]): number {
  const xlogx = (a: number, b: number): number => (a === 0 ? 0 : a * Math.log(b));
  let sum = 0;
  y.forEach((yi, i) => {
    const wi = w[i]!;
    if (wi === 0) return;
    if (family === "binomial") {
      const m = Math.round(wi);
      const k = Math.round(m * yi);
      sum += lchoose(m, k) + xlogx(k, yi) + xlogx(m - k, 1 - yi);
    } else sum += wi * (xlogx(yi, yi) - yi - lgamma(yi + 1));
  });
  return -2 * sum;
}

describe("glmer with nAGQ > 1", () => {
  it(`matches the exact optimum of the AGQ deviance, with the true log-likelihood (G12) (${fitFixture.r_version})`, () => {
    const failures: string[] = [];
    const worstRef = new Map<string, number>();
    const worstLme4 = new Map<string, number>();
    const note = (map: Map<string, number>, field: string, err: number): void => {
      map.set(field, Math.max(map.get(field) ?? 0, Number.isNaN(err) ? Infinity : err));
    };
    let fits = 0;
    let g13 = 0;
    fitFixture.cases.forEach((c, index) => {
      const a = c.args;
      const where = `case ${index} (${String(a.formula)}, ${String(a.family)} ${String(a.link)}, nAGQ = ${String(a.nAGQ)})`;
      const data = dataFrameOf(a.data, a.dataTypes);
      const e = c.expected;
      const family = a.family as string;
      const expectedError =
        (e.error as string | undefined) ??
        (family === "binomial" || family === "poisson"
          ? undefined
          : `glmer: nAGQ > 1 is not available for the ${family} family (lme4 holds the dispersion at 1 there, so its estimates would not be maximum likelihood)`);
      if (expectedError !== undefined) {
        let error: unknown;
        try {
          glmer(a.formula as string, data, optionsOf(a));
        } catch (err) {
          error = err;
        }
        if (!(error instanceof RangeError) || error.message !== expectedError) failures.push(`${where}: error ${String(error)}, expected RangeError ${expectedError}`);
        if (e.error === undefined) g13++;
        return;
      }
      fits++;
      const r = glmer(a.formula as string, data, optionsOf(a));
      const ref = c.reference!;

      // G12: R's logLik is −D_K / 2; the log-likelihood adds −1/2 the saturated constant, from the case's data
      const s = glmerStructure(a.formula as string, data, optionsOf(a) as never);
      const constant = saturatedConstant(family, s.y, s.weights);
      if (family === "binomial" && s.weights.every((v) => v === 1) && constant !== 0) failures.push(`${where}: constant ${constant} for 0/1 data`);
      const rLogLik = num(ref.logLik as string);
      // (the constant is what separates the two: the difference from R's logLik is −constant / 2)
      const shift = r.logLik - rLogLik;
      note(worstRef, "constant", scaledError(shift, -constant / 2, Math.max(1, Math.abs(rLogLik))));
      if (!(scaledError(shift, -constant / 2, Math.max(1, Math.abs(rLogLik))) <= 1e-10)) {
        failures.push(`${where}: logLik − R's logLik ${shift}, expected −constant / 2 = ${-constant / 2}`);
      }
      const wantScalar: Record<string, number> = {
        logLik: rLogLik - constant / 2,
        AIC: num(ref.AIC as string) + constant,
        BIC: num(ref.BIC as string) + constant,
        deviance: num(ref.deviance as string),
      };
      for (const [f, x] of Object.entries(wantScalar)) {
        const got = r[f as "logLik"];
        const err = scaledError(got, x, Math.abs(x));
        note(worstRef, f, err);
        if (!(err <= (f === "deviance" ? 1e-7 : 1e-10))) failures.push(`${where} ${f}: reference ${x}, got ${got} (error ${err.toExponential(1)})`);
      }
      note(worstLme4, "logLik (R's scale)", scaledError(r.logLik + constant / 2, num(e.logLik as string), Math.abs(num(e.logLik as string))));

      const vectors = (f: Record<string, unknown>): Record<string, number[]> => ({
        theta: nums(f.theta),
        fixef: nums(f.fixef),
        sd: (f.varCorr as { sd: string[] }[]).flatMap((v) => nums(v.sd)),
        ranef: (f.ranef as { values: string[][] }[]).flatMap((g) => g.values.flatMap(nums)),
        fitted: nums(f.fitted),
        linearPredictor: nums(f.linearPredictor),
        residuals: nums(f.residuals),
        pearsonResiduals: nums(f.pearsonResiduals),
        workingResiduals: nums(f.workingResiduals),
        responseResiduals: nums(f.responseResiduals),
        stdError: nums(f.stdError),
        zValue: nums(f.zValue),
        vcov: (f.vcov as string[][]).flatMap(nums),
      });
      const got: Record<string, number[]> = {
        theta: r.theta,
        fixef: r.fixef,
        sd: r.varCorr.flatMap((v) => v.sd),
        ranef: r.ranef.flatMap((g) => g.values.flat()),
        fitted: r.fitted,
        linearPredictor: r.linearPredictor,
        residuals: r.residuals,
        pearsonResiduals: r.pearsonResiduals,
        workingResiduals: r.workingResiduals,
        responseResiduals: r.responseResiduals,
        stdError: r.coefTable.stdError,
        zValue: r.coefTable.zValue,
        vcov: r.vcov.flat(),
      };
      const want = vectors(ref);
      const lme4 = vectors(e);
      for (const [field, x] of Object.entries(want)) {
        const g = got[field]!;
        if (g.length !== x.length) {
          failures.push(`${where} ${field}: length ${g.length}, expected ${x.length}`);
          continue;
        }
        const tol = field === "stdError" || field === "zValue" || field === "vcov" ? 1e-6 : 1e-7;
        g.forEach((v, i) => {
          const err = scaledError(v, x[i]!, maxAbs(x));
          note(worstRef, field, err);
          if (!(err <= tol)) failures.push(`${where} ${field}[${i}]: reference ${x[i]}, got ${v} (error ${err.toExponential(1)})`);
          note(worstLme4, field, scaledError(v, lme4[field]![i]!, maxAbs(lme4[field]!)));
        });
      }
      want.theta!.forEach((x, i) => {
        if (x === 0 && r.theta[i] !== 0) failures.push(`${where} theta[${i}]: reference 0, got ${r.theta[i]}`);
      });
      const sigmaRef = num(ref.sigma as string);
      const sigmaErr = scaledError(r.sigma, sigmaRef, Math.abs(sigmaRef));
      note(worstRef, "sigma", sigmaErr);
      if (!(sigmaErr <= 1e-7)) failures.push(`${where} sigma: reference ${sigmaRef}, got ${r.sigma}`);

      const exact: [string, unknown, unknown][] = [
        ["singular", r.singular, ref.singular],
        ["vcovFrom", r.vcovFrom, ref.vcovFrom],
        ["df", r.df, num(ref.df as string)],
        ["nObs", r.nObs, ref.nObs],
        ["messages", r.messages, ref.messages],
        ["warnings", r.warnings, ref.warnings],
        ["nAGQ", r.nAGQ, num(a.nAGQ as string)],
        ["ranef levels", r.ranef.map((g) => g.levels), (ref.ranef as { levels: string[] }[]).map((g) => g.levels)],
        ["varCorr groups", r.varCorr.map((v) => [v.group, v.columns]), (ref.varCorr as { group: string; columns: string[] }[]).map((v) => [v.group, v.columns])],
      ];
      for (const [field, value, expected] of exact) {
        if (JSON.stringify(value) !== JSON.stringify(expected)) failures.push(`${where} ${field}: ${JSON.stringify(value)}, expected ${JSON.stringify(expected)}`);
      }
      // no worse than lme4's estimates (on R's scale, D_K)
      const dLme4 = num(ref.devianceAtLme4 as string);
      if (!(-2 * r.logLik - constant <= dLme4 + 1e-10 * Math.abs(dLme4))) failures.push(`${where} D_K ${-2 * r.logLik - constant} worse than at lme4's estimates ${dLme4}`);
    });
    const show = (m: Map<string, number>): string => [...m].map(([f, w]) => `${f} ${w.toExponential(1)}`).join(", ");
    console.log(`glmer (nAGQ > 1): ${fits} fits, ${g13} G13 errors; largest error against the reference: ${show(worstRef)}`);
    console.log(`glmer (nAGQ > 1): largest relative difference from lme4: ${show(worstLme4)}`);
    expect(g13).toBe(4);
    expect(failures, failures.slice(0, 30).join("\n")).toEqual([]);
  });

  it("logLik is the log-likelihood, consistent with the Laplace approximation's (G12)", () => {
    // cbpp (R: logLik −92.03 with nAGQ = 1, −50.06 with nAGQ = 2), 0/1 binomial and poisson: the quadrature and the
    // Laplace approximation of the same likelihood differ by little, and the quadrature converges in K
    const pick = (formula: string, family: string, nAGQ: string): Record<string, unknown> =>
      fitFixture.cases.find((c) => c.args.formula === formula && c.args.family === family && c.args.nAGQ === nAGQ)!.args;
    for (const [a, bound] of [
      [pick("cbind(inc, notinc) ~ period + (1 | herd)", "binomial", "25"), 0.1],
      [pick("y ~ x + (1 | g)", "binomial", "10"), 0.1],
      [pick("y ~ x + (1 | g)", "poisson", "5"), 0.1],
    ] as const) {
      const data = dataFrameOf(a.data, a.dataTypes);
      const agq = glmer(a.formula as string, data, optionsOf(a));
      const laplace = glmer(a.formula as string, data, { ...optionsOf(a), nAGQ: 1 });
      expect(Math.abs(agq.logLik - laplace.logLik)).toBeLessThan(bound);
      expect(agq.df).toBe(laplace.df);
      expect(agq.AIC - laplace.AIC).toBeCloseTo(-2 * (agq.logLik - laplace.logLik), 10);
    }
    const cbpp = pick("cbind(inc, notinc) ~ period + (1 | herd)", "binomial", "25");
    const data = dataFrameOf(cbpp.data, cbpp.dataTypes);
    const k2 = glmer(cbpp.formula as string, data, { ...optionsOf(cbpp), nAGQ: 2 });
    const k25 = glmer(cbpp.formula as string, data, optionsOf(cbpp));
    expect(k2.logLik).toBeCloseTo(-92.0, 0);
    expect(Math.abs(k2.logLik - k25.logLik)).toBeLessThan(0.1);
  });

  it("errors: the random-effects terms (R's two messages), G13 for the families with a dispersion", () => {
    const a = fitFixture.cases.find((c) => c.args.formula === "y ~ x + (1 | g)" && c.args.family === "Gamma")!.args;
    const data = dataFrameOf(a.data, a.dataTypes);
    for (const family of ["Gamma", "inverse.gaussian", "gaussian"] as const) {
      expect(() => glmer("y ~ x + (1 | g)", data, { family, link: "log", nAGQ: 2 })).toThrow(
        new RangeError(`glmer: nAGQ > 1 is not available for the ${family} family (lme4 holds the dispersion at 1 there, so its estimates would not be maximum likelihood)`),
      );
      // (nAGQ 0 and 1 are fitted)
      expect(glmer("y ~ x + (1 | g)", data, { family, link: "log", nAGQ: 0 }).nAGQ).toBe(0);
    }
    expect(() => glmer("y ~ x + (x || g)", data, { family: "poisson", nAGQ: 3 })).toThrow(new RangeError("AGQ only defined for a single scalar random-effects term"));
  });
});
