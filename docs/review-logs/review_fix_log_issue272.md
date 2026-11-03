# Issue #272 log: powerAnovaTest's overflow fallback still multiplies the group count and the sample size first

GitHub Issue #272. Session 11, group A5 of the second triage (effect sizes and powers in pwr.ts and power.ts).

## Plan

- Intent: `powerAnovaTest` computes the noncentrality lambda = (groups - 1) n between / within, and where that overflows retries with the ratio first, (groups - 1) n (between / within). The retry still forms (groups - 1) n, which can overflow by itself while lambda is in range; lambda then stays Infinity and the power is reported as the limit 1. With between = 0 the product 0 Inf even gave lambda NaN.
- Method: keep both existing forms (so every value that was finite keeps its bits) and, only where the second is still not finite (Inf or NaN) for finite groups and n, compute a b c / d with each factor scaled to [1, 2) by a power of 2 and the exponents added back with `ldexp` (`scaledProductOver`, local to power.ts; 0 for c = 0).
- Why this: the scaled product cannot overflow or underflow in its partial products, and returns Infinity only where lambda itself is beyond the doubles (the limit 1 is kept there). The shared `productOver` (a b / n) does not cover four factors without a further partial product that can overflow.
- The issue's example (groups = n = 1e200) leads to df1 = 1e200 and df2 = Inf; it was not run under vitest. It was run once as a single bundled node process under `timeout 60` (esbuild bundle, no child processes): it returned at once (see below).
- R's `power.anova.test` also multiplies first (NaN for the cases below), so they are recorded in docs.

## Check (main `9513619`, R 4.5.2)

