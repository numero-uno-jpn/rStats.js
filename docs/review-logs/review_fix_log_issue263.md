# Issue #263 log: the pwr normal tests lose the upper critical value for tiny significance levels

GitHub Issue #263. Session 11, group B3 of the second preparation (bprep_2), implemented by the user's decision (P14).

## Plan

- Intent: `normalPower` (shared by `pwrNormTest`, `pwrPTest`, `pwr2pTest`, `pwr2p2nTest`) forms the upper critical value as `qnorm(1 - sig)` or `qnorm(1 - sig / 2)`. `1 - a` loses digits for a small a and rounds to 1 below 1.1e-16, so `qnorm` gives Infinity and the upper rejection region is dropped: sigLevel 1e-20 gave the power 1.08e-30 (the lower region only) for 2.70e-13, and `alternative: "greater"` gave 0. pwr 1.3.0 uses `qnorm(sig.level / 2, lower = FALSE)` and is right there. (Session 5's review 58 recorded "pwr's 1 - sig" as record-only, on the assumption that pwr used the same form.)
- User's decision (B3, third round): the rule of review 58 for confidence levels close to 1, i.e. the quantile of the upper tail only where the tail probability (sig / 2 two-sided, sig one-sided) is below 1e-8; otherwise the present expression, so that ordinary powers keep their bits. (Always using the upper tail, as pwr does, was the alternative; R's own `qnorm(0.05, lower = FALSE)` is 3 ulp from the correctly rounded value, so it would not bring bit agreement with R and would change an existing exact expectation.)
- Method: `upperCritical(a)` = `qnorm(a, upper)` for a < 1e-8, else `qnorm(1 - a)`; used for the two upper critical values in `normalPower`. The lower critical value `qnorm(sig / 2)` and the "less" alternative were already formed from the lower tail.

## Check (after #200 `7c3a9c3`, R 4.5.2, pwr 1.3.0, Rmpfr at 300 bits with sigLevel the double 1e-20)

| Call (d or h 0.3, n 50 unless given) | R (pwr) | Rmpfr | Before | After |
|---|---|---|---|---|
| `pwrNormTest`, sigLevel 1e-20 | 2.7021638088513114e-13 | 2.7021638088512897e-13 | 1.0799286692263845e-30 | 2.702163808851275e-13 |
| the same, greater | 4.6320520391789737e-13 | 4.6320520391789115e-13 | 0 | 4.632052039178854e-13 |
| the same, less | | | 2.521867024772904e-30 | unchanged |
| `pwrPTest`, 1e-20 | 2.7021638088513114e-13 | as above | 1.0799286692263845e-30 | 2.702163808851275e-13 |
| `pwr2pTest`, 1e-20 | 2.3247992937403397e-15 | 2.3247992937403084e-15 | 1.1614911086359125e-27 | 2.324799293740307e-15 |
| `pwr2p2nTest`, n1 30, n2 70, 1e-20 | 8.5139703098456891e-16 | 8.5139703098455701e-16 | 4.527925499203033e-27 | 8.513970309845566e-16 |
| `pwrNormTest`, 1e-300 | 7.8568302310827054e-268 | | 0 | 7.85683023108075e-268 |
| `pwrNormTest`, 1e-8 (sig / 2 = 5e-9) | 0.0001534479854131442 | | 0.00015344798480343435 | 0.00015344798541314369 |
| `pwrNormTest`, solving n for power 0.5 at 1e-20 | 968.4637047396252 | | error (no sign change) | 968.4637047396254 |
| `pwrNormTest` at 0.05 (two-sided, greater), 2e-8, sigLevel 0 | | | 0.5641160254310038, 0.6831290430800077, 0.00024089565995133398, 0 | unchanged |
| `pwrNormTest`, solving sigLevel for power 0.5 at n 50 | | | 0.033892804599303814 | 0.03389280459930374 |

The last row is the expected side effect noted in the preparation: `uniroot` evaluates the power at the end of its interval, sigLevel 1e-10, where the new rule applies, so a solved sigLevel can move by about 1e-15 (the root's tolerance is far larger). Powers computed for a given sigLevel >= 2e-8 (>= 1e-8 one-sided) keep their bits.

## Fix

- `src/htest/pwr.ts`: `upperCritical` and its use in `normalPower`.
- No docs: the new values agree with pwr (to the accuracy of R's own qnorm), so this removes a difference rather than adding one.

## Tests

- `test/issue263.test.ts`: the four functions at sigLevel 1e-20 against Rmpfr (5e-14), greater, 1e-300 and 1e-8 against pwr, solving n at 1e-20 against pwr, and unchanged values. With `src/` stashed the first test fails.
- `npx vitest run`: 352 files passed (2803 tests passed, 38 skipped). `npx tsc --noEmit -p .`: no errors.

## Out of scope

- None. After this fix no `1 - sig` form is left in pwr.ts or power.ts (the t-, chi-squared- and F-based functions already take the quantile of the upper tail).

## close comment

Fixed in <commit of #263, see git log --grep='#263'>.

The shared `normalPower` (pwrNormTest, pwrPTest, pwr2pTest, pwr2p2nTest) now takes the upper critical value from the quantile of the upper tail, `qnorm(a, lowerTail: false)`, where the tail probability a (sigLevel / 2 two-sided, sigLevel one-sided) is below 1e-8, the same rule as for confidence levels close to 1 elsewhere in the package; above that the expression is unchanged, so ordinary powers keep their values. `pwrNormTest({ d: 0.3, n: 50, sigLevel: 1e-20 })` now gives 2.702163808851275e-13 (high-precision value 2.7021638088512897e-13; pwr 2.7021638088513114e-13) instead of 1.08e-30, the "greater" alternative 4.632052039178854e-13 instead of 0, and solving n at that level no longer fails. Tests in test/issue263.test.ts.

(Not pushed yet.)
