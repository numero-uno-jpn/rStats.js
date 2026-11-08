// TOSTER's t_TOST against R (oracle/toster.R), by the rules of oracle/methodcomparison-behaviour.md, section 4 and
// decisions 18-23: the three t tests, the bounds, the raw and standardised effect sizes and TOSTER's notes (here
// warnings). The noncentral-t limits are compared with the fixture's reference (true roots; TOSTER's optimiser is
// about 1e-9 accurate). Known differences (decisions 20 and 23): for one sample the raw interval is that of mean - mu
// and the "t" and "z" limits of the standardised difference are 1 - 2 alpha limits; alpha = 0.5 is an error.
import { describe, expect, it } from "vitest";
import { tsumTOST, tTOST, type TTOSTOptions, type TTOSTResult } from "../src/index.js";
import { pt, qnorm, qt } from "../src/index.js";
import { num } from "./helpers/fixture.js";
import { arg, loadHTestFixture, type HTestCase } from "./helpers/htest.js";
import { expectScaleInvariant } from "./helpers/scaleInvariance.js";

const fixture = loadHTestFixture("tTOST");

function optionsOf(a: HTestCase["args"]): TTOSTOptions {
  const o: Record<string, unknown> = {};
  for (const key of ["lowEqbound", "highEqbound", "alpha", "mu"] as const) if (a[key] !== undefined) o[key] = arg.num(a[key]);
  if (a.eqb !== undefined) o.eqb = arg.vec(a.eqb);
  for (const key of ["paired", "varEqual", "biasCorrection", "rmCorrection"] as const) if (a[key] !== undefined) o[key] = arg.bool(a[key]);
  for (const key of ["hypothesis", "eqboundType", "glass", "smdCi"] as const) if (a[key] !== undefined) o[key] = arg.str(a[key]);
  return o as TTOSTOptions;
}

const run = (a: HTestCase["args"]): TTOSTResult => tTOST(arg.vec(a.x)!, arg.vec(a.y), optionsOf(a));

/** |a - e| / max(|e|, floor) */
const err = (a: number, e: number, floor = 0): number => (a === e ? 0 : Math.abs(a - e) / Math.max(Math.abs(e), floor));

