# Issue #513 log: the swap in the Tukey quantile's Brent solver

GitHub Issue #513. Session 15. Classification C (the reviewer's reading is wrong). No code change.

## Plan

- Intent: the issue says the sequential assignments `a = b; b = c; c = a; fa = fb; fb = fc; fc = fa;` in `brent()` (src/distributions/tukey.ts) are a broken simultaneous rotation `(a,b,c) <- (b,c,a)` that corrupts the bracket. Filed from static reading only; no runtime check.
- Method: compare with Brent (1973) and R's zeroin, check the qtukey round trip on main and in R 4.5.2, and try the proposed rotation in a standalone copy. If the current form is correct, add a light test and close as not planned.

## Check (main `ba95c24`)

| call | rStats.js | R 4.5.2 |
|---|---|---|
| `qtukey(0.95, 3, 12)` | 3.7729289657270084, `ptukey` back 0.95 (rel. error 0) | 3.772929 (`0x1.e2ef560d6522fp+1`), back 0.95 |
| `qtukey(0.5, 5, 7)` | 2.3738183292296644, back 0.5 (rel. error 0) | 2.373818, back 0.5 |
| `qtukey(1e-10, 3, 20)` | 1.9046256137806940e-5, back rel. error 6.5e-16 | 9.270898e-10, back 0 (see Out of scope) |

Standalone Brent on x^3 - 2, e^x - 5 and atan(x - 1): the current swap converges to the root in 9 to 12 iterations with the bracket kept; the proposed rotation sets b = c (since c = a on entry) and returns an interval end (not a root) after 0 iterations in all three.

## Cause

The sequential form is the intended one, as in Brent's ALGOL procedure `zero` and R's zeroin.c ("Swap data for b to be the best approximation"). `a` holds the previous b and `c` the end of the bracket opposite b; when |f(c)| < |f(b)|, b takes c, and both a and c take the old b (c = old b keeps the sign change, old a is no longer needed). It is not a rotation. The bit-matched `uniroot` (src/numerics/integrate.ts, label 30) uses the same lines.

## Tests

- `test/issue513.test.ts`: qtukey(0.95, 3, 12) near R's 3.772929 and round-trips to 0.95 exactly; (0.5, 5, 7) round-trips exactly; (1e-10, 3, 20) within 1e-14 relative. Passes on main (nothing to stash). tsc clean.

## Out of scope (recorded)

- R's own `qtukey(1e-10, 3, 20)` is 9.27e-10, whose `ptukey` is 0 (R's secant search with eps = 1e-4 fails in the far lower tail). rStats.js already returns the correct quantile there; not a new difference to record.

## close comment

Not planned: this is not a bug. The sequential assignments `a = b; b = c; c = a` (and the same for fa, fb, fc) are exactly Brent's (1973) procedure `zero` and R's zeroin.c swap, not a rotation: b takes the better end c, and a and c both take the old b, so c stays on the opposite side of the root and the old a is dropped. The proposed rotation `(a,b,c) <- (b,c,a)` breaks the solver (with c = a on entry it sets b = c and stops at an interval end without iterating). On the current main, `qtukey(0.95, 3, 12)` = 3.7729289657270084 (R: 3.772929) and `ptukey` of it is 0.95 with relative error 0; (0.5, 5, 7) and (1e-10, 3, 20) also round-trip to within 1e-15. A test pinning these round trips was added (`test/issue513.test.ts`). (Not pushed yet.)
