// tTOST and tsumTOST at the ends of the double range: the t statistics, p-values and raw interval are formed on the
// data scaled by a power of 2 (as tTest's), so a difference that overflows or a standard error in the subnormals does
// not change them; tsumTOST scales the means and the SDs separately; and the samples are checked as blandAltman's.
import { describe, expect, it } from "vitest";
import { tsumTOST, tTest, tTOST, type TTOSTResult } from "../src/index.js";

const rel = (a: number, b: number): number => (a === b ? 0 : Math.abs(a - b) / Math.abs(b));
/** the unitless parts: t statistics and p-values of the three tests, the SMD and its interval */
const unitless = (r: TTOSTResult): number[] => [
  r.tTest.t,
  r.tTest.pValue,
  r.lower.t,
  r.lower.pValue,
  r.upper.t,
  r.upper.pValue,
  r.pValue,
  r.smd.estimate,
  ...r.smd.confInt,
];

describe("tTOST and tsumTOST: scaling", () => {
  it("a difference beyond the double range (the t's were Infinity)", () => {
    const x = [1.0e308, 1.1e308, 0.9e308, 1.05e308, 0.95e308];
    const y = x.map((v) => -v * 0.97);
    const eqb = [1e308, 1.7e308];
    const r = tTOST(x, y, { eqb });
    // tTest's own statistic (unitless and finite), and the same test on the data scaled by 2^-1000
    expect(r.tTest.t).toBe(tTest(x, y).statistic);
    expect(r.tTest.t).toBe(39.995362707132934);
    const s = 2 ** -1000;
    const small = tTOST(x.map((v) => v * s), y.map((v) => v * s), { eqb: eqb.map((v) => v * s) });
    unitless(r).forEach((v, i) => expect(rel(v, unitless(small)[i]!), `[${i}]`).toBeLessThanOrEqual(1e-15));
    expect(r.raw.se).toBe(small.raw.se * 2 ** 1000);
    // the same with summary statistics
    const st = { m1: 1e308, sd1: 1e307, n1: 10, m2: -1e308, sd2: 1e307, n2: 10 };
    const a = tsumTOST(st, { eqb });
    const b = tsumTOST({ m1: st.m1 * s, sd1: st.sd1 * s, n1: 10, m2: st.m2 * s, sd2: st.sd2 * s, n2: 10 }, { eqb: eqb.map((v) => v * s) });
    expect(Number.isFinite(a.tTest.t)).toBe(true);
    unitless(a).forEach((v, i) => expect(rel(v, unitless(b)[i]!), `tsum [${i}]`).toBeLessThanOrEqual(1e-15));
  });

  it("a standard error in the subnormals (the t's and p's were 2e-6 to 3e-5 off)", () => {
    const X = [5100123, 4900311, 5600877, 5800021, 6000555, 5400999, 5200444, 6100333];
    const Y = [5300001, 5000111, 5500222, 5700333, 5900444, 5200555, 4800666, 5600777];
    const T = 2 ** -1074;
    const designs: [(c: number) => TTOSTResult, string][] = [
      [(c) => tTOST(X.map((v) => v * c), undefined, { eqb: [5.4e6 * c, 6e6 * c] }), "one"],
      [(c) => tTOST(X.map((v) => v * c), Y.map((v) => v * c), { eqb: 5e5 * c }), "welch"],
      [(c) => tTOST(X.map((v) => v * c), Y.map((v) => v * c), { eqb: 5e5 * c, varEqual: true }), "pooled"],
      [(c) => tTOST(X.map((v) => v * c), Y.map((v) => v * c), { eqb: 5e5 * c, paired: true }), "paired"],
    ];
    for (const [f, name] of designs) {
      const a = f(1);
      const b = f(T);
      // the integer data times 2^-1074 are exact, and so is their scaling back to the units of the integers: the
      // results agree to rounding (the paired pValue was 0.0015585064, true 0.0015585533)
      unitless(b).forEach((v, i) => expect(rel(v, unitless(a)[i]!), `${name} [${i}]`).toBeLessThanOrEqual(1e-14));
    }
  });

  it("tsumTOST: SDs far below the means (the Welch df was 18.19 at 1e80, NaN at 1e150)", () => {
    for (const m of [1e80, 1e150, 1e300]) {
      const r = tsumTOST({ m1: m, sd1: 1, n1: 10, m2: -m, sd2: 1, n2: 10 }, { eqb: [m, 3 * m] });
      // sd1 = sd2 and n1 = n2: Welch's df is exactly 18 and the standard error sqrt(1/10 + 1/10)
      expect(r.tTest.df).toBe(18);
      const se = Math.sqrt(0.2);
      expect(rel(r.tTest.se, se)).toBeLessThanOrEqual(1e-15);
      expect(rel(r.tTest.t, (2 * m) / se)).toBeLessThanOrEqual(1e-15);
      expect(rel(r.lower.t, m / se)).toBeLessThanOrEqual(1e-15);
      expect(rel(r.upper.t, -m / se)).toBeLessThanOrEqual(1e-15);
      // g(av) = J (2m)/sqrt((1 + 1)/2)
      expect(rel(r.smd.estimate / r.smd.J, 2 * m)).toBeLessThanOrEqual(1e-15);
      // one sample
      const o = tsumTOST({ m1: m, sd1: 1, n1: 10 }, { eqb: [-m, m / 2] });
      expect(rel(o.tTest.t, m / Math.sqrt(0.1))).toBeLessThanOrEqual(1e-15);
      expect(rel(o.upper.t, m / 2 / Math.sqrt(0.1))).toBeLessThanOrEqual(1e-15);
    }
  });

  it("tTOST checks its samples (null and strings were used as numbers, Infinity failed inside uniroot)", () => {
    const x = [5.1, 4.9, 5.6, 5.8, 6.0, 5.4, 5.2, 6.1];
    const y = [5.3, 5.0, 5.5, 5.7, 5.9, 5.2, 4.8, 5.6];
    const bad: unknown[] = [null, "1", undefined, true];
    for (const v of bad) {
      expect(() => tTOST([...x, v] as number[], y, { eqb: 0.5 })).toThrow(TypeError);
      expect(() => tTOST(x, [...y, v] as number[], { eqb: 0.5 })).toThrow(TypeError);
      expect(() => tTOST([...x, v] as number[], undefined, { eqb: 0.5 })).toThrow(TypeError);
      expect(() => tTOST([...x, v] as number[], [...y, 5], { eqb: 0.5, paired: true })).toThrow(/'x' must be numeric/);
    }
    for (const v of [Infinity, -Infinity]) {
      expect(() => tTOST([...x, v], y, { eqb: 0.5 })).toThrow(RangeError);
      expect(() => tTOST(x, [...y, v], { eqb: 0.5 })).toThrow(/'y' must not contain infinite values/);
      expect(() => tTOST([...x, v], undefined, { eqb: 0.5 })).toThrow(RangeError);
      expect(() => tTOST([...x, v], [...y, 5], { eqb: 0.5, paired: true })).toThrow(RangeError);
    }
    expect(() => tTOST("1,2,3" as never, y, { eqb: 0.5 })).toThrow(TypeError);
    expect(() => tTOST(x, 5 as never, { eqb: 0.5 })).toThrow(TypeError);
    // NaN is still a missing value, dropped as before; typed arrays are accepted
    expect(tTOST([...x, NaN], y, { eqb: 0.5 }).raw.estimate).toBe(tTOST(x, y, { eqb: 0.5 }).raw.estimate);
    expect(tTOST(Float64Array.from(x), Float64Array.from(y), { eqb: 0.5 }).pValue).toBe(tTOST(x, y, { eqb: 0.5 }).pValue);
  });
  it("tsumTOST: means far below the bounds' units (the bound in the means' units overflowed: t Infinity, p 0)", () => {
    // the t's are in SE units: means of 1e-300 or 1e-200 beside SDs of 1e10 give the t's and p-values of mean 0
    // (tL = 5e9/(1e10/sqrt(20)) = 2.2360679774997896, p 0.01877; at 1e-300 tL was Infinity and p 0)
    const tests = (r: TTOSTResult): number[] => [r.lower.t, r.lower.pValue, r.upper.t, r.upper.pValue, r.pValue];
    const designs: [string, (m: number) => TTOSTResult][] = [
      ["one", (m) => tsumTOST({ m1: m, sd1: 1e10, n1: 20 }, { eqb: 5e9 })],
      ["one, eqb 1e10, sd 1", (m) => tsumTOST({ m1: m, sd1: 1, n1: 20 }, { eqb: 1e10 })],
      ["pooled", (m) => tsumTOST({ m1: m, sd1: 1e10, n1: 20, m2: 0, sd2: 1e10, n2: 20 }, { eqb: 5e9, varEqual: true })],
      ["welch", (m) => tsumTOST({ m1: m, sd1: 1e10, n1: 20, m2: 0, sd2: 2e10, n2: 15 }, { eqb: 5e9 })],
      ["SMD", (m) => tsumTOST({ m1: m, sd1: 1e10, n1: 20 }, { eqb: 0.5, eqboundType: "SMD" })],
    ];
    for (const [name, run] of designs) {
      const at0 = tests(run(0));
      for (const m of [1e-200, 1e-300, 5e-324]) expect(tests(run(m)), `${name} m1 ${m}`).toEqual(at0);
    }
    expect(rel(tests(designs[0]![1](1e-300))[0]!, 5e9 / (1e10 / Math.sqrt(20)))).toBeLessThanOrEqual(1e-15);
  });
});
