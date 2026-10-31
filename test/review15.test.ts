// Fixes of the 15th review round (review_fix_log_20261031_15.md).
import { describe, expect, it } from "vitest";
import { chisqTest, glm, glmAnova, ksTest, survdiff } from "../src/index.js";

describe("survdiff", () => {
  it("a subject censored at Infinity is at risk throughout; an event at Infinity is an error", () => {
    const g = ["A", "A", "B", "B"];
    const inf = survdiff([1, 3, Infinity, 2], [1, 1, 0, 1], g);
    const big = survdiff([1, 3, 1e6, 2], [1, 1, 0, 1], g);
    expect(inf.chisq).toBeCloseTo(big.chisq, 14);
    expect(() => survdiff([1, 3, Infinity, 2], [1, 1, 1, 1], g)).toThrow("event times must be finite");
  });
  it("a singular variance matrix: the generalized inverse on rank(V) degrees of freedom", () => {
    // everyone fails at once: no information on the groups (R stops: "system is exactly singular")
    const r = survdiff([1, 1], [1, 1], ["A", "B"]);
    expect(r.chisq).toBe(0);
    expect(r.df).toBe(0);
    expect(r.pvalue).toBeNaN();
    // a full-rank case keeps its usual degrees of freedom
    expect(survdiff([1, 2, 3, 4, 5, 6], [1, 1, 0, 1, 1, 1], ["A", "B", "A", "B", "C", "C"]).df).toBe(2);
  });
});

describe("input checks", () => {
  it("chisqTest rejects an infinite count", () => {
    expect(() => chisqTest([Infinity, 10])).toThrow("non-negative and finite");
  });
  it("ksTest rejects a distribution function outside [0, 1]", () => {
    expect(() => ksTest([0.1, 0.5, 0.9], () => 1.5)).toThrow("not a value in [0, 1]");
    expect(() => ksTest([0.1, 0.5, 0.9], () => NaN)).toThrow("not a value in [0, 1]");
  });
  it("glm rejects an infinite offset; glmAnova rejects fits of different families", () => {
    expect(() => glm([1, 2, 3], [2, 4, 6.5], { offset: [0, Infinity, 0] })).toThrow("the offset must be finite");
    const x = [1, 2, 3, 4, 5, 6];
    const y = [1, 3, 2, 5, 4, 6];
    expect(() => glmAnova([glm(x, y), glm(x, y, { family: "poisson" })])).toThrow("same family and link");
  });
});
