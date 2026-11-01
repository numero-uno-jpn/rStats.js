// External review of htest (HTEST-011 to 017) and the roots of fisherTest (review_fix_log_20261031_58.md).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { chisqTest, confint, dhyper, fisherTest, lm, mantelhaenTest, propTest, setSeed, tTest, varTest } from "../src/index.js";

const near1 = 0.9999999999999999;

/** log of the weights dhyper(s) psi^s of Fisher's noncentral hypergeometric distribution of the (1, 1) cell */
function tilted(t: number[][], psi: number): { s: number[]; p: number[] } {
  const [[a, b], [c, d]] = t as [[number, number], [number, number]];
  const m = a + c;
  const n = b + d;
  const k = a + b;
  const s: number[] = [];
  for (let v = Math.max(0, k - n); v <= Math.min(k, m); v++) s.push(v);
  const lw = s.map((v) => (dhyper(v, m, n, k, { log: true }) as number) + v * Math.log(psi));
  const mx = lw.reduce((x, y) => (y > x ? y : x), -Infinity);
  const w = lw.map((v) => Math.exp(v - mx));
  const tot = w.reduce((x, y) => x + y, 0);
  return { s, p: w.map((v) => v / tot) };
}
const tail = (t: number[][], psi: number, x: number, upper: boolean): number => {
  const { s, p } = tilted(t, psi);
  return p.reduce((acc, v, i) => acc + ((upper ? s[i]! >= x : s[i]! <= x) ? v : 0), 0);
};
const mean = (t: number[][], psi: number): number => {
  const { s, p } = tilted(t, psi);
  return p.reduce((acc, v, i) => acc + v * s[i]!, 0);
};

