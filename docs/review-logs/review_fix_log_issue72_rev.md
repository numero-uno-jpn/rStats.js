# Revision of issue 72: expm's order bounded by the work

## Plan
- Intent: the Taylor and Padé methods of `expm` make `order` matrix products whatever the matrix, so an order up to
  2147483647 (the limit set in issue 72) can run for minutes (2 x 2) or days (50 x 50). Criterion K4 (time about 10 s
  at most on this machine, a RangeError before the computation).
- Decision: D8 (session 14, `prep/limits.md` question 2, recommended option: limits on expm and grad only).
- Form: order * (n^3 + 64) <= 2^31 for an n x n matrix (n^3 multiply-adds per product plus a fixed cost per step),
  checked after the 0 x 0 and 1 x 1 cases (which make no products) and before the finite-entry check and the loops.
  Only the four methods that use order; the Higham08 methods still ignore it. Orders inside the limit are untouched.

## Original decision
- Issue 72: order limited to R's integer range (2^53 and beyond did not return); the time of large orders was
  recorded only ("R takes long too"). No user decision.

## Gap with the current criteria
- K4: no bound on the time.

## Reproduction (main, R 4.5.2 with expm 1.0)
| call (M = [[1, 0.5], [0.25, -0.5]]) | rStats.js before | R |
|---|---|---|
| `expm(M, "Taylor", order = 8)`, `1e5`, `1e6` | 2.8285042654183945 in each, 0.7 / 24 / 139 ms | 0x1.6a0c6d8248c4ep+1 (= 2.8285042654183945) for 8 and 1e5 |
| `expm(M, "Pade", order = 8)`, `1e5`, `1e6` | 2.8285042654183763, ...945, ...94; 0.5 / 32 / 296 ms | 0x1.6a0c6d8248c25p+1 (= ...763), 0x1.6a0c6d8248c4ep+1 for 8 and 1e5 |
| 2 x 2, Taylor, order 29826162 (just beyond the new limit) | 4.7 s (the stashed run of the new test) | |
| 50 x 50, Padé, order 1000 (prep) | 542 ms, so about 9 s at 17171 | |

The time is about order * (200 ns + 2 to 4 ns * n^3) (prep). Limits: order 29826161 for 2 x 2, 17171 for 50 x 50.

## Fix
- `src/linalg/expm.ts`: RangeError "order = <order> is too large for a <n> x <n> matrix: order * (n^3 + 64) must be at
  most 2^31", before any computation; the option's documentation names the bound.
- Docs (en, ja): a bullet after the exact-distribution limits of session 12 (Hypothesis tests, deliberate differences).

## Tests
- `test/issue72_rev.test.ts`: the four methods throw at once (under 100 ms) at 2 x 2 order 29826162 and 2147483647 and
  50 x 50 order 17172; the values inside the limit are the ones before (Taylor and Padé order 1e5, Padé 8), Higham08
  ignores order 1e9, a 1 x 1 matrix accepts 2147483647. The rejection test fails with src stashed (it computed 4.7 s,
  then did not throw).
- issue72, expm (fixture), issue404, review30 pass.

## Out of scope (recorded)
- None.
