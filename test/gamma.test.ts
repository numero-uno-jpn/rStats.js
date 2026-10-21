import { dchisq, dgamma, dpois, pchisq, pgamma, ppois, qchisq, qgamma, qpois } from "../src/index.js";
import { bool, num } from "./helpers/fixture.js";
import { fixtureSuite } from "./helpers/suite.js";

/** When a linear-scale p is extremely close to 1, R's comparison depends on the rounding of 1 - p (docs/differences-from-r.md) */
const nearOne = (a: Record<string, string | boolean>) =>
  !a.logP && num(a.p) > 0.5 && 1 - num(a.p) < 1e-12 ? "p is close to 1 and R's comparison is decided by rounding" : undefined;

const tail = (a: Record<string, string | boolean>) => ({ lowerTail: bool(a.lowerTail), logP: bool(a.logP) });

fixtureSuite({
  name: "dgamma",
  tolerance: 1e-14,
  density: true,
  call: (a) => dgamma(num(a.x), num(a.shape), { scale: num(a.scale), log: bool(a.log) }),
});
fixtureSuite({
  name: "pgamma",
  tolerance: 1e-14,
  call: (a) => pgamma(num(a.q), num(a.shape), { scale: num(a.scale), ...tail(a) }),
});
fixtureSuite({
  name: "qgamma",
  tolerance: 1e-14,
  call: (a) => qgamma(num(a.p), num(a.shape), { scale: num(a.scale), ...tail(a) }),
  backward: (a, x) => pgamma(x, num(a.shape), { scale: num(a.scale), ...tail(a) }),
});
fixtureSuite({
  name: "dchisq",
  tolerance: 1e-14,
  density: true,
  call: (a) => dchisq(num(a.x), num(a.df), { log: bool(a.log) }),
});
fixtureSuite({
  name: "pchisq",
  tolerance: 1e-14,
  call: (a) => pchisq(num(a.q), num(a.df), tail(a)),
});
fixtureSuite({
  name: "qchisq",
  tolerance: 1e-14,
  call: (a) => qchisq(num(a.p), num(a.df), tail(a)),
  backward: (a, x) => pchisq(x, num(a.df), tail(a)),
});
fixtureSuite({
  name: "dpois",
  tolerance: 1e-14,
  density: true,
  call: (a) => dpois(num(a.x), num(a.lambda), { log: bool(a.log) }),
});
fixtureSuite({
  name: "ppois",
  tolerance: 1e-14,
  call: (a) => ppois(num(a.q), num(a.lambda), tail(a)),
});
fixtureSuite({
  name: "qpois",
  tolerance: 0,
  discreteCdf: (a, y, lg) => ppois(y, num(a.lambda), { lowerTail: bool(a.lowerTail), logP: lg ?? bool(a.logP) }),
  knownDifference: nearOne,
  call: (a) => qpois(num(a.p), num(a.lambda), tail(a)),
});
