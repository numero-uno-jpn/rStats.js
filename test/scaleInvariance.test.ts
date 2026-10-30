// Regression tests for the external review of 2026-10-31 (ChatGPT_notices_20261031): statistics that do not depend on
// the units of the data stay the same when the data are scaled far from 1, counts are integers, and the missing
// values of the repeated-measures analyses.
import { describe, expect, it } from "vitest";
import {
  aov,
  aovEz,
  bartlettTest,
  binomTest,
  chisqTest,
  cov,
  gamesHowellTest,
  glhtDunnett,
  jonckheereTest,
  mauchlyTest,
  onewayTest,
  pairwiseTTest,
  poissonTest,
  tTest,
  tukeyTest,
  varTest,
} from "../src/index.js";

const a = [1, 2, 3, 4, 5];
const b = [2, 4, 5, 6, 8];
const g = [...a.map(() => "a"), ...b.map(() => "b")];
const close = (x: number, y: number, tol = 1e-12): void => expect(Math.abs(x - y)).toBeLessThanOrEqual(tol * Math.abs(y));

describe("tests on variances at any scale", () => {
  const p = (s: number): number[] => {
    const A = a.map((v) => v * s);
    const B = b.map((v) => v * s);
    return [
      tTest(A, B).pValue,
      tTest(A, B).parameter,
      tTest(A, B, { varEqual: true }).pValue,
      tTest(A, { mu: 2 * s }).pValue,
      onewayTest([A, B]).pValue,
      onewayTest([A, B], { varEqual: true }).pValue,
      varTest(A, B).pValue,
      bartlettTest([A, B]).pValue,
      gamesHowellTest([...A, ...B], g).pValue[0]![0]!,
      tukeyTest([...A, ...B], g).pValue[0]![0]!,
      glhtDunnett([...A, ...B], g).p[0]!,
      pairwiseTTest([...A, ...B], g).pValue[0]![0]!,
    ];
  };
  const ref = p(1);
  for (const s of [1e-200, 1e-150, 1e155, 2 ** 600]) {
    it(`data times ${s}`, () => p(s).forEach((v, i) => close(v, ref[i]!, 1e-10)));
  }
  it("scales the estimates back", () => {
    const r = tTest(a.map((v) => v * 1e-200), b.map((v) => v * 1e-200));
    close(r.stdErr, 1.224744871391589e-200, 1e-12);
    close(r.confInt[0], -4.879833064265858e-200, 1e-12);
    close(glhtDunnett([...a, ...b].map((v) => v * 1e-200), g).estimate[0]!, 2e-200, 1e-12);
  });
});

describe("overflow of intermediate values", () => {
  it("cov is symmetric", () => {
    const x = [1.7e308, -1.7e308];
    const y = [1.7e-308, -1.7e-308];
    close(cov(x, y), 5.78);
    close(cov(y, x), 5.78);
  });
  it("chisqTest", () => {
    close(chisqTest([1e200, 1e200], { p: [0.1, 0.9] }).statistic, 3.555555555555556e200);
    const r = chisqTest([[1e200, 1e200], [1e200, 1e200]], { correct: false });
    expect(r.statistic).toBe(0);
    expect(r.expected).toEqual([[1e200, 1e200], [1e200, 1e200]]);
    close(chisqTest([[3e200, 1e200], [1e200, 2e200]]).statistic, chisqTest([[3, 1], [1, 2]], { correct: false }).statistic * 1e200);
  });
});

describe("counts", () => {
  it("are integers within an absolute 1e-7", () => {
    expect(() => binomTest(100000000.25, 200000001, { alternative: "less" })).toThrow(/integer/);
    expect(() => binomTest(1, 100000000.25, { alternative: "less" })).toThrow(/integer/);
    expect(() => poissonTest(100000000.25, { alternative: "less" })).toThrow(/integer/);
    expect(binomTest(3 + 5e-8, 10).statistic).toBe(3);
  });
  it("one-sample poissonTest takes confLevel 0 and 1", () => {
    expect(poissonTest(3, { confLevel: 1 }).confInt).toEqual([0, Infinity]);
    expect(poissonTest(3, { confLevel: 0 }).confInt[0]).toBeGreaterThan(0);
    expect(() => poissonTest([3, 4], { confLevel: 1 })).toThrow();
  });
});

