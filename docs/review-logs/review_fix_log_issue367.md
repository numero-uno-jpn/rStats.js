# Issue #367 log: coxph risk sums overflow for finite linear predictors

GitHub Issue #367. Session 12, group B (user decisions).

## Plan

- User decision (2026-11-03): only where exp(eta) would overflow, hold the risk sums as e^-m times their values (a log-sum-exp shift); option A of the prep notes. Iterating from a saturated initial value may keep NaN coefficients, as survival does (NA or an error).
- Intent: `evaluate` adds `exp(eta) w` straight into the risk sums. A finite eta above about 709.8 makes them Inf and the log partial likelihood -Inf, although it is finite (the likelihood is invariant to a common shift of eta in a risk set).
- Method: `evaluate` is the only place exp(eta) is formed. Keep a shift m per stratum, 0 at the start. When eta - m > 700, rescale all accumulators (risk set and the deaths at the current time) by e^(m - eta) and set m = eta; while the sums are still empty and eta - m < -700, set m = eta (so the first terms do not underflow). Each term is exp(eta - m) w and the log of the risk sum is log(riskSum) + m. Means and information are ratios of the sums and need no change. With m = 0 every operation is the old one (x - 0 and x + 0 are x), so the ordinary range keeps all bits.
- Consistent with the common base (session 43): the covariates are already in units of 2^e_j; the shift acts on eta only.

## Check (main `72ec3c3`, R 4.5.2 survival)

`iterMax` is `control.iterMax` (the issue's top-level `iterMax` is ignored, so its call iterates).

| call | before | survival | after |
|---|---|---|---|
| x = 0, 1, `init` 1000, iter 0 | loglik -Inf | -Inf | -1000 (true -1000 - log1p(e^-1000)) |
| x = 0, 2, `init` 1000, iter 0 | -Inf | "initial values lead to overflow or underflow of the exp function" | -2000 |
| x = 0, 800, 1600, 2400, `init` 1, iter 0 | -Inf | the same error | -4000 |
| the last two iterated | -Inf, coefficient NaN | error | loglik finite, coefficient NaN (the information is 0 at the saturated point) |
| 6-point fit (x 500 to 3000), init 0.5 | -750, NaN | -750, NA | unchanged |
| 6-point fit, default init | -4.276666119016054, -3.5357606207666024 | -4.27666611901605442, -3.53576062076660191 | unchanged |

## Fix

- `src/models/coxph.ts`, `evaluate`: the shift `shift`, `rescale`, `SHIFT_LIMIT` = 700; `deathRisk` moved out of the time loop so `rescale` can reach it.

## Tests

- `test/issue367.test.ts`: the three overflowing initial values (fail with `src/` stashed), the saturated iteration and an ordinary fit (unchanged, pass both ways).
- `test/coxph.test.ts` (fixture, 30 cases): pass, unchanged.

## Out of scope (recorded)

- None.

## close comment

Fixed in <commit of #367, see git log --grep='#367'>: `coxph` added exp(eta) w directly into the risk sums, so a finite linear predictor beyond exp's range (about 709.8) made them Inf and the log partial likelihood -Inf. `coxph([1, 2], [1, 0], [[0], [1]], { init: [1000], control: { iterMax: 0 } })` now gives loglik -1000 (survival -Inf), and x = 0, 2 gives -2000 (survival stops with "initial values lead to overflow or underflow of the exp function"). The risk sums are held as e^-m times their values, with m moved only where a finite exp(eta) would overflow, so ordinary fits are unchanged in all bits (fixture of 30 cases). Iterating from such a saturated value still gives NaN coefficients, as survival gives NA, since the information there is 0. Note that `iterMax` is an option of `control`. Recorded in docs/differences-from-r.md.

Test: test/issue367.test.ts. (Not pushed yet.)
