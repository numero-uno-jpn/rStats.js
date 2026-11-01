// External review of the negative binomial and hypergeometric distributions (review_fix_log_20261031_55.md).
import { describe, expect, it } from "vitest";
import { dhyper, dnbinom, dpois, pbinom, pnbinom, ppois, qnbinom } from "../src/index.js";

describe("review 55", () => {
  it("DIST-006: pnbinom where x + 1 rounds to x", () => {
    // NB(r, 1/2) with an integer r: P[X <= r] = 1/2 + P[X = r] (0.5 before; R too)
    const want = 0.5 + dnbinom(1e16, 1e16, { prob: 0.5 });
    expect(pnbinom(1e16, 1e16, { prob: 0.5 })).toBe(want);
    expect(pnbinom(1e16, 1e16, { prob: 0.5, lowerTail: false })).toBeCloseTo(1 - want, 15);
    expect(Math.exp(pnbinom(1e16, 1e16, { prob: 0.5, logP: true })) / want - 1).toBeCloseTo(0, 14);
    expect(qnbinom(0.5, 1e16, { prob: 0.5 })).toBe(1e16); // 2 below before (R: 1e16)
    // below 2^53 as before
    expect(pnbinom(1e15, 1e15, { prob: 0.5 })).toBe(0.5000000089206206);
  });

  it("x + 1 that rounds up to x + 2 (1e16 - 2 + 1 is 1e16), also in ppois and pbinom (round 54)", () => {
    // the test x + 1 === x missed it, and the old path took the parameter x + 2
    const x = 1e16 - 2;
    expect(ppois(x, 1e16)).toBe(ppois(1e16, 1e16) - dpois(1e16, 1e16) - dpois(1e16 - 1, 1e16));
    expect(pbinom(x, 2e16, 0.5)).toBeLessThan(0.5);
    expect(pnbinom(x, 1e16, { prob: 0.5 })).toBeLessThan(0.5);
  });

  it("deep upper tails beyond 2^53, where the term is not resolved against the tail (regression of round 54)", () => {
    // the logs of the tail and of the term round to the same value: the difference was -Infinity or NaN
    expect(ppois(1e20, 1e16, { lowerTail: false, logP: true })).toBe(-821044037197618200000);
    expect(pbinom(1.9e16, 2e16, 0.5, { lowerTail: false, logP: true })).toBe(-9892638744281478);
    const [y, size, prob] = [6.662294020361651e91, 3.3479193877814253, 5.311648844360781e-44];
    expect(Number.isFinite(pnbinom(y, size, { prob, lowerTail: false, logP: true }))).toBe(true);
  });

  it("DIST-008: dnbinom where size + x overflows is NaN with and without log", () => {
    // 0 (and NaN with log) before; the density is not computed there (round 22), as pnbinom
    expect(dnbinom(1e308, 1e308, { prob: 0.5 })).toBeNaN();
    expect(dnbinom(1e308, 1e308, { prob: 0.5, log: true })).toBeNaN();
    expect(pnbinom(1e308, 1e308, { prob: 0.5 })).toBeNaN();
    // where size + x is finite as before
    expect(dnbinom(1e300, 1e300, { prob: 0.5, log: true })).toBe(-346.6532760725914);
  });

  it("DIST-007 (recorded): dhyper where m + n overflows stays NaN, as phyper beyond 2^53", () => {
    expect(dhyper(5e299, 1e308, 1e308, 1e300)).toBeNaN();
  });
});
