import { describe, expect, it } from "vitest";
import { dnorm, pnorm } from "../src/index.js";
import { dunif, punif, qunif } from "../src/distributions/uniform.js";
import { dexp, pexp, qexp } from "../src/distributions/exponential.js";
import { dlnorm, plnorm, qlnorm } from "../src/distributions/lognormal.js";
import { dlogis, plogis, qlogis } from "../src/distributions/logistic.js";
import { dcauchy, pcauchy, qcauchy } from "../src/distributions/cauchy.js";
import { dweibull, pweibull, qweibull } from "../src/distributions/weibull.js";
import { bool, num, relativeError } from "./helpers/fixture.js";
import { fixtureSuite } from "./helpers/suite.js";

type Args = Record<string, string | boolean>;
const tail = (a: Args) => ({ lowerTail: bool(a.lowerTail), logP: bool(a.logP) });
const unif = (a: Args) => ({ min: num(a.min), max: num(a.max) });
const ls = (a: Args) => ({ location: num(a.location), scale: num(a.scale) });
const lnp = (a: Args) => ({ meanlog: num(a.meanlog), sdlog: num(a.sdlog) });

/** max - min overflows in double precision (e.g. min = -1e308, max = 1e308). R returns Inf, 0 or NaN (docs/differences-from-r.md) */
const rangeOverflow = (a: Args) => {
  const [lo, hi] = [num(a.min), num(a.max)];
  return Number.isFinite(lo) && Number.isFinite(hi) && !Number.isFinite(hi - lo)
    ? "max - min overflows (R returns Inf, 0 or NaN)"
    : undefined;
};

fixtureSuite({
  name: "dunif",
  tolerance: 1e-14,
  knownDifference: rangeOverflow,
  density: true,
  call: (a) => dunif(num(a.x), { ...unif(a), log: bool(a.log) }),
});
fixtureSuite({
  name: "punif",
  tolerance: 1e-14,
  knownDifference: rangeOverflow,
  call: (a) => punif(num(a.q), { ...unif(a), ...tail(a) }),
});
fixtureSuite({
  name: "qunif",
  tolerance: 1e-14,
  knownDifference: rangeOverflow,
  call: (a) => qunif(num(a.p), { ...unif(a), ...tail(a) }),
  backward: (a, x) => punif(x, { ...unif(a), ...tail(a) }),
});

fixtureSuite({
  name: "dexp",
  tolerance: 1e-14,
  density: true,
  call: (a) => dexp(num(a.x), { rate: num(a.rate), log: bool(a.log) }),
});
fixtureSuite({
  name: "pexp",
  tolerance: 1e-14,
  call: (a) => pexp(num(a.q), { rate: num(a.rate), ...tail(a) }),
});
fixtureSuite({
  name: "qexp",
  tolerance: 1e-14,
  call: (a) => qexp(num(a.p), { rate: num(a.rate), ...tail(a) }),
  backward: (a, x) => pexp(x, { rate: num(a.rate), ...tail(a) }),
});

fixtureSuite({
  name: "dlnorm",
  tolerance: 1e-14,
  density: true,
  call: (a) => dlnorm(num(a.x), { ...lnp(a), log: bool(a.log) }),
});
fixtureSuite({
  name: "plnorm",
  tolerance: 1e-14,
  call: (a) => plnorm(num(a.q), { ...lnp(a), ...tail(a) }),
});
fixtureSuite({
  name: "qlnorm",
  tolerance: 1e-14,
  call: (a) => qlnorm(num(a.p), { ...lnp(a), ...tail(a) }),
  backward: (a, x) => plnorm(x, { ...lnp(a), ...tail(a) }),
});

fixtureSuite({
  name: "dlogis",
  tolerance: 1e-14,
  density: true,
  call: (a) => dlogis(num(a.x), { ...ls(a), log: bool(a.log) }),
});
fixtureSuite({
  name: "plogis",
  tolerance: 1e-14,
  call: (a) => plogis(num(a.q), { ...ls(a), ...tail(a) }),
});
fixtureSuite({
  name: "qlogis",
  tolerance: 1e-14,
  call: (a) => qlogis(num(a.p), { ...ls(a), ...tail(a) }),
  backward: (a, x) => plogis(x, { ...ls(a), ...tail(a) }),
});

