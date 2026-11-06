// R's warnings of the tests in each situation where R's code warns, against the fixture htestWarnings
// (oracle/htestwarnings.R: each case is an R call, args.r, and an id mapped here to the rStats.js call; expected has R's
// warnings, each once in R's order, and rError where R stops after them). The warnings of the grids of the other
// test fixtures are compared in their suites (test/helpers/htest.ts). Then the warning handler of each test.
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ansariTest,
  chisqTest,
  cohensD,
  corTest,
  cronbachAlpha,
  fisherTest,
  hedgesG,
  ksTest,
  pairwisePropTest,
  pairwiseWilcoxTest,
  pnorm,
  propTest,
  punif,
  setSeed,
  setWarningHandler,
  wilcoxTest,
  type WarningHandler,
} from "../src/index.js";
import { loadHTestFixture } from "./helpers/htest.js";

afterEach(() => {
  setWarningHandler(null);
});

const seq = (n: number): number[] => Array.from({ length: n }, (_, i) => i + 1);
const g3 = ["a", "a", "a", "b", "b", "b", "c", "c", "c"];
const g4 = ["a", "a", "a", "a", "b", "b", "b", "b"];
const ksX = [0.61, -1.2, 0.33, 1.57, -0.42, 0.08, -0.85, 1.1];
const u = (q: number): number => punif(q);
const x6 = [1, 2, 3, 4, 5, 6];
const y6 = [2, 1, 4, 3, 7, 8];
const tied6 = [2, 1, 4, 4, 7, 8];
const flat6 = [2, 2, 2, 2, 2, 2];
const inf4 = [Infinity, Infinity, Infinity, Infinity];
const d4 = [5.1, 4.9, 6.2, 5.8];

