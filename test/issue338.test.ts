// Issue #338: plaplace and dlaplace with q (x) and the location mu the same infinity returned 0 or 1 (0 for the
// density). q - mu is Inf - Inf and the limit depends on which goes first: NaN, as in extraDistr (R 4.5.2) and as
// pnorm, plogis and pcauchy. Opposite infinities and a finite q keep the limit.
import { describe, expect, it } from "vitest";
import { dlaplace, plaplace } from "../src/distributions/laplace.js";

describe("issue #338: plaplace / dlaplace with q = mu = ±Inf", () => {
  it("returns NaN for the same infinity in every tail and scale", () => {
    for (const v of [-Infinity, Infinity])
      for (const lowerTail of [true, false])
        for (const logP of [false, true]) expect(plaplace(v, { mu: v, lowerTail, logP })).toBeNaN();
    expect(dlaplace(Infinity, { mu: Infinity })).toBeNaN();
    expect(dlaplace(-Infinity, { mu: -Infinity, log: true })).toBeNaN();
  });

  it("keeps the limits for opposite infinities and finite q (extraDistr's values)", () => {
    expect(plaplace(Infinity, { mu: -Infinity })).toBe(1);
    expect(plaplace(-Infinity, { mu: Infinity })).toBe(0);
    expect(plaplace(-Infinity, { mu: Infinity, lowerTail: false, logP: true })).toBe(0);
    expect(plaplace(0, { mu: Infinity })).toBe(0);
    expect(plaplace(0, { mu: -Infinity })).toBe(1);
    expect(dlaplace(-Infinity, { mu: Infinity })).toBe(0);
    expect(dlaplace(Infinity, { mu: -Infinity, log: true })).toBe(-Infinity);
  });
});
