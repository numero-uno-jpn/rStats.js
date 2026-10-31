// Fixes of the 17th review round (review_fix_log_20261031_17.md): the mathematically right values where R 4.5.2
// gives a wrong or inconsistent one.
import { describe, expect, it } from "vitest";
import { dweibull, pbeta, pt, qnbinom, qt } from "../src/index.js";

describe("review 17", () => {
  it("qt with ncp = ±Inf is ±Inf inside (0, 1), as pt is 0 or 1 at every finite t", () => {
    expect(qt(0.5, 10, { ncp: Infinity })).toBe(Infinity);
    expect(qt(0.5, 10, { ncp: -Infinity })).toBe(-Infinity);
    expect(qt(0.5, Infinity, { ncp: Infinity })).toBe(Infinity);
    expect(pt(1, 10, { ncp: Infinity })).toBe(0);
  });
  it("pbeta is 0 left of the support, point masses at 0 included", () => {
    expect(pbeta(-1, 0, 2)).toBe(0);
    expect(pbeta(-1, 0, 0)).toBe(0);
    expect(pbeta(0, 0, 2)).toBe(1);
    expect(pbeta(0, 0, 0)).toBe(0.5);
  });
  it("qnbinom with a negative size or mu is NaN, as dnbinom and pnbinom", () => {
    expect(qnbinom(0.5, -1, { mu: 0 })).toBeNaN();
    expect(qnbinom(0.5, 0, { mu: -1 })).toBeNaN();
    expect(qnbinom(0.5, 2, { mu: 0 })).toBe(0);
  });
  it("dweibull with scale = Inf is 0 at a finite x > 0", () => {
    expect(dweibull(1, 0.5, { scale: Infinity })).toBe(0);
    expect(dweibull(1, 0.5, { scale: Infinity, log: true })).toBe(-Infinity);
  });
});
