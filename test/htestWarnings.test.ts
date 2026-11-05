// R's warnings of the tests that warn where R warns (each distinct warning once, in R's order), one case per
// situation of R's code. The expected arrays were made with R 4.5.2 (Rscript on Windows; only the texts are compared,
// not the numbers): each case is the R call in its comment, run as
//   w <- character(0)
//   withCallingHandlers(<call>, warning = function(c) { w <<- c(w, conditionMessage(c)); invokeRestart("muffleWarning") })
//   unique(w)
// For the cases where R stops with an error after its warnings, the comment says so; rStats.js returns a value there
// and the warnings R gave before it stopped. To be replaced by the warnings recorded in the fixtures.
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ansariTest,
  chisqTest,
  fisherTest,
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

const P_TIES = "cannot compute exact p-value with ties";
const P_ZEROES = "cannot compute exact p-value with zeroes";
const CI_TIES_1 = "cannot compute exact confidence interval with ties";
const CI_ZEROES_1 = "cannot compute exact confidence interval with zeroes";
const CI_TIES_2 = "cannot compute exact confidence intervals with ties";
const LEVEL = "requested conf.level not achievable";
const LEVEL_2 = "Requested conf.level not achievable";
const ALL_TIED_1 = "cannot compute confidence interval when all observations are zero or tied";

afterEach(() => {
  setWarningHandler(null);
});

