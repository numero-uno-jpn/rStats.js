import { dhyper, phyper, qhyper } from "../src/distributions/hypergeometric.js";
import { bool, num } from "./helpers/fixture.js";
import { fixtureSuite } from "./helpers/suite.js";

const tail = (a: Record<string, string | boolean>) => ({ lowerTail: bool(a.lowerTail), logP: bool(a.logP) });
const params = (a: Record<string, string | boolean>): [number, number, number] => [num(a.m), num(a.n), num(a.k)];

fixtureSuite({
  name: "dhyper",
  tolerance: 1e-14,
  density: true,
  call: (a) => dhyper(num(a.x), ...params(a), { log: bool(a.log) }),
});
fixtureSuite({
  name: "phyper",
  tolerance: 1e-14,
  call: (a) => phyper(num(a.q), ...params(a), tail(a)),
});
fixtureSuite({
  name: "qhyper",
  tolerance: 0,
  discreteCdf: (a, y, lg) => phyper(y, ...params(a), { lowerTail: bool(a.lowerTail), logP: lg ?? bool(a.logP) }),
  knownDifference: (a, e, x) =>
    a.logP === true && num(a.p) === -Infinity && Number.isNaN(e) && !Number.isNaN(x)
      ? "R returns NaN for p = -Inf with log.p = TRUE (we return the same answer as for p = 0)"
      : undefined,
  call: (a) => qhyper(num(a.p), ...params(a), tail(a)),
});
