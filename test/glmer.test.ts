// Generalised linear mixed models fitted by glmer against the fixture glmer (oracle/glmer.R; oracle/glmer-behaviour.md
// "The fit and its results (stage 2c)", accuracy G11). Against the reference (every field at the exact optimum of the
// Laplace deviance at the exact conditional mode, in 110-bit arithmetic): logLik, AIC, BIC relative 1e-10; deviance
// (the sum of the deviance residuals) relative 1e-7; theta, fixef, varCorr sd, ranef values, fitted,
// linearPredictor and the four residual vectors within 1e-7 × the largest absolute value of the reference vector;
// sigma relative 1e-7; varCorr corr absolute 1e-7; vcov, stdError, zValue within 1e-6 × the largest absolute value;
// elements of theta that are 0 in the reference exactly 0; singular, vcovFrom, df, nObs, the names and levels,
// messages and warnings equal to the reference's; the error case: the error message. Against lme4 (expected): the
// fit's −2 logLik no worse than the exact deviance at lme4's estimates (devianceAtLme4, + 1e-10 relative); the
// largest difference of each field from lme4 is printed, not checked. Also: the option errors (unknown and
// unsupported keys, start, nAGQ).
import { describe, expect, it } from "vitest";
import { glmer, type GlmerOptions, type GlmerResult } from "../src/models/glmer.js";
import type { GlmerFamilyName } from "../src/models/glmerFamily.js";
import type { GlmLinkName } from "../src/models/glmFamily.js";
import { num } from "./helpers/fixture.js";
import { dataFrameOf, loadAnovaFixture } from "./helpers/anova.js";

const fixture = loadAnovaFixture("glmer");
const TOL_LOGLIK = 1e-10;
const TOL = 1e-7;
const TOL_VCOV = 1e-6;
const TOL_LME4 = 1e-10;

interface FixtureVarCorr {
  group: string;
  columns: string[];
  sd: string[];
  corr: string[][];
}
interface FixtureRanef {
  group: string;
  levels: string[];
  columns: string[];
  values: string[][];
}

const nums = (v: unknown): number[] => (v as string[]).map((x) => num(x));
const maxAbs = (v: readonly number[]): number => Math.max(0, ...v.map(Math.abs));
/** |actual − expected| / scale, 0 when the two are equal (also when the scale is 0, or both NaN) */
const scaledError = (actual: number, expected: number, scale: number): number =>
  actual === expected || (Number.isNaN(actual) && Number.isNaN(expected)) ? 0 : Math.abs(actual - expected) / scale;

/** The vector fields with their tolerance, as lists of vectors */
function vectorsOf(r: GlmerResult): Record<string, number[][]> {
  return {
    theta: [r.theta],
    fixef: [r.fixef],
    sd: r.varCorr.map((v) => v.sd),
    ranef: r.ranef.map((g) => g.values.flat()),
    fitted: [r.fitted],
    linearPredictor: [r.linearPredictor],
    residuals: [r.residuals],
    pearsonResiduals: [r.pearsonResiduals],
    workingResiduals: [r.workingResiduals],
    responseResiduals: [r.responseResiduals],
    stdError: [r.coefTable.stdError],
    zValue: [r.coefTable.zValue],
    vcov: [r.vcov.flat()],
  };
}
function fixtureVectorsOf(f: Record<string, unknown>): Record<string, number[][]> {
  return {
    theta: [nums(f.theta)],
    fixef: [nums(f.fixef)],
    sd: (f.varCorr as FixtureVarCorr[]).map((v) => nums(v.sd)),
    ranef: (f.ranef as FixtureRanef[]).map((g) => g.values.flatMap(nums)),
    fitted: [nums(f.fitted)],
    linearPredictor: [nums(f.linearPredictor)],
    residuals: [nums(f.residuals)],
    pearsonResiduals: [nums(f.pearsonResiduals)],
    workingResiduals: [nums(f.workingResiduals)],
    responseResiduals: [nums(f.responseResiduals)],
    stdError: [nums(f.stdError)],
    zValue: [nums(f.zValue)],
    vcov: [(f.vcov as string[][]).flatMap(nums)],
  };
}
const VCOV_FIELDS = new Set(["stdError", "zValue", "vcov"]);

function optionsOf(a: Record<string, unknown>): GlmerOptions {
  const options: GlmerOptions = { family: a.family as GlmerFamilyName, link: a.link as GlmLinkName, nAGQ: num(a.nAGQ as string) };
  if (a.weights !== undefined) options.weights = nums(a.weights);
  if (a.offset !== undefined) options.offset = nums(a.offset);
  return options;
}

