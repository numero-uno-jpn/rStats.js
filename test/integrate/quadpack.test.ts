// QUADPACK port (dqagse, dqagie) compared with SciPy, which runs the same routines from the C translation the port
// follows: result, error estimate, evaluation count, ier and number of subintervals (scripts/mpmath/quadpack.py)
import { dqagie, dqagse, type Integrand, type QuadResult } from "../../src/integrate/quadpack.js";
import { describe, expect, it } from "vitest";
import { num } from "../helpers/fixture.js";
import { loadReference } from "../helpers/mpmath.js";

const F: Record<string, Integrand> = {
  gauss: (x) => Math.exp(-x * x),
  invsqrt: (x) => (x > 0 ? 1 / Math.sqrt(x) : 0),
  log: (x) => (x > 0 ? Math.log(x) : 0),
  sinc: (x) => (x !== 0 ? Math.sin(x) / x : 1),
  pow09: (x) => (x > 0 ? x ** -0.9 : 0),
  cauchy: (x) => 1 / (1 + x * x),
  kink: (x) => Math.abs(x - 1 / 3),
  dnorm: (x) => Math.exp((-x * x) / 2) / Math.sqrt(2 * Math.PI),
  gamma6: (x) => Math.exp(-x) * x ** 5,
  betaprime: (x) => (x > 0 ? 1 / ((x + 1) * Math.sqrt(x)) : 0),
  recip: (x) => 1 / x,
  cos100: (x) => Math.cos(100 * x),
  sininv: (x) => Math.sin(1 / x),
  step: (x) => (x < 0.3 ? 1 : 0),
  poly: (x) => 3 * x ** 4 - 2 * x + 1,
};

const cache = new Map<string, QuadResult>();
function run(a: Record<string, string | boolean>): QuadResult {
  const key = JSON.stringify({ ...a, what: undefined });
  let r = cache.get(key);
  if (r === undefined) {
    const f = F[a.f as string]!;
    r =
      a.kind === "agse"
        ? dqagse(f, num(a.a), num(a.b), num(a.epsabs), num(a.epsrel), num(a.limit))
        : dqagie(f, num(a.bound), num(a.inf) as -1 | 1 | 2, num(a.epsabs), num(a.epsrel), num(a.limit));
    cache.set(key, r);
  }
  return r;
}

// Counts and ier must match exactly. The result may move by a few ulps with the integrands' libm calls (exp, sin, ...),
// and for an integral that is 0 (cos 100x over [0, pi]) it is rounding noise, compared against the error estimate.
// The error estimate itself is built from rounding-level differences of the rules, so it is compared loosely
describe("QUADPACK against SciPy", () => {
  const fixture = loadReference("quadpack_scipy");
  it(`agrees with SciPy's QUADPACK (${fixture.cases.length} values)`, () => {
    const bad: string[] = [];
    for (const c of fixture.cases) {
      const r = run(c.args);
      const what = c.args.what as keyof QuadResult;
      const actual = r[what];
      const expected = num(c.expected);
      let ok: boolean;
      if (what === "result") ok = Math.abs(actual - expected) <= Math.max(1e-12 * Math.abs(expected), r.abserr * 1e-2);
      else if (what === "abserr") ok = Math.abs(actual - expected) <= 1e-2 * Math.abs(expected);
      else ok = actual === expected;
      if (!ok) bad.push(`${JSON.stringify(c.args)}: ${actual} vs ${expected}`);
    }
    expect(bad).toEqual([]);
  });
});
