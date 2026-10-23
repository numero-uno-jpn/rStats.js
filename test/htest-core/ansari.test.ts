// Numerical core of ansari.test: the exact null distribution of the Ansari-Bradley statistic, checked against exact
// integer counts (scripts/mpmath/ansari.py, itself checked against brute-force enumeration)
import { dansariExact, pansariExact, qansariExact } from "../../src/htest/core/ansari.js";
import { bool, num } from "../helpers/fixture.js";
import { referenceSuite } from "../helpers/mpmath.js";

referenceSuite({ name: "dansari_exact", tolerance: 1e-13, call: (a) => dansariExact(num(a.x), num(a.m), num(a.n)) });
referenceSuite({
  name: "pansari_exact",
  tolerance: 1e-13,
  call: (a) => pansariExact(num(a.q), num(a.m), num(a.n), bool(a.lowerTail)),
});
referenceSuite({ name: "qansari_exact", tolerance: 0, call: (a) => qansariExact(num(a.p), num(a.m), num(a.n)) });
