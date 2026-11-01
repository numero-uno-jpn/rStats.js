// External review of htest (HTEST-018 to 030, review_fix_log_20261031_59.md).
import { describe, expect, it } from "vitest";
import { chisqTest, flignerTest, jonckheereTest, ksTest, mcnemarTest, pAdjust, pnorm, quadeTest, varTest, wilcoxTest } from "../src/index.js";

/** JT of values assigned to ordered groups of the given sizes (ties count 1/2) */
function jtOf(values: readonly number[], sizes: readonly number[]): number {
  const groups: number[][] = [];
  let at = 0;
  for (const s of sizes) {
    groups.push(values.slice(at, at + s));
    at += s;
  }
  let jt = 0;
  for (let i = 0; i < groups.length; i++)
    for (let j = i + 1; j < groups.length; j++) for (const a of groups[i]!) for (const b of groups[j]!) jt += a < b ? 1 : a === b ? 0.5 : 0;
  return jt;
}

/** The exact permutation variance of JT: every ordering of the values, each equally likely under the null */
function permutationVariance(values: readonly number[], sizes: readonly number[]): number {
  const all: number[] = [];
  const permute = (rest: number[], picked: number[]): void => {
    if (rest.length === 0) {
      all.push(jtOf(picked, sizes));
      return;
    }
    for (let i = 0; i < rest.length; i++) permute([...rest.slice(0, i), ...rest.slice(i + 1)], [...picked, rest[i]!]);
  };
  permute([...values], []);
  const m = all.reduce((a, b) => a + b, 0) / all.length;
  return all.reduce((a, b) => a + (b - m) ** 2, 0) / all.length;
}

describe("review 59", () => {
  it("HTEST-018: one-sample exact KS p-values for D >= 1/2 from the one-sided exceedance", () => {
    // 1 - P(D < d) gave 0 at n = 20 and 3e-15 at n = 99 (R too); SciPy's exact values
    const want: [number, number][] = [
      [10, 2.0e-10],
      [20, 2.000686646e-20],
      [50, 2.01606119e-50],
      [99, 2.052595859e-99],
    ];
    for (const [n, p] of want) {
      const x = Array.from({ length: n }, (_, i) => (0.1 * (i + 1)) / n);
      const r = ksTest(x, (v: number) => v, { exact: true });
      expect(Math.abs(r.pValue / p - 1)).toBeLessThan(1e-9);
    }
    // below 1/2 as before
    expect(ksTest([0.1, 0.4, 0.7, 0.2, 0.9], (v: number) => v, { exact: true }).pValue).toBeGreaterThan(0.5);
  });

  it("HTEST-019, HTEST-021: McNemar with pairs of cells without discordant counts", () => {
    // 0 / 0 made the statistic NaN (R too)
    const r = mcnemarTest([[0, 1, 0], [0, 0, 0], [0, 0, 0]]);
    expect(r.statistic).toBe(1);
    expect(r.parameter).toBe(3);
    expect(() => mcnemarTest([[10, 0], [0, 10]])).toThrow(/no discordant pairs/);
    expect(mcnemarTest([[10, 3], [7, 10]]).statistic).toBe(0.9); // the continuity correction as before
  });

  it("HTEST-020, HTEST-023, HTEST-026: inputs that define no test are errors", () => {
    expect(() => chisqTest([[1.5, 2.5], [3.5, 4.5]], { simulatePValue: true, B: 10 })).toThrow(/integer counts/);
    expect(() => wilcoxTest([0, 0, 0])).toThrow(/no non-zero differences/);
    expect(() => varTest([1, 1, 1], [2, 2, 2])).toThrow(/zero variance/);
    expect(varTest([1, 1, 1], [1, 2, 4]).estimate).toBe(0); // one zero variance: the limit, as before
  });

  it("HTEST-022, HTEST-024: quade and fligner at any scale", () => {
    // ranges and deviations of finite data overflowed and tied (R too)
    const y = [[-1e308, 0, 1e308], [-9e307, 0, 9e307], [-1, 0, 1], [0, 1, 2]];
    expect(quadeTest(y)).toEqual(quadeTest(y.map((r) => r.map((v) => v * 2 ** -1022))));
    const x = [[-1e308, -1e308, 1e308], [-9e307, -9e307, 1e308]];
    expect(flignerTest(x)).toEqual(flignerTest(x.map((r) => r.map((v) => v * 2 ** -1022))));
  });

  it("HTEST-029: Jonckheere-Terpstra's normal approximation with ties uses the permutation variance", () => {
    // the packages' variance without ties gave 0.0085591 here
    for (const [x, g, sizes] of [
      [[1, 1, 2, 2, 3, 3], [1, 1, 2, 2, 3, 3], [2, 2, 2]],
      [[1, 2, 2, 3, 3, 3, 4], [1, 1, 1, 2, 2, 3, 3], [3, 2, 2]],
    ] as [number[], number[], number[]][]) {
      const r = jonckheereTest(x, g, { alternative: "increasing" });
      const n = x.length;
      const mean = sizes.reduce((a, s, i) => a + s * sizes.slice(i + 1).reduce((b, t) => b + t, 0), 0) / 2;
      const v = permutationVariance(x, sizes);
      expect(n).toBeGreaterThan(0);
      expect(Math.abs(r.pValue / (pnorm(r.statistic, { mean, sd: Math.sqrt(v), lowerTail: false }) as number) - 1)).toBeLessThan(1e-12);
    }
    expect(jonckheereTest([1, 1, 2, 2, 3, 3], [1, 1, 2, 2, 3, 3], { alternative: "increasing" }).pValue).toBeCloseTo(0.0061086, 7);
  });
});

describe("review 59 large n", () => {
  it("HTEST-030: pAdjust with n = Infinity is an error; BY with a large n returns", () => {
    // the harmonic sum never ended (R: "too long a vector")
    expect(() => pAdjust([0.01, 0.02], { method: "BY", n: Infinity })).toThrow(/finite/);
    const t0 = performance.now();
    const r = pAdjust([0.01, 0.02], { method: "BY", n: 1e12 });
    expect(performance.now() - t0).toBeLessThan(200);
    expect(r).toEqual([1, 1]);
    // the expansion against the sum at its switch
    const q = (n: number) => (pAdjust([1e-9], { method: "BY", n }) as number[])[0]! / (n * 1e-9);
    expect(Math.abs(q(1e6 + 1) / q(1e6) - 1)).toBeLessThan(1e-6);
  });
});
