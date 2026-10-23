import { describe, expect, it } from "vitest";
import { dgeom, pgeom, qgeom } from "../src/distributions/geometric.js";
import { dnbinom, pnbinom, qnbinom } from "../src/distributions/negbinomial.js";
import { bool, num } from "./helpers/fixture.js";
import { fixtureSuite } from "./helpers/suite.js";

type Args = Record<string, string | boolean>;
const tail = (a: Args) => ({ lowerTail: bool(a.lowerTail), logP: bool(a.logP) });

/** When a linear-scale p is extremely close to 1, R's decision depends on the rounding of 1 - p (docs/differences-from-r.md) */
const nearOne = (a: Args) =>
  !a.logP && num(a.p) > 0.5 && 1 - num(a.p) < 1e-12 ? "p is close to 1 and R's decision is determined by rounding" : undefined;

/**
 * Negative binomial quantiles where we intentionally differ from R (docs/differences-from-r.md).
 * cdf is the distribution function on the same scale as the input p.
 * - The answer exceeds 2^53: neighbouring integers are not representable, so "the smallest integer" is
 *   not well defined. We pass if the CDF at our answer is closer to p than the CDF at R's answer
 *   (R drifts far from the target here)
 * - Many integers fall within the rounding width of p (the CDF is extremely flat, e.g. tiny size): if the
 *   CDF at both answers is within 16 ε of p (relative 4 ε on the log scale), both are correct to the
 *   precision of p
 */
const nbQuantileDifference = (
  a: Args,
  e: number,
  x: number,
  cdf: (y: number, lowerTail: boolean) => number,
): string | undefined => {
  const near = nearOne(a);
  if (near) return near;
  if (!Number.isFinite(e) || !Number.isFinite(x)) return undefined;
  const p = num(a.p);
  const lower = bool(a.lowerTail);
  // For linear p > 1/2, compare the small complementary probability (differences between probabilities near 1 are lost to rounding)
  const flip = !a.logP && p > 0.5;
  const target = flip ? 1 - p : p;
  const dev = (y: number) => Math.abs(cdf(y, flip ? !lower : lower) - target);
  if (Math.max(e, x) > 2 ** 53) {
    if (Math.abs(x - e) <= 4 * Number.EPSILON * Math.max(e, x)) return "answer exceeds 2^53; neighbouring integers are not representable (a few ulp apart)";
    if (dev(x) <= dev(e)) return "answer exceeds 2^53; the CDF at R's answer is further from p";
  }
  const band = a.logP ? 4 * Number.EPSILON * Math.abs(p) : 16 * Number.EPSILON;
  if (dev(x) <= band && dev(e) <= band) return "flat CDF: many integers fall within the rounding width of p";
  return undefined;
};

fixtureSuite({
  name: "dgeom",
  tolerance: 1e-14,
  density: true,
  call: (a) => dgeom(num(a.x), num(a.prob), { log: bool(a.log) }),
});
fixtureSuite({
  name: "pgeom",
  tolerance: 1e-14,
  call: (a) => pgeom(num(a.q), num(a.prob), tail(a)),
});
fixtureSuite({
  name: "qgeom",
  tolerance: 0,
  discreteCdf: (a, y, lg) => pgeom(y, num(a.prob), { lowerTail: bool(a.lowerTail), logP: lg ?? bool(a.logP) }),
  knownDifference: nearOne,
  call: (a) => qgeom(num(a.p), num(a.prob), tail(a)),
});

fixtureSuite({
  name: "dnbinom",
  tolerance: 1e-14,
  density: true,
  // With size = Inf (prob < 1) the probability is 0. R returns the log as the overflowed finite value of size log(prob) (e.g. -1.2e308)
  // For size = Inf, prob = 1, log P[X = 0] = log 1, which R computes as Inf × 0 = NaN
  knownDifference: (a, e, x) => {
    if (a.size !== "Inf" || a.log !== true) return undefined;
    if (x === -Infinity && e < -1e100) return "size = Inf: R returns the log probability as a huge finite value";
    if (x === 0 && Number.isNaN(e)) return "size = Inf, prob = 1: R returns NaN for the log probability";
    return undefined;
  },
  call: (a) => dnbinom(num(a.x), num(a.size), { prob: num(a.prob), log: bool(a.log) }),
});
fixtureSuite({
  name: "pnbinom",
  tolerance: 1e-14,
  call: (a) => pnbinom(num(a.q), num(a.size), { prob: num(a.prob), ...tail(a) }),
});
fixtureSuite({
  name: "qnbinom",
  tolerance: 0,
  discreteCdf: (a, y, lg) =>
    pnbinom(y, num(a.size), { prob: num(a.prob), lowerTail: bool(a.lowerTail), logP: lg ?? bool(a.logP) }),
  knownDifference: (a, e, x) => {
    if (a.size === "Inf" && Number.isNaN(e) && x === Infinity) return "size = Inf: R returns NaN (the mass is at X = ∞, so Inf)";
    return nbQuantileDifference(a, e, x, (y, l) => pnbinom(y, num(a.size), { prob: num(a.prob), lowerTail: l, logP: bool(a.logP) }));
  },
  call: (a) => qnbinom(num(a.p), num(a.size), { prob: num(a.prob), ...tail(a) }),
});

fixtureSuite({
  name: "dnbinom_mu",
  tolerance: 1e-14,
  density: true,
  call: (a) => dnbinom(num(a.x), num(a.size), { mu: num(a.mu), log: bool(a.log) }),
});
fixtureSuite({
  name: "pnbinom_mu",
  tolerance: 1e-14,
  call: (a) => pnbinom(num(a.q), num(a.size), { mu: num(a.mu), ...tail(a) }),
});
fixtureSuite({
  name: "qnbinom_mu",
  tolerance: 0,
  discreteCdf: (a, y, lg) =>
    pnbinom(y, num(a.size), { mu: num(a.mu), lowerTail: bool(a.lowerTail), logP: lg ?? bool(a.logP) }),
  knownDifference: (a, e, x) =>
    nbQuantileDifference(a, e, x, (y, l) => pnbinom(y, num(a.size), { mu: num(a.mu), lowerTail: l, logP: bool(a.logP) })),
  call: (a) => qnbinom(num(a.p), num(a.size), { mu: num(a.mu), ...tail(a) }),
});

/**
 * q beyond 2^53, outside the fixture grid (qnbinom reaches it). The continued fraction used to stop advancing
 * its coefficients there, and a subnormal intermediate cost digits. Reference values from mpmath (40-800 digits:
 * quadrature of the beta density around its mode, and the hypergeometric form of I_p(size, q + 1))
 */
describe("pnbinom with q beyond 2^53", () => {
  const cases: [number, number, { prob?: number; mu?: number }, boolean, number][] = [
    [100010668931481120, 1e7, { prob: 1e-10 }, true, -1.0000000000051135],
    [100020289663207340, 1e7, { prob: 1e-10 }, true, -1.3449942879141902],
    [6612540300287293000, 1e-10, { mu: 1e6 }, true, -690.77552789821303],
    [6612540300287293000, 1e-10, { mu: 1e6 }, false, 1.0000000000006706e-300],
  ];
  it("matches the reference values", () => {
    for (const [q, size, par, logP, ref] of cases) {
      const x = pnbinom(q, size, { ...par, lowerTail: false, logP });
      expect(Math.abs(x - ref) / Math.abs(ref), `pnbinom(${q}, ${size}, ${JSON.stringify(par)})`).toBeLessThan(1e-13);
    }
  });
});
