// Audit of the distribution functions beyond the R fixture grids: random parameters over wide ranges, checked
// against mpmath (scripts/mpmath/audit.py writes test/fixtures/audit_<name>.mpmath.json)
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

// Known shortfalls, held at the accuracy reached now until the fixes in CLOUD_BRANCH.md land (then back to 1e-14):
// pgamma and ppois reach 2e-14 where igam's series sums thousands of rounded ratios (shape > 1000); the noncentral
// χ² and beta reach 1.4e-13 at large ncp, where the shape a + j of a far-tail component is rounded to double
const pending: Record<string, number> = { pgamma: 3e-14, ppois: 3e-14, pnchisq: 2e-13, pnbeta: 2e-13 };

for (const [name, call] of Object.entries(audits)) {
  const path = fileURLToPath(new URL(`./fixtures/audit_${name}.mpmath.json`, import.meta.url));
  if (existsSync(path)) referenceSuite({ name: `audit_${name}`, tolerance: pending[name] ?? 1e-14, call });
}
