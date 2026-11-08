// psych's ICC (the six Shrout-Fleiss forms) against R (oracle/iccpsych.R), by the rules of
// oracle/methodcomparison-behaviour.md, section 3 and decisions 14-17.
//
// rStats.js computes both paths exactly (ANOVA mean squares in double-double; REML in closed form), so every case
// with a reference is compared with the reference (refKind "anova": exact rational mean squares; "reml": the closed
// form on the boundary). R's lmer values are only about 1e-5 accurate (lme4's optimiser) and are not compared; R's aov
// values are compared too where R is accurate. Cases without a reference: missing ratings (an error here, decision
// 15), errors of R, and perfectly consistent ratings (MSE = 0: F Infinity and p 0 here, R's F about 1e31).
import { describe, expect, it } from "vitest";
import { ICC, icc, type ICCResult } from "../src/index.js";
import { num } from "./helpers/fixture.js";
import { arg, loadHTestFixture, type HTestCase } from "./helpers/htest.js";
import { expectScaleInvariant } from "./helpers/scaleInvariance.js";

const TYPES = ["ICC1", "ICC2", "ICC3", "ICC1k", "ICC2k", "ICC3k"] as const;
const fixture = loadHTestFixture("iccPsych");

function relErr(a: number, e: number): number {
  if (a === e) return 0;
  return Math.abs(a - e) / Math.abs(e);
}

/** [ICC, F, df1, df2, p, lower, upper] of each form, in the fixture's layout */
const rowsOf = (r: ICCResult): number[][] => r.results.map((v) => [v.ICC, v.F, v.df1, v.df2, v.pValue, v.lower, v.upper]);

function run(a: HTestCase["args"]): ICCResult {
  const x = arg.mat(a.x)!;
  const lmer = arg.bool(a.lmer);
  const alpha = arg.num(a.alpha);
  return ICC(x, { ...(lmer === undefined ? {} : { lmer }), ...(alpha === undefined ? {} : { alpha }) });
}

