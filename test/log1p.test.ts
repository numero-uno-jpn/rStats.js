// log1pmx, lgamma1p, log1mexp and log1pexp (R's C API, Rmath.h) against correctly rounded values computed with
// Rmpfr (oracle/log1p.R; the fixtures hold the true values, not R's output)
import { lgamma1p, log1mexp, log1pexp, log1pmx } from "../src/index.js";
import { num } from "./helpers/fixture.js";
import { fixtureSuite } from "./helpers/suite.js";

const fns: Record<string, (x: number) => number> = { log1pmx, lgamma1p, log1mexp, log1pexp };
for (const [name, f] of Object.entries(fns)) {
  fixtureSuite({
    name,
    call: (a) => f(num(a.x)),
    tolerance: 1e-14,
  });
}
