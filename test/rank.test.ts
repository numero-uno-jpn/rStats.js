import { dsignrank, psignrank, qsignrank } from "../src/distributions/signrank.js";
import { dwilcox, pwilcox, qwilcox } from "../src/distributions/wilcox.js";
import { bool, num } from "./helpers/fixture.js";
import { fixtureSuite } from "./helpers/suite.js";

const tail = (a: Record<string, string | boolean>) => ({ lowerTail: bool(a.lowerTail), logP: bool(a.logP) });

/**
 * Cases where we intentionally differ from R (docs/differences-from-r.md)
 * - With log.p = TRUE and p = -Inf (probability 0) R returns NaN. We return the same answer as for p = 0
 * - When a linear-scale p is extremely close to 1, R compares 1 - p with a slack of about 1e-15 absolute,
 *   so its answer is off
 */
const knownDiff = (a: Record<string, string | boolean>, e: number, x: number): string | undefined => {
  const p = num(a.p);
  if (a.logP === true && p === -Infinity && Number.isNaN(e) && !Number.isNaN(x))
    return "R returns NaN for p = -Inf with log.p = TRUE (we return the answer for p = 0)";
  if (a.logP !== true && p > 0.5 && 1 - p < 1e-12) return "p is close to 1 and R's decision is determined by rounding";
  return undefined;
};

fixtureSuite({
  name: "dsignrank",
  tolerance: 1e-14,
  density: true,
  call: (a) => dsignrank(num(a.x), num(a.n), { log: bool(a.log) }),
});
fixtureSuite({
  name: "psignrank",
  tolerance: 1e-14,
  call: (a) => psignrank(num(a.q), num(a.n), tail(a)),
});
fixtureSuite({
  name: "qsignrank",
  tolerance: 0,
  discreteCdf: (a, y, lg) => psignrank(y, num(a.n), { lowerTail: bool(a.lowerTail), logP: lg ?? bool(a.logP) }),
  knownDifference: knownDiff,
  call: (a) => qsignrank(num(a.p), num(a.n), tail(a)),
});
fixtureSuite({
  name: "dwilcox",
  tolerance: 1e-14,
  density: true,
  call: (a) => dwilcox(num(a.x), num(a.m), num(a.n), { log: bool(a.log) }),
});
fixtureSuite({
  name: "pwilcox",
  tolerance: 1e-14,
  call: (a) => pwilcox(num(a.q), num(a.m), num(a.n), tail(a)),
});
fixtureSuite({
  name: "qwilcox",
  tolerance: 0,
  discreteCdf: (a, y, lg) =>
    pwilcox(y, num(a.m), num(a.n), { lowerTail: bool(a.lowerTail), logP: lg ?? bool(a.logP) }),
  knownDifference: knownDiff,
  call: (a) => qwilcox(num(a.p), num(a.m), num(a.n), tail(a)),
});
