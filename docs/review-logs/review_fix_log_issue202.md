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

## Follow-up 1: the threshold lowered to 1e16 (user's decision, fifth round)

- Plan: the first bullet of Out of scope above. The user decided to lower `HUGE_DF` (pwr.ts, shared by `pwrF2Test` and `pwrAnovaTest`) from 1e20 to 1e16, accepting that values between 1e16 and 1e20 that do not overflow change. One commit for both functions, as the constant is shared (#200 and #202).
- Reference: the power P[X/u - c Y/v > 0], X ~ χ²(u, λ), Y ~ χ²(v), by the Davies (1973) sum of the characteristic function in Rmpfr (256 bits, step 2π/80 standard deviations, 261 terms), with the critical value c solved for by a secant on the same sum at λ = 0 (scratchpad `fix19_ref.R`). Checked against the exact path where that is accurate: u = 1000, v = 2000, λ = 30 gives 0.13539330442117514, rStats.js `pf(qf(...))` 0.13539330442117528; u = 1e4, v = 1e5, λ = 100: 0.16589509548757478 and 0.1658950954875746.
- Results (sig 0.05; "exact" is `pf(qf(...))`, the path below the threshold; "normal" is `fPowerHugeDf`; errors are the value minus the reference):

| u, v, ncp | Reference | Exact (error) | Normal (error) |
|---|---|---|---|
| 1e15, 1e15, 2 sqrt(u) | 0.25951101259407501 | 0.2595110230382408 (+1.0e-8) | 0.25951103605754955 (+2.3e-8) |
| 1e16, 1e16, 2e8 | 0.25951101960094143 | 0.25951103333841163 (+1.4e-8) | 0.25951102702074375 (+7.4e-9) |
| 2e16, 2e16, 2 sqrt(u) | 0.25951102055006270 | 0.2595110280643643 (+7.5e-9) | 0.2595110257966553 (+5.2e-9) |
| 3e16, 3e16, 2 sqrt(u) | 0.25951102097053901 | 0.25951095704828075 (-6.4e-8) | 0.25951102525436387 (+4.3e-9) |
| 1e17, 1e17, 2 sqrt(u) | 0.25951102181670718 | 0.2595111267699508 (+1.0e-7) | 0.2595110241630547 (+2.3e-9) |
| 1e18, 1e18, 2e9 | 0.25951102251739381 | 0.2595108972704641 (-1.3e-7) | 0.25951102325937403 (+7.4e-10) |
| 1e19, 1e19, 2 sqrt(u) | 0.25951102273897040 | 0.2595128173946687 (+1.8e-6) | 0.2595110229736051 (+2.3e-10) |
| 1e20, 1e20, 2e10 | 0.25951102280903905 | 0.25951419851352897 (+3.2e-6) | 0.2595110228832371 (+7.4e-11) |
| 1e17, 1e30, 3 sqrt(u) | 0.68312904015435778 | 0.6831358772676552 (+6.8e-6) | 0.683129041470188 (+1.3e-9) |
| 1e18, 1e18, 1 | 0.050000000051567823 | 0.04999995999253302 (-4.0e-8) | 0.05000000005156781 (-1e-17) |
| 1e16, Inf, 2e8 | 0.40879721672864143 | 0.40879721637803496 (-3.5e-10) | 0.40879722158581133 (+4.9e-9) |
| 2e16, Inf, 2 sqrt(u) | 0.40879721762642625 | 0.4087972147659643 (-2.9e-9) | 0.40879722106096394 (+3.4e-9) |
| 3e16, Inf, 2 sqrt(u) | 0.40879721802415964 | 0.4087972210322862 (+3.0e-9) | 0.4087972208284479 (+2.8e-9) |
| 1e17, Inf, 2 sqrt(u) | 0.40879721882455992 | 0.4087972133669664 (-5.5e-9) | 0.40879722036053184 (+1.5e-9) |

  With v of the same order as u, the normal approximation is closer to the reference from 1e16 on, and the exact path's error grows to 1e-7 at 1e17 and 1e-6 at 1e19, while the approximation's falls as 1/sqrt(u) (7e-9, 2e-9, 2e-10). With v = Inf the exact path (`pnchisq`/`qchisq`) is better at 1e16 and the two are equal (3e-9) at 2e16 and 3e16; the approximation is better from 1e17. Below 1e16 (1e15) the exact path is better; u = 1e16 itself is not above the threshold and keeps the exact path. So 1e16 is about where the two cross, as expected. R gives 1 with "pnchisq not converged" for u = v = 1e17 to 1e20 (pwr 1.3.0).
- Fix: `HUGE_DF = 1e16` and the comments in `src/htest/pwr.ts` (the approximation's error is now stated as O(df^-1/2), about 1e-8 at 1e16).
- Tests: `test/issue202.test.ts` "takes the normal approximation where both degrees of freedom exceed 1e16" (the rows 1e17, 1e18, 1e19, (1e17, 1e30) and (1e18, ncp 1) against the reference, tolerances 3e-9 to 1e-16, and `pwrAnovaTest({k: 1e20, n: 2, f: 1e-5})` to 1e-10); it fails with `src/` stashed. `test/issue200.test.ts`: k = 1e20 moved out of "unchanged" (it is now above the threshold) and replaced by k = 1e16 (not above it: 0.25951103333841163, unchanged).
- Docs: the #202 and #200 rows in `docs/differences-from-r.md` and `docs/ja/differences-from-r.md` (1e16, the errors above).
- `npx vitest run`: 355 files passed (2813 tests passed, 38 skipped). `npx tsc --noEmit -p .`: no errors. (This line was added with follow-up 2.)

## Follow-up 2: the density df with a huge df2 (user's decision, fifth round)

- Plan: the second bullet of Out of scope above. The user decided that the noncentral `df` takes the noncentral χ² density limit under the same criterion as `pf` (`pnf1`). In `dnf1` the branch for df2 = Inf now also covers `n > 1e40 && hugeDf2(x, m, n, ncp)`, placed where `pnf1` has it (before x = 0, the central shortcut and `dnfCore`'s tiny-q first term, which is what went wrong: its first term is not small when x n/2 is not). x = 0 and x = Inf fail the criterion (|log p| is Inf) and keep their values. Values with df2 <= 1e40 keep their bits.
- Check (R 4.5.2; Rmpfr: the Poisson mixture series of the noncentral χ² density at 200 bits):

| Call | R | Rmpfr | Before | After |
|---|---|---|---|---|
| `df(3, 2, 1e308, ncp = 1)` | 0x1.878c02295d354p-4 = 0.095592506831804265 | 2 dchisq(6, 2, ncp = 1) = 0.095592506831810265 | 0.6065306597125976 | 0.09559250683181027 |
| the same with `log = TRUE` | -2.347660842417099 | | -0.5000000000000591 | -2.3476608424170817 |
| `df(0.5, 5, 1e308, ncp = 0.5)` | 0.66309975970528621 | 5 dchisq(2.5, 5, ncp = 0.5) = 0.66309975970533547 | 2.046893316607165 | 0.6630997597053354 |
| `df(3, 2, df2, ncp = 1)`, df2 = 1e300 / 1e200 / 1e41 | 0.095592506831822419 (1e300), 0x1.878c02295d517p-4 (1e200) | 0.095592506831810265 | 0.09559250683181383 / 0.09559250683180841 / 0.09559250683180977 | 0.09559250683181027 |
| `df(1e-300, 2, 1e308, ncp = 1)` | 0.60653065971260558 | e^-0.5 = 0.60653065971263342 | 0.6065306597126334 | 0.6065306597126335 (1 ulp; dnchisq at 2e-300) |
| `df(5e299, 2, 1e308, ncp = 1e300)` | NaN | about 3.98942279e-151 (see Out of scope) | 0 | 3.9894228040144464e-151 |
| `df(3, 2, 1e40 / 1e20 / 100, ncp = 1)`, `df(1.5, 4, 30, ncp = 2.5)`, `df(0, 2, 1e308, ncp = 1)`, `df(Inf, 2, 1e308, ncp = 1)`, central `df(3, 2, 1e308)`, `df(3, 2, 1e308, ncp = 0 or 1e-300)` | | | 0.09559250683180977, 0.09559250683181045, 0.09542691489739202, 0.35796007715889616, 0.6065306597126334, NaN, 0.049787068367863944, 0.049787068367863944 | unchanged |

- Fix: `src/distributions/nbeta.ts` (`dnf1`, and the comment of `hugeDf2`).
- Tests: `test/issue202.test.ts` "takes the noncentral chi-squared limit of df for a huge df2" (the first three rows against Rmpfr at 1e-14) fails with `src/` stashed; the unchanged values above were added to "leaves the other cases as before".
- Docs: R's density for the first rows is correct (to 6e-14), so they have no row; `df(5e299, 2, 1e308, ncp = 1e300)` (R NaN) has a row after the `pf(1e290, 1, 1e290, ...)` row in `docs/differences-from-r.md` and `docs/ja/differences-from-r.md`.
- `npx vitest run`: 355 files passed (2815 tests passed, 38 skipped). `npx tsc --noEmit -p .`: no errors.
- Out of scope: `hugeDf2`'s criterion bounds the first-order effect of W = χ²_n/n but not the second, ½ var(W) (q m)² d²P/dy², which is about (m + ncp) |log p| / n relative. With ncp near n / 1e8 that is about 1e-9, not the double: for `df(5e299, 2, 1e308, ncp = 1e300)` the limit 1e-150/sqrt(2π) is high by about 2.5e-9 relative (½ (2/n) y^2/σ^2 with y = 1e300, σ^2 = 4e300), and `pf` there by the same order. The new value is still far closer than the old 0 (R NaN). A criterion with an ncp term (for example n > 1e20 (m + ncp) (|log p| + 1)) would leave such points to the series, whose behaviour there was not checked; not changed (the decision was to use pf's criterion). Also, the noncentral χ² density itself gives 2 dchisq(1e300, 2, ncp = 1e300) = 3.9894228040144464e-151 where 1/(sqrt(2π) 1e150) (1 + O(1e-300)) = 3.989422804014327e-151 (3e-14 relative); not looked into.

## close comment

Fixed in <commit of #202, see git log --grep='#202'>.

`pwrF2Test` now forms the noncentrality as `2 f2 (u / 2 + v / 2 + 0.5)` where `f2 (u + v + 1)` is not finite for finite inputs, so `pwrF2Test({u: 1e308, v: 1e308, f2: 1e-308})` no longer takes the infinite-noncentrality shortcut. With both degrees of freedom this large the critical value `qf(0.95, u, v)` rounds to 1 in doubles, so where both exceed 1e20 the power is now taken from the normal approximation of the F statistic (error below 1e-10 there): the example gives 0.04999999999999999 (the exact value is 0.05 + 1e-155; R gives NaN). This also corrects u = v = 1e28 to 1e308 with a moderate noncentrality, which gave 0.30 or 0 for 0.2595.

While checking it, the noncentral `pf` with df2 = 1e308 was found to give negative probabilities (`pwrF2Test({u: 2, v: 1e308, f2: 1e-308})` was -0.817); `pf` now takes the noncentral chi-squared limit where df2 is too large to matter (the criterion already used by `qf`), giving 0.13271001423251663 (R 0.13271001423251644). `pf` with df2 up to 1e40, and powers with a degree of freedom up to 1e16 and df2 up to 1e40, are unchanged.

Follow-up: the threshold of the normal approximation is now 1e16 instead of 1e20 (for `pwrF2Test` and `pwrAnovaTest`). Between 1e16 and 1e20 the exact path `pf(qf(...))` was off by up to 3e-6, as the critical value keeps only a few digits beyond 1 there; against a 256-bit reference the approximation is off by 2.3e-9 at u = v = 1e17 (the exact path 1.0e-7) and 7e-11 at 1e20 (3.2e-6). The density `df` now takes the corresponding noncentral χ² density limit under the same criterion: `df(3, 2, 1e308, ncp = 1)` gave 0.6065 and now gives 0.09559250683181027 (2 dchisq(6, 2, ncp = 1) = 0.095592506831810265; R 0.095592506831804265); values with df2 up to 1e40 are unchanged. Documented in docs/differences-from-r.md; tests in test/issue202.test.ts.

(Not pushed yet.)
