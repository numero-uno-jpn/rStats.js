// Audit of the distribution functions beyond the R fixture grids: random parameters over wide ranges, checked
// against mpmath (scripts/mpmath/audit.py writes test/fixtures/audit_<name>.mpmath.json; the *_large fixtures are
// written by scripts/mpmath/largebeta.py)
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  dbeta, dbinom, dgamma, dnbinom, dpois, dt, pbeta, pbinom, pchisq, pf, pgamma, phyper, pnbinom, pnorm, ppois, pt,
} from "../src/index.js";
import { bool, num } from "./helpers/fixture.js";
import { referenceSuite } from "./helpers/mpmath.js";

type Args = Record<string, string | boolean>;
const tail = (a: Args) => ({ lowerTail: bool(a.lowerTail), logP: bool(a.logP) });
const lg = (a: Args) => ({ log: bool(a.log) });

const audits: Record<string, (a: Args) => number> = {
  pnorm: (a) => pnorm(num(a.q), tail(a)),
  pgamma: (a) => pgamma(num(a.q), num(a.shape), tail(a)),
  pbeta: (a) => pbeta(num(a.q), num(a.shape1), num(a.shape2), tail(a)),
  pt: (a) => pt(num(a.q), num(a.df), tail(a)),
  pbinom: (a) => pbinom(num(a.q), num(a.size), num(a.prob), tail(a)),
  // Both parameters large (scripts/mpmath/largebeta.py): the uniform asymptotic expansion and around it
  pbeta_large: (a) => pbeta(num(a.q), num(a.shape1), num(a.shape2), tail(a)),
  pbinom_large: (a) => pbinom(num(a.q), num(a.size), num(a.prob), tail(a)),
  ppois: (a) => ppois(num(a.q), num(a.lambda), tail(a)),
  pnbinom: (a) => pnbinom(num(a.q), num(a.size), { mu: num(a.mu), ...tail(a) }),
  dgamma: (a) => dgamma(num(a.x), num(a.shape), lg(a)),
  dbeta: (a) => dbeta(num(a.x), num(a.shape1), num(a.shape2), lg(a)),
  dbinom: (a) => dbinom(num(a.x), num(a.size), num(a.prob), lg(a)),
  dpois: (a) => dpois(num(a.x), num(a.lambda), lg(a)),
  dt: (a) => dt(num(a.x), num(a.df), lg(a)),
  dnbinom: (a) => dnbinom(num(a.x), num(a.size), { mu: num(a.mu), ...lg(a) }),
  pf: (a) => pf(num(a.q), num(a.df1), num(a.df2), tail(a)),
  pchisq: (a) => pchisq(num(a.q), num(a.df), tail(a)),
  phyper: (a) => phyper(num(a.q), num(a.m), num(a.n), num(a.k), tail(a)),
  pnchisq: (a) => pchisq(num(a.q), num(a.df), { ncp: num(a.ncp), ...tail(a) }),
  pnbeta: (a) => pbeta(num(a.q), num(a.shape1), num(a.shape2), { ncp: num(a.ncp), ...tail(a) }),
};

for (const [name, call] of Object.entries(audits)) {
  const path = fileURLToPath(new URL(`./fixtures/audit_${name}.mpmath.json`, import.meta.url));
  if (existsSync(path)) referenceSuite({ name: `audit_${name}`, tolerance: 1e-14, call });
}
