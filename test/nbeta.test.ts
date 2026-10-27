import { describe, expect, it } from "vitest";
import { dbeta, pbeta, qbeta } from "../src/index.js";
import { bool, num, relativeError } from "./helpers/fixture.js";
import { fixtureSuite } from "./helpers/suite.js";

// Noncentral beta distribution (when ncp is given)
const opts = (a: Record<string, string | boolean>) => ({
  ncp: num(a.ncp),
  lowerTail: bool(a.lowerTail),
  logP: bool(a.logP),
});

fixtureSuite({
  name: "dnbeta",
  tolerance: 1e-14,
  density: true,
  call: (a) => dbeta(num(a.x), num(a.shape1), num(a.shape2), { ncp: num(a.ncp), log: bool(a.log) }),
});
fixtureSuite({
  name: "pnbeta",
  tolerance: 1e-14,
  call: (a) => pbeta(num(a.q), num(a.shape1), num(a.shape2), opts(a)),
});
fixtureSuite({
  name: "qnbeta",
  tolerance: 1e-14,
  // With an infinite parameter R returns 0, 0.5 or 1 (it searches while the CDF stays NaN). We return NaN
  knownDifference: (a, _e, x) =>
    Number.isNaN(x) && ![a.shape1, a.shape2, a.ncp].every((v) => Number.isFinite(num(v)))
      ? "infinite parameter: R returns an intermediate value of its search"
      : undefined,
  call: (a) => qbeta(num(a.p), num(a.shape1), num(a.shape2), opts(a)),
  backward: (a, x) => pbeta(x, num(a.shape1), num(a.shape2), opts(a)),
});

describe("noncentral beta: regressions", () => {
  it("gives 1 for an upper-tail quantile beyond the largest double below 1 (these threw TypeError)", () => {
    // A tiny p with a small shape2: P[X > x] is still above p at x = 1 - 2^-53, so the answer is 1
    for (const [p, a, b, ncp] of [
      [1.2066869150839893e-270, 0.031616179278943515, 0.2793791077635366, 0.6460099483845458],
      [3.976297326742368e-86, 0.29917959692439394, 0.014605186447542447, 1],
      [1.0672001223561913e-146, 0.2044317355987288, 0.03536673333921324, 8.073418284076341],
    ] as const) {
      expect(qbeta(p, a, b, { ncp, lowerTail: false })).toBe(1);
      expect(pbeta(1 - 2 ** -53, a, b, { ncp, lowerTail: false })).toBeGreaterThan(p);
      expect(qbeta(Math.log(p), a, b, { ncp, lowerTail: false, logP: true })).toBe(1);
    }
  });

  it("returns at a huge ncp (these did not return)", () => {
    // λ = 1.2e22: 1 - X is about W/λ, below the double resolution of 1, so the lower-tail quantile is 1
    const [a, b, ncp] = [79.32204890240992, 0.09403994879604119, 1.245630132105305e22];
    expect(qbeta(5.3577955561017315e-43, a, b, { ncp })).toBe(1);
    expect(pbeta(1 - 2 ** -53, a, b, { ncp, logP: true })).toBeLessThan(Math.log(5.3577955561017315e-43));
    // λ = 2e9: P[X <= x] = P[W >= Y k], k = (1 - x)/x, near the mean of Y: P[χ²_4 >= 2e9 k] = e^-t (1 + t), t = 1e9 k
    const k = 1e-8 / (1 - 1e-8);
    const t = 1e9 * k;
    expect(Math.abs((pbeta(1 - 1e-8, 1, 2, { ncp: 2e9 }) as number) / (Math.exp(-t) * (1 + t)) - 1)).toBeLessThan(1e-3);
  });
});

describe("noncentral beta: tails", () => {
  it("builds the larger tail as 1 - (smaller) (1.0000000000000002 before)", () => {
    const [x, a, b, ncp] = [9.867288258188533e-299, 0.5, 0.4399301350869252, 287.25848611940876];
    const upper = pbeta(x, a, b, { ncp, lowerTail: false }) as number;
    expect(upper).toBeLessThanOrEqual(1);
    expect(upper).toBe(1 - (pbeta(x, a, b, { ncp }) as number));
  });

  it("sums the far left tail at a large λ as -λ/2 + log Σ (λ/2)^j/j! I_x(a + j, b) (mpmath)", () => {
    // the integral gave -10000042.979 at x = 1e-7
    for (const [x, ref] of [
      [1e-7, -10000042.951131284],
      [1e-30, -10000203.677310308],
      [4.99e-6, -9999973.74985535],
    ] as const) {
      expect(relativeError(pbeta(x, 3, 5, { ncp: 2e7, logP: true }) as number, ref)).toBeLessThanOrEqual(1e-15);
    }
  });

  it("gives log P = -(λ/2)(1 - x) to leading order where λ is huge (-Infinity, or below -λ/2, before)", () => {
    for (const [x, a, b, ncp] of [
      [4.221933697964338e-14, 505.3925056171359, 1621.708212160233, 6.732843944580593e295],
      [2.602014683577338e-234, 2, 1887.4890229242255, 1.531785102266383e218],
      [0.12485740100964904, 178.5166557908405, 461.69685003899446, 18428991667705106000],
    ] as const) {
      // (the rest is of order (a + b) log λ: 2e4 against 8e18 in the last)
      expect(relativeError(pbeta(x, a, b, { ncp, logP: true }) as number, -(ncp / 2) * (1 - x))).toBeLessThanOrEqual(1e-14);
    }
  });

  it("gives the density at tiny shapes and x (NaN before: the ratio of the terms underflowed)", () => {
    const [x, a, b, ncp] = [1.4930968104424972e-218, 4.994551015409567e-269, 1.00296357719376e-118, 4.248780725227059];
    const ref = Math.exp(-ncp / 2) * (dbeta(x, a, b) as number);
    expect(relativeError(dbeta(x, a, b, { ncp }) as number, ref)).toBeLessThanOrEqual(1e-13);
  });
});
