// log1pmx, lgamma1p, log1mexp and log1pexp (R's C API, Rmath.h) against correctly rounded values computed with
// 512-bit Rmpfr (oracle/log1p.R; the fixtures hold the true values, not R's output)
import { lgamma1p, log1mexp, log1pexp, log1pmx } from "../src/index.js";
import { num, relativeError } from "./helpers/fixture.js";
import { fixtureSuite } from "./helpers/suite.js";

const EULER = 0.5772156649015329;

// Where 512 bits are not enough, the oracle's values are wrong; these cases are checked against the leading term of
// the expansion instead: 1 + x rounds to 1 for |x| = 1e-300, so lgamma(1 + x) came out 0 (truth -gamma x);
// 1 - exp(-x) rounds to 1 for x >= 700, so log1mexp came out 0 (truth -exp(-x)); exp(1e300) overflows MPFR's
// exponent range, so log1pexp(1e300) came out Inf (truth 1e300)
const oracleLimit: Record<string, (x: number, expected: number, actual: number) => boolean> = {
  lgamma1p: (x, e, a) => e === 0 && Math.abs(x) < 1e-100 && relativeError(a, -EULER * x) <= 1e-15,
  log1mexp: (x, e, a) => e === 0 && x >= 700 && relativeError(a, -Math.exp(-x)) <= 1e-15,
  log1pexp: (x, e, a) => e === Infinity && x >= 34 && Number.isFinite(x) && a === x,
};

const fns: Record<string, (x: number) => number> = { log1pmx, lgamma1p, log1mexp, log1pexp };
for (const [name, f] of Object.entries(fns)) {
  fixtureSuite({
    name,
    call: (a) => f(num(a.x)),
    tolerance: 1e-14,
    knownDifference: (a, expected, actual) =>
      oracleLimit[name]?.(num(a.x), expected, actual)
        ? "beyond the oracle's 512 bits (checked against the leading term of the expansion)"
        : undefined,
  });
}