describe("repeated measures", () => {
  const y = [
    [10.5, 9.8, 8.8], [11.2, 10.1, 9.9], [9.7, 9.5, 9.0], [10.9, 10.6, 9.1], [10.1, 9.2, 9.4],
    [9.8, 9.4, 8.7], [10.8, 10.0, 9.3], [10.2, 9.6, 9.1], [11.1, 10.3, 9.6], [9.9, 9.1, 8.8],
  ];
  const long = (s: number, rows = y): { id: string[]; w: string[]; dv: (number | null)[] } => {
    const d = { id: [] as string[], w: [] as string[], dv: [] as (number | null)[] };
    rows.forEach((r, i) => r.forEach((v, j) => (d.id.push(`s${i}`), d.w.push(`c${j}`), d.dv.push(v * s))));
    return d;
  };
  const ez = (d: ReturnType<typeof long>) => aovEz(d, { id: "id", dv: "dv", within: "w" });
  it("aovEz epsilons and Mauchly's W at any scale", () => {
    const ref = ez(long(1));
    for (const s of [1e-4, 1e-100, 1e150]) {
      const r = ez(long(s));
      r.corrections!.table[0]!.forEach((v, i) => close(v, ref.corrections!.table[0]![i]!, 1e-10));
      r.sphericity!.table[0]!.forEach((v, i) => close(v, ref.sphericity!.table[0]![i]!, 1e-10));
    }
    close(ref.corrections!.table[0]![0]!, 0.7863600352273362);
  });
  it("aovEz removes the id of a missing response", () => {
    const ref = ez(long(1, y.slice(1)));
    for (const missing of [NaN, null]) {
      const d = long(1);
      d.dv[1] = missing;
      const r = ez(d);
      expect(r.warnings.some((w) => w.startsWith("Missing values for 1 ID(s)"))).toBe(true);
      // ids s1 ... s9 left: the same as without s0
      r.anova.table[0]!.forEach((v, i) => close(v, ref.anova.table[0]![i]!, 1e-10));
    }
    const d = long(1);
    d.dv[1] = Infinity;
    expect(() => ez(d)).toThrow(/finite/);
  });
  it("mauchlyTest at any scale, and without the rows with a missing value", () => {
    const ref = mauchlyTest(y, { X: "~1" });
    close(ref.statistic, 0.7283178757795079);
    for (const s of [1e100, 1e-100]) close(mauchlyTest(y.map((r) => r.map((v) => v * s)), { X: "~1" }).pValue, ref.pValue, 1e-10);
    const withNaN = y.map((r, i) => (i === 1 ? [r[0]!, NaN, r[2]!] : r));
    close(mauchlyTest(withNaN, { X: "~1" }).statistic, mauchlyTest(y.filter((_, i) => i !== 1), { X: "~1" }).statistic);
    const group = y.map((_, i) => (i < 5 ? "a" : i === 7 ? NaN : "b"));
    close(
      mauchlyTest(y, { X: "~1", group }).statistic,
      mauchlyTest(y.filter((_, i) => i !== 7), { X: "~1", group: group.filter((_, i) => i !== 7) }).statistic,
    );
  });
  it("aov keeps the within-subject part of a covariate that varies mostly between subjects", () => {
    for (const s of [1, 1e-4, 1e4]) {
      const data = { id: [] as string[], x: [] as number[], y: [] as number[] };
      for (let i = 0; i < 8; i++) {
        for (const w of [-1, 1]) {
          data.id.push(`s${i}`);
          data.x.push((1000 * i + 0.1 * w) * s);
          data.y.push(2000 * i + 0.4 * w + (i % 2) * 0.01);
        }
      }
      const fit = aov("y ~ x + Error(id)", data);
      if (!("strata" in fit)) throw new Error("expected error strata");
      const within = fit.strata.find((st) => st.stratum === "Error: Within")!;
      expect(within.rowNames).toEqual(["x", "Residuals"]);
      expect(within.table.map((r) => r[0])).toEqual([1, 7]);
    }
  });
});

describe("jonckheereTest", () => {
  it("clinfun drops infinite values", () => {
    const x = [1, 2, 3, 4, Infinity, 5, 6, 7, 8, 9, 10, 11];
    const gr = [1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3];
    const fin = (v: number[]): number[] => v.filter((_, i) => Number.isFinite(x[i]));
    expect(jonckheereTest(x, gr, { variant: "clinfun" }).statistic).toBe(jonckheereTest(fin(x), fin(gr), { variant: "clinfun" }).statistic);
  });
});

describe("aovEz input", () => {
  it("a within factor with one level is an error", () => {
    expect(() => aovEz({ id: [1, 2, 3, 4], w: ["a", "a", "a", "a"], dv: [1, 2, 3, 4] }, { id: "id", dv: "dv", within: "w" })).toThrow(
      'Factor "w" consists of one level only',
    );
  });
});
