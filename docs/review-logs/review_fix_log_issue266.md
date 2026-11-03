# Issue #266 log: polychor thresholds collapse where the total of the table overflows

GitHub Issue #266. Session 11, group A6 of the second triage (overflow in tests and descriptive statistics).

## Plan

- Intent: `thresholds()` divides the cumulative margins by the total, so a table of finite counts whose total overflows (`[[8e307, 8e307], [8e307, 8e307]]`, total 3.2e308) gets thresholds qnorm(1.6e308 / Inf) = -Inf. Running it showed a second overflow behind the first: the log-likelihood sum n_ij log P_ij is about -2.2e308 for `[[4e307, 4e307], [4e307, 4e307]]` (total 1.6e308, finite), so Brent's method sees a constant Inf and returns 0.99986 for a table with rho 0. Fixing only the thresholds would leave that.
- Method: in `polychor`, where the total of the table is 2^1000 or more (or overflows), the whole table is divided by a power of 2 with `scaleToUnit` (exact) before the zero margins are removed. The thresholds, rho and the ML estimates do not depend on the units of the counts (the log-likelihood is scaled by the same power of 2, to the bit). With `stdErr`, the variances (in 1 / n) are multiplied by 2^-k, the chi-square parts that scale with the counts by 2^k, and n by 2^k; the terms n log(1 + 1e-6 / n) (absolute, polycor's 1e-6 added to the counts) are formed from the original counts and added separately.
- Why this bound: -log P is at most about 745 where P is not 0, so below a total of 2^1000 the log-likelihood (at most about 2^1010) cannot overflow; tables below the bound go through the old code unchanged to the bit. Above it, rho stays the same to the bit wherever the old code worked (checked with 2^1015 times a 3 × 3 table).
- R's polycor (Inf replaced by the largest double in the optimiser) gives 0.999859 for both tables, so this is recorded in docs.

## Check (main `c4c9638`, R 4.5.2, polycor)

| Call | R | Before | After |
|---|---|---|---|
| `polychor([[8e307, 8e307], [8e307, 8e307]])` (the issue) | 0.999859 (warning "Inf replaced by maximum positive value") | 0.9998590004758731 | -1.6653345369377348e-16, the same as `[[1, 1], [1, 1]]` |
| `polychor([[4e307, 4e307], [4e307, 4e307]])` (total finite, log-likelihood overflows) | 0.999859 (the same warning) | 0.9998590004758731 | -1.6653345369377348e-16 |
| the same table with `{ ML: true, stdErr: true }` | not run | rho 0.99986 | rho -1.26e-17, var[0][0] 7.71e-309 (0.6168502750680848 × 4 / 3.2e308), chisq 8.0e-6, n Infinity |
| `polychor(T)`, T = [[20, 10, 5], [8, 15, 12], [3, 9, 18]], also times 2^990 and 2^1015 | 0.56468360567916331 (the known optimiser difference) | 0.5646836056792304 | unchanged (all three) |
| `polychor([[3e307, 1e307], [1e307, 3e307]])` (total 8e307, scaled now) | not run (twice these counts: 0.999859) | 0.7071100150710427 | unchanged |
| `polychor(T, { ML: true, stdErr: true })` | not run | rho 0.5652381231965001, var[0][0] 0.008534270644865937, chisq 0.5508583744892291 | unchanged |
| `polychor(T × 2^1015, { ML: true, stdErr: true })` | not run | variances subnormal (2.4306409617045237e-308 …) | rho the same; some subnormal variances differ in the last digits (one rounding into the subnormal range instead of several) |

## Fix

- `src/htest/polycor.ts`: the scaling of the table at the start of `polychor` and the multiplications back for `stdErr`.
- docs/differences-from-r.md and docs/ja/differences-from-r.md: a row in "Where R fails and rStats.js returns a value".

## Tests

- `test/issue266.test.ts`: the two tables give the rho of the table of 1s; with ML and stdErr the variances match those of the table of 1s times 4 / 3.2e308, the chi-square 8e-6, n Infinity; ordinary and large-but-working tables keep their values from before the fix. With `src/` stashed the first two tests fail.
- `npx vitest run`: 354 files passed (2810 tests passed, 38 skipped). `npx tsc --noEmit -p .`: no errors.

## Out of scope

- In the scaled path a cell below 2^-1074 times the largest cell rounds to 0 (a row or column could then be removed as empty); such a cell has no effect on the thresholds in double precision anyway, but the warning would differ.
- `polyserial` builds its counts from the data and cannot overflow.

## close comment

Fixed in <commit of #266, see git log --grep='#266'>: where the total of the table is 2^1000 or more, `polychor` now divides the table by a power of 2 before estimating (the thresholds and rho do not depend on the units of the counts), and multiplies the variances, the chi-square and n back with `stdErr`. Besides the thresholds of the issue, the log-likelihood itself overflowed for totals near the largest double, so `polychor([[8e307, 8e307], [8e307, 8e307]])` and `polychor([[4e307, 4e307], [4e307, 4e307]])` both gave 0.99986; they now give -1.67e-16, the value of `[[1, 1], [1, 1]]`. R's polycor gives 0.999859 with "Inf replaced by maximum positive value", so this is recorded in docs/differences-from-r.md. Tables with totals below 2^1000 are unchanged to the bit. (Not pushed yet.)
