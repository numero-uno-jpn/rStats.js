// Numerical core of ks.test: the exact and limiting Kolmogorov distributions, checked against exact rational
// arithmetic and mpmath (scripts/mpmath/kolmogorov.py)
import { pkolmogorovExact, pkolmogorovLimit, pkolmogorovOneSidedUpper } from "../../src/htest/core/kolmogorov.js";
import { bool, num } from "../helpers/fixture.js";
import { referenceSuite } from "../helpers/mpmath.js";

referenceSuite({ name: "pkolmogorov_exact", tolerance: 1e-13, call: (a) => pkolmogorovExact(num(a.n), num(a.d)) });
referenceSuite({ name: "pkolmogorov_limit", tolerance: 1e-14, call: (a) => pkolmogorovLimit(num(a.x), bool(a.lowerTail)) });
referenceSuite({
  name: "pkolmogorov_onesided_upper",
  tolerance: 1e-13,
  call: (a) => pkolmogorovOneSidedUpper(num(a.n), num(a.d)),
});
