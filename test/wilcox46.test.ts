// R 4.6's wilcox.test in wilcoxTest: the exact conditional test with ties and zeros (Pratt), the achieved confidence
// levels, the Edgeworth terms of correct = 1..3, small two-sided normal p-values, extreme tails and the limits.
// Expected values are R 4.6.2's (oracle/wilcox46-behaviour.md) unless they are exact probabilities computed here.
import { describe, expect, it } from "vitest";
import { pairwiseWilcoxTest, wilcoxTest } from "../src/index.js";

const close = (actual: number, expected: number, tol = 1e-13): void => {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tol * Math.abs(expected));
};
const seq = (a: number, b: number): number[] => Array.from({ length: b - a + 1 }, (_, i) => a + i);
/** C(n, k) exactly, as a double */
const choose = (n: number, k: number): number => {
  let c = 1n;
  for (let i = 1; i <= k; i++) c = (c * BigInt(n - k + i)) / BigInt(i);
  return Number(c);
};

describe("wilcoxTest, exact test with ties and zeros (R 4.6)", () => {
  it("ranks the zeros with the data (Pratt) and uses the conditional distribution", () => {
    const x = [1.5, 2, 2, -3, 4, 0, 5, -1, 2];
    const r = wilcoxTest(x);
    expect([r.statistic, r.pValue, r.method]).toEqual([35, 0.1328125, "Wilcoxon signed rank exact test"]);
    expect(r.warnings).toEqual([]);
    expect(wilcoxTest(x, { alternative: "greater" }).pValue).toBe(0.06640625);
    expect(wilcoxTest(x, { alternative: "less" }).pValue).toBe(0.94140625);
    expect(wilcoxTest(x, { mu: 2 }).pValue).toBe(0.53125);
    // the normal approximation drops the zeros first (V = 29)
    const n = wilcoxTest(x, { exact: false });
    expect(n.statistic).toBe(29);
    close(n.pValue, 0.13952696844257639);
    expect(wilcoxTest([0, 1, 2, 3, 4, 5]).pValue).toBe(0.0625);
    expect(wilcoxTest([1, 2, 2, 3, 4, 5], { mu: 2 }).pValue).toBe(0.375);
    expect(wilcoxTest([5, 5, 5]).pValue).toBe(0.25);
    expect(wilcoxTest([4, 3, 2], [3, 2, 1], { paired: true }).pValue).toBe(0.25);
  });

  it("only zeros: a point mass at 0 (the normal approximation stays an error)", () => {
    expect([wilcoxTest([0, 0]).statistic, wilcoxTest([0, 0]).pValue]).toEqual([0, 1]);
    expect(wilcoxTest([3, 3, 3, 3], { mu: 3 }).pValue).toBe(1);
    expect(() => wilcoxTest([0, 0], { exact: false })).toThrow(/no non-zero differences/);
  });

  it("two samples: both tails, min(2 L, 2 U, 1)", () => {
    const x = [1, 2, 2, 4, 5, 7];
    const y = [3, 3, 4, 6, 8, 9, 9];
    const r = wilcoxTest(x, y);
    expect([r.statistic, r.method]).toEqual([9.5, "Wilcoxon rank sum exact test"]);
    close(r.pValue, 0.10606060606060606);
    close(wilcoxTest(x, y, { alternative: "less" }).pValue, 0.053030303030303032);
    close(wilcoxTest(x, y, { alternative: "greater" }).pValue, 0.95279720279720281);
    close(wilcoxTest(x, y, { mu: -1 }).pValue, 0.27272727272727271);
    close(wilcoxTest([1, 2, 3], [3, 4, 5]).pValue, 0.2);
    expect(wilcoxTest([1, 2, 3], [3, 4, 5], { alternative: "greater" }).pValue).toBe(1);
    close(wilcoxTest([1, 2, 3], [0, 4, 5], { mu: 1 }).pValue, 0.5);
    expect(wilcoxTest([1, 1], [1, 1]).pValue).toBe(1);
  });

  it("extreme tails keep their digits", () => {
    // the upper tail summed directly: 1 / C(19, 10) (1 - L would give 1.0825088224475365e-05)
    const x = [10, 11, 11, 12, 13, 14, 15, 16, 17, 18];
    const y = [1, 2, 2, 3, 4, 5, 6, 7, 8];
    close(wilcoxTest(x, y, { alternative: "greater" }).pValue, 1 / choose(19, 10), 1e-14);
    close(wilcoxTest(x, y).pValue, 2 / choose(19, 10), 1e-14);
    const t = [-5, -4, -3, -3, -2, -1, -6, -7, -8, -9, -10, -11, 1];
    const z = [...t, ...t, ...t].map((v) => -v);
    close(wilcoxTest(z, { alternative: "greater" }).pValue, 8.1854523159563541e-11);
    close(wilcoxTest(z).pValue, 1.6370904631912708e-10);
    // all 1000 signs positive: 2^-1000 exactly (the distribution is halved at each score; counts would overflow)
    expect(wilcoxTest([...seq(1, 999), 999], { exact: true, alternative: "greater" }).pValue).toBe(2 ** -1000);
    // the lowest of C(80, 40) subsets of tied pairs (counts beyond 2^53)
    const pairs = (a: number, b: number): number[] => seq(a, b).flatMap((v) => [v, v]);
    close(wilcoxTest(pairs(1, 20), pairs(21, 40), { alternative: "less" }).pValue, 1 / choose(80, 40), 1e-13);
  });
});

