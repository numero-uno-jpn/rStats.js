// R's warnings of the tests that warn where R warns (each distinct warning once, in R's order), one case per
// situation of R's code. The expected arrays were made with R 4.5.2 (Rscript on Windows; only the texts are compared,
// not the numbers): each case is the R call in its comment, run as
//   w <- character(0)
//   withCallingHandlers(<call>, warning = function(c) { w <<- c(w, conditionMessage(c)); invokeRestart("muffleWarning") })
//   unique(w)
// For the cases where R stops with an error after its warnings, the comment says so; rStats.js returns a value there
// and the warnings R gave before it stopped. To be replaced by the warnings recorded in the fixtures.
import { afterEach, describe, expect, it, vi } from "vitest";
import { ansariTest, setWarningHandler, wilcoxTest, type WarningHandler } from "../src/index.js";

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
