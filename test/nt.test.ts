import { dt, pt, qt } from "../src/index.js";
import { bool, num } from "./helpers/fixture.js";
import { fixtureSuite } from "./helpers/suite.js";

// Noncentral t distribution (when ncp is given)
// The tolerance for the density and CDF is 1e-13. In the deep tails (below 1e-50) the exponents at the
// quadrature nodes of the integral (src/distributions/nt.ts) reach several hundred, and the difference from
// the reference values grows to just under 1e-13 (about 1e-15 near the centre)
const NT_TOL = 1e-13;
const opts = (a: Record<string, string | boolean>) => ({
  ncp: num(a.ncp),
  lowerTail: bool(a.lowerTail),
  logP: bool(a.logP),
});

fixtureSuite({
  name: "dnt",
  tolerance: NT_TOL,
  density: true,
  call: (a) => dt(num(a.x), num(a.df), { ncp: num(a.ncp), log: bool(a.log) }),
});
fixtureSuite({
  name: "pnt",
  tolerance: NT_TOL,
  call: (a) => pt(num(a.q), num(a.df), opts(a)),
});
fixtureSuite({
  name: "qnt",
  tolerance: 1e-14,
  // The quantile is undefined for ncp = Inf. R returns NaN or ±Inf depending on p. We return NaN
  knownDifference: (a, _e, x) =>
    Number.isNaN(x) && !Number.isFinite(num(a.ncp)) && !Number.isNaN(num(a.ncp)) ? "ncp = Inf: R returns ±Inf" : undefined,
  call: (a) => qt(num(a.p), num(a.df), opts(a)),
  backward: (a, x) => pt(x, num(a.df), opts(a)),
});