| Call | R | Before | After |
|---|---|---|---|
| groups 3, n 1e308, between 1, within 1e308 (lambda = 2, df2 Inf) | NaN | 1 | 0.2255449157695638 (R's `pchisq(qchisq(0.05, 2, lower.tail = FALSE), 2, ncp = 2, lower.tail = FALSE)` = `pf(..., 2, 1e300, ncp = 2)` = 0.22554491576956397) |
| the same with between 0 | NaN | NaN | 0.05 (lambda 0) |
| groups 4, n 5, between 1, within 3 | `0x1.6a0b7b49ead58p-2` (R's noncentral F; documented accuracy difference) | 0.3535594237229933 | unchanged |
| groups 3, n 10, between 1e308, within 1e308 (the earlier ratio-first fallback) | not run | 0.9732550750514971 | unchanged |
| groups 3, n 1e308, between 1, within 1e-10 (lambda beyond the doubles) | not run | 1 | unchanged |
| the issue's groups 1e200, n 1e200, between 1e8, within 1e308 (lambda 1e100) | not run | 1 | 0.7602499389065251 (see Out of scope) |

## Fix

- `src/htest/power.ts`: `scaledProductOver` and the third step in `powerAnovaTest`'s `powerOf`.
- docs/differences-from-r.md and docs/ja/differences-from-r.md: a row after the `pwr.r.test` row (the older row on overflowing noncentralities stays as it is).

## Tests

- `test/issue272.test.ts`: the safe example against R's chi-squared value (relative 1e-14) and between 0 giving the significance level; ordinary calls, the earlier fallback and an infinite lambda keep the values from before the fix. With `src/` stashed the first test fails.
- `npx vitest run`: 349 files passed (2796 tests passed, 38 skipped), with the fixes of #264, #265, #269 and #272 together. `npx tsc --noEmit -p .`: no errors.

## Out of scope

- With the issue's degrees of freedom (df1 = 1e200, df2 = Inf) the critical value `qf(0.05, df1, Inf, lower = FALSE)` = 1 + 2.3e-100 rounds to 1, and pf(1, ...) with lambda = 1e100 gives 0.760 where the normal approximation of the test gives about 0.174 (P(Z > (2.33e-100 - 1e-100) / 1.41e-100)). This is the loss of the critical value in doubles for huge degrees of freedom, the same kind as pwrAnovaTest's and pwrF2Test's (#200, #202), which are handled separately; not changed here. Where the critical value is representable (groups 1e6, n 1e305, lambda about 1000) the new value 0.17420677771778384 agrees with that approximation (0.174).

## Follow-up 1: the normal approximation of F for huge degrees of freedom (user's decision, fifth round)

- Plan: the Out of scope above. The user decided to extend the normal approximation of `pwrF2Test` and `pwrAnovaTest` (#202, #200) to `powerAnovaTest`, only where both degrees of freedom exceed the threshold (1e16 since the follow-up of #200/#202). Every call with groups - 1 <= 1e16 keeps its bits.
- Method: `HUGE_DF`, `hugeDf` and `fPowerHugeDf` moved from pwr.ts to power.ts (pwr.ts imports them; their code is unchanged), and in `powerAnovaTest`'s `powerOf`, after the limit 1 for an infinite lambda, `if (hugeDf(df1, df2)) return fPowerHugeDf(df1, df2, lambda, sig)` with df1 = groups - 1, df2 = (n - 1) groups (Infinity allowed for df2; groups = Inf keeps the exact path as before).
- Check (after `29ec927`, R 4.5.2):

| Call | R | Before | After |
|---|---|---|---|
| groups 1e200, n 1e200, between 1e8, within 1e308 (the issue's example; df1 1e200, df2 Inf, lambda 1e100) | NaN | 0.7602499389065251 | 0.17418726161793208 (pnorm(qnorm(0.95) - 1/sqrt(2), upper) = 0x1.64bc4a803b038p-3 = 0.1741872616179323, exact to O(1e-100)) |
| groups 1e17, n 2, between sqrt(1e17)/1e17, within 1 (df1 = df2 = 1e17, lambda 2 sqrt(df1)) | 1 (pnchisq not converged) | 0.2595111267699508 | 0.2595110241630547 (256-bit reference of the #202 follow-up 0.25951102181670718) |
| groups 1e18, n 2, between 1e-9, within 1 | | 0.2595108972704641 | 0.25951102325937403 (reference 0.25951102251739381) |
| groups 1e30, n 2, between 1, within 1e15 (lambda 2e15 = 2 sqrt(df1)) | 1 (pnchisq not converged) | 5.174889337672401e-175 | 0.25951102284144456 (limit 0.25951102284144434) |
| groups 1e40, n 2, between 2, within 1e20 | | 0 | 0.6387600313123349 |
| groups 1e16 and 1e16 + 2 (df1 = 1e16), n 2, between 1e-8, within 1; groups 4, n 5, between 1, within 3; groups 3, n 1e308, between 1, within 1e308; groups 1e6, n 1e305, between 1e-302, within 1 | | 0.25951103333841163, 0.2595110300979085, 0.3535594237229933, 0.2255449157695638, 1 | unchanged |

- Tests: `test/issue272.test.ts` "takes the normal approximation of F where both degrees of freedom exceed 1e16" (the issue's example to 1e-14 relative, 1e17 and 1e18 against the references to 3e-9 and 1e-9, 1e30 against the limit) fails with `src/` stashed; groups 1e16 and 1e16 + 2 added to the unchanged values.
- Docs: a row after the #272 row in `docs/differences-from-r.md` and `docs/ja/differences-from-r.md`.
- `npx vitest run`: 355 files passed (2814 tests passed, 38 skipped). `npx tsc --noEmit -p .`: no errors.

## close comment

Fixed in <commit of #272, see git log --grep='#272'>: where the noncentrality (groups - 1) n between / within is still not finite after taking the ratio first, `powerAnovaTest` now forms it from the four factors scaled by powers of 2, so (groups - 1) n no longer overflows on its own. `powerAnovaTest({ groups: 3, n: 1e308, betweenVar: 1, withinVar: 1e308 })` (lambda = 2, df2 = Inf) now gives power 0.2255449157695638 (R's `pchisq` for this case: 0.22554491576956397) instead of 1, and with `betweenVar: 0` the significance level 0.05 instead of NaN. R's `power.anova.test` gives NaN there, so this is recorded in docs/differences-from-r.md. Values that were finite are unchanged to the bit. For the example in the issue (df1 = 1e200, df2 = Inf) the critical F value rounds to 1 in doubles, so where both degrees of freedom exceed 1e16 `powerAnovaTest` now takes the power from the normal approximation of F, as `pwrAnovaTest` and `pwrF2Test` do (#200, #202): the example gives 0.17418726161793208 (the exact value is pnorm(qnorm(0.95) - 1/sqrt(2), upper) = 0.1741872616179323 to O(1e-100); it was 0.760, and R gives NaN). Calls with groups - 1 up to 1e16 are unchanged. (Not pushed yet.)
