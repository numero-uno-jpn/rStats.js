# Issue #207 log: expm "Higham08" loses a small entry in the scaling before the Padé approximant

GitHub Issue #207. Session 11, group B2 (user decision: fix #207 only, by balancing internally where the scaling loses an entry; #205 recorded only).

## Plan

- Intent: `expm(A, { method: "Higham08" })` does not balance, and for a 1-norm above 2.1 it forms B = A / 2^s with one s for the whole matrix. A nonzero entry far below the largest falls below the normal range or to 0 in B, and the squaring cannot bring it back: `[[0, 1e308], [1e-308, 0]]` (A^2 = I, exp(A) = cosh(1) I + sinh(1) A) gave [[1, 1e308], [0, 1]], the exponential of a nilpotent matrix. The same happens at 1e±200 (s = 662).
- Method (the user's decision, option (b) of the preparation): for "Higham08" only, where the scaling A / 2^s that `pade` would use takes a nonzero entry of A below 2^-1022, balance A with dgebal's job "S" (a diagonal similarity by powers of 2, exact), take the exponential and transform back, as "Higham08.b" does for its scaling step (no permutation). The exponent s is now computed by one helper (`squaringExponent`) for the check and for `pade`.
- Why this: it is a fallback that only acts where the result is already damaged; the default method gives the correct value for these matrices, and the fallback reproduces it to the bit. Other matrices are not balanced, as in R.
- The threshold is "below the normal range" (2^-1022), as the preparation's option (b) states, not only "to exactly 0": an entry that becomes subnormal in B already loses digits (see the table). This is the decided option's condition; noted here because the decision's summary says "where a nonzero entry vanishes".
- R's `expm(method = "Higham08")` gives the same wrong values (R 4.5.2, expm package), so the difference is recorded in docs/differences-from-r.md and docs/ja.

## Check (main `2d8e06c`)

| call (method "Higham08" unless noted) | R 4.5.2 Higham08 | Before | After | R Higham08.b / true value |
|---|---|---|---|---|
| `[[0, 1e308], [1e-308, 0]]` | [[1, 1e308], [0, 1]] (`0x1p+0 0x0p+0 0x1.1ccf385ebc8ap+1023 0x1p+0`) | the same | [[`0x1.8b07551d9f55p+0`, `0x1.4eb55a5e75e35p+1023`], [`0x1.0e6b5a119c032p-1023`, `0x1.8b07551d9f551p+0`]] | Higham08.b: the same bits. Rmpfr: cosh 1 `0x1.8b07551d9f55p+0`, `0x1.4eb55a5e75e34p+1023`, `0x1.0e6b5a119c032p-1023` |
| `[[0, 1e200], [1e-200, 0]]` | [[1, 1e200], [0, 1]] | the same | 1.5430806348152437, 1.1752011936438014e200, 1.1752011936438015e-200, 1.543080634815244 | Higham08.b: the same bits (`0x1.8909d9a1c7075p+664`, `0x1.cc92e9dfc90b4p-665`); Rmpfr agrees |
| `[[0, 1e300, 0], [1e-300, 0, 0], [0, 0, 1000]]` | | lower-left 0 | as Higham08.b | |
| `[[0, 1e10], [1e-300, 0]]` (1e-300 / 2^31 is subnormal) | lower-left `0x1.56e1fc2f8f3p-997` | 9.999999999999853e-301 | 9.999999999999997e-301 (`0x1.56e1fc2f8f357p-997`) | Higham08.b `0x1.56e1fc2f8f357p-997`; true value about 1e-300 (1 + 1e-290 / 6) |
| `[[0, 1e10], [1e-310, 0]]` | (R: most digits lost, e.g. `0x1.2p-1038` for a nearby subnormal) | 9.999905164924e-311 | 1e-310 | Higham08.b 1e-310 |
| `[[0, 1e10], [1e-290, 0]]`, `[[1, 2], [3, 4]]` (no entry below 2^-1022 in B) | | | the same bits (not balanced) | |

## Fix

- `src/linalg/expm.ts`: `lostInSquaringScale(A)` (the 1-norm above 2.1, s > 0, and some nonzero entry with abs(v / 2^s) < 2^-1022); for "Higham08" it sets `scaling = gebal("S", A)`, and the existing back-transformation of "Higham08.b" undoes it. `squaringExponent(A, nu)` is the former expression for s, shared with `pade`. The file's header comment says so.

## Tests

- `test/issue207.test.ts`: the issue's matrix (the bits of R's Higham08.b) and equality with "Higham08.b", the 1e±200 and 3 x 3 versions, the subnormal cases, and two matrices that are not balanced (same values as before). With `src/` stashed, the three tests of balanced cases fail.
- `npx vitest run`: 322 files passed (2719 tests passed, 38 skipped); the existing expm tests pass with their exact values. `npx tsc --noEmit -p .`: no errors.

## Out of scope

- #205 (`eigen` of diag(1e308, 1e-308)): the same kind of loss in the global normalization before the decomposition; recorded only (user decision), see review_fix_log_issue205.md.

## close comment

Fixed in <commit of #207, see git log --grep='#207'>: `expm(method = "Higham08")` still does not balance in general, but where the scaling A / 2^s before the Padé approximant would take a nonzero entry below the normal range, it now balances internally (dgebal's job "S", a diagonal similarity by powers of 2) and transforms back. `expm([[0, 1e308], [1e-308, 0]], { method: "Higham08" })` is now [[1.5430806348152437, 1.1752011936438017e308], [1.1752011936438015e-308, 1.543080634815244]] (it was [[1, 1e308], [0, 1]], as in R's expm), the same bits as the default "Higham08.b" (and as R's Higham08.b); the 1e±200 version is fixed too. Other matrices are not balanced and keep their values. Recorded in docs/differences-from-r.md.

Test: test/issue207.test.ts. (Not pushed yet.)
