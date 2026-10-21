import { dbeta, pbeta, qbeta } from "../src/index.js";
import { bool, num } from "./helpers/fixture.js";
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
