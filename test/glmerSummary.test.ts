// The summary of glmer fits against the fixture glmerSummary (oracle/glmersummary.R; oracle/glmer-behaviour.md
// "glmerSummary (stage 3)", accuracy G11). Against the reference (the fields at the exact optimum, 110-bit
// arithmetic; logLik, AIC, BIC, minus2LogLik by G12 for nAGQ > 1): logLik, AIC, BIC, minus2LogLik relative 1e-10;
// estimate within 1e-7 × the largest absolute value; stdError, statistic within 1e-6 × the largest absolute value;
// correlation absolute 1e-6; pValue relative 1e-6 max(1, statistic²) (absolute where the reference is below 1e-300);
// residualQuantiles within 1e-7 × the largest absolute value; sigma relative 1e-7; statisticName, names, nGroups,
// nObs, df, dfResidual, messages, warnings, family, link, nAGQ equal. Against lme4 (expected) the largest differences
// are printed, not checked. Also: the options and a fit that is not glmer's.
import { describe, expect, it } from "vitest";
import { glmer, type GlmerOptions } from "../src/models/glmer.js";
import type { GlmerFamilyName } from "../src/models/glmerFamily.js";
import { glmerSummary, type GlmerSummary } from "../src/models/glmerSummary.js";
import type { GlmLinkName } from "../src/models/glmFamily.js";
import { lmer } from "../src/models/lmer.js";
import { num } from "./helpers/fixture.js";
import { dataFrameOf, loadAnovaFixture } from "./helpers/anova.js";

const fixture = loadAnovaFixture("glmerSummary");
const TOL_LOGLIK = 1e-10;
const TOL = 1e-7;
const TOL_SE = 1e-6;

const nums = (v: unknown): number[] => (v as string[]).map((x) => num(x));
const maxAbs = (v: readonly number[]): number => Math.max(0, ...v.map(Math.abs));
const scaledError = (actual: number, expected: number, scale: number): number =>
  actual === expected || (Number.isNaN(actual) && Number.isNaN(expected)) ? 0 : Math.abs(actual - expected) / scale;

/** The options of a fixture case (weights and offset as arrays or column names) */
function glmerOptionsOf(a: Record<string, unknown>): GlmerOptions {
  const options: GlmerOptions = { family: a.family as GlmerFamilyName, link: a.link as GlmLinkName, nAGQ: num(a.nAGQ as string) };
  const vector = (v: unknown): number[] | string => (typeof v === "string" ? v : nums(v));
  if (a.weights !== undefined) options.weights = vector(a.weights);
  if (a.offset !== undefined) options.offset = vector(a.offset);
  return options;
}

