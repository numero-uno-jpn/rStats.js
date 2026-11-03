# Issue #202 log: pwrF2Test overflows u + v, and the F test with huge degrees of freedom

GitHub Issue #202. Session 11, group B3 of the first preparation (bprep_1), implemented by the user's decision (P14).

## Plan

- Intent: `pwrF2Test` forms the noncentrality as `f2 * (u + v + 1)`. For u = v = 1e308 the sum overflows and the power is reported as the limit 1, although the noncentrality is 2. Fixing the noncentrality alone is not enough: with both degrees of freedom this large, `qf(0.95, u, v)` = 1 + O(u^-1/2) rounds to 1 in doubles, and `pf(1, ...)` gives about 0.5 instead of the test's power. This loss of the critical value starts near 1e20, independently of the overflow (u = v = 1e28 gave 0.302 and 1e32 and above 0, for a true 0.2595).
- User's decision (B3, first round): the noncentrality from scaled terms where it is not finite, and the normal approximation of F where both degrees of freedom exceed 1e20 (R gives NaN there, so docs). Second decision: the negative power found out of scope during the preparation (`pwrF2Test({u: 2, v: 1e308, f2: 1e-308})` = -0.817, R 0.13271), from the noncentral `pf` with a huge df2 (recorded in the #135 log), fixed with the noncentral chi-squared limit under the same criterion as `qf` (qnfRaw).
- Method:
  - `pwrF2Test`: where `ncp` is not finite for finite u, v and f2, `ncp = 2 (f2 (u / 2 + v / 2 + 0.5))`. Then, as before, Infinity gives the limit 1.
  - New `fPowerHugeDf` in pwr.ts (shared with #200, `pwrAnovaTest`): for df1 finite and both degrees of freedom above 1e20 (`hugeDf`), the power P[F > qf] with F normal, mean 1 + mu (mu = ncp/df1), variance 2 (1 + 2 mu)/df1 + 2 (1 + mu)^2/df2, and the null variance 2/df1 + 2/df2 for the critical value. The standard deviation is a `Math.hypot` so that (1 + mu)^2 does not overflow. The error of the approximation is O(df1^-1/2), below 1e-10 there.
  - `pnf1` (src/distributions/nbeta.ts): for df2 > 1e40, `hugeDf2` evaluates the criterion of qnfRaw (W = chi2_n/n is 1 on the scale of the result: n > 1e40 (|log p| + 1) and n > 1e20 (m + 2 |log p| + 1e3 + 4 sqrt((m + ncp)(|log p| + 1)))), with |log p| that of the smaller tail of the limit at q; where it holds, `pnchisq1(q m, m, ncp)` as for df2 = Inf. It is placed before the tiny-q series, which was what went wrong (its first term x^a / (a B(a, b)) is not small when b = df2/2 is huge: x b = m q/2).
- Why: the decided options. Values with df2 <= 1e40 in `pf`, and in `pwrF2Test` with either degree of freedom <= 1e20 and v <= 1e40, keep their bits (checked below), and the overflow fallback only runs where the old noncentrality was not finite.
- Commits: one commit for both parts (the test file covers both).

## Check (main `54c9ab0`, R 4.5.2, pwr 1.3.0)

| Call | R | Before | After |
|---|---|---|---|
| `pwrF2Test({u: 1e308, v: 1e308, f2: 1e-308})` | NaN | 1 | 0.04999999999999999 (limit 0.05 + 1e-155) |
| `pwrF2Test({u: d, v: d, f2: 2 sqrt(d)/(2d + 1)})`, d = 1e24 / 1e28 / 1e32 / 1e100 | 1 with "pnchisq not converged" (1e24) | 0.25918990661239977 / 0.3024642874190535 / 0 / 0 | 0.25951102284186195 / 0.2595110228414482 / 0.259511022841444 / 0.259511022841444 (limit `pnorm(qnorm(0.95) - 1, upper)` = 0x1.09bd41f038d84p-2 = 0.25951102284144434) |
| `pwrF2Test({u: 2, v: 1e308, f2: 1e-308})` | 0x1.0fca4497d7c32p-3 = 0.13271001423251644 | -0.8170034722010077 | 0.13271001423251663 |
| `pf(3, 2, 1e308, ncp = 1, upper)` / lower | 0x1.0ef4101415903p-3 / 0x1.bc42fbfafa9c1p-1 (= R's pchisq(6, 2, ncp = 1)) | -0.8195919791377926 / 1.8195919791377926 | 0.13230145036022428 / 0.8676985496397758 |
| `pf(3, 2, 1e308, ncp = 0, upper)` | e^-3 | -1.9999999999998224 | 0.04978706836786395 |
| `pf(3, 2, 1e200 or 1e40, ncp = 1, upper)`, central `pf(3, 2, 1e308)` | | 0.13230145036022428, 0.049787068367863944 | unchanged |
| `pwrF2Test` u 3 v 60 f2 0.15 (power), solving v for power 0.8; u 1e30 v 10 f2 1e-30; u Inf; f2 1e308 | | 0.7109605416866716, 72.70582657950871, 0.050000000000000024, 1, 1 | unchanged |

The normal approximation was compared with the exact path where the latter still works: at u = v = 1e16 the two differ by 4e-8 relative, of the order of the approximation's own error there (1/sqrt(1e16)).

## Fix

- `src/htest/pwr.ts`: `HUGE_DF`, `hugeDf`, `fPowerHugeDf`; the noncentrality fallback and the two branches in `pwrF2Test`'s `powerOf`.
- `src/distributions/nbeta.ts`: `hugeDf2` and the branch in `pnf1`. This applies also to `ncp = 0` given explicitly (which goes through `pnf1`; it gave -2.0 above). The central `pf` without `ncp` does not go through `pnf1` and is unchanged.
- `docs/differences-from-r.md`, `docs/ja/differences-from-r.md`: a row after the #272 row. The `pf` fix agrees with R (R's pnf switches to pnchisq for df2 > 1e8), so it has no row.

## Tests

- `test/issue202.test.ts`: the issue's example (0.05 to 1e-14), the sweep d = 1e24 to 1e200 against the limit (1e-10) and d = 1e100 to 1e-14, R's value for u = 2, v = 1e308, `pf` with df2 = 1e308 against R's pchisq (both tails, and ncp = 0), and unchanged values from before the fix. With `src/` stashed, the first two tests fail.
- `test/issue135.test.ts`: `pf(1e300, 1e-200, 1e200, ncp = 1, log = TRUE)` is now -0 instead of 0 (the chi-squared limit's sign of zero, the same as for df2 = Inf); the assertion now compares abs(value) with 0. Its other values (df2 = 1e200) still pass at 1e-14.
- `npx vitest run`: 350 files, the only failure was the issue135 assertion above (fixed); after the fix both files pass. `npx tsc --noEmit -p .`: no errors.

## Out of scope

- Just below the threshold the exact path is still off: `pwrF2Test` with u = v = d and ncp = 2 sqrt(d) gives, relative to the limit 0.25951102284144, 4e-7 at d = 1e17, -5e-7 at 1e18, 7e-6 at 1e19, 1.2e-5 at 1e19.5 and at exactly 1e20 (not above the threshold: 0.25951419851352897), while the true value differs from the limit by O(1/sqrt(d)) (3e-9 at 1e17). So the loss of the critical value starts near 1e17, not 1e20. Lowering the threshold to about 1e16 would remove it (the approximation's error there is of order 1e-8); this changes values that are not overflows and is left for the user's decision.
- `df(3, 2, 1e308, ncp = 1)` gives 0.6065 for the chi-squared limit 2 dchisq(6, 2, ncp = 1) = 0.0956: the density's tiny-q first term (`dnfCore`) has the same defect as `pnfTiny` for a huge df2. Not changed (the decision covers `pf`).
- `pnfTiny` itself is still used where the criterion fails (for example df1 near df2/1e20); the #135 log's other examples (#158) are unchanged.

## close comment

Fixed in <commit of #202, see git log --grep='#202'>.

`pwrF2Test` now forms the noncentrality as `2 f2 (u / 2 + v / 2 + 0.5)` where `f2 (u + v + 1)` is not finite for finite inputs, so `pwrF2Test({u: 1e308, v: 1e308, f2: 1e-308})` no longer takes the infinite-noncentrality shortcut. With both degrees of freedom this large the critical value `qf(0.95, u, v)` rounds to 1 in doubles, so where both exceed 1e20 the power is now taken from the normal approximation of the F statistic (error below 1e-10 there): the example gives 0.04999999999999999 (the exact value is 0.05 + 1e-155; R gives NaN). This also corrects u = v = 1e28 to 1e308 with a moderate noncentrality, which gave 0.30 or 0 for 0.2595.

While checking it, the noncentral `pf` with df2 = 1e308 was found to give negative probabilities (`pwrF2Test({u: 2, v: 1e308, f2: 1e-308})` was -0.817); `pf` now takes the noncentral chi-squared limit where df2 is too large to matter (the criterion already used by `qf`), giving 0.13271001423251663 (R 0.13271001423251644). `pf` with df2 up to 1e40, and powers with a degree of freedom up to 1e20 and df2 up to 1e40, are unchanged. Documented in docs/differences-from-r.md; tests in test/issue202.test.ts.

(Not pushed yet.)
