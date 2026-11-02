// Issue #92: extraDistr's random generators with an infinite parameter (review_fix_log_issue92.md). An infinite shape
// a or alpha gives the limit, as the quantile functions do (the values and the uniforms drawn are extraDistr's); an
// infinite b or beta is NaN, as the density, distribution and quantile functions, after the uniforms extraDistr draws.
// The expected values and draws are extraDistr 1.10.0.5's (R 4.5.2, set.seed(1)).
import { describe, expect, it } from "vitest";
import { rinvgamma, rkumar, rpareto, runif, setSeed } from "../src/index.js";

setSeed(1);
const u = runif(3);

/** The values and the number of uniforms drawn (from the next uniform) */
function run(f: () => number[]): { values: number[]; drawn: number } {
  setSeed(1);
  const values = f();
  return { values, drawn: u.indexOf(runif(1)[0]!) };
}

describe("issue #92", () => {
  it("takes an infinite shape as the limit, as the quantile functions", () => {
    expect(run(() => rkumar(2, Infinity, 2))).toEqual({ values: [1, 1], drawn: 2 });
    expect(run(() => rpareto(2, { a: Infinity, b: 2 }))).toEqual({ values: [2, 2], drawn: 2 });
    expect(run(() => rinvgamma(2, Infinity, { beta: 3 }))).toEqual({ values: [0, 0], drawn: 0 });
  });

  it("is NaN for an infinite b or beta, drawing what extraDistr draws", () => {
    // extraDistr: 0 (kumar), Inf (pareto, invgamma)
    expect(run(() => rkumar(2, 2, Infinity))).toEqual({ values: [NaN, NaN], drawn: 2 });
    expect(run(() => rkumar(2, Infinity, Infinity))).toEqual({ values: [NaN, NaN], drawn: 2 });
    expect(run(() => rpareto(2, { a: 2, b: Infinity }))).toEqual({ values: [NaN, NaN], drawn: 2 });
    expect(run(() => rpareto(2, { a: Infinity, b: Infinity }))).toEqual({ values: [NaN, NaN], drawn: 2 });
    expect(run(() => rinvgamma(2, 3, { beta: Infinity }))).toEqual({ values: [NaN, NaN], drawn: 0 });
    expect(run(() => rinvgamma(2, Infinity, { beta: Infinity }))).toEqual({ values: [NaN, NaN], drawn: 0 });
  });

  it("draws nothing for an invalid parameter", () => {
    expect(run(() => rkumar(2, -1, Infinity))).toEqual({ values: [NaN, NaN], drawn: 0 });
    expect(run(() => rpareto(2, { a: NaN, b: Infinity }))).toEqual({ values: [NaN, NaN], drawn: 0 });
    expect(run(() => rinvgamma(2, -1, { beta: Infinity }))).toEqual({ values: [NaN, NaN], drawn: 0 });
  });
});