describe("tTOST (TOSTER t_TOST)", () => {
  it(`matches R (${fixture.r_version}) and the noncentral-t references`, () => {
    let compared = 0;
    let errors = 0;
    let knownNct = 0;
    fixture.cases.forEach((c, index) => {
      const e = c.expected as Record<string, unknown>;
      const a = c.args;
      const alpha = arg.num(a.alpha) ?? 0.05;
      if (e.error !== undefined || alpha === 0.5) {
        // R's errors, and alpha = 0.5 (TOSTER: a zero-width interval; an error here, decision 23)
        expect(() => run(a), `case ${index}`).toThrow();
        errors++;
        return;
      }
      const r = run(a);
      const what = (f: string): string => `case ${index} ${f}`;
      // closed forms: 1e-13; the p-values (t tails) 1e-12
      const rows = e.TOST as Record<string, string[]>;
      for (const [name, got] of [["t-test", r.tTest], ["TOST Lower", r.lower], ["TOST Upper", r.upper]] as const) {
        const w = rows[name]!.map(num);
        expect(err(got.t, w[0]!, 1e-12), what(`${name} t`)).toBeLessThanOrEqual(1e-12);
        expect(err(got.se, w[1]!), what(`${name} se`)).toBeLessThanOrEqual(1e-13);
        expect(err(got.df, w[2]!), what(`${name} df`)).toBeLessThanOrEqual(1e-13);
        expect(err(got.pValue, w[3]!), what(`${name} p`)).toBeLessThanOrEqual(1e-12);
      }
      const eqb = e.eqb as string[][];
      expect(eqb[1]![0], what("label")).toBe(r.smd.label);
      expect(err(r.bounds.raw[0], num(eqb[0]![1]!)), what("raw bounds")).toBeLessThanOrEqual(1e-14);
      expect(err(r.bounds.raw[1], num(eqb[0]![2]!)), what("raw bounds")).toBeLessThanOrEqual(1e-14);
      expect(err(r.bounds.smd[0], num(eqb[1]![1]!)), what("smd bounds")).toBeLessThanOrEqual(1e-13);
      expect(err(r.bounds.smd[1], num(eqb[1]![2]!)), what("smd bounds")).toBeLessThanOrEqual(1e-13);
      const eff = e.effsize as Record<string, string[]>;
      const rawE = eff.Raw!.map(num);
      const oneSample = a.y === undefined;
      const mu = arg.num(a.mu) ?? 0;
      const se = rawE[1]!;
      // known difference (decision 20): TOSTER's one-sample interval is that of the mean, here of mean - mu
      const rawLo = oneSample ? rawE[2]! - mu : rawE[2]!;
      const rawHi = oneSample ? rawE[3]! - mu : rawE[3]!;
      expect(err(r.raw.estimate, rawE[0]!, se), what("raw estimate")).toBeLessThanOrEqual(1e-13);
      expect(err(r.raw.se, se), what("raw se")).toBeLessThanOrEqual(1e-13);
      // the ends relative to the standard error (they cancel near 0, and mu is subtracted in R's values)
      expect(err(r.raw.confInt[0], rawLo, se), what("raw lower")).toBeLessThanOrEqual(1e-12);
      expect(err(r.raw.confInt[1], rawHi, se), what("raw upper")).toBeLessThanOrEqual(1e-12);
      expect(err(r.confLevel, rawE[4]!), what("conf level")).toBeLessThanOrEqual(1e-15);
      const smdE = eff[r.smd.label]!.map(num);
      const smd = e.smd as Record<string, string>;
      const ref = (c.reference as { smd: { dlow: string; dhigh: string } } | undefined)?.smd;
      expect(err(r.smd.estimate, smdE[0]!, 1e-3), what("smd estimate")).toBeLessThanOrEqual(1e-13);
      expect(err(r.smd.se, smdE[1]!), what("smd se")).toBeLessThanOrEqual(1e-13);
      // (TOSTER forms J as exp of a difference of lgammas, which loses a few digits; hedgesJ forms the difference directly)
      expect(err(r.smd.J, num(smd.J!)), what("J")).toBeLessThanOrEqual(1e-13);
      expect(err(r.smd.df, num(smd.d_df!)), what("smd df")).toBeLessThanOrEqual(1e-13);
      let [lo, hi] = [smdE[2]!, smdE[3]!];
      if (ref !== undefined) [lo, hi] = [num(ref.dlow), num(ref.dhigh)];
      else if (oneSample && (r.smd.label === "Hedges's g" || r.smd.label === "Cohen's d") && (a.smdCi === "t" || a.smdCi === "z")) {
        // known difference (decision 20): 1 - 2 alpha limits, TOSTER's are 1 - alpha
        const q = a.smdCi === "t" ? (qt(1 - alpha, r.smd.df) as number) : (qnorm(1 - alpha) as number);
        [lo, hi] = [smdE[0]! - q * smdE[1]!, smdE[0]! + q * smdE[1]!];
      }
      // the roots of the noncentral t to about 1e-12 of the standard error of the estimate (pt's accuracy)
      const ends: [number, number, string][] = [[r.smd.confInt[0], lo, "smd lower"], [r.smd.confInt[1], hi, "smd upper"]];
      for (const [got, want, field] of ends) {
        // known difference: the reference solves R's pt, which for a noncentrality above 37.62 uses a normal
        // approximation (Abramowitz and Stegun 26.7.10; about 1% off at ncp 50, cases 48 and 49): there the limit
        // must solve rStats.js's pt (accurate there; checked by quadrature of the noncentral t) instead
        const hn = oneSample ? 1 / arg.vec(a.x)!.filter((v) => !Number.isNaN(v)).length : NaN;
        const ncp = Math.abs(want) / (Math.sqrt(hn) * r.smd.J);
        if (ref !== undefined && oneSample && ncp > 37.62) {
          const t = Math.abs(num(smd.t_stat!));
          const root = Math.abs(got) / (Math.sqrt(hn) * r.smd.J);
          const p = field === "smd upper" ? (pt(t, r.smd.df, { ncp: root }) as number) : (pt(t, r.smd.df, { ncp: root, lowerTail: false }) as number);
          expect(err(p, alpha), what(`${field} (root of pt)`)).toBeLessThanOrEqual(1e-12);
          knownNct++;
          continue;
        }
        expect(err(got, want, r.smd.se), what(field)).toBeLessThanOrEqual(1e-11);
      }
      expect(r.method, what("method")).toBe(e.method);
      expect(r.hypothesis, what("hypothesis")).toBe((e.hypothesis as string).endsWith("Equivalence") ? "EQU" : "MET");
      expect(r.warnings, what("warnings")).toEqual([...(e.warnings as string[]), ...(e.messages as string[])]);
      compared++;
    });
    console.log(`tTOST: ${compared} cases compared, ${errors} errors verified, ${knownNct} limits where R's pt is approximate`);
    expect(knownNct).toBe(2);
    expect(compared + errors).toBe(fixture.cases.length);
  });

  it("tsumTOST equals tTOST on the summaries of the data", () => {
    const x = [5.1, 4.9, 5.6, 5.8, 6.0, 5.4, 5.2, 6.1];
    const y = [5.3, 5.0, 5.5, 5.7, 5.9, 5.2, 4.8, 5.6];
    const mean = (v: number[]): number => v.reduce((s, u) => s + u, 0) / v.length;
    const sd = (v: number[]): number => Math.sqrt(v.reduce((s, u) => s + (u - mean(v)) ** 2, 0) / (v.length - 1));
    const r12 = x.reduce((s, u, i) => s + (u - mean(x)) * (y[i]! - mean(y)), 0) / ((x.length - 1) * sd(x) * sd(y));
    const stats = { m1: mean(x), sd1: sd(x), n1: 8, m2: mean(y), sd2: sd(y), n2: 8, r12 };
    const pick = (r: TTOSTResult): number[] => [
      r.tTest.t, r.tTest.pValue, r.lower.pValue, r.upper.pValue, r.pValue, ...r.raw.confInt, r.smd.estimate, r.smd.se, ...r.smd.confInt, ...r.bounds.smd,
    ];
    const cases: TTOSTOptions[] = [
      { eqb: 0.5 },
      { eqb: 0.5, varEqual: true, smdCi: "goulet" },
      { eqb: [-0.2, 0.6], hypothesis: "MET", mu: 0.1 },
      { eqb: 0.5, paired: true },
      { eqb: 0.5, paired: true, rmCorrection: true, smdCi: "t" },
      { eqb: 0.3, glass: "glass2" },
    ];
    for (const o of cases) {
      const a = pick(tTOST(x, y, o));
      const b = pick(tsumTOST(stats, o));
      // the summaries carry their own rounding (and r12 cancels in the SD of the differences)
      a.forEach((v, i) => expect(err(b[i]!, v, 1e-3), `${JSON.stringify(o)} [${i}]`).toBeLessThanOrEqual(1e-9));
    }
    const one = pick(tTOST(x, undefined, { eqb: 0.3, mu: 5.5 }));
    const oneS = pick(tsumTOST({ m1: mean(x), sd1: sd(x), n1: 8 }, { eqb: 0.3, mu: 5.5 }));
    one.forEach((v, i) => expect(err(oneS[i]!, v, 1e-3)).toBeLessThanOrEqual(1e-9));
    expect(tsumTOST({ ...stats, n2: 7 }, { eqb: 0.5, paired: true }).warnings).toEqual(["Unequal number of pairs; using smallest n"]);
    // the one-sided p-value from the upper tail (TOSTER's 1 - pt loses it)
    const tiny = tsumTOST({ m1: 0, sd1: 1, n1: 1000, m2: 0, sd2: 1, n2: 1000 }, { eqb: 1 });
    expect(tiny.pValue).toBeGreaterThan(0);
    expect(tiny.pValue).toBeLessThan(1e-90);
  });

  it("checks its arguments", () => {
    const x = [5.1, 4.9, 5.6, 5.8, 6.0, 5.4, 5.2, 6.1];
    const y = [5.3, 5.0, 5.5, 5.7, 5.9, 5.2, 4.8, 5.6];
    expect(() => tTOST(x, y)).toThrow(TypeError);
    expect(() => tTOST(x, y, { lowEqbound: 1 })).toThrow(TypeError);
    expect(() => tTOST(x, y, { lowEqbound: 1, highEqbound: -1 })).toThrow(RangeError);
    expect(() => tTOST(x, y, { eqb: [1, 2, 3] })).toThrow(RangeError);
    expect(() => tTOST(x, y, { eqb: NaN })).toThrow(RangeError);
    expect(() => tTOST(x, y, { eqb: 1, alpha: 0.5 })).toThrow(RangeError);
    expect(() => tTOST(x, y, { eqb: 1, alpha: 0 })).toThrow(RangeError);
    expect(() => tTOST(x, y, { eqb: 1, smdCi: "x" })).toThrow(RangeError);
    expect(() => tTOST(x, y, { eqb: 1, foo: 1 } as never)).toThrow(RangeError);
    expect(() => tTOST(x, undefined, { eqb: 1, paired: true })).toThrow(TypeError);
    expect(() => tsumTOST({ m1: 1, sd1: 0, n1: 5 }, { eqb: 1 })).toThrow(RangeError);
    expect(() => tsumTOST({ m1: 1, sd1: 1, n1: 1 }, { eqb: 1 })).toThrow(RangeError);
    expect(() => tsumTOST({ m1: 1, sd1: 1, n1: 5, m2: 1, sd2: 1, n2: 5 }, { eqb: 1, paired: true })).toThrow(RangeError);
    // MET with p_TOST at most the t test's: TOSTER's note
    const met = tTOST(x, y, { eqb: 0.01, hypothesis: "MET" });
    expect(met.warnings).toEqual(["MET test may have higher error rates than a nil two-tailed test. Consider wider equivalence bounds."]);
  });

  it("does not depend on the units of the data", () => {
    const x = [5.1, 4.9, 5.6, 5.8, 6.0, 5.4, 5.2, 6.1];
    const y = [5.3, 5.0, 5.5, 5.7, 5.9, 5.2, 4.8, 5.6, 5.0];
    const designs: [number[] | undefined, TTOSTOptions][] = [
      [y, { eqb: 0.5 }],
      [y, { eqb: 0.5, varEqual: true, smdCi: "goulet", mu: 0.1 }],
      [y.slice(0, 8), { eqb: 0.5, paired: true }],
      [y.slice(0, 8), { eqb: 0.5, paired: true, rmCorrection: true }],
      [undefined, { eqb: 0.3, mu: 5.5 }],
    ];
    for (const [yy, o] of designs) {
      const at = (c: number): TTOSTResult =>
        tTOST(x.map((v) => v * c), yy?.map((v) => v * c), { ...o, eqb: (o.eqb as number) * c, ...(o.mu === undefined ? {} : { mu: o.mu * c }) });
      const parts = {
        unitless: (r: TTOSTResult) => [r.tTest.t, r.tTest.pValue, r.lower.pValue, r.upper.pValue, r.smd.estimate, r.smd.se, ...r.smd.confInt, ...r.bounds.smd],
        units: (r: TTOSTResult) => [r.raw.estimate, r.raw.se, ...r.raw.confInt],
      };
      expectScaleInvariant(`tTOST ${JSON.stringify(o)}`, at, parts, 1e-12);
      for (const c of [2 ** -1000, 2 ** 1000]) {
        const r = at(c);
        const r1 = at(1);
        parts.unitless(r).forEach((v, i) => expect(err(v, parts.unitless(r1)[i]!, 1e-12)).toBeLessThanOrEqual(1e-12));
      }
    }
  });
});
