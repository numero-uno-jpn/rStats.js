// R's warnings of the tests that warn where R warns (each distinct warning once, in R's order), one case per
// situation of R's code. The expected arrays were made with R 4.5.2 (Rscript on Windows; only the texts are compared,
// not the numbers): each case is the R call in its comment, run as
//   w <- character(0)
//   withCallingHandlers(<call>, warning = function(c) { w <<- c(w, conditionMessage(c)); invokeRestart("muffleWarning") })
//   unique(w)
// For the cases where R stops with an error after its warnings, the comment says so; rStats.js returns a value there
// and the warnings R gave before it stopped. To be replaced by the warnings recorded in the fixtures.
import { afterEach, describe, expect, it, vi } from "vitest";
import { setWarningHandler, wilcoxTest, type WarningHandler } from "../src/index.js";

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
