import { ptukey } from "../src/distributions/tukey.js";
import { bool, num } from "./helpers/fixture.js";
import { fixtureSuite } from "./helpers/suite.js";

const opts = (a: Record<string, string | boolean>) => ({
  nranges: num(a.nranges),
  lowerTail: bool(a.lowerTail),
  logP: bool(a.logP),
});

/**
 * The tolerance is 2e-14 relative (looser than the 1e-14 used for other distributions). R's ptukey is accurate
 * to only about 8 digits, so almost all cases are compared with Rmpfr reference values (oracle/tukey.R,
 * 160-bit trapezoidal rule). Observed errors are mostly below 6e-15; the maximum, 1.7e-14, is in the deep
 * lower tail with nmeans = 1000 (ptukey(0.5, 1000, 10) = 1.3e-129). The inner integral W(w) is stored as an
 * interpolation of log W, so when W is extremely small the rounding of log W (ε |log W|) shows.
 */
fixtureSuite({
  name: "ptukey",
  tolerance: 2e-14,
  call: (a) => ptukey(num(a.q), num(a.nmeans), num(a.df), opts(a)),
});