describe("glmer", () => {
  it(`matches the exact optimum and is at least as good as lme4 (${fixture.r_version})`, () => {
    const failures: string[] = [];
    const worstRef = new Map<string, number>();
    const worstLme4 = new Map<string, number>();
    const note = (map: Map<string, number>, field: string, err: number): void => {
      map.set(field, Math.max(map.get(field) ?? 0, Number.isNaN(err) ? Infinity : err));
    };
    fixture.cases.forEach((c, index) => {
      const a = c.args;
      const where = `case ${index} (${String(a.formula)}, ${String(a.family)} ${String(a.link)}, nAGQ = ${String(a.nAGQ)})`;
      const data = dataFrameOf(a.data, a.dataTypes);
      const e = c.expected;
      if (e.error !== undefined) {
        let message: string | undefined;
        try {
          glmer(a.formula as string, data, optionsOf(a));
        } catch (err) {
          message = (err as Error).message;
        }
        if (message !== e.error) failures.push(`${where}: error ${String(message)}, expected ${String(e.error)}`);
        return;
      }
      const r = glmer(a.formula as string, data, optionsOf(a));
      const ref = c.reference!;

      for (const f of ["logLik", "AIC", "BIC", "deviance"] as const) {
        const x = num(ref[f] as string);
        const err = scaledError(r[f], x, Math.abs(x));
        note(worstRef, f, err);
        if (!(err <= (f === "deviance" ? TOL : TOL_LOGLIK))) failures.push(`${where} ${f}: reference ${x}, got ${r[f]} (error ${err.toExponential(1)})`);
        note(worstLme4, f, scaledError(r[f], num(e[f] as string), Math.abs(num(e[f] as string))));
      }

      const got = vectorsOf(r);
      const want = fixtureVectorsOf(ref);
      const lme4 = fixtureVectorsOf(e);
      for (const [field, parts] of Object.entries(want)) {
        if (got[field]!.length !== parts.length) {
          failures.push(`${where} ${field}: ${got[field]!.length} parts, expected ${parts.length}`);
          continue;
        }
        const tol = VCOV_FIELDS.has(field) ? TOL_VCOV : TOL;
        parts.forEach((x, k) => {
          const g = got[field]![k]!;
          const l = lme4[field]![k]!;
          if (g.length !== x.length) {
            failures.push(`${where} ${field}[${k}]: length ${g.length}, expected ${x.length}`);
            return;
          }
          const scale = maxAbs(x);
          g.forEach((v, i) => {
            const err = scaledError(v, x[i]!, scale);
            note(worstRef, field, err);
            if (!(err <= tol)) failures.push(`${where} ${field}[${k}][${i}]: reference ${x[i]}, got ${v} (error ${err.toExponential(1)})`);
            note(worstLme4, field, scaledError(v, l[i]!, maxAbs(l)));
          });
        });
      }
      want.theta![0]!.forEach((x, i) => {
        if (x === 0 && r.theta[i] !== 0) failures.push(`${where} theta[${i}]: reference 0, got ${r.theta[i]}`);
      });

      const sigmaRef = num(ref.sigma as string);
      const sigmaErr = scaledError(r.sigma, sigmaRef, Math.abs(sigmaRef));
      note(worstRef, "sigma", sigmaErr);
      if (!(sigmaErr <= TOL)) failures.push(`${where} sigma: reference ${sigmaRef}, got ${r.sigma}`);
      note(worstLme4, "sigma", scaledError(r.sigma, num(e.sigma as string), Math.abs(num(e.sigma as string))));

      const vcRef = ref.varCorr as FixtureVarCorr[];
      if (r.varCorr.length !== vcRef.length) failures.push(`${where} varCorr: ${r.varCorr.length} terms, expected ${vcRef.length}`);
      else {
        r.varCorr.forEach((v, k) => {
          const x = vcRef[k]!;
          if (v.group !== x.group) failures.push(`${where} varCorr[${k}].group: ${v.group}, expected ${x.group}`);
          if (JSON.stringify(v.columns) !== JSON.stringify(x.columns)) failures.push(`${where} varCorr[${k}].columns: ${JSON.stringify(v.columns)}`);
          const corr = v.corr.flat();
          const corrRef = x.corr.flatMap(nums);
          const corrLme4 = (e.varCorr as FixtureVarCorr[])[k]!.corr.flatMap(nums);
          if (corr.length !== corrRef.length) {
            failures.push(`${where} varCorr[${k}].corr: ${corr.length} values, expected ${corrRef.length}`);
            return;
          }
          corr.forEach((cv, i) => {
            const err = scaledError(cv, corrRef[i]!, 1);
            note(worstRef, "corr", err);
            if (!(err <= TOL)) failures.push(`${where} varCorr[${k}].corr[${i}]: reference ${corrRef[i]}, got ${cv}`);
            note(worstLme4, "corr", scaledError(cv, corrLme4[i]!, 1));
          });
        });
      }
      const reRef = ref.ranef as FixtureRanef[];
      if (r.ranef.length !== reRef.length) failures.push(`${where} ranef: ${r.ranef.length} groups, expected ${reRef.length}`);
      else {
        r.ranef.forEach((g, k) => {
          const x = reRef[k]!;
          if (g.group !== x.group) failures.push(`${where} ranef[${k}].group: ${g.group}, expected ${x.group}`);
          if (JSON.stringify(g.levels) !== JSON.stringify(x.levels)) failures.push(`${where} ranef[${k}].levels differ`);
          if (JSON.stringify(g.columns) !== JSON.stringify(x.columns)) failures.push(`${where} ranef[${k}].columns: ${JSON.stringify(g.columns)}`);
        });
      }

      const exact: [string, unknown, unknown][] = [
        ["singular", r.singular, ref.singular],
        ["vcovFrom", r.vcovFrom, ref.vcovFrom],
        ["df", r.df, num(ref.df as string)],
        ["nObs", r.nObs, ref.nObs],
        ["messages", r.messages, ref.messages],
        ["warnings", r.warnings, ref.warnings],
        ["family", r.family, a.family],
        ["link", r.link, a.link],
        ["nAGQ", r.nAGQ, num(a.nAGQ as string)],
      ];
      for (const [field, value, expected] of exact) {
        if (JSON.stringify(value) !== JSON.stringify(expected)) failures.push(`${where} ${field}: ${JSON.stringify(value)}, expected ${JSON.stringify(expected)}`);
      }
      if (r.rows.length !== r.nObs || r.fitted.length !== r.nObs) failures.push(`${where} rows ${r.rows.length}, fitted ${r.fitted.length}, nObs ${r.nObs}`);

      // no worse than lme4's estimates
      const dLme4 = num(ref.devianceAtLme4 as string);
      if (!(-2 * r.logLik <= dLme4 + TOL_LME4 * Math.abs(dLme4))) failures.push(`${where} -2 logLik ${-2 * r.logLik} worse than at lme4's estimates ${dLme4}`);
    });
    const show = (m: Map<string, number>): string => [...m].map(([f, w]) => `${f} ${w.toExponential(1)}`).join(", ");
    console.log(`glmer: ${fixture.cases.length} cases; largest error against the reference: ${show(worstRef)}`);
    console.log(`glmer: largest relative difference from lme4: ${show(worstLme4)}`);
    expect(failures, failures.slice(0, 30).join("\n")).toEqual([]);
  });

  describe("options", () => {
    const cbpp = fixture.cases[0]!.args;
    const data = dataFrameOf(cbpp.data, cbpp.dataTypes);
    const formula = cbpp.formula as string;
    const fit = (options: unknown): GlmerResult => glmer(formula, data, { family: "binomial", ...(options as GlmerOptions) });
    const unknown = (key: string): RegExp => new RegExp(`^unknown option '${key.replace(/\./g, "\\.")}' for glmer \\(known: `);

    it("are checked: an object, R's arguments not supported, unknown keys (also in start)", () => {
      expect(() => glmer(formula, data, null as never)).toThrow(TypeError);
      expect(() => fit({ mustart: [0.5] })).toThrow(new Error("glmer: argument 'mustart' is not supported"));
      expect(() => fit({ control: {} })).toThrow(new Error("glmer: argument 'control' is not supported"));
      expect(() => fit({ REML: false })).toThrow(RangeError);
      expect(() => fit({ REML: false })).toThrow(unknown("REML"));
      expect(() => fit({ start: { par: [1] } })).toThrow(unknown("start.par"));
      expect(() => fit({ start: [1] })).toThrow(unknown("start.0"));
      expect(() => fit({ start: { theta: ["1"] } })).toThrow(TypeError);
    });

    it("start: R's errors in R's order, and the same estimate from another start", () => {
      // (checked in R: the names with nAGQ = 0 first, then theta's length, theta's bounds, fixef's length)
      expect(() => fit({ nAGQ: 0, start: { theta: [1, 2], fixef: [1, 2, 3] } })).toThrow(new RangeError(`'start' has invalid names "fixef"`));
      expect(() => fit({ start: { theta: [1, 2], fixef: [1, 2, 3] } })).toThrow(new RangeError("starting value of 'par' has length not equal to 1"));
      expect(() => fit({ start: { theta: [-1], fixef: [1, 2, 3] } })).toThrow(new RangeError("Starting values violate bounds"));
      expect(() => fit({ start: { fixef: [1, 2, 3] } })).toThrow(new RangeError("starting value of 'fixef' has length not equal to 4"));
      const r = fit({});
      const s = fit({ start: { theta: [0.2], fixef: [-1, -1, -1, -1] } });
      expect(s.theta[0]).toBeCloseTo(r.theta[0]!, 7);
      s.fixef.forEach((b, k) => expect(b).toBeCloseTo(r.fixef[k]!, 7));
      expect(fit({ start: { theta: [0] } }).theta[0]).toBeCloseTo(r.theta[0]!, 7);
    });

    it("nAGQ: negative a RangeError (R uses 0), above 1 the quadrature (test/glmerAgq.test.ts), above 100 R's error", () => {
      expect(() => fit({ nAGQ: -1 })).toThrow(RangeError);
      expect(fit({ nAGQ: 2.7 }).nAGQ).toBe(2);
      expect(() => fit({ nAGQ: 101 })).toThrow(new RangeError("nAGQ <= 100L is not TRUE"));
      // (truncated as in R)
      expect(fit({ nAGQ: 0.5 }).nAGQ).toBe(0);
    });

    it("family gaussian with the identity link (also the default) is a RangeError pointing to lmer", () => {
      expect(() => glmer("y ~ 1 + (1 | g)", { y: [1, 2, 3, 4], g: ["a", "a", "b", "b"] })).toThrow(/use lmer/);
    });
  });
});
