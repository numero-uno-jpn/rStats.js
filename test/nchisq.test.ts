import { dchisq, pchisq, qchisq } from "../src/index.js";
import { bool, num } from "./helpers/fixture.js";
import { fixtureSuite } from "./helpers/suite.js";

// Noncentral χ² distribution (when ncp is given)
const opts = (a: Record<string, string | boolean>) => ({
  ncp: num(a.ncp),
  lowerTail: bool(a.lowerTail),
  logP: bool(a.logP),
});

fixtureSuite({
  name: "dnchisq",
  tolerance: 1e-14,
  density: true,
  call: (a) => dchisq(num(a.x), num(a.df), { ncp: num(a.ncp), log: bool(a.log) }),
});
fixtureSuite({
  name: "pnchisq",
  tolerance: 1e-14,
  call: (a) => pchisq(num(a.q), num(a.df), opts(a)),
});
fixtureSuite({
  name: "qnchisq",
  tolerance: 1e-14,
  // df = 0 and ncp = 0 is a point mass at 0. R returns NaN (the answer is 0)
  knownDifference: (a, e, x) =>
    (Number.isNaN(e) || e === Infinity) && x === 0 && num(a.df) === 0 && num(a.ncp) === 0
      ? "point mass at 0: R returns NaN or Inf (the answer is 0)"
      : undefined,
  call: (a) => qchisq(num(a.p), num(a.df), opts(a)),
  backward: (a, x) => pchisq(x, num(a.df), opts(a)),
});