/** The rStats.js call of each case of the fixture (the R call is the case's args.r) */
const CALLS: Record<string, () => { warnings: string[] }> = {
  "wilcoxTest: one sample, ties": () => wilcoxTest([1, 2, 2, 3, 4, 5]),
  "wilcoxTest: one sample, ties, interval": () => wilcoxTest([1, 2, 2, 3, 4, 5], { confInt: true }),
  "wilcoxTest: one sample, zero": () => wilcoxTest([0, 1, 2, 3, 4, 5]),
  "wilcoxTest: one sample, zero, interval": () => wilcoxTest([0, 1, 2, 3, 4, 5], { confInt: true }),
  "wilcoxTest: one sample, ties and zero, interval": () => wilcoxTest([0, 1, 2, 2, 3, 4, 5], { confInt: true }),
  "wilcoxTest: one sample, ties, exact false, interval": () => wilcoxTest([1, 2, 2, 3, 4, 5], { exact: false, confInt: true }),
  "wilcoxTest: one sample, exact interval not achievable": () => wilcoxTest([1.1, 2.3, 3.6], { confInt: true }),
  "wilcoxTest: one sample, exact interval not achievable, less": () => wilcoxTest([1.1, 2.3, 3.6], { confInt: true, alternative: "less" }),
  "wilcoxTest: one sample, exact interval": () => wilcoxTest([1.1, 2.3, 3.6, 4.2, 5.9, 6.1, 7.7], { confInt: true }),
  "wilcoxTest: one sample, normal interval not achievable": () => wilcoxTest([1.1, 2.3, 3.6], { confInt: true, exact: false }),
  "wilcoxTest: one sample, ties, interval not achievable": () => wilcoxTest([1, 2, 2, 3], { confInt: true }),
  "wilcoxTest: one sample, all tied, interval": () => wilcoxTest([2, 2, 2], { confInt: true }),
  "wilcoxTest: one sample, all tied, exact false, interval": () => wilcoxTest([2, 2, 2], { confInt: true, exact: false }),
  "wilcoxTest: one sample, one non-zero, interval": () => wilcoxTest([0, 3], { confInt: true }),
  "wilcoxTest: one sample, ties, n >= 50, interval": () => wilcoxTest([...seq(50), 3], { confInt: true }),
  "wilcoxTest: paired, ties, interval": () => wilcoxTest([1, 2, 3, 4, 5], [0, 0, 1, 2, 3], { paired: true, confInt: true }),
  "wilcoxTest: two samples, ties": () => wilcoxTest([1, 2, 3], [3, 4, 5]),
  "wilcoxTest: two samples, ties, interval": () => wilcoxTest([1, 2, 3], [3, 4, 5], { confInt: true }),
  "wilcoxTest: two samples, ties after the shift": () => wilcoxTest([1, 2, 3], [0, 4, 5], { mu: 1 }),
  "wilcoxTest: two samples, all tied": () => wilcoxTest([1, 1], [1, 1]),
  "wilcoxTest: two samples, exact interval not achievable": () => wilcoxTest([1.1, 2.2], [3.3, 4.4], { confInt: true }),
  "wilcoxTest: two samples, exact interval not achievable, greater": () =>
    wilcoxTest([1.1, 2.2], [3.3, 4.4], { confInt: true, alternative: "greater" }),
  "wilcoxTest: two samples, normal interval": () => wilcoxTest([1.1, 2.2], [3.3, 4.4], { confInt: true, exact: false }),
  "wilcoxTest: formula, ties, interval": () =>
    wilcoxTest("y ~ g", { y: [1, 2, 3, 3, 4, 5], g: ["a", "a", "a", "b", "b", "b"] }, { confInt: true }),

  "ansariTest: ties": () => ansariTest([1, 2, 3, 4], [2, 5, 6, 7]),
  "ansariTest: ties, interval": () => ansariTest([1, 2, 3, 4], [2, 5, 6, 7], { confInt: true }),
  "ansariTest: ties, exact true, interval": () => ansariTest([1, 2, 3, 4], [2, 5, 6, 7], { exact: true, confInt: true }),
  "ansariTest: ties, exact false, interval": () => ansariTest([1, 2, 3, 4], [2, 5, 6, 7], { exact: false, confInt: true }),
  "ansariTest: ties, m >= 50": () => ansariTest([...seq(50), 3], [2, 5, 6, 7]),
  "ansariTest: exact interval": () => ansariTest([-2, -1, 1, 2], [-4, -3, 3, 4], { confInt: true }),
  "ansariTest: exact interval, location": () => ansariTest([1.1, 2.2, 3.3], [10.5, 11.5, 12.5], { confInt: true }),
  "ansariTest: exact interval, location, less": () =>
    ansariTest([1.1, 2.2, 3.3], [10.5, 11.5, 12.5], { confInt: true, alternative: "less" }),
  "ansariTest: exact interval, location, negative y": () => ansariTest([1, 2, 3, 4.5], [-1, -2, -3, -4.5], { confInt: true }),
  "ansariTest: exact interval, no positive ratio": () => ansariTest([1, 2, 3], [-1, -2, -4], { confInt: true }),
  "ansariTest: normal interval, location": () => ansariTest([-2, -1, 1, 2], [-4, -3, 3, 4], { confInt: true, exact: false }),
  "ansariTest: normal interval, location, no estimate": () =>
    ansariTest([1.1, 2.2, 3.3], [10.5, 11.5, 12.5], { confInt: true, exact: false }),
  "ansariTest: normal interval, ties, location": () => ansariTest([1, 1, 2, 3], [10, 11, 11, 12], { confInt: true, exact: false }),
  "ansariTest: normal interval, no positive ratio": () => ansariTest([1, 2, 3], [-1, -2, -4], { confInt: true, exact: false }),
  "ansariTest: normal interval, infinite range": () => ansariTest([1, 2, Infinity], [1.5, 2.5, -4], { confInt: true, exact: false }),
  "ansariTest: normal interval, infinite range, zero": () => ansariTest([1, 2, 3], [0, 2.5, -4], { confInt: true, exact: false }),
  "ansariTest: formula, ties, interval": () => ansariTest("y ~ g", { y: [1, 2, 3, 4, 2, 5, 6, 7], g: g4 }, { confInt: true }),

  "pairwiseWilcoxTest: no ties": () => pairwiseWilcoxTest([1.2, 2.3, 1.8, 2.9, 3.1, 3.6, 4.0, 4.4, 5.2], g3),
  "pairwiseWilcoxTest: ties in every pair": () => pairwiseWilcoxTest([1, 2, 2, 3, 4, 5, 5, 6, 7], g3),
  "pairwiseWilcoxTest: ties in one pair": () => pairwiseWilcoxTest([1, 2, 3, 3.5, 4.5, 5.5, 5.5, 6, 7], g3),
  "pairwiseWilcoxTest: paired, zeros and ties": () => pairwiseWilcoxTest([1, 2, 3, 1, 2.5, 3.5, 0.5, 2, 4], g3, { paired: true }),

  "fisherTest: one count rounded": () => fisherTest([[3.5, 1], [1, 3]]),
  "fisherTest: three counts rounded": () => fisherTest([[2.5, 1.2], [0.7, 3]]),
  "fisherTest: a difference within the tolerance": () => fisherTest([[3 + 1e-9, 1], [1, 3]]),
  "fisherTest: rounded to 0": () => fisherTest([[0.4, 1], [1, 3]]),
  "fisherTest: a small relative difference": () => fisherTest([[1000000.4, 2], [3, 4]], { confInt: false }),
  "fisherTest: eight digits": () => fisherTest([[10.3, 1], [1, 3]]),
  "fisherTest: 2 x 3": () => fisherTest([[1.5, 2, 3], [4, 5, 6.25]]),
  "fisherTest: integer counts": () => fisherTest([[3, 1], [1, 3]]),

  "chisqTest: goodness of fit, expected below 5": () => chisqTest([3, 4, 5]),
  "chisqTest: goodness of fit": () => chisqTest([30, 40, 50]),
  "chisqTest: goodness of fit, given p": () => chisqTest([10, 10, 1], { p: [0.45, 0.45, 0.1] }),
  "chisqTest: goodness of fit, simulated": () => (setSeed(1), chisqTest([3, 4, 5], { simulatePValue: true })),
  "chisqTest: table": () => chisqTest([[12, 7], [5, 15]]),
  "chisqTest: table, expected below 5": () => chisqTest([[3, 1], [1, 3]]),
  "chisqTest: table, simulated": () => (setSeed(1), chisqTest([[3, 1], [1, 3]], { simulatePValue: true })),
  "chisqTest: table, simulated, zero margin": () => chisqTest([[30, 10, 20], [0, 0, 0]], { simulatePValue: true }),
  "chisqTest: factors": () => chisqTest(["a", "b", "a", "b"], ["u", "u", "v", "v"]),

  "propTest: one sample": () => propTest(3, 10),
  "propTest: one sample, expected below 5": () => propTest(2, 8),
  "propTest: one sample, given p, no correction": () => propTest(5, 10, { p: 0.4, correct: false }),
  "propTest: two samples": () => propTest([15, 25], [50, 50]),
  "propTest: two samples, pooled expected below 5": () => propTest([2, 5], [10, 10]),
  "propTest: table": () => propTest([[2, 6], [5, 5]]),
  "propTest: given proportions": () => propTest([5, 5], [10, 10], { p: [0.3, 0.9] }),
  "propTest: four samples": () => propTest([83, 90, 129, 70], [86, 93, 136, 82]),
  "pairwisePropTest: none": () => pairwisePropTest([15, 25, 40], [50, 50, 50]),
  "pairwisePropTest: every pair": () => pairwisePropTest([2, 5, 40], [10, 10, 50]),

  "ksTest: one sample": () => ksTest(ksX, (q) => pnorm(q)),
  "ksTest: one sample, ties": () => ksTest([0.2, 0.2, 0.8], u),
  "ksTest: one sample, ties, exact true": () => ksTest([0.2, 0.2, 0.8], u, { exact: true }),
  "ksTest: one sample, ties, exact false": () => ksTest([0.2, 0.2, 0.8], u, { exact: false }),
  "ksTest: two samples": () => ksTest(ksX, [0.9, 2.1, 1.4, 2.8, 1.7, 0.4]),
  "ksTest: two samples, ties, exact": () => ksTest([1, 2, 3, 4], [2, 5, 6, 7]),
  "ksTest: two samples, ties, exact false": () => ksTest([1, 2, 3, 4], [2, 5, 6, 7], { exact: false }),
  "ksTest: two samples, no ties, exact false": () => ksTest([1, 2, 3, 4], [2.5, 5, 6, 7], { exact: false }),
  "ksTest: two samples, ties, m n >= 10000": () => ksTest([...seq(100), 3], seq(100)),
  "ksTest: formula, ties, exact false": () => ksTest("y ~ g", { y: [1, 2, 3, 4, 2, 5, 6, 7], g: g4 }, { exact: false }),

  "corTest: pearson": () => corTest(x6, y6),
  "corTest: pearson, constant": () => corTest(x6, flat6),
  "corTest: pearson, infinite value": () => corTest([1, 2, Infinity, 4], [1, 2, 3, 4]),
  "corTest: pearson, infinite constant": () => corTest([1, 2, 3, 4], inf4),
  "corTest: pearson, data of 1e-300": () => corTest([1e-300, 2e-300, 3e-300], [1, 2, 3]),
  "corTest: pearson, constant of 1e308": () => corTest([1e308, 1e308, 1e308, 1e308], [1, 2, 3, 4]),
  "corTest: kendall, constant": () => corTest(x6, flat6, { method: "kendall" }),
  "corTest: kendall, infinite constant": () => corTest([1, 2, 3, 4], inf4, { method: "kendall" }),
  "corTest: kendall, n = 2, constant": () => corTest([1, 1], [1, 2], { method: "kendall" }),
  "corTest: kendall, exact": () => corTest(x6, y6, { method: "kendall" }),
  "corTest: kendall, ties": () => corTest(x6, tied6, { method: "kendall" }),
  "corTest: kendall, ties, exact false": () => corTest(x6, tied6, { method: "kendall", exact: false }),
  "corTest: kendall, ties, n >= 50": () => corTest(seq(60), [...seq(59), 59], { method: "kendall" }),
  "corTest: spearman, constant": () => corTest(x6, flat6, { method: "spearman" }),
  "corTest: spearman, infinite constants": () => corTest(inf4, inf4, { method: "spearman" }),
  "corTest: spearman, exact": () => corTest(x6, y6, { method: "spearman" }),
  "corTest: spearman, ties": () => corTest(x6, tied6, { method: "spearman" }),
  "corTest: spearman, ties, exact false": () => corTest(x6, tied6, { method: "spearman", exact: false }),
  "corTest: spearman, ties, n > 1290": () => corTest(seq(1300), [...seq(1299), 1299], { method: "spearman" }),
  "corTest: spearman, n = 2, exact false": () => corTest([1, 2], [2, 1], { method: "spearman", exact: false }),
  "corTest: formula, spearman, ties": () => corTest("~ a + b", { a: x6, b: tied6 }, { method: "spearman" }),

  "cohensD: two samples": () => cohensD(d4, [4.1, 4.5, 3.9, 5.0]),
  "cohensD: y with 2 values": () => cohensD(d4, [4, 5, 4, 5]),
  "cohensD: y with 2 values and NA": () => cohensD(d4, [4, 5, 4, NaN]),
  "cohensD: NA in x, y with 2 values": () => cohensD([5.1, NaN, 6.2, 5.8], [4, 5, 4, 5]),
  "cohensD: paired, y with 2 values": () => cohensD(d4, [4, 5, 4, 5], { paired: true }),
  "cohensD: y of 2 values": () => cohensD([1, 2], [4, 5]),
  "cohensD: one sample": () => cohensD(d4),
  "hedgesG: y with 2 values": () => hedgesG(d4, [4, 5, 4, 5]),
  "hedgesG: y with 2 values and NA": () => hedgesG(d4, [4, 5, 4, NaN]),

  "cronbachAlpha: positive items": () => cronbachAlpha([[1, 2, 3], [2, 3, 3], [3, 3, 4], [4, 5, 4], [2, 2, 3]]),
  "cronbachAlpha: a constant item": () => cronbachAlpha([[1, 5, 5], [1, 4, 4], [1, 3, 2], [1, 1, 1], [1, 2, 4]]),
  "cronbachAlpha: two constant items": () =>
    cronbachAlpha([[1, 2, 3, 5, 1], [2, 3, 3, 5, 1], [3, 3, 4, 5, 1], [4, 5, 4, 5, 1], [2, 2, 3, 5, 1]]),
  "cronbachAlpha: a negative item": () => cronbachAlpha([[1, 2, 4], [2, 1, 3], [3, 4, 1], [4, 3, 2]]),
  "cronbachAlpha: two negative items, fewer subjects than items": () => cronbachAlpha([[1, 2, 3, 4], [2, 3, 1, 5], [3, 1, 2, 2]]),
  "cronbachAlpha: two items correlated -1": () => cronbachAlpha([[1, 3], [2, 2], [3, 1]]),
  "cronbachAlpha: two items correlated 1": () => cronbachAlpha([[1, 1], [2, 2], [3, 3]]),
  "cronbachAlpha: uncorrelated items and a constant one": () => cronbachAlpha([[1, 1, 5], [2, 2, 5], [3, 2, 5], [4, 1, 5]]),
};

