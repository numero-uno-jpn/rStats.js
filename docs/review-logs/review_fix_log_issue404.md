# Issue #404 log: expm Taylor erases a subnormal entry

GitHub Issue #404. Session 13, group B (user decision).

## Plan

- User decision (2026-11-03): drop the floor p >= 5 of the scaling N = 2^p only where the scaling would take a nonzero entry below 2^-1022, keeping |A / N| <= 1/16; what "Pade" still loses is only recorded (the recommended option of the preparation).
- Intent: `scalingExponent` takes L >= 1, so p = L + 4 >= 5 always. For an entirely small matrix A / 32 falls below the normal range; 2^-1074 becomes 0 and `expm` returns the identity. The exact exponential is representable, so it is a wrong value (R too).
- Why this way: the accuracy criterion of the method (|A / N| <= 2^-4) is unchanged; only the floor, which is not needed for accuracy, goes. Matrices whose scaled entries stay normal keep p and their bits. Balancing (as #207 did for "Higham08") does not help here: dgebal's job "S" leaves these matrices unscaled.

## Check (main `ff9999a`)

R 4.5.2 (expm package), A = [[0, a], [0, 0]], exact exp(A) = I + A:

| a, method | R | before | after |
|---|---|---|---|
| 2^-1074, "Taylor" (order 1 and 8) | 0 | 0 | 2^-1074 |
| 2^-1074, "Pade" (order 1 and 8) | 0 | 0 | 0 (recorded) |
| 1e-310, "Taylor" | 0x1.2688b70e62p-1030 (9.9999999999945e-311) | the same | 1e-310 |
| 1e-310, "Pade" | 0x1.2688b70e64p-1030 (1.00000000000103e-310) | the same | 1.00000000000005e-310 |

Also `[[1e-310, 2e-310], [3e-310, 4e-310]]` with "Taylor": 2e-310 and 3e-310 (before 2.0000000000005e-310 in [1, 2]). Unchanged: a = 1e-300 (scaled entries stay normal), `[[1, 1e-310], [0, 2]]` (an entry falls, but nu about 2 already needs L = 1; 4.6707742704721e-310 for 4.6707742704716e-310), and every normal-range matrix.

## Fix

- `src/linalg/expm.ts`, `scalingExponent` (used by "Taylor", "TaylorO", "Pade", "PadeO"): where `A / 2^p` takes a nonzero entry below 2^-1022, p = max(0, L' + 4) with L' >= -4 the smallest with 2^L' >= nu; where the product of the norms underflows (below 2^-1000), nu is taken from the logs of the norms.
- `docs/differences-from-r.md`, `docs/ja/differences-from-r.md`: a row after the #207 row.

## Tests

- `test/issue404.test.ts`: the nilpotent and full small matrices with "Taylor"/"TaylorO" (orders 1 and 8), "Pade" for 1e-310 and 2^-1074, and the unchanged cases. With `src/` stashed, 2 of 3 tests fail.
- The 13 other test files that use `expm` (`expm.test.ts` with its fixture, `issue207`, `issue72`, `review30`, `locationScaleExtremes`, ...): pass. `npx tsc --noEmit -p .`: no errors.

## Out of scope (recorded)

- "Pade" still gives 0 for 2^-1074: the Padé numerator and denominator have the coefficient 1/2 on A, and 2^-1074 / 2 rounds to 0. A smaller p cannot help.
- "Taylor"/"Pade" with a wide matrix such as `[[0, 1e308], [1e-308, 0]]` give [[1, 1e308], [0, 1]] (the error #207 fixed for "Higham08"; R's "Taylor" did not finish in 60 s). Balancing (dgebal "S") would fix it; another phenomenon than this issue. The default "Higham08.b" is right.
- Matrices that mix normal and subnormal entries (`[[1, 1e-310], [0, 2]]`) lose the last digits of the subnormal entries in every method except "Higham08.b".

## close comment

Fixed in <commit of #404, see git log --grep='#404'>: the scaling N = 2^p of the "Taylor"/"Pade" methods no longer keeps the floor p >= 5 where it would take a nonzero entry below 2^-1022; p is then the smallest with |A / N| <= 1/16 (and p >= 0). `expm([[0, Number.MIN_VALUE], [0, 0]], { method: "Taylor", order: 1 })` is now [[1, 5e-324], [0, 1]] (I + A, exact), and 1e-310 keeps all its digits. Other matrices keep their scaling and values. "Pade" gains on 1e-310 but still loses 2^-1074 (its coefficient 1/2 halves the entry), which is recorded. R 4.5.2 gives the identity, so the difference is listed in docs/differences-from-r.md.

Test: test/issue404.test.ts. (Not pushed yet.)