describe("wilcoxTest warnings (R's wilcox.test)", () => {
  const cases: [string, () => { warnings: string[] }, string[]][] = [
    // wilcox.test(c(1,2,2,3,4,5))
    ["one sample, ties", () => wilcoxTest([1, 2, 2, 3, 4, 5]), [P_TIES]],
    // wilcox.test(c(1,2,2,3,4,5), conf.int = TRUE)
    ["one sample, ties, interval", () => wilcoxTest([1, 2, 2, 3, 4, 5], { confInt: true }), [LEVEL, P_TIES, CI_TIES_1]],
    // wilcox.test(c(0,1,2,3,4,5))
    ["one sample, zero", () => wilcoxTest([0, 1, 2, 3, 4, 5]), [P_ZEROES]],
    // wilcox.test(c(0,1,2,3,4,5), conf.int = TRUE)
    ["one sample, zero, interval", () => wilcoxTest([0, 1, 2, 3, 4, 5], { confInt: true }), [LEVEL, P_ZEROES, CI_ZEROES_1]],
    // wilcox.test(c(0,1,2,2,3,4,5), conf.int = TRUE)
    [
      "one sample, ties and zero, interval",
      () => wilcoxTest([0, 1, 2, 2, 3, 4, 5], { confInt: true }),
      [LEVEL, P_TIES, CI_TIES_1, P_ZEROES, CI_ZEROES_1],
    ],
    // wilcox.test(c(1,2,2,3,4,5), exact = FALSE, conf.int = TRUE)
    ["one sample, ties, exact false, interval", () => wilcoxTest([1, 2, 2, 3, 4, 5], { exact: false, confInt: true }), [LEVEL]],
    // wilcox.test(c(1.1,2.3,3.6), conf.int = TRUE)
    ["one sample, exact interval not achievable", () => wilcoxTest([1.1, 2.3, 3.6], { confInt: true }), [LEVEL]],
    // wilcox.test(c(1.1,2.3,3.6), conf.int = TRUE, alternative = "less")
    [
      "one sample, exact interval not achievable, less",
      () => wilcoxTest([1.1, 2.3, 3.6], { confInt: true, alternative: "less" }),
      [LEVEL],
    ],
    // wilcox.test(c(1.1,2.3,3.6,4.2,5.9,6.1,7.7), conf.int = TRUE)
    ["one sample, exact interval", () => wilcoxTest([1.1, 2.3, 3.6, 4.2, 5.9, 6.1, 7.7], { confInt: true }), []],
    // wilcox.test(c(1.1,2.3,3.6), conf.int = TRUE, exact = FALSE)
    ["one sample, normal interval not achievable", () => wilcoxTest([1.1, 2.3, 3.6], { confInt: true, exact: false }), [LEVEL]],
    // wilcox.test(c(2,2,2), conf.int = TRUE)
    ["one sample, all tied, interval", () => wilcoxTest([2, 2, 2], { confInt: true }), [ALL_TIED_1, P_TIES, CI_TIES_1]],
    // wilcox.test(c(2,2,2), conf.int = TRUE, exact = FALSE)
    ["one sample, all tied, exact false, interval", () => wilcoxTest([2, 2, 2], { confInt: true, exact: false }), [ALL_TIED_1]],
    // wilcox.test(c(0,3), conf.int = TRUE)
    ["one sample, one non-zero, interval", () => wilcoxTest([0, 3], { confInt: true }), [ALL_TIED_1, P_ZEROES, CI_ZEROES_1]],
    // wilcox.test(c(1:50, 3), conf.int = TRUE)  (51 values: the normal approximation by default)
    ["one sample, ties, n >= 50, interval", () => wilcoxTest([...Array.from({ length: 50 }, (_, i) => i + 1), 3], { confInt: true }), []],
    // wilcox.test(c(1,2,3,4,5), c(0,0,1,2,3), paired = TRUE, conf.int = TRUE)
    [
      "paired, ties, interval",
      () => wilcoxTest([1, 2, 3, 4, 5], [0, 0, 1, 2, 3], { paired: true, confInt: true }),
      [LEVEL, P_TIES, CI_TIES_1],
    ],
    // wilcox.test(c(1,2,3), c(3,4,5))
    ["two samples, ties", () => wilcoxTest([1, 2, 3], [3, 4, 5]), [P_TIES]],
    // wilcox.test(c(1,2,3), c(3,4,5), conf.int = TRUE)
    ["two samples, ties, interval", () => wilcoxTest([1, 2, 3], [3, 4, 5], { confInt: true }), [P_TIES, CI_TIES_2]],
    // wilcox.test(c(1,2,3), c(0,4,5), mu = 1)
    ["two samples, ties after the shift", () => wilcoxTest([1, 2, 3], [0, 4, 5], { mu: 1 }), [P_TIES]],
    // wilcox.test(c(1,1), c(1,1))
    ["two samples, all tied", () => wilcoxTest([1, 1], [1, 1]), [P_TIES]],
    // wilcox.test(c(1.1,2.2), c(3.3,4.4), conf.int = TRUE)
    ["two samples, exact interval not achievable", () => wilcoxTest([1.1, 2.2], [3.3, 4.4], { confInt: true }), [LEVEL_2]],
    // wilcox.test(c(1.1,2.2), c(3.3,4.4), conf.int = TRUE, alternative = "greater")
    [
      "two samples, exact interval not achievable, greater",
      () => wilcoxTest([1.1, 2.2], [3.3, 4.4], { confInt: true, alternative: "greater" }),
      [LEVEL_2],
    ],
    // wilcox.test(c(1.1,2.2), c(3.3,4.4), conf.int = TRUE, exact = FALSE)  (no warning: the normal interval is clamped)
    ["two samples, normal interval", () => wilcoxTest([1.1, 2.2], [3.3, 4.4], { confInt: true, exact: false }), []],
    // wilcox.test(y ~ g, data) with the two-sample ties case
    [
      "formula, ties, interval",
      () => wilcoxTest("y ~ g", { y: [1, 2, 3, 3, 4, 5], g: ["a", "a", "a", "b", "b", "b"] }, { confInt: true }),
      [P_TIES, CI_TIES_2],
    ],
  ];
  it.each(cases)("%s", (_, f, expected) => {
    expect(f().warnings).toEqual(expected);
  });

  it("passes the warnings to the handler once, also for the formula form", () => {
    const handler = vi.fn<WarningHandler>();
    setWarningHandler(handler);
    wilcoxTest("y ~ g", { y: [1, 2, 3, 3, 4, 5], g: ["a", "a", "a", "b", "b", "b"] }, { confInt: true });
    expect(handler.mock.calls).toEqual([
      [P_TIES, "wilcoxTest"],
      [CI_TIES_2, "wilcoxTest"],
    ]);
  });
});

