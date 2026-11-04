// The optional arguments that R takes by position (glmResiduals' type, cohenES' size, outer's fun, tabulate's nbins,
// propTrendTest's score, the deriv of splinefun's function) are also accepted in an options object: in place of the
// argument, or after it. Giving one both ways is a RangeError.
import { describe, expect, it } from "vitest";
import { cohenES, glm, glmResiduals, outer, propTrendTest, splinefun, tabulate } from "../src/index.js";

const both = (f: () => unknown, name: string) => expect(f).toThrow(new RangeError(`'${name}' is given both as an argument and in the options`));

describe("positional arguments or options", () => {
  it("glmResiduals: type", () => {
    const fit = glm([1, 2, 3, 4, 5, 6], [0, 0, 1, 0, 1, 1], { family: "binomial" });
    expect(glmResiduals(fit, { type: "pearson" })).toEqual(glmResiduals(fit, "pearson"));
    expect(glmResiduals(fit, {})).toEqual(glmResiduals(fit));
    both(() => (glmResiduals as (...a: unknown[]) => unknown)(fit, "pearson", { type: "response" }), "type");
  });

  it("cohenES: size", () => {
    expect(cohenES("anov", { size: "medium" })).toEqual(cohenES("anov", "medium"));
    expect(cohenES(undefined, { size: "large" })).toEqual(cohenES("p", "large"));
    both(() => (cohenES as (...a: unknown[]) => unknown)("anov", "medium", { size: "large" }), "size");
  });

  it("outer: fun", () => {
    const f = (a: number, b: number) => a - 2 * b;
    expect(outer([1, 2], [1, 2, 3], { fun: "+" })).toEqual(outer([1, 2], [1, 2, 3], "+"));
    expect(outer([1, 2], [1, 2, 3], { fun: f })).toEqual(outer([1, 2], [1, 2, 3], f));
    expect(outer([1, 2], [1, 2, 3], {})).toEqual(outer([1, 2], [1, 2, 3]));
    both(() => (outer as (...a: unknown[]) => unknown)([1], [2], f, { fun: "+" }), "fun");
  });

  it("tabulate: nbins", () => {
    expect(tabulate([1, 2, 2, 5], { nbins: 3 })).toEqual([1, 2, 0]);
    expect(tabulate([1, 2, 2, 5], {})).toEqual([1, 2, 0, 0, 1]);
    expect((tabulate as (...a: unknown[]) => unknown)([1, 2, 2, 5], 3, {})).toEqual([1, 2, 0]);
    both(() => (tabulate as (...a: unknown[]) => unknown)([1, 2], 3, { nbins: 4 }), "nbins");
  });

  it("propTrendTest: score, also as a Float64Array", () => {
    const x = [15, 10, 8, 4];
    const n = [30, 30, 30, 30];
    const score = [0, 1, 2, 4];
    expect(propTrendTest(x, n, { score })).toEqual(propTrendTest(x, n, score));
    expect(propTrendTest(x, n, Float64Array.from(score))).toEqual(propTrendTest(x, n, score));
    expect(propTrendTest(x, n, {})).toEqual(propTrendTest(x, n));
    both(() => (propTrendTest as (...a: unknown[]) => unknown)(x, n, score, { score }), "score");
  });

  it("splinefun's function: deriv", () => {
    for (const method of ["fmm", "natural", "monoH.FC"] as const) {
      const s = splinefun([1, 2, 3, 4], [1, 4, 9, 16], { method });
      expect(s([2.5], { deriv: 1 })).toEqual(s([2.5], 1));
      expect(s([2.5], {})).toEqual(s([2.5]));
      both(() => (s as (...a: unknown[]) => unknown)([2.5], 1, { deriv: 2 }), "deriv");
    }
    // knots whose range overflows (the scaled path)
    const big = splinefun([1e307, 4e307, 9e307, 1.6e308], [1, 4, 9, 16]);
    expect(big([5e307], { deriv: 1 })).toEqual(big([5e307], 1));
  });
});
