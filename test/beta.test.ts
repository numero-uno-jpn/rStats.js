import { dbeta, dbinom, df, dt, pbeta, pbinom, pf, pt, qbeta, qbinom, qf, qt } from "../src/index.js";
import { bool, num } from "./helpers/fixture.js";
import { fixtureSuite } from "./helpers/suite.js";

/**
 * For quantiles not representable in double (the true value rounds to 0 or ∞), R sometimes returns
 * finite values near 2^-1024 or 2^1023, or NaN. We return 0 / ∞ / the endpoint.
 * (docs/differences-from-r.md)
 */
const rTinyOrHuge = (expected: number, actual: number): string | undefined => {
  if (actual === 0 && expected > 0 && expected <= 2 ** -1022) return "R returns an unrepresentably small answer as 2^-1024 or similar";
  if (actual === Infinity && expected > 1e300) return "R returns an overflowing answer as a large finite value";
  if (Number.isNaN(expected) && (actual === 0 || actual === 1)) return "R returns NaN (the answer rounds to an endpoint)";
  return undefined;
};

const tail = (a: Record<string, string | boolean>) => ({ lowerTail: bool(a.lowerTail), logP: bool(a.logP) });

fixtureSuite({
  name: "dbeta",
  tolerance: 1e-14,
  density: true,
  call: (a) => dbeta(num(a.x), num(a.shape1), num(a.shape2), { log: bool(a.log) }),
});
fixtureSuite({
  name: "pbeta",
  tolerance: 1e-14,
  call: (a) => pbeta(num(a.q), num(a.shape1), num(a.shape2), tail(a)),
});
fixtureSuite({
  name: "qbeta",
  tolerance: 1e-14,
  knownDifference: (_a, e, x) => rTinyOrHuge(e, x),
  call: (a) => qbeta(num(a.p), num(a.shape1), num(a.shape2), tail(a)),
  backward: (a, x) => pbeta(x, num(a.shape1), num(a.shape2), tail(a)),
});
fixtureSuite({
  name: "dbinom",
  tolerance: 1e-14,
  density: true,
  call: (a) => dbinom(num(a.x), num(a.size), num(a.prob), { log: bool(a.log) }),
});
fixtureSuite({
  name: "pbinom",
  tolerance: 1e-14,
  call: (a) => pbinom(num(a.q), num(a.size), num(a.prob), tail(a)),
});
fixtureSuite({
  name: "qbinom",
  tolerance: 0,
  discreteCdf: (a, y, lg) => pbinom(y, num(a.size), num(a.prob), { lowerTail: bool(a.lowerTail), logP: lg ?? bool(a.logP) }),
  knownDifference: (a) => {
    const n = num(a.size);
    const p = num(a.p);
    const end = a.logP ? p === 0 || p === -Infinity : p === 0 || p === 1;
    if (Number.isFinite(n) && n !== Math.round(n) && !end) return "size is not an integer";
    return !a.logP && p > 0.5 && 1 - p < 1e-12 ? "p is close to 1 and R's comparison is decided by rounding" : undefined;
  },
  call: (a) => qbinom(num(a.p), num(a.size), num(a.prob), tail(a)),
});
fixtureSuite({
  name: "dt",
  tolerance: 1e-14,
  density: true,
  call: (a) => dt(num(a.x), num(a.df), { log: bool(a.log) }),
});
fixtureSuite({
  name: "pt",
  tolerance: 1e-14,
  call: (a) => pt(num(a.q), num(a.df), tail(a)),
});
fixtureSuite({
  name: "qt",
  tolerance: 1e-14,
  call: (a) => qt(num(a.p), num(a.df), tail(a)),
  backward: (a, x) => pt(x, num(a.df), tail(a)),
});
fixtureSuite({
  name: "df",
  tolerance: 1e-14,
  density: true,
  call: (a) => df(num(a.x), num(a.df1), num(a.df2), { log: bool(a.log) }),
});
fixtureSuite({
  name: "pf",
  tolerance: 1e-14,
  call: (a) => pf(num(a.q), num(a.df1), num(a.df2), tail(a)),
});
fixtureSuite({
  name: "qf",
  tolerance: 1e-14,
  knownDifference: (_a, e, x) => rTinyOrHuge(e, x),
  call: (a) => qf(num(a.p), num(a.df1), num(a.df2), tail(a)),
  backward: (a, x) => pf(x, num(a.df1), num(a.df2), tail(a)),
});

// One large and one small parameter (oracle/largea.R; every case has a reference value)
fixtureSuite({
  name: "pbetaLargeA",
  tolerance: 1e-14,
  call: (a) => pbeta(num(a.q), num(a.shape1), num(a.shape2), tail(a)),
});
fixtureSuite({
  name: "ptLargeDf",
  tolerance: 1e-14,
  call: (a) => pt(num(a.q), num(a.df), tail(a)),
});
fixtureSuite({
  name: "pfLargeDf",
  tolerance: 1e-14,
  call: (a) => pf(num(a.q), num(a.df1), num(a.df2), tail(a)),
});
fixtureSuite({
  name: "pbinomLargeN",
  tolerance: 1e-14,
  call: (a) => pbinom(num(a.q), num(a.size), num(a.prob), tail(a)),
});
