import { dunif, punif, qunif } from "../src/distributions/uniform.js";
import { dexp, pexp, qexp } from "../src/distributions/exponential.js";
import { dlnorm, plnorm, qlnorm } from "../src/distributions/lognormal.js";
import { dlogis, plogis, qlogis } from "../src/distributions/logistic.js";
import { dcauchy, pcauchy, qcauchy } from "../src/distributions/cauchy.js";
import { dweibull, pweibull, qweibull } from "../src/distributions/weibull.js";
import { bool, num } from "./helpers/fixture.js";
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