describe("ansariTest warnings (R's ansari.test)", () => {
  const LOCATION = "samples differ in location: cannot compute confidence set, returning NA";
  const NO_ESTIMATE = "cannot compute estimate, returning NA";
  const cases: [string, () => { warnings: string[] }, string[]][] = [
    // ansari.test(c(1,2,3,4), c(2,5,6,7))
    ["ties", () => ansariTest([1, 2, 3, 4], [2, 5, 6, 7]), [P_TIES]],
    // ansari.test(c(1,2,3,4), c(2,5,6,7), conf.int = TRUE)  (R then stops: "object 'cint' not found")
    ["ties, interval", () => ansariTest([1, 2, 3, 4], [2, 5, 6, 7], { confInt: true }), [P_TIES, CI_TIES_2]],
    // ansari.test(c(1,2,3,4), c(2,5,6,7), exact = TRUE, conf.int = TRUE)  (R then stops: "object 'cint' not found")
    ["ties, exact true, interval", () => ansariTest([1, 2, 3, 4], [2, 5, 6, 7], { exact: true, confInt: true }), [P_TIES, CI_TIES_2]],
    // ansari.test(c(1,2,3,4), c(2,5,6,7), exact = FALSE, conf.int = TRUE)
    [
      "ties, exact false, interval",
      () => ansariTest([1, 2, 3, 4], [2, 5, 6, 7], { exact: false, confInt: true }),
      [LOCATION, NO_ESTIMATE],
    ],
    // ansari.test(c(1:50, 3), c(2,5,6,7))  (51 values: the normal approximation by default)
    ["ties, m >= 50", () => ansariTest([...Array.from({ length: 50 }, (_, i) => i + 1), 3], [2, 5, 6, 7]), []],
    // ansari.test(c(-2,-1,1,2), c(-4,-3,3,4), conf.int = TRUE)
    ["exact interval", () => ansariTest([-2, -1, 1, 2], [-4, -3, 3, 4], { confInt: true }), []],
    // ansari.test(c(1.1,2.2,3.3), c(10.5,11.5,12.5), conf.int = TRUE)
    ["exact interval, location", () => ansariTest([1.1, 2.2, 3.3], [10.5, 11.5, 12.5], { confInt: true }), [LOCATION]],
    // ansari.test(c(1.1,2.2,3.3), c(10.5,11.5,12.5), conf.int = TRUE, alternative = "less")
    [
      "exact interval, location, less",
      () => ansariTest([1.1, 2.2, 3.3], [10.5, 11.5, 12.5], { confInt: true, alternative: "less" }),
      [LOCATION],
    ],
    // ansari.test(c(1,2,3), c(-1,-2,-4), conf.int = TRUE)  (R then stops: "object 'absigma' not found")
    [
      "exact interval, no positive ratio",
      () => ansariTest([1, 2, 3], [-1, -2, -4], { confInt: true }),
      ["cannot compute confidence set, returning NA"],
    ],
    // ansari.test(c(-2,-1,1,2), c(-4,-3,3,4), conf.int = TRUE, exact = FALSE)
    ["normal interval, location", () => ansariTest([-2, -1, 1, 2], [-4, -3, 3, 4], { confInt: true, exact: false }), [LOCATION]],
    // ansari.test(c(1.1,2.2,3.3), c(10.5,11.5,12.5), conf.int = TRUE, exact = FALSE)
    [
      "normal interval, location, no estimate",
      () => ansariTest([1.1, 2.2, 3.3], [10.5, 11.5, 12.5], { confInt: true, exact: false }),
      [LOCATION, NO_ESTIMATE],
    ],
    // ansari.test(c(1,2,3), c(-1,-2,-4), conf.int = TRUE, exact = FALSE)  (R warns "no non-missing arguments to min;
    // returning Inf" and "... to max; returning -Inf" from range() of no ratios, then LOCATION, then stops: "invalid
    // 'xmin' value"; rStats.js returns NaN limits and estimate, and LOCATION only)
    ["normal interval, no positive ratio", () => ansariTest([1, 2, 3], [-1, -2, -4], { confInt: true, exact: false }), [LOCATION]],
    // ansari.test(c(1,2,Inf), c(1.5,2.5,-4), conf.int = TRUE, exact = FALSE)  (no interval in the result)
    [
      "normal interval, infinite range",
      () => ansariTest([1, 2, Infinity], [1.5, 2.5, -4], { confInt: true, exact: false }),
      ["cannot compute asymptotic confidence set or estimator"],
    ],
    // ansari.test(y ~ g, data) with the ties case
    [
      "formula, ties, interval",
      () => ansariTest("y ~ g", { y: [1, 2, 3, 4, 2, 5, 6, 7], g: ["a", "a", "a", "a", "b", "b", "b", "b"] }, { confInt: true }),
      [P_TIES, CI_TIES_2],
    ],
  ];
  it.each(cases)("%s", (_, f, expected) => {
    expect(f().warnings).toEqual(expected);
  });

  it("has no interval where R's asymptotic range is infinite", () => {
    expect(ansariTest([1, 2, Infinity], [1.5, 2.5, -4], { confInt: true, exact: false }).confInt).toBeUndefined();
  });

  it("passes the warnings to the handler once, also for the formula form", () => {
    const handler = vi.fn<WarningHandler>();
    setWarningHandler(handler);
    ansariTest("y ~ g", { y: [1, 2, 3, 4, 2, 5, 6, 7], g: ["a", "a", "a", "a", "b", "b", "b", "b"] }, { confInt: true });
    expect(handler.mock.calls).toEqual([
      [P_TIES, "ansariTest"],
      [CI_TIES_2, "ansariTest"],
    ]);
  });
});