const SD_ZERO = "the standard deviation is zero";

/**
 * Situations where rStats.js deliberately returns other warnings than R: the warnings expected instead of R's, and why
 * (the user's decisions on the warnings of the tests; docs/differences-from-r.md)
 */
function different(id: string, r: string[]): { warnings: string[]; reason: string } | undefined {
  // psych::alpha's own warnings only, not those of the functions it calls (principal, cor, smc: decision 10)
  if (id.startsWith("cronbachAlpha: ")) {
    const own = r.filter((w) => w.startsWith("Item = ") || w.startsWith("Some items were negatively correlated"));
    return own.length === r.length ? undefined : { warnings: own, reason: "only psych::alpha's own warnings" };
  }
  switch (id) {
    // R warns of min and max of no ratios before it stops; the result here has NaN limits (decision E)
    case "ansariTest: normal interval, no positive ratio":
      return { warnings: r.filter((w) => !w.startsWith("no non-missing arguments to m")), reason: "R's range() of no ratios" };
    // R's sums of squares underflow (its cor is NaN, sd 0); the correlation here is 1 (decision F)
    case "corTest: pearson, data of 1e-300":
      return { warnings: r.filter((w) => w !== SD_ZERO), reason: "R's sums of squares underflow" };
    default:
      return undefined;
  }
}

