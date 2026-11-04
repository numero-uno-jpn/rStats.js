// Revision of review 24: the Laplace distribution with sigma = Inf is the limit, as the normal, logistic and Cauchy
// distributions (review_fix_log_20261031_24_rev.md). extraDistr 1.10 (R 4.5.2) gives the same values except
// qlaplace(0.5, mu, Inf), NaN there.
import { describe, expect, it } from "vitest";
import { dlaplace, plaplace, qlaplace, rlaplace, runif, setSeed } from "../src/index.js";

const S = { mu: 0, sigma: Infinity };

describe("review 24 revision: Laplace with sigma = Inf", () => {
  it("dlaplace is 0 at a finite x (log -Inf), NaN at an infinite x", () => {
    expect(dlaplace([-1, 0, 1], S)).toEqual([0, 0, 0]);
    expect(dlaplace(1, { ...S, log: true })).toBe(-Infinity);
    expect(dlaplace([Infinity, -Infinity], S)).toEqual([NaN, NaN]);
  });
  it("plaplace is 1/2 at a finite x in both tails (log -log 2), NaN at an infinite x", () => {
    expect(plaplace([-1, 0, 1], S)).toEqual([0.5, 0.5, 0.5]);
    expect(plaplace(1, { ...S, lowerTail: false, logP: true })).toBe(-Math.LN2);
    expect(plaplace(1, { ...S, logP: true })).toBe(-Math.LN2);
    expect(plaplace([Infinity, -Infinity], S)).toEqual([NaN, NaN]);
  });
  it("qlaplace is -Inf below 1/2, mu at 1/2 and Inf above", () => {
    expect(qlaplace([0, 0.3, 0.5, 0.7, 1], S)).toEqual([-Infinity, -Infinity, 0, Infinity, Infinity]);
    expect(qlaplace(0.5, { mu: 3, sigma: Infinity })).toBe(3);
    expect(qlaplace(Math.log(0.5), { mu: 3, sigma: Infinity, logP: true })).toBe(3);
    expect(qlaplace(Math.log(0.3), { ...S, logP: true })).toBe(-Infinity);
    expect(qlaplace(0.3, { ...S, lowerTail: false })).toBe(Infinity);
  });
  it("an infinite mu with sigma = Inf stays NaN (extraDistr NaN)", () => {
    expect(dlaplace(1, { mu: Infinity, sigma: Infinity })).toBeNaN();
    expect(plaplace(1, { mu: -Infinity, sigma: Infinity })).toBeNaN();
    expect(qlaplace(0.3, { mu: Infinity, sigma: Infinity })).toBeNaN();
  });
  it("rlaplace gives extraDistr's -Inf and Inf with its draws (set.seed(1))", () => {
    setSeed(1);
    const u = runif(5);
    setSeed(1);
    expect(rlaplace(2, { mu: 3, sigma: Infinity })).toEqual([-Infinity, Infinity]);
    expect(runif(1)[0]).toBe(u[4]);
  });
});
