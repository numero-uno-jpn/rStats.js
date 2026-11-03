# Issue #235 log: distSummary("f") moments overflow for huge degrees of freedom

GitHub Issue #235. Session 11, group A4 (distSummary, F and hypergeometric).

## Plan

- Intent: the F summary forms the variance 2 m^2 t / (n (m - 2)^2 (m - 4)), the direct sd sqrt(2) m sqrt(t) / (sqrt(n) (m - 2) sqrt(m - 4)), the skewness (2 n + m - 2) sqrt(8 (m - 4)) / ((m - 6) sqrt(n t)) and the kurtosis 12 (n (5 m - 22) t + (m - 4)(m - 2)^2) / (n (m - 6)(m - 8) t) (n = df1, m = df2, t = n + m - 2) from products that overflow for large but finite degrees of freedom. df1 = df2 = 1e308 gave NaN throughout; 1e200 gave variance NaN, sd 0 and skewness 0 (finite / Inf); df1 = 10, df2 = 1e200 variance and kurtosis NaN; df1 = 1e150, df2 = 1e60 variance 0.
- Method: keep each closed form where its numerator and denominator are both normal numbers (the same bits as before); otherwise use ratios that stay in range, with r = m / (m - 2), u = (m - 2) / n, w = (m - 2) / (m - 4) and t taken as 2 (n / 2 + m / 2 - 1) where it overflows:
  - variance: 2 r^2 (1 + u) / (m - 4); where u overflows (n tiny), 2 r^2 (1 / (m - 4) + w / n).
  - sd: sqrt(2) r sqrt(1 + u) / sqrt(m - 4); where u overflows, sqrt(2) r sqrt(w) / sqrt(n) (the dropped 1 / (m - 4) is below 1e-308 of the other term there).
  - skewness: (n + t) / sqrt(n t) = sqrt(n / t) + sqrt(t / n), times x = sqrt(8) sqrt(m - 4) / (m - 6), formed as (sqrt(n) / sqrt(t)) x + (sqrt(t) x) / sqrt(n) (so a subnormal n does not overflow sqrt(t) / sqrt(n) before x scales it down).
  - kurtosis: 12 ((5 - 22 / m) (m / (m - 6)) / (m - 8) + ((m - 4) / (m - 6)) ((m - 2) / (m - 8)) ((m / 2 - 1) / (t / 2) / n)).
- Why "both normal" and not "finite": a finite closed form can still be wrong (0 where only the denominator overflowed, 1e150 / 1e60 above), and a subnormal part has lost bits.

## Check (main `6548587`)

distSummary is not an R function. References: Rmpfr at 400 bits on the exact doubles (mantissa and exponent in, `%a` out).

| df1, df2 | before (variance, sd, skewness, kurtosis) | after | Rmpfr |
|---|---|---|---|
| 1e308, 1e308 (the issue) | NaN, NaN, NaN, NaN | 4e-308, 2e-154, 6.000000000000002e-154, 6.6e-307 | 4e-308, 2e-154, 6e-154, 6.6e-307 |
| 1e200, 1e200 | NaN, 0, 0, NaN | 4e-200, 2e-100, 6e-100, 6.5999999999999995e-199 | 4e-200, 2e-100, 6e-100, 6.6e-199 |
| 10, 1e200 | NaN, 0.447, 0.894, NaN | 0.19999999999999998, 0.4472135954999579, 0.8944271909999159, 1.2000000000000002 | 0.2, the same, the same, 1.2 |
| 1e200, 10 | 0.5208, 0.7217, 0, NaN | 0.5208333333333333, 0.7216878364870322, 3.4641016151377544, 42 | the same (variance 1 ulp) |
| 1e150, 1e60 | 0, 1.414e-30, 5.657e-30, NaN | 2.0000000000000002e-60, ..., 6e-59 | the same |
| 1.7e308, 1.7e308; 1e308, 1.7e308; 5, 1e308; 1e308, 9; 1e100, 1e100 | NaN or 0 | within 2.2e-16 | |
| 1e-320, 1e308 | NaN, Inf, Inf, NaN | Inf, 1.414221434529443e160, 2.828442869058887e160, Inf | Inf, the same, 2.828442869058886e160, Inf |
| 3, 9; 1e-300, 1e10; 1e-310, 10 | | unchanged | within 2.2e-16 |

The issue's expected skewness 4.24e-154 for df1 = df2 = 1e308 is not right: for equal D the skewness is 3 D sqrt(8 D) / (D sqrt(2 D^2)) = 6 / sqrt(D), 6e-154 (Rmpfr agrees). Its variance (4e-308) and sd (2e-154) are right.

Unchanged bits in the ordinary range: a sweep of df1, df2 over 20 values each from 0.5 to 1e150 (400 pairs; with invgamma, beta, nbinom (mu), hypergeometric and kumar modes over similar grids), against main before this group (`6ec8f78`), differs only in 20 F pairs, all with df2 = 1e100 or 1e150 whose variance and kurtosis were NaN or 0 before (now the correct values, e.g. df1 = 10, df2 = 1e150: variance 0.19999999999999998, kurtosis 1.2000000000000002); in those the sd moves by an ulp because it is now sqrt(variance) instead of the direct form. Everything else is bit for bit the same.

## Fix

- `src/distributions/summary.ts`, `case "f"`: the conditional ratio forms above.

## Tests

- `test/issue235.test.ts`: ten pairs against Rmpfr (relative 3e-16), a subnormal df1, and unchanged values where the closed forms are in range. With `src/` stashed, the first two fail.
- distSummary tests and `npx tsc --noEmit -p .`: pass, no errors.

## close comment

Fixed in <commit of #235, see git log --grep='#235'>: `distSummary("f")` now keeps each closed form (variance, direct sd, skewness, kurtosis) only where its numerator and denominator are normal numbers, and otherwise forms it from ratios such as d2 / (d2 - 2), (d2 - 2) / d1 and sqrt(d1 / t) + sqrt(t / d1), with t = d1 + d2 - 2 halved where it overflows. `distSummary("f", { df1: 1e308, df2: 1e308 })` now gives variance 4e-308, sd 2e-154, skewness 6e-154 and kurtosis 6.6e-307, within 2.2e-16 of Rmpfr on the exact doubles (the skewness is 6 / sqrt(D) for equal D, not 4.24e-154 as the issue estimated); df1 = df2 = 1e200 no longer gives sd 0 and skewness 0, and df1 = 10, df2 = 1e200 gives variance 0.2 and kurtosis 1.2. Ordinary values are unchanged.

Test: test/issue235.test.ts. (Not pushed yet.)
