// Linear mixed models fitted by lmer against lme4 (oracle/lmer.R, oracle/lmer-behaviour.md "The fit and its
// results"). Against the reference (the fields at the exact minimiser of the criterion, in 128-bit arithmetic):
// logLik, AIC, BIC, deviance, REMLcrit relative 1e-12; theta, fixef, stdError, tValue, vcov, varCorr sd, ranef
// values, fitted, residuals within 1e-9 × the largest absolute value of the reference vector or matrix; sigma relative
// 1e-9; varCorr corr absolute 1e-9; elements of theta that are 0 in the reference exactly 0; df, singular, the names
// and levels equal to the reference; messages and warnings equal to lme4's. Against lme4 (expected): the criterion
// of the fit no worse than lme4's (d ≤ d_lme4 + 1e-10 |d_lme4|); the largest relative difference of each field from
// lme4 is printed (how far lme4's optimiser stops from the minimiser), not checked.
import { describe, expect, it } from "vitest";
import { lmer, type LmerOptions, type LmerResult } from "../src/models/lmer.js";
import { num } from "./helpers/fixture.js";
import { dataFrameOf, loadAnovaFixture } from "./helpers/anova.js";

const fixture = loadAnovaFixture("lmer");
const TOL_CRITERION = 1e-12;
const TOL = 1e-9;
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
/** |actual − expected| / scale, 0 when the two are equal (also when the scale is 0) */
const scaledError = (actual: number, expected: number, scale: number): number => (actual === expected ? 0 : Math.abs(actual - expected) / scale);

const SCALARS = ["logLik", "AIC", "BIC", "deviance", "REMLcrit"] as const;

/** The numeric fields of a fit as named vectors (one name per field), each with the scale of its tolerance */
function vectorsOf(r: LmerResult): Record<string, number[][]> {
  return {
    theta: [r.theta],
    fixef: [r.fixef],
    stdError: [r.coefTable.stdError],
    tValue: [r.coefTable.tValue],
    vcov: [r.vcov.flat()],
    sd: r.varCorr.map((v) => v.sd),
    ranef: r.ranef.map((g) => g.values.flat()),
    fitted: [r.fitted],
    residuals: [r.residuals],
  };
}
function fixtureVectorsOf(f: Record<string, unknown>): Record<string, number[][]> {
  return {
    theta: [nums(f.theta)],
    fixef: [nums(f.fixef)],
    stdError: [nums(f.stdError)],
    tValue: [nums(f.tValue)],
    vcov: [(f.vcov as string[][]).flatMap(nums)],
    sd: (f.varCorr as FixtureVarCorr[]).map((v) => nums(v.sd)),
    ranef: (f.ranef as FixtureRanef[]).map((g) => g.values.flatMap(nums)),
    fitted: [nums(f.fitted)],
    residuals: [nums(f.residuals)],
  };
}