fixtureSuite({
  name: "dcauchy",
  tolerance: 1e-14,
  density: true,
  call: (a) => dcauchy(num(a.x), { ...ls(a), log: bool(a.log) }),
});
fixtureSuite({
  name: "pcauchy",
  tolerance: 1e-14,
  call: (a) => pcauchy(num(a.q), { ...ls(a), ...tail(a) }),
});
fixtureSuite({
  name: "qcauchy",
  tolerance: 1e-14,
  call: (a) => qcauchy(num(a.p), { ...ls(a), ...tail(a) }),
  backward: (a, x) => pcauchy(x, { ...ls(a), ...tail(a) }),
});

fixtureSuite({
  name: "dweibull",
  tolerance: 1e-14,
  // When (x/scale)^shape overflows, R computes the log density as -Inf + Inf and returns NaN (the true value is -Inf)
  knownDifference: (a, e, x) =>
    a.log === true && Number.isNaN(e) && x === -Infinity ? "R's log density is ∞ - ∞ = NaN" : undefined,
  density: true,
  call: (a) => dweibull(num(a.x), num(a.shape), { scale: num(a.scale), log: bool(a.log) }),
});
fixtureSuite({
  name: "pweibull",
  tolerance: 1e-14,
  call: (a) => pweibull(num(a.q), num(a.shape), { scale: num(a.scale), ...tail(a) }),
});
fixtureSuite({
  name: "qweibull",
  tolerance: 1e-14,
  call: (a) => qweibull(num(a.p), num(a.shape), { scale: num(a.scale), ...tail(a) }),
  backward: (a, x) => pweibull(x, num(a.shape), { scale: num(a.scale), ...tail(a) }),
});

// Extreme arguments that used to throw or give NaN or values out of range (found by distributionProperties.test.ts).
// Expected values from closed forms
describe("extreme arguments", () => {
  it("weibull: x / scale under- or overflowing, huge shape", () => {
    expect(dweibull(1e-300, 2, { scale: 1e100 })).toBe(0);
    // log f = log(shape / scale) + (shape - 1) log u - u^shape, u^shape negligible
    const ld = Math.LN2 - Math.log(1e100) + (Math.log(1e-300) - Math.log(1e100));
    expect(relativeError(dweibull(1e-300, 2, { scale: 1e100, log: true }), ld)).toBeLessThan(1e-14);
    // (x / scale)^0.5 with x subnormal: P = t (1 - t / 2) with t = 1.4e-162
    expect(relativeError(pweibull(2e-323, 0.5, { scale: 10 }), Math.sqrt(2e-323) / Math.sqrt(10))).toBeLessThan(1e-14);
    // (x / scale)^1e-20 is 1 to 1e-17: exp(-1)
    expect(relativeError(pweibull(1.7e308, 1e-20, { scale: 0.1, lowerTail: false }), Math.exp(-1))).toBeLessThan(1e-14);
    const big = { scale: 8.670866844656034e208, lowerTail: false };
    expect(relativeError(pweibull(1.7976931348623157e308, 2.679195818301863e-39, big), Math.exp(-1))).toBeLessThan(1e-14);
    expect(dweibull(1.2e-293, 6.8e254, { scale: 2.6e-293 })).toBe(0);
    // log P = shape log(x / scale) where (x / scale)^shape is subnormal
    const x = 1.0806026394113126e-157;
    const s = 639.1605591752661;
    expect(relativeError(pweibull(x, 2, { scale: s, logP: true }), 2 * (Math.log(x) - Math.log(s)))).toBeLessThan(1e-14);
    // scale p^2 (-log1p(-p) = p), subnormal: within one step of the subnormal spacing
    const p = 2.0873605415528046e-162;
    expect(Math.abs(qweibull(p, 0.5, { scale: 379.78228278051154 }) - 379.78228278051154 * p * p)).toBeLessThanOrEqual(5e-324);
  });

  it("normal: (x - mean) / sd near the overflow threshold", () => {
    const o = { mean: -304.67, sd: 1.12e-17 };
    expect(pnorm(1.68e291, o)).toBe(1);
    expect(pnorm(1.68e291, { ...o, lowerTail: false })).toBe(0);
    expect(dnorm(1.68e291, o)).toBe(0);
  });

  it("qlnorm: meanlog + sdlog z overflowing", () => {
    expect(qlnorm(1e-7, { sdlog: 1e100, lowerTail: false })).toBe(Infinity);
    expect(qlnorm(1e-7, { sdlog: 1e100 })).toBe(0);
  });

  it("qunif: the upper tail as max - p (max - min)", () => {
    expect(qunif(3.7e-216, { min: -1, max: 0, lowerTail: false })).toBe(-3.7e-216);
    expect(punif(-3.7e-216, { min: -1, max: 0, lowerTail: false })).toBe(3.7e-216);
  });
});