describe("wilcoxTest, exact intervals (R 4.6)", () => {
  const x9 = [1.83, 0.5, 1.62, 2.48, 1.68, 1.88, 1.55, 3.06, 1.3];

  it("classical: the achieved level, the q + 1 step, (-Inf, Inf) where no level is reached", () => {
    const r = wilcoxTest(x9, { confInt: true });
    expect(r.confInt).toEqual([1.165, 2.37]);
    expect([r.confLevel, r.estimate]).toEqual([0.9609375, 1.725]);
    expect(r.warnings).toEqual([]);
    expect(wilcoxTest(x9, { confInt: true, confLevel: 0.99 }).confLevel).toBe(0.9921875);
    const l = wilcoxTest(x9, { confInt: true, alternative: "less" });
    expect([l.confInt![1], l.confLevel]).toEqual([2.18, 0.951171875]);
    for (const alternative of ["two.sided", "less", "greater"] as const) {
      const n3 = wilcoxTest([1.1, 2.3, 3.6], { confInt: true, alternative });
      expect([...n3.confInt!, n3.confLevel]).toEqual([-Infinity, Infinity, 1]);
    }
    const tiny = wilcoxTest(seq(1, 10), { confInt: true, confLevel: 1e-6 });
    expect([...tiny.confInt!, tiny.confLevel]).toEqual([5.5, 5.5, 0.078125]);
    const two = wilcoxTest([0.8, 0.83, 1.89, 1.04, 1.45, 1.38, 1.91, 1.64, 0.73, 1.46], [1.15, 0.88, 0.9, 0.74, 1.21], { confInt: true });
    close(two.confLevel!, 0.96003996003996006);
    close(two.confInt![1], 0.7599999999999999);
  });

  it("two samples with ties: the conditional interval by test inversion", () => {
    const x = [1, 2, 2, 4, 5, 7];
    const y = [3, 3, 4, 6, 8, 9, 9];
    const r = wilcoxTest(x, y, { confInt: true });
    expect([...r.confInt!, r.estimate]).toEqual([-6, 1, -2]);
    close(r.confLevel!, 0.9533799533799534);
    const l = wilcoxTest(x, y, { confInt: true, alternative: "less", confLevel: 0.9 });
    expect(l.confInt).toEqual([-Infinity, -1]);
    close(l.confLevel!, 0.93473193473193472);
    const g = wilcoxTest(x, y, { confInt: true, alternative: "greater", confLevel: 0.9 });
    expect(g.confInt).toEqual([-5, Infinity]);
    close(g.confLevel!, 0.92540792540792538);
    const s = wilcoxTest(seq(1, 10), [2.5, 4.5, 6.5], { confInt: true });
    expect(s.confInt).toEqual([-3.5, 5.5]);
    close(s.confLevel!, 0.95104895104895104);
    expect(wilcoxTest([1, 2, 3], [3, 4, 5], { confInt: true, alternative: "less" }).confInt).toEqual([-Infinity, 0]);
    expect(wilcoxTest([1, 2, 3], [3, 4, 5], { confInt: true, alternative: "greater" }).confInt).toEqual([-4, Infinity]);
    expect(wilcoxTest([1, Infinity, Infinity], [2, 3], { confInt: true }).confInt).toEqual([-Infinity, Infinity]);
  });

  it("two samples: an end at the first or last difference has the tail rejected there (R 4.6.2: 0)", () => {
    // P(W >= 9) = 1 / C(6, 3) is rejected below -4: level 0.95 (R 4.6.2 reports 1)
    const g = wilcoxTest([1, 2, 3], [3, 4, 5], { confInt: true, alternative: "greater", confLevel: 0.92 });
    expect(g.confInt).toEqual([-4, Infinity]);
    close(g.confLevel!, 0.95);
    const l = wilcoxTest([1, 2, 3], [3, 4, 5], { confInt: true, alternative: "less", confLevel: 0.92 });
    expect(l.confInt).toEqual([-Infinity, 0]);
    close(l.confLevel!, 0.95);
  });

  it("one sample with ties or zeros: the correct conditional interval (R 4.6.2's lower end is one Walsh average higher)", () => {
    // without ties, a zero (x9 - 0.5) takes the conditional path; the interval is the classical one of the same data
    // (R 4.6.2: [1.19, 2.37])
    const z = wilcoxTest(x9, { mu: 0.5, confInt: true });
    expect(z.confInt).toEqual([1.165, 2.37]);
    expect(z.confLevel).toBe(0.9609375);
    const g = wilcoxTest(x9, { mu: 0.5, confInt: true, alternative: "greater" });
    expect(g.confInt![0]).toBe(wilcoxTest(x9, { confInt: true, alternative: "greater" }).confInt![0]);
    // the lower end can be -Inf (R 4.6.2: [1, Inf] at level 1)
    const t = wilcoxTest([1, 2, 2, 3], { confInt: true });
    expect([...t.confInt!, t.confLevel]).toEqual([-Infinity, Infinity, 1]);
    // the upper end as R's (the tails are symmetric; R 4.6.2: (-Inf, 4] at 0.953125)
    const l = wilcoxTest([1, 2, 2, 3, 4, 5], { mu: 2, confInt: true, alternative: "less" });
    expect([...l.confInt!, l.confLevel, l.estimate]).toEqual([-Infinity, 4, 0.953125, 3]);
  });

  it("infinite observations: an error where the shifted data are undefined (R stops too)", () => {
    expect(() => wilcoxTest([1, 2, Infinity, Infinity], { confInt: true })).toThrow(/infinite/);
    expect(() => wilcoxTest([-Infinity, 1, 2, 2, 5], { confInt: true })).toThrow(/infinite/);
  });
});

