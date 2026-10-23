// Audit of the quantile functions beyond the R fixture grids: random parameters and probabilities (including far
// tails and log p), against true quantiles from mpmath (scripts/mpmath/audit_q.py writes
// test/fixtures/auditq_<name>.mpmath.json). Discrete quantiles must agree exactly
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { qbeta, qbinom, qgamma, qnorm, qpois, qt } from "../src/index.js";
import { bool, num } from "./helpers/fixture.js";
import { referenceSuite } from "./helpers/mpmath.js";

type Args = Record<string, string | boolean>;
const tail = (a: Args) => ({ lowerTail: bool(a.lowerTail), logP: bool(a.logP) });

const audits: Record<string, [number, (a: Args) => number]> = {
  qnorm: [1e-13, (a) => qnorm(num(a.p), tail(a))],
  qgamma: [1e-13, (a) => qgamma(num(a.p), num(a.shape), tail(a))],
  qbeta: [1e-13, (a) => qbeta(num(a.p), num(a.shape1), num(a.shape2), tail(a))],
  qt: [1e-13, (a) => qt(num(a.p), num(a.df), tail(a))],
  qpois: [0, (a) => qpois(num(a.p), num(a.lambda), tail(a))],
  qbinom: [0, (a) => qbinom(num(a.p), num(a.size), num(a.prob), tail(a))],
};

for (const [name, [tolerance, call]] of Object.entries(audits)) {
  const path = fileURLToPath(new URL(`./fixtures/auditq_${name}.mpmath.json`, import.meta.url));
  if (existsSync(path)) referenceSuite({ name: `auditq_${name}`, tolerance, call });
}
