# Issue #239 log: distSummary("kumar") mode 0 where a b overflows

GitHub Issue #239. Session 11, group A3 (distSummary, simple overflows).

## Plan

- Intent: the Kumaraswamy mode ((a - 1) / (a b - 1))^(1/a) (a, b >= 1) forms a b, which overflows for a = b = 1e200; the ratio is then 0 and the mode 0, where the true mode rounds to 1.
- Method: only where a b overflows, take the mode as ((a - 1) / a)^(1/a) b^(-1/a). There a b > 1.8e308, so a b - 1 is a b to double precision (the dropped 1/(a b) is below 6e-309 relative), and the two powers keep their bases in range (the single ratio (a - 1) / (a b) would fall onto the subnormals for a = 2, b = 1e308). Where a b is finite, the formula is unchanged (the same bits).
- The moments of large shapes (#249) and the Weibull counterpart (#240) are a separate, later group and are not touched here.

## Check (main `bf6ffd7`)

distSummary is not an R function. References: Rmpfr at 400 bits on the exact doubles.

| a, b | before | after | Rmpfr |
|---|---|---|---|
| 1e200, 1e200 (the issue) | 0 | 1 | 1 |
| 1e300, 2; 1e154, 1e155 | 0 | 1 | 1 |
| 2, 1e308 | 0 | 7.071067811865476e-155 | 7.071067811865475e-155 (2.2e-16) |
| 3, 1e308 | 0 | 1.882072057762082e-103 | 1.882072057762057e-103 (1.3e-14) |
| 1.5, 1.7e308 | 0 | 1.5665823020498476e-206 | 1.5665823020498064e-206 (2.6e-14) |
| 2, 3; 1e100, 1e100 | 0.4472135954999579; 1 | unchanged | |

The 1e-14 errors come from the rounding of the exponent 1/a, multiplied by log b (about 700): any double formula has them (the unchanged closed form has the same error for a = 3, b = 1e300, where a b is finite).

## Fix

- `src/distributions/summary.ts`, `case "kumar"`: the mode as above where a b overflows.

## Tests

- `test/issue239.test.ts`: the issue's call and two more that round to 1, three cases against Rmpfr (relative 5e-14), unchanged values where a b is finite. With `src/` stashed, the first two fail.
- distSummary tests and `npx tsc --noEmit -p .`: pass, no errors.

## Out of scope

- kumar(1e200, 1e200) still has sd 0 and skewness and kurtosis NaN: the moments of large shapes are issue #249 (with #240 for Weibull), planned as a separate group.

## close comment

Fixed in <commit of #239, see git log --grep='#239'>: where a b overflows, `distSummary("kumar")` now takes the mode as ((a - 1) / a)^(1/a) b^(-1/a) (a b - 1 is a b to double precision there). `distSummary("kumar", { a: 1e200, b: 1e200 }).mode` is now 1; a = 2, b = 1e308 gives 7.071067811865476e-155 (Rmpfr: 7.071067811865475e-155). Values where a b is finite are unchanged. The moments of large shapes (sd 0 here) are tracked in #249.

Test: test/issue239.test.ts. (Not pushed yet.)