describe("pairwiseWilcoxTest warnings (R's pairwise.wilcox.test: those of each wilcox.test, each once)", () => {
  const g = ["a", "a", "a", "b", "b", "b", "c", "c", "c"];
  const cases: [string, () => { warnings: string[] }, string[]][] = [
    // pairwise.wilcox.test(c(1.2,2.3,1.8,2.9,3.1,3.6,4.0,4.4,5.2), g)
    ["no ties", () => pairwiseWilcoxTest([1.2, 2.3, 1.8, 2.9, 3.1, 3.6, 4.0, 4.4, 5.2], g), []],
    // pairwise.wilcox.test(c(1,2,2,3,4,5,5,6,7), g)  (R: the warning three times, once per pair)
    ["ties in every pair", () => pairwiseWilcoxTest([1, 2, 2, 3, 4, 5, 5, 6, 7], g), [P_TIES]],
    // pairwise.wilcox.test(c(1,2,3,3.5,4.5,5.5,5.5,6,7), g)
    ["ties in one pair", () => pairwiseWilcoxTest([1, 2, 3, 3.5, 4.5, 5.5, 5.5, 6, 7], g), [P_TIES]],
    // pairwise.wilcox.test(c(1,2,3,1,2.5,3.5,0.5,2,4), g, paired = TRUE)  (R: ties, zeroes, zeroes, ties)
    ["paired, zeros and ties", () => pairwiseWilcoxTest([1, 2, 3, 1, 2.5, 3.5, 0.5, 2, 4], g, { paired: true }), [P_TIES, P_ZEROES]],
  ];
  it.each(cases)("%s", (_, f, expected) => {
    expect(f().warnings).toEqual(expected);
  });

  it("passes the warnings to the handler once, under its own name", () => {
    const handler = vi.fn<WarningHandler>();
    setWarningHandler(handler);
    pairwiseWilcoxTest([1, 2, 2, 3, 4, 5, 5, 6, 7], g);
    expect(handler.mock.calls).toEqual([[P_TIES, "pairwiseWilcoxTest"]]);
  });
});