describe("ICC (psych)", () => {
  it(`matches the references and R (${fixture.r_version})`, () => {
    let compared = 0;
    let errors = 0;
    fixture.cases.forEach((c, index) => {
      const e = c.expected as Record<string, unknown>;
      const hasNA = (c.args.x as string[][]).some((r) => r.some((v) => v === "NA"));
      const allEqual = new Set((c.args.x as string[][]).flat()).size === 1;
      if (e.error !== undefined || hasNA || allEqual) {
        // R's errors, missing ratings (supported by psych's lmer path and by aov with missing = FALSE; an error
        // here, decision 15), and ratings that are all equal (R: rounding noise, ICC -8e-16; an error here, decision
        // 17)
        expect(() => run(c.args), `case ${index}`).toThrow(RangeError);
        errors++;
        return;
      }
      const r = run(c.args);
      const got = rowsOf(r);
      const ref = c.reference as { results: Record<string, string[]>; MSW: string } | undefined;
      const lmer = c.args.lmer !== false;
      if (ref !== undefined) {
        // closed forms from mean squares accurate to a few ulp: 1e-12 relative, the p-values (upper tails of F at
        // F values with the same relative error times df) and bounds (quantiles of F) to 1e-11
        TYPES.forEach((t, i) => {
          const want = ref.results[t]!.map(num);
          want.forEach((w, j) => {
            const tol = j === 4 || j >= 5 ? 1e-11 : 1e-12;
            expect(relErr(got[i]![j]!, w), `case ${index} ${t}[${j}]: ${got[i]![j]} vs ${w}`).toBeLessThanOrEqual(tol);
          });
        });
        expect(relErr(r.MSW, num(ref.MSW)), `case ${index} MSW`).toBeLessThanOrEqual(1e-13);
      }
      // the data scaled by 2^-540 and 2^520: aov's sums of squares underflow or overflow (NaN, 0); the reference only
      const scaled = (c.args.x as string[][]).flat().some((v) => Math.abs(num(v)) > 1e100 || Math.abs(num(v)) < 1e-100);
      if (scaled) expect(ref).toBeDefined();
      else if (!lmer) {
        // R's aov values where they are finite and accurate (not the cases scaled by 2^-540, 2^520 or MSE = 0)
        const res = e.results as Record<string, string[]>;
        const perfect = r.MSE === 0;
        TYPES.forEach((t, i) => {
          res[t]!.map(num).forEach((w, j) => {
            if (Number.isNaN(w)) return;
            if (perfect && ((j === 1 && w > 1e30) || (j === 4 && w < 1e-100))) {
              // R's F about 1e31 from a rounding-level residual (MSE, and MSW where every subject's ratings are
              // equal); the true F is Infinity, p 0
              expect(got[i]![j], `case ${index} ${t}[${j}]`).toBe(j === 1 ? Infinity : 0);
              return;
            }
            // aov's sums of squares lose up to 3e-10 with an offset of 1e6; 1e-12 elsewhere (bounds 1e-11)
            const tol = index === 17 ? 1e-9 : j === 4 || j >= 5 ? 1e-11 : 1e-12;
            const floor = perfect ? 1e-14 : 0;
            const err = Math.abs(got[i]![j]! - w) / Math.max(Math.abs(w), floor);
            expect(err, `case ${index} ${t}[${j}]: ${got[i]![j]} vs ${w}`).toBeLessThanOrEqual(tol);
          });
        });
        if (r.MSW === 0) expect(num(e.MSW as string)).toBeLessThan(1e-25);
        else if (!Number.isNaN(num(e.MSW as string)) && r.MSW < Infinity) {
          expect(relErr(r.MSW, num(e.MSW as string)), `case ${index} MSW`).toBeLessThanOrEqual(index === 17 ? 1e-9 : 1e-12);
        }
        expect(r.warnings, `case ${index} warnings`).toEqual(e.warnings);
      } else {
        // lme4's values: within its optimiser's error
        const res = e.results as Record<string, string[]>;
        TYPES.forEach((t, i) =>
          res[t]!.map(num).forEach((w, j) => {
            expect(Math.abs(got[i]![j]! - w) / Math.max(Math.abs(w), 1e-3), `case ${index} ${t}[${j}] (lmer)`).toBeLessThanOrEqual(2e-4);
          }),
        );
        // lme4's "boundary (singular) fit" is a message, not a warning
        expect(r.warnings).toEqual([]);
      }
      compared++;
    });
    console.log(`iccPsych: ${compared} cases compared, ${errors} errors verified`);
    expect(compared + errors).toBe(fixture.cases.length);
  });

  it("agrees with icc (irr) except the ICC2k interval", () => {
    const sf = [[9, 2, 5, 8], [6, 1, 3, 2], [8, 4, 6, 8], [7, 1, 2, 6], [10, 5, 6, 9], [6, 2, 4, 7]];
    const r = ICC(sf, { lmer: false });
    const pairs: [number, Parameters<typeof icc>[1]][] = [
      [0, { model: "oneway" }],
      [1, { model: "twoway", type: "agreement" }],
      [2, { model: "twoway", type: "consistency" }],
      [3, { model: "oneway", unit: "average" }],
      [5, { model: "twoway", type: "consistency", unit: "average" }],
    ];
    for (const [i, o] of pairs) {
      const a = icc(sf, o);
      const b = r.results[i]!;
      for (const [u, v] of [[a.value, b.ICC], [a.Fvalue, b.F], [a.pValue, b.pValue], [a.lbound, b.lower], [a.ubound, b.upper]] as const) {
        expect(relErr(v, u)).toBeLessThanOrEqual(1e-13);
      }
    }
    const avg = icc(sf, { model: "twoway", type: "agreement", unit: "average" });
    expect(relErr(r.results[4]!.ICC, avg.value)).toBeLessThanOrEqual(1e-14);
    // irr's interval [0.0394, 0.9286], psych's [0.0711, 0.9272]
    expect(r.results[4]!.lower).toBeCloseTo(0.0711, 4);
    expect(avg.lbound).toBeCloseTo(0.0394, 4);
  });

  it("degenerate data (decision 17)", () => {
    expect(() => ICC([[3, 3, 3], [3, 3, 3], [3, 3, 3]])).toThrow(/all ratings are equal/);
    expect(() => ICC([[1, 2, 3], [1, 2, 3]])).toThrow(RangeError);
    expect(() => ICC([[1, 2, 3]])).toThrow(RangeError);
    expect(() => ICC([[1], [2]])).toThrow(RangeError);
    expect(() => ICC([[1, 2], [3]])).toThrow(TypeError);
    expect(() => ICC([[1, 2], [3, Infinity]])).toThrow(RangeError);
    expect(() => ICC([[1, 2], [3, 4]], { alpha: 1 })).toThrow(RangeError);
    expect(() => ICC([[1, 2], [3, 4]], { confLevel: 0 })).toThrow(RangeError);
    expect(() => ICC([[1, 2], [3, 4]], { foo: 1 } as never)).toThrow(RangeError);
    // perfect consistency: F Infinity, p 0, ICC3 (and ICC3k) and their bounds 1, on both paths
    for (const lmer of [true, false]) {
      const r = ICC([[1, 2, 4], [2, 3, 5], [3, 4, 6], [4, 5, 7], [5, 6, 8]], { lmer });
      expect(r.MSE).toBe(0);
      for (const i of [2, 5]) expect([r.results[i]!.ICC, r.results[i]!.lower, r.results[i]!.upper]).toEqual([1, 1, 1]);
      for (const i of [1, 2, 4, 5]) expect([r.results[i]!.F, r.results[i]!.pValue]).toEqual([Infinity, 0]);
      expect(r.warnings).toEqual(lmer ? [] : ["essentially perfect fit for ‘1’: summary may be unreliable"]);
    }
    // perfect agreement: every coefficient and bound 1
    const p = ICC([[1, 1, 1], [2, 2, 2], [3, 3, 3]]);
    for (const row of p.results) expect([row.ICC, row.lower, row.upper]).toEqual([1, 1, 1]);
  });

  it("REML on the boundary: coefficients 0 and F 1 where a component is 0", () => {
    const neg = [[1, 5], [5, 1], [2, 4], [4, 2], [3, 3.2]];
    const r = ICC(neg);
    expect(r.results[0]!.ICC).toBe(0);
    expect(r.results[2]!.F).toBe(1);
    expect(r.MSB).toBe(r.MSE);
    const a = ICC(neg, { lmer: false });
    expect(a.results[3]!.ICC).toBeLessThan(-100);
  });

  it("does not depend on the units of the data", () => {
    const sf = [[9, 2, 5, 8], [6, 1, 3, 2], [8, 4, 6, 8], [7, 1, 2, 6], [10, 5, 6, 9], [6, 2, 4, 7]];
    for (const lmer of [true, false]) {
      for (const data of [sf, [[1, 5], [5, 1], [2, 4], [4, 2], [3, 3.2]]]) {
        const runAt = (c: number): ICCResult => ICC(data.map((r) => r.map((v) => v * c)), { lmer });
        expectScaleInvariant(`ICC lmer=${lmer}`, runAt, { unitless: (r) => rowsOf(r).flat(), squared: (r) => [r.MSB, r.MSJ, r.MSE, r.MSW] }, 1e-12);
        for (const c of [2 ** -1000, 2 ** 1000]) {
          const r = runAt(c);
          expect(rowsOf(r).flat()).toEqual(rowsOf(runAt(1)).flat());
        }
      }
    }
  });
});