describe("lmer", () => {
  it(`matches the exact minimiser and is at least as good as lme4 (${fixture.r_version})`, () => {
    const failures: string[] = [];
    // the largest error of each field against the reference (in units of its tolerance's scale), and the largest
    // relative difference from lme4
    const worstRef = new Map<string, number>();
    const worstLme4 = new Map<string, number>();
    const note = (map: Map<string, number>, field: string, err: number): void => {
      map.set(field, Math.max(map.get(field) ?? 0, Number.isNaN(err) ? Infinity : err));
    };
    fixture.cases.forEach((c, index) => {
      const a = c.args;
      const options: LmerOptions = { REML: a.REML as boolean };
      if (a.contrasts !== undefined) options.contrasts = a.contrasts as NonNullable<LmerOptions["contrasts"]>;
      if (a.levels !== undefined) options.levels = a.levels as NonNullable<LmerOptions["levels"]>;
      const r = lmer(a.formula as string, dataFrameOf(a.data, a.dataTypes), options);
      const e = c.expected;
      const ref = c.reference!;
      const where = `case ${index} (${String(a.formula)}, REML = ${String(a.REML)})`;

      for (const f of SCALARS) {
        const x = num(ref[f] as string);
        const err = scaledError(r[f], x, Math.abs(x));
        note(worstRef, f, err);
        if (!(err <= TOL_CRITERION)) failures.push(`${where} ${f}: reference ${x}, got ${r[f]}`);
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
            if (!(err <= TOL)) failures.push(`${where} ${field}[${k}][${i}]: reference ${x[i]}, got ${v}`);
            note(worstLme4, field, scaledError(v, l[i]!, maxAbs(l)));
          });
        });
      }
      // elements of theta at 0 in the reference: exactly 0
      want.theta![0]!.forEach((x, i) => {
        if (x === 0 && r.theta[i] !== 0) failures.push(`${where} theta[${i}]: reference 0, got ${r.theta[i]}`);
      });

      // sigma: relative
      const sigmaRef = num(ref.sigma as string);
      const sigmaErr = scaledError(r.sigma, sigmaRef, Math.abs(sigmaRef));
      note(worstRef, "sigma", sigmaErr);
      if (!(sigmaErr <= TOL)) failures.push(`${where} sigma: reference ${sigmaRef}, got ${r.sigma}`);
      note(worstLme4, "sigma", scaledError(r.sigma, num(e.sigma as string), Math.abs(num(e.sigma as string))));

      // varCorr: names, and corr (absolute)
      const vcRef = ref.varCorr as FixtureVarCorr[];
      const vcLme4 = e.varCorr as FixtureVarCorr[];
      if (r.varCorr.length !== vcRef.length) failures.push(`${where} varCorr: ${r.varCorr.length} terms, expected ${vcRef.length}`);
      else {
        r.varCorr.forEach((v, k) => {
          const x = vcRef[k]!;
          if (v.group !== x.group) failures.push(`${where} varCorr[${k}].group: ${v.group}, expected ${x.group}`);
          if (JSON.stringify(v.columns) !== JSON.stringify(x.columns)) failures.push(`${where} varCorr[${k}].columns: ${JSON.stringify(v.columns)}, expected ${JSON.stringify(x.columns)}`);
          const corr = v.corr.flat();
          const corrRef = x.corr.flatMap(nums);
          const corrLme4 = vcLme4[k]!.corr.flatMap(nums);
          if (corr.length !== corrRef.length) {
            failures.push(`${where} varCorr[${k}].corr: ${corr.length} values, expected ${corrRef.length}`);
            return;
          }
          corr.forEach((c, i) => {
            const err = scaledError(c, corrRef[i]!, 1);
            note(worstRef, "corr", err);
            if (!(err <= TOL)) failures.push(`${where} varCorr[${k}].corr[${i}]: reference ${corrRef[i]}, got ${c}`);
            note(worstLme4, "corr", scaledError(c, corrLme4[i]!, 1));
          });
        });
      }

      // ranef: names and levels
      const reRef = ref.ranef as FixtureRanef[];
      if (r.ranef.length !== reRef.length) failures.push(`${where} ranef: ${r.ranef.length} groups, expected ${reRef.length}`);
      else {
        r.ranef.forEach((g, k) => {
          const x = reRef[k]!;
          if (g.group !== x.group) failures.push(`${where} ranef[${k}].group: ${g.group}, expected ${x.group}`);
          if (JSON.stringify(g.levels) !== JSON.stringify(x.levels)) failures.push(`${where} ranef[${k}].levels differ`);
          if (JSON.stringify(g.columns) !== JSON.stringify(x.columns)) failures.push(`${where} ranef[${k}].columns: ${JSON.stringify(g.columns)}, expected ${JSON.stringify(x.columns)}`);
        });
      }

      // df, singular, messages, warnings
      if (r.df !== num(ref.df as string)) failures.push(`${where} df: ${r.df}, expected ${String(ref.df)}`);
      if (r.singular !== ref.singular) failures.push(`${where} singular: ${r.singular}, expected ${String(ref.singular)}`);
      if (r.singular !== e.singular) failures.push(`${where} singular: ${r.singular}, lme4 ${String(e.singular)}`);
      if (JSON.stringify(r.messages) !== JSON.stringify(e.messages)) failures.push(`${where} messages: ${JSON.stringify(r.messages)}, lme4 ${JSON.stringify(e.messages)}`);
      if (JSON.stringify(r.warnings) !== JSON.stringify(e.warnings)) failures.push(`${where} warnings: ${JSON.stringify(r.warnings)}, lme4 ${JSON.stringify(e.warnings)}`);
      if (r.nObs !== r.fitted.length || r.rows.length !== r.nObs) failures.push(`${where} nObs ${r.nObs}, rows ${r.rows.length}`);

      // the criterion is no worse than lme4's
      const dLme4 = num((a.REML ? e.REMLcrit : e.deviance) as string);
      const d = a.REML ? r.REMLcrit : r.deviance;
      if (!(d <= dLme4 + TOL_LME4 * Math.abs(dLme4))) failures.push(`${where} criterion ${d} worse than lme4's ${dLme4}`);
    });
    const show = (m: Map<string, number>): string => [...m].map(([f, w]) => `${f} ${w.toExponential(1)}`).join(", ");
    console.log(`lmer: ${fixture.cases.length} cases; largest error against the reference: ${show(worstRef)}`);
    console.log(`lmer: largest relative difference from lme4: ${show(worstLme4)}`);
    expect(failures, failures.slice(0, 20).join("\n")).toEqual([]);
  });

  it("throws for a formula without random-effects terms", () => {
    expect(() => lmer("y ~ x", { y: [1, 2, 3], x: [1, 2, 4] })).toThrow("No random effects terms specified in formula");
  });
});