describe("fisherTest warnings (R's fisher.test: the rounding of the counts, with all.equal's text)", () => {
  const ROUNDED = "'x' has been rounded to integer: Mean relative difference: ";
  const cases: [string, () => { warnings: string[] }, string[]][] = [
    // fisher.test(matrix(c(3.5,1,1,3), 2, byrow = TRUE))
    ["one count rounded", () => fisherTest([[3.5, 1], [1, 3]]), [`${ROUNDED}0.1428571`]],
    // fisher.test(matrix(c(2.5,1.2,0.7,3), 2, byrow = TRUE))
    ["three counts rounded", () => fisherTest([[2.5, 1.2], [0.7, 3]]), [`${ROUNDED}0.2272727`]],
    // fisher.test(matrix(c(3+1e-9,1,1,3), 2, byrow = TRUE))  (all.equal is TRUE)
    ["a difference within the tolerance", () => fisherTest([[3 + 1e-9, 1], [1, 3]]), []],
    // fisher.test(matrix(c(0.4,1,1,3), 2, byrow = TRUE))
    ["rounded to 0", () => fisherTest([[0.4, 1], [1, 3]]), [`${ROUNDED}1`]],
    // fisher.test(matrix(c(1000000.4,2,3,4), 2, byrow = TRUE))
    ["a small relative difference", () => fisherTest([[1000000.4, 2], [3, 4]], { confInt: false }), [`${ROUNDED}3.999998e-07`]],
    // fisher.test(matrix(c(10.3,1,1,3), 2, byrow = TRUE))
    ["eight digits", () => fisherTest([[10.3, 1], [1, 3]]), [`${ROUNDED}0.02912621`]],
    // fisher.test(matrix(c(1.5,2,3,4,5,6.25), 2, byrow = TRUE))
    ["2 x 3", () => fisherTest([[1.5, 2, 3], [4, 5, 6.25]]), [`${ROUNDED}0.09677419`]],
    // fisher.test(matrix(c(3,1,1,3), 2, byrow = TRUE))
    ["integer counts", () => fisherTest([[3, 1], [1, 3]]), []],
  ];
  it.each(cases)("%s", (_, f, expected) => {
    expect(f().warnings).toEqual(expected);
  });

  it("passes the warning to the handler", () => {
    const handler = vi.fn<WarningHandler>();
    setWarningHandler(handler);
    fisherTest([[1.5, 2, 3], [4, 5, 6.25]]);
    expect(handler.mock.calls).toEqual([[`${ROUNDED}0.09677419`, "fisherTest"]]);
  });
});

const APPROX = "Chi-squared approximation may be incorrect";