describe("R's warnings in each situation (fixture htestWarnings)", () => {
  const fixture = loadHTestFixture("htestWarnings");
  const cases = fixture.cases.map((c) => ({ id: c.args.id as string, r: c.args.r as string, warnings: c.expected.warnings as string[] }));

  it(`has an rStats.js call for each case of R (${fixture.r_version}), and a case for each call`, () => {
    expect(cases.map((c) => c.id).sort()).toEqual(Object.keys(CALLS).sort());
  });

  it.each(cases)("$id", ({ id, warnings }) => {
    const d = different(id, warnings);
    expect(CALLS[id]!().warnings).toEqual(d?.warnings ?? warnings);
  });

  it("differs from R only where decided (each exception still applies)", () => {
    const applied = cases.filter((c) => different(c.id, c.warnings) !== undefined).map((c) => c.id);
    expect(applied).toEqual([
      "ansariTest: normal interval, no positive ratio",
      "corTest: pearson, data of 1e-300",
      "cronbachAlpha: two negative items, fewer subjects than items",
      "cronbachAlpha: two items correlated -1",
      "cronbachAlpha: two items correlated 1",
    ]);
  });
});

describe("the warning handler of the tests", () => {
  const P_TIES = "cannot compute exact p-value with ties";
  const CI_TIES_2 = "cannot compute exact confidence intervals with ties";
  // ansari.test's text since R 4.6 ("interval")
  const CI_TIES_ANSARI = "cannot compute exact confidence interval with ties";
  const APPROX = "Chi-squared approximation may be incorrect";
  const handled = (f: () => unknown): unknown[][] => {
    const handler = vi.fn<WarningHandler>();
    setWarningHandler(handler);
    f();
    return handler.mock.calls;
  };

  it("wilcoxTest: once, also for the formula form", () => {
    const calls = handled(() => wilcoxTest("y ~ g", { y: [1, 2, 3, 3, 4, 5], g: ["a", "a", "a", "b", "b", "b"] }, { confInt: true }));
    expect(calls).toEqual([
      [P_TIES, "wilcoxTest"],
      [CI_TIES_2, "wilcoxTest"],
    ]);
  });

  it("ansariTest: once, also for the formula form", () => {
    const calls = handled(() => ansariTest("y ~ g", { y: [1, 2, 3, 4, 2, 5, 6, 7], g: g4 }, { confInt: true }));
    expect(calls).toEqual([
      [P_TIES, "ansariTest"],
      [CI_TIES_ANSARI, "ansariTest"],
    ]);
  });

  it("ansariTest has no interval where R's asymptotic range is infinite", () => {
    expect(ansariTest([1, 2, Infinity], [1.5, 2.5, -4], { confInt: true, exact: false }).confInt).toBeUndefined();
  });

  it("pairwiseWilcoxTest: once, under its own name", () => {
    expect(handled(() => pairwiseWilcoxTest([1, 2, 2, 3, 4, 5, 5, 6, 7], g3))).toEqual([[P_TIES, "pairwiseWilcoxTest"]]);
  });

  it("fisherTest", () => {
    expect(handled(() => fisherTest([[1.5, 2, 3], [4, 5, 6.25]]))).toEqual([
      ["'x' has been rounded to integer: Mean relative difference: 0.09677419", "fisherTest"],
    ]);
  });

  it("chisqTest: once each", () => {
    expect(handled(() => chisqTest([[30, 10, 20], [0, 0, 0]], { simulatePValue: true }))).toEqual([
      ["cannot compute simulated p-value with zero marginals", "chisqTest"],
      [APPROX, "chisqTest"],
    ]);
  });

  it("propTest", () => {
    expect(handled(() => propTest(2, 8))).toEqual([[APPROX, "propTest"]]);
  });

  it("pairwisePropTest: once, under its own name", () => {
    expect(handled(() => pairwisePropTest([2, 5, 40], [10, 10, 50]))).toEqual([[APPROX, "pairwisePropTest"]]);
  });

  it("ksTest: once, also for the formula form", () => {
    const calls = handled(() => ksTest("y ~ g", { y: [1, 2, 3, 4, 2, 5, 6, 7], g: g4 }, { exact: false }));
    expect(calls).toEqual([["p-value will be approximate in the presence of ties", "ksTest"]]);
  });

  it("corTest: once, also for the formula form", () => {
    const calls = handled(() => corTest("~ a + b", { a: x6, b: tied6 }, { method: "spearman" }));
    expect(calls).toEqual([["cannot compute exact p-value with ties", "corTest"]]);
  });

  it("hedgesG", () => {
    expect(handled(() => hedgesG(d4, [4, 5, 4, NaN]))).toEqual([
      ["'y' is numeric but has only 2 unique values.\n  If this is a grouping variable, convert it to a factor.", "hedgesG"],
      ["Missing values detected. NAs dropped.", "hedgesG"],
    ]);
  });

  it("cronbachAlpha", () => {
    expect(handled(() => cronbachAlpha([[1, 3], [2, 2], [3, 1]]))).toEqual([
      [
        "Some items were negatively correlated with the first principal component and probably \nshould be reversed.  \nTo do this, run the function again with the 'check.keys=TRUE' option",
        "cronbachAlpha",
      ],
    ]);
  });
});