describe("review 58", () => {
  it("fisherTest: the conditional MLE and the limits are the roots (R stops up to several percent off)", () => {
    // [[3, 1], [1, 3]] solved to 1e-12 in R: 6.40831965819967, 0.211735595446579, 626.243530588813 (R's fisher.test:
    // 6.40830886700579, 0.21173291530550, 621.93375054542)
    const r = fisherTest([[3, 1], [1, 3]]);
    expect(Math.abs((r.estimate as number) / 6.40831965819967 - 1)).toBeLessThan(1e-12);
    expect(Math.abs(r.confInt![0] / 0.211735595446579 - 1)).toBeLessThan(1e-12);
    expect(Math.abs(r.confInt![1] / 626.243530588813 - 1)).toBeLessThan(1e-12);
    expect(Math.abs(fisherTest([[3, 1], [1, 3]], { confLevel: 0.99 }).confInt![1] / 3186.24872567422 - 1)).toBeLessThan(1e-12);
    // HTEST-015: "f() values at end points not of opposite sign" before; R's 99.99% limit is the end 1/eps
    expect(Math.abs(fisherTest([[3, 1], [1, 3]], { confLevel: 0.9999 }).confInt![1] / 319986.249987314 - 1)).toBeLessThan(1e-11);
    const e = fisherTest([[3, 1], [1, 3]], { confLevel: near1 }).confInt!;
    expect(e[0] > 0 && Number.isFinite(e[1])).toBe(true);
  });

  it("fisherTest over R's 2 x 2 fixture cases: mean = x at the estimate, tail = alpha at the limits", () => {
    const path = fileURLToPath(new URL("./fixtures/fisherTest.json", import.meta.url));
    const cases = (JSON.parse(readFileSync(path, "utf8")) as { cases: { args: Record<string, unknown>; expected: Record<string, unknown> }[] })
      .cases;
    let checked = 0;
    for (const { args, expected } of cases) {
      const t = (args.x as string[][]).map((row) => row.map(Number));
      if (expected.error !== undefined || t.length !== 2 || t[0]!.length !== 2 || args.confInt === false) continue;
      if (t.flat().some((v) => !Number.isInteger(v))) continue; // (fractional counts are rounded by fisherTest, as R)
      // (supports of up to 5000 points: the plain sums here take long beyond)
      if (Math.min(t[0]![0]! + t[0]![1]!, t[0]![0]! + t[1]![0]!) > 5000) continue;
      const alternative = (args.alternative as "two.sided" | "less" | "greater" | undefined) ?? "two.sided";
      const confLevel = args.confLevel === undefined ? 0.95 : Number(args.confLevel);
      const r = fisherTest(t, { alternative, confLevel });
      const x = t[0]![0]!;
      const est = r.estimate as number;
      if (est > 0 && Number.isFinite(est)) expect(Math.abs(mean(t, est) / x - 1)).toBeLessThan(1e-9);
      const alpha = alternative === "two.sided" ? (1 - confLevel) / 2 : 1 - confLevel;
      const [lo, hi] = r.confInt!;
      if (alternative !== "less" && lo > 0) expect(Math.abs(tail(t, lo, x, true) / alpha - 1)).toBeLessThan(1e-8);
      if (alternative !== "greater" && Number.isFinite(hi)) expect(Math.abs(tail(t, hi, x, false) / alpha - 1)).toBeLessThan(1e-8);
      checked++;
    }
    expect(checked).toBeGreaterThan(400);
  });

  it("HTEST-011, 012, 014 and the same pattern elsewhere: intervals at a level next to 1", () => {
    // 1 - alpha rounded to 1: the limits were 0, NaN, [0, Infinity]
    const v = varTest([1, 2, 3], [2, 4, 8], { confLevel: near1 }).confInt;
    expect(v[0] > 0 && Number.isFinite(v[1])).toBe(true);
    const p = propTest(5, 10, { confLevel: near1 }).confInt!;
    expect(p[0] > 0 && p[1] < 1).toBe(true);
    const strata = [[[10, 5], [4, 12]], [[8, 6], [5, 9]]];
    const m = mantelhaenTest(strata, { confLevel: near1 }).confInt!;
    expect(m[0] > 0 && Number.isFinite(m[1])).toBe(true);
    const tt = tTest([1, 2, 3, 4, 6], { confLevel: near1 }).confInt!;
    expect(Number.isFinite(tt[0]) && Number.isFinite(tt[1])).toBe(true);
    const fit = lm([1, 2, 3, 4, 5], [1.1, 1.9, 3.2, 3.9, 5.1]);
    expect(confint(fit, { level: near1 }).upper.every(Number.isFinite)).toBe(true);
    // the ordinary level as before (R's values)
    expect(varTest([1, 2, 3], [2, 4, 8]).confInt).toEqual([0.00274725274725275, 4.178571428571425]);
    expect(propTest(5, 10).confInt).toEqual([0.236593090512564, 0.763406909487436]);
    expect(mantelhaenTest(strata).confInt).toEqual([1.2789009099477169, 11.01348823694088]);
  });

  it("HTEST-013, HTEST-016: inputs the simulation or the exact test cannot take are errors", () => {
    // p-values above 1 before (R too); the exact test took fractional counts (R too)
    setSeed(1);
    expect(() => chisqTest([3, 4, 5], { simulatePValue: true, B: 2.1 })).toThrow(/'B' must be/);
    expect(() => chisqTest([3.5, 4, 5], { simulatePValue: true, B: 2 })).toThrow(/summing to an integer/);
    // (fractional tables are errors in the simulation as well since round 59)
    expect(() => chisqTest([[3.5, 4], [5, 2]], { simulatePValue: true, B: 2 })).toThrow(/integer counts/);
    const frac = [[[0.5, 1.5], [1.5, 0.5]], [[0.5, 1.5], [1.5, 0.5]]];
    expect(() => mantelhaenTest(frac, { exact: true })).toThrow(/integer counts/);
    expect(Number.isFinite(mantelhaenTest(frac).pValue)).toBe(true);
  });

  it("HTEST-017: mantelhaenTest where products of the counts overflow", () => {
    // the variance was Infinity / Infinity: statistic and p-value NaN (R too)
    const v = 1e150;
    const r = mantelhaenTest([[[v, v], [v, v]], [[v, v], [v, v]]]);
    expect(r.statistic).toBe(0);
    expect(r.pValue).toBe(1);
    expect(r.estimate).toBe(1);
  });
});