describe("chisqTest warnings (R's chisq.test)", () => {
  const ZERO_MARGINALS = "cannot compute simulated p-value with zero marginals";
  const cases: [string, () => { warnings: string[] }, string[]][] = [
    // chisq.test(c(3,4,5))
    ["goodness of fit, expected below 5", () => chisqTest([3, 4, 5]), [APPROX]],
    // chisq.test(c(30,40,50))
    ["goodness of fit", () => chisqTest([30, 40, 50]), []],
    // chisq.test(c(10,10,1), p = c(0.45,0.45,0.1))
    ["goodness of fit, given p", () => chisqTest([10, 10, 1], { p: [0.45, 0.45, 0.1] }), [APPROX]],
    // set.seed(1); chisq.test(c(3,4,5), simulate.p.value = TRUE)
    ["goodness of fit, simulated", () => (setSeed(1), chisqTest([3, 4, 5], { simulatePValue: true })), []],
    // chisq.test(matrix(c(12,5,7,15), 2))
    ["table", () => chisqTest([[12, 7], [5, 15]]), []],
    // chisq.test(matrix(c(3,1,1,3), 2))
    ["table, expected below 5", () => chisqTest([[3, 1], [1, 3]]), [APPROX]],
    // set.seed(1); chisq.test(matrix(c(3,1,1,3), 2), simulate.p.value = TRUE)
    ["table, simulated", () => (setSeed(1), chisqTest([[3, 1], [1, 3]], { simulatePValue: true })), []],
    // chisq.test(matrix(c(30,0,10,0,20,0), 2), simulate.p.value = TRUE)
    [
      "table, simulated, zero margin",
      () => chisqTest([[30, 10, 20], [0, 0, 0]], { simulatePValue: true }),
      [ZERO_MARGINALS, APPROX],
    ],
    // chisq.test(c("a","b","a","b"), c("u","u","v","v"))
    ["factors", () => chisqTest(["a", "b", "a", "b"], ["u", "u", "v", "v"]), [APPROX]],
  ];
  it.each(cases)("%s", (_, f, expected) => {
    expect(f().warnings).toEqual(expected);
  });

  it("passes the warnings to the handler once", () => {
    const handler = vi.fn<WarningHandler>();
    setWarningHandler(handler);
    chisqTest([[30, 10, 20], [0, 0, 0]], { simulatePValue: true });
    expect(handler.mock.calls).toEqual([
      [ZERO_MARGINALS, "chisqTest"],
      [APPROX, "chisqTest"],
    ]);
  });
});

describe("propTest warnings (R's prop.test)", () => {
  const cases: [string, () => { warnings: string[] }, string[]][] = [
    // prop.test(3, 10)
    ["one sample", () => propTest(3, 10), []],
    // prop.test(2, 8)
    ["one sample, expected below 5", () => propTest(2, 8), [APPROX]],
    // prop.test(5, 10, p = 0.4, correct = FALSE)
    ["one sample, given p, no correction", () => propTest(5, 10, { p: 0.4, correct: false }), [APPROX]],
    // prop.test(c(15,25), c(50,50))
    ["two samples", () => propTest([15, 25], [50, 50]), []],
    // prop.test(c(2,5), c(10,10))
    ["two samples, pooled expected below 5", () => propTest([2, 5], [10, 10]), [APPROX]],
    // prop.test(matrix(c(2,6,5,5), 2, byrow = TRUE))
    ["table", () => propTest([[2, 6], [5, 5]]), [APPROX]],
    // prop.test(c(5,5), c(10,10), p = c(0.3,0.9))
    ["given proportions", () => propTest([5, 5], [10, 10], { p: [0.3, 0.9] }), [APPROX]],
    // prop.test(c(83,90,129,70), c(86,93,136,82))
    ["four samples", () => propTest([83, 90, 129, 70], [86, 93, 136, 82]), []],
  ];
  it.each(cases)("%s", (_, f, expected) => {
    expect(f().warnings).toEqual(expected);
  });

  it("passes the warning to the handler", () => {
    const handler = vi.fn<WarningHandler>();
    setWarningHandler(handler);
    propTest(2, 8);
    expect(handler.mock.calls).toEqual([[APPROX, "propTest"]]);
  });
});