describe("wilcoxTest, normal approximation (R 4.6)", () => {
  const x12 = [0.8, 1.9, -0.4, 2.7, 1.1, -1.3, 0.5, 3.2, 1.6, -0.2, 2.1, 0.9];
  const y8 = [-0.5, 0.3, 1.2, -1.1, 0.7, -0.9, 0.1, -1.6];

  it("correct = 0..3: continuity correction plus that many Edgeworth terms", () => {
    // [correct, one sample: two-sided, less, greater, two samples: two-sided, less, greater]
    const table: [boolean | 0 | 1 | 2 | 3, number[]][] = [
      [false, [0.022909099354356588, 0.98854545032282171, 0.011454549677178306, 0.030753561259274642, 0.98462321937036268, 0.015376780629637292]],
      [true, [0.025369859822053753, 0.98967081137938051, 0.012684929911026852, 0.033865370332825107, 0.98605473543987676, 0.016932685166412588]],
      [0, [0.025369859822053753, 0.98967081137938051, 0.012684929911026852, 0.033865370332825107, 0.98605473543987676, 0.016932685166412588]],
      [1, [0.021863114916597759, 0.99146023231143854, 0.010931557458298857, 0.031714180313091589, 0.98720779155021843, 0.015857090156545805]],
      [2, [0.021064380726316667, 0.99180168039730676, 0.010532190363158271, 0.031291263167280592, 0.98739750481871191, 0.015645631583640372]],
      [3, [0.021274982201776149, 0.99176244662311552, 0.010637491100888007, 0.031483183940728132, 0.9873349187510303, 0.015741591970364135]],
    ];
    for (const [correct, values] of table) {
      ["two.sided", "less", "greater"].forEach((alternative, i) => {
        const o = { exact: false, correct, alternative: alternative as "two.sided" };
        close(wilcoxTest(x12, o).pValue, values[i]!, 1e-12);
        close(wilcoxTest(x12, y8, o).pValue, values[i + 3]!, 1e-12);
      });
    }
    expect(wilcoxTest(x12, { exact: false, correct: 2 }).method).toBe("Wilcoxon signed rank test with continuity correction");
    close(wilcoxTest(x12, { mu: 3, exact: false, correct: 3 }).pValue, 0.0009526853900371406, 1e-12);
    // a tie switches the terms off
    close(wilcoxTest([...x12, 0.8], { exact: false, correct: 3 }).pValue, 0.017461758127902183, 1e-12);
    // the interval uses the continuity correction only
    const ci = (correct: boolean | 3): number[] => {
      const r = wilcoxTest(x12, { exact: false, correct, confInt: true });
      return [...r.confInt!, r.estimate as number];
    };
    expect(ci(3)).toEqual(ci(true));
  });

  it("a bad correct is an error", () => {
    for (const correct of [4, 1.5, -1, NaN]) {
      expect(() => wilcoxTest(x12, { correct: correct as 0 })).toThrow("'correct' must be an integer between 0 and 3");
    }
  });

  it("small two-sided p-values from the upper tail (R 4.6.2: 0 for 1:300)", () => {
    // twice R's one-sided value 3.0570684296522223e-51; R gives 6.1141368593044447e-51 for -(1:300)
    const r = wilcoxTest(seq(1, 300), { exact: false });
    close(r.pValue, 2 * 3.0570684296522223e-51, 1e-14);
    close(wilcoxTest(seq(1, 300).map((v) => -v), { exact: false }).pValue, 6.1141368593044447e-51, 1e-14);
    close(wilcoxTest(seq(1, 300), { exact: false, alternative: "greater" }).pValue, 3.0570684296522223e-51, 1e-14);
  });

  it("the interval keeps the values equal to mu (R 4.6)", () => {
    const r = wilcoxTest([1.5, 2, 2, -3, 4, 0, 5, -1, 2], { exact: false, confInt: true });
    close(r.confInt![0], -0.50004754554209252, 1e-12);
    close(r.confInt![1], 3.49992331115281718, 1e-12);
    close(r.estimate as number, 1.7499965986730397, 1e-12);
  });
});

