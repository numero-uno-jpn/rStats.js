// Brent's localmin (R's optimize) compared with SciPy's bounded minimiser, the same procedure, with sqrt(eps) set to
// sqrt(2^-52) as in R (scripts/mpmath/localmin.py): locations and evaluation counts agree exactly, and the values up to
// one ulp of the test functions' powers (JS ** and Python ** round differently)
import { localMin } from "../../src/optim/localmin.js";
import { num } from "../helpers/fixture.js";
import { referenceSuite } from "../helpers/mpmath.js";

const F: Record<string, (x: number) => number> = {
  quad: (x) => (x - 1 / 3) ** 2,
  cos: (x) => Math.cos(x),
  abs: (x) => Math.abs(x - 0.7),
  rosen1: (x) => (1 - x) ** 2 + 100 * (x * x - x) ** 2,
  expx: (x) => Math.exp(x) - 2 * x,
  flat: (x) => (x - 2) ** 4,
  edge: (x) => x,
  sinlog: (x) => Math.sin(x) * Math.log(x),
  big: (x) => (x - 1e6) ** 2,
  tiny: (x) => (x - 1e-9) ** 2,
};

referenceSuite({
  name: "localmin",
  tolerance: 1e-15,
  call: (a) => {
    const r = localMin(F[a.f as string]!, num(a.lower), num(a.upper), num(a.tol));
    return a.what === "x" ? r.x : a.what === "fx" ? r.fx : r.evaluations;
  },
});