describe("glmerSummary", () => {
  it(`matches the summary at the exact optimum (${fixture.r_version})`, () => {
    const failures: string[] = [];
    const worstRef = new Map<string, number>();
    const worstLme4 = new Map<string, number>();
    const note = (map: Map<string, number>, field: string, err: number): void => {
      map.set(field, Math.max(map.get(field) ?? 0, Number.isNaN(err) ? Infinity : err));
    };
    fixture.cases.forEach((c, index) => {
      const a = c.args;
      const where = `case ${index} (${String(a.formula)}, ${String(a.family)} ${String(a.link)}, nAGQ = ${String(a.nAGQ)})`;
      const fit = glmer(a.formula as string, dataFrameOf(a.data, a.dataTypes), glmerOptionsOf(a));
      const s = glmerSummary(fit);
      const ref = c.reference!;
      const e = c.expected;

      for (const f of ["logLik", "AIC", "BIC", "minus2LogLik"] as const) {
        const x = num(ref[f] as string);
        const err = scaledError(s[f], x, Math.abs(x));
        note(worstRef, f, err);
        if (!(err <= TOL_LOGLIK)) failures.push(`${where} ${f}: reference ${x}, got ${s[f]} (error ${err.toExponential(1)})`);
        note(worstLme4, f, scaledError(s[f], num(e[f] as string), Math.abs(num(e[f] as string))));
      }
      const sigmaRef = num(ref.sigma as string);
      const sigmaErr = scaledError(s.sigma, sigmaRef, Math.abs(sigmaRef));
      note(worstRef, "sigma", sigmaErr);
      if (!(sigmaErr <= TOL)) failures.push(`${where} sigma: reference ${sigmaRef}, got ${s.sigma}`);

      const vectors: [keyof GlmerSummary, number[], number][] = [
        ["estimate", s.estimate, TOL],
        ["stdError", s.stdError, TOL_SE],
        ["statistic", s.statistic, TOL_SE],
        ["residualQuantiles", s.residualQuantiles, TOL],
      ];
      for (const [field, got, tol] of vectors) {
        const x = nums(ref[field]);
        const l = nums(e[field]);
        if (got.length !== x.length) {
          failures.push(`${where} ${field}: length ${got.length}, expected ${x.length}`);
          continue;
        }
        const scale = maxAbs(x);
        got.forEach((v, i) => {
          const err = scaledError(v, x[i]!, scale);
          note(worstRef, field, err);
          if (!(err <= tol)) failures.push(`${where} ${field}[${i}]: reference ${x[i]}, got ${v} (error ${err.toExponential(1)})`);
          note(worstLme4, field, scaledError(v, l[i]!, maxAbs(l)));
        });
      }
      const pRef = nums(ref.pValue);
      const zRef = nums(ref.statistic);
      if (s.pValue.length !== pRef.length) failures.push(`${where} pValue: length ${s.pValue.length}, expected ${pRef.length}`);
      else {
        s.pValue.forEach((v, i) => {
          const x = pRef[i]!;
          // (the statistic's relative error is multiplied by about statistic² in the tail)
          const err = x < 1e-300 ? scaledError(v, x, 1) / 1e-6 : scaledError(v, x, Math.abs(x)) / Math.max(1, zRef[i]! ** 2);
          note(worstRef, "pValue (/ max(1, z²))", err);
          if (!(err <= TOL_SE)) failures.push(`${where} pValue[${i}]: reference ${x}, got ${v}`);
          note(worstLme4, "pValue", scaledError(v, num((e.pValue as string[])[i]!), Math.abs(num((e.pValue as string[])[i]!))));
        });
      }
      const corrRef = (ref.correlation as string[][]).flatMap(nums);
      const corr = s.correlation.flat();
      if (corr.length !== corrRef.length) failures.push(`${where} correlation: ${corr.length} values, expected ${corrRef.length}`);
      else {
        corr.forEach((v, i) => {
          const err = scaledError(v, corrRef[i]!, 1);
          note(worstRef, "correlation", err);
          if (!(err <= TOL_SE)) failures.push(`${where} correlation[${i}]: reference ${corrRef[i]}, got ${v}`);
        });
      }
      s.correlation.forEach((row, i) => {
        if (row[i] !== 1) failures.push(`${where} correlation[${i}][${i}]: ${row[i]}, not exactly 1`);
      });

      const exact: [string, unknown, unknown][] = [
        ["statisticName", s.statisticName, ref.statisticName],
        ["names", s.names, ref.names],
        ["nGroups", s.nGroups, ref.nGroups],
        ["nObs", s.nObs, ref.nObs],
        ["df", s.df, num(ref.df as string)],
        ["dfResidual", s.dfResidual, num(ref.dfResidual as string)],
        ["messages", s.messages, ref.messages],
        ["warnings", s.warnings, ref.warnings],
        ["family", s.family, ref.family],
        ["link", s.link, ref.link],
        ["nAGQ", s.nAGQ, num(ref.nAGQ as string)],
      ];
      for (const [field, value, expected] of exact) {
        if (JSON.stringify(value) !== JSON.stringify(expected)) failures.push(`${where} ${field}: ${JSON.stringify(value)}, expected ${JSON.stringify(expected)}`);
      }
      // the variance components are the fit's
      expect(s.varCorr).toEqual(fit.varCorr);
    });
    const show = (m: Map<string, number>): string => [...m].map(([f, w]) => `${f} ${w.toExponential(1)}`).join(", ");
    console.log(`glmerSummary: ${fixture.cases.length} cases; largest error against the reference: ${show(worstRef)}`);
    console.log(`glmerSummary: largest relative difference from lme4: ${show(worstLme4)}`);
    expect(failures, failures.slice(0, 30).join("\n")).toEqual([]);
  });

  describe("options and fits", () => {
    const cbpp = fixture.cases[0]!.args;
    const fit = glmer(cbpp.formula as string, dataFrameOf(cbpp.data, cbpp.dataTypes), glmerOptionsOf(cbpp));

    it("R's arguments are not supported, any other key is a RangeError", () => {
      expect(() => glmerSummary(fit, { correlation: false } as never)).toThrow(new Error("glmerSummary: argument 'correlation' is not supported"));
      expect(() => glmerSummary(fit, { "use.hessian": false } as never)).toThrow(new Error("glmerSummary: argument 'use.hessian' is not supported"));
      expect(() => glmerSummary(fit, { useHessian: false } as never)).toThrow(new Error("glmerSummary: argument 'useHessian' is not supported"));
      expect(() => glmerSummary(fit, { digits: 3 } as never)).toThrow(RangeError);
      expect(() => glmerSummary(fit, null as never)).toThrow(TypeError);
      expect(glmerSummary(fit, {}).names).toEqual(fit.fixefNames);
    });

    it("needs the result of glmer itself (not a copy, not an lmer fit)", () => {
      expect(() => glmerSummary({ ...fit })).toThrow(TypeError);
      const l = lmer("y ~ 1 + (1 | g)", { y: [1, 2.5, 3, 4.2, 5, 6.1], g: ["a", "a", "b", "b", "c", "c"] });
      expect(() => glmerSummary(l as never)).toThrow(TypeError);
    });
  });
});