describe("pairwisePropTest warnings (R's pairwise.prop.test: those of each prop.test, each once)", () => {
  const cases: [string, () => { warnings: string[] }, string[]][] = [
    // pairwise.prop.test(c(15,25,40), c(50,50,50))
    ["none", () => pairwisePropTest([15, 25, 40], [50, 50, 50]), []],
    // pairwise.prop.test(c(2,5,40), c(10,10,50))  (R: the warning three times, once per pair)
    ["every pair", () => pairwisePropTest([2, 5, 40], [10, 10, 50]), [APPROX]],
  ];
  it.each(cases)("%s", (_, f, expected) => {
    expect(f().warnings).toEqual(expected);
  });

  it("passes the warning to the handler once, under its own name", () => {
    const handler = vi.fn<WarningHandler>();
    setWarningHandler(handler);
    pairwisePropTest([2, 5, 40], [10, 10, 50]);
    expect(handler.mock.calls).toEqual([[APPROX, "pairwisePropTest"]]);
  });
});

describe("ksTest warnings (R's ks.test)", () => {
  const ONE_TIES = "ties should not be present for the one-sample Kolmogorov-Smirnov test";
  const TWO_TIES = "p-value will be approximate in the presence of ties";
  const x = [0.61, -1.2, 0.33, 1.57, -0.42, 0.08, -0.85, 1.1];
  const u = (q: number): number => punif(q);
  const g = ["a", "a", "a", "a", "b", "b", "b", "b"];
  const cases: [string, () => { warnings: string[] }, string[]][] = [
    // ks.test(x, "pnorm")
    ["one sample", () => ksTest(x, (q) => pnorm(q)), []],
    // ks.test(c(0.2,0.2,0.8), "punif")
    ["one sample, ties", () => ksTest([0.2, 0.2, 0.8], u), [ONE_TIES]],
    // ks.test(c(0.2,0.2,0.8), "punif", exact = TRUE)
    ["one sample, ties, exact true", () => ksTest([0.2, 0.2, 0.8], u, { exact: true }), [ONE_TIES]],
    // ks.test(c(0.2,0.2,0.8), "punif", exact = FALSE)
    ["one sample, ties, exact false", () => ksTest([0.2, 0.2, 0.8], u, { exact: false }), [ONE_TIES]],
    // ks.test(x, c(0.9,2.1,1.4,2.8,1.7,0.4))
    ["two samples", () => ksTest(x, [0.9, 2.1, 1.4, 2.8, 1.7, 0.4]), []],
    // ks.test(c(1,2,3,4), c(2,5,6,7))  (exact by default: no warning)
    ["two samples, ties, exact", () => ksTest([1, 2, 3, 4], [2, 5, 6, 7]), []],
    // ks.test(c(1,2,3,4), c(2,5,6,7), exact = FALSE)
    ["two samples, ties, exact false", () => ksTest([1, 2, 3, 4], [2, 5, 6, 7], { exact: false }), [TWO_TIES]],
    // ks.test(c(1,2,3,4), c(2.5,5,6,7), exact = FALSE)
    ["two samples, no ties, exact false", () => ksTest([1, 2, 3, 4], [2.5, 5, 6, 7], { exact: false }), []],
    // ks.test(c(1:100, 3), 1:100)  (m n >= 10000: asymptotic by default)
    [
      "two samples, ties, m n >= 10000",
      () => ksTest([...Array.from({ length: 100 }, (_, i) => i + 1), 3], Array.from({ length: 100 }, (_, i) => i + 1)),
      [TWO_TIES],
    ],
    // ks.test(y ~ g, data.frame(y = c(1,2,3,4,2,5,6,7), g), exact = FALSE)
    ["formula, ties, exact false", () => ksTest("y ~ g", { y: [1, 2, 3, 4, 2, 5, 6, 7], g }, { exact: false }), [TWO_TIES]],
  ];
  it.each(cases)("%s", (_, f, expected) => {
    expect(f().warnings).toEqual(expected);
  });

  it("passes the warning to the handler once, also for the formula form", () => {
    const handler = vi.fn<WarningHandler>();
    setWarningHandler(handler);
    ksTest("y ~ g", { y: [1, 2, 3, 4, 2, 5, 6, 7], g }, { exact: false });
    expect(handler.mock.calls).toEqual([[TWO_TIES, "ksTest"]]);
  });
});