describe("wilcoxTest, limits of the exact conditional test", () => {
  const rounded = (n: number, shift: number): number[] => seq(1, n).map((i) => Math.round(10 * Math.sin(i * 1.7) + shift) / 2);

  it("throws a RangeError suggesting exact: false before long computations", () => {
    const t0 = performance.now();
    expect(() => wilcoxTest(rounded(3000, 1), { exact: true })).toThrow(/use exact: false/);
    expect(() => wilcoxTest(rounded(400, 1), rounded(400, 0), { exact: true })).toThrow(/use exact: false/);
    expect(() => wilcoxTest(rounded(150, 1), rounded(150, 0), { exact: true, confInt: true })).toThrow(RangeError);
    expect(performance.now() - t0).toBeLessThan(3000);
  });

  it("computes the sizes R handles (49 x 49 with an interval)", () => {
    const r = wilcoxTest(rounded(49, 1), rounded(49, 0), { confInt: true });
    expect(r.method).toBe("Wilcoxon rank sum exact test");
    expect(r.confLevel).toBeGreaterThan(0.95);
  });
});

describe("pairwiseWilcoxTest follows wilcoxTest", () => {
  it("exact with ties, no warnings", () => {
    const r = pairwiseWilcoxTest([1, 2, 2, 3, 4, 5, 5, 6, 7], ["a", "a", "a", "b", "b", "b", "c", "c", "c"], { pAdjustMethod: "none" });
    expect(r.method).toBe("Wilcoxon rank sum exact test");
    expect(r.warnings).toEqual([]);
    close(r.pValue[0]![0]!, wilcoxTest([1, 2, 2], [3, 4, 5]).pValue);
  });
});
