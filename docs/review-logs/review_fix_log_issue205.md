# Issue #205 log: eigen loses a small eigenvalue in the global normalization (recorded only)

GitHub Issue #205. Session 11, group B2 (user decision: fix #207 only; #205 is recorded, not changed). Verdict: not planned. No code change.

## Plan

- Intent: check the claim that `eigen` of diag(1e308, 1e-308) returns 0 for the small eigenvalue, compare with R, and record the decision.
- Method: run the issue's call on main with `npx tsx`, and R 4.5.2 (`eigen`, symmetric and not) with the doubles passed as hex floats.
- Why recorded only (the user's decision, option (b) of the preparation): `eigen` divides the whole matrix by one power of 2 before the decomposition (when its largest entry is outside [2^-256, 2^256], review 29) to keep the iterations from overflowing. Where the entries span more than the exponent range of a double, as 1e308 and 1e-308 do, no single scaling keeps both; the small entry underflows before the decomposition sees it. Recovering it needs a different algorithm (taking out the eigenvalues isolated by permutation, dgebal's job "P", before the decomposition, or a Jacobi method with high relative accuracy), which helps only diagonal or triangular blocks, not a general matrix with coupled small entries, and changes the symmetric path. R gives the same value.

## Check (main `b634579`)

| call | R 4.5.2 | rStats.js | true value |
|---|---|---|---|
| `eigen([[1e308, 0], [0, 1e-308]], { symmetric: true, onlyValues: true }).values` | `0x1.1ccf385ebc8ap+1023 0x0p+0` | [1e308, 0] | [1e308, 1e-308] |
| the same with `symmetric: false` | `0x1.1ccf385ebc8ap+1023 0x0p+0` | [1e308, 0] | [1e308, 1e-308] |
| `eigen(diag(1e200, 1e-200))` (symmetric and not) | the small one `0x1.d8f9811335b57p-665` = 1.2e-200 (20% too large) | [1e200, 1e-200] (correct) | [1e200, 1e-200] |

The issue's observation is right, and R returns the same values. For diag(1e200, 1e-200), where the normalization in rStats.js keeps both entries, R's value is wrong by 20% while rStats.js is exact.

## Verdict

Not changed (user decision). The loss happens only where the entries of the matrix span more than the exponent range of a double (about 2^2046), so that no common power of 2 keeps them all in range; it is the same kind of loss as #207, which was fixed because the default method of `expm` already gives the correct value there and the fix is local. For `eigen` there is no such fallback without changing the decomposition.

## close comment

Not planned (recorded). `eigen([[1e308, 0], [0, 1e-308]])` gives [1e308, 0], as the issue says, and R 4.5.2 gives the same (`0x1.1ccf385ebc8ap+1023 0x0p+0`, symmetric or not). The matrix is divided by one power of 2 before the decomposition so that the iterations cannot overflow, and when the entries span more than the exponent range of a double (1e308 and 1e-308), no single power of 2 keeps both in range. Recovering the small eigenvalue would need a different decomposition (isolating eigenvalues by permutation before it, or a Jacobi method with high relative accuracy), which would only help diagonal or triangular blocks, so it is recorded rather than changed. Where the range fits, the scaling does keep both: `eigen(diag(1e200, 1e-200))` gives [1e200, 1e-200] exactly (R gives 1.2e-200 for the small one). See docs/review-logs/review_fix_log_issue205.md. (Not pushed yet.)
