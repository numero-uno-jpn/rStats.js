# Issue #502 log: wilcoxTest's interval from (x - mu) + mu

GitHub Issue #502. Session 14, group B3. Fixed as a fallback: where `mu` dwarfs the data, the signed rank interval takes the observations themselves. The issue's example (1 ulp) keeps R's bits and is not changed.

## Plan

- User decision (2026-11-04): E3 #502: only where the reconstruction is off by more than 2^-26 of max abs(x), use x directly (fallback). The issue's example (1 ulp) is recorded as R's bits. 7 fixture cases become correct values.
- Intent: R's `wilcox.test.default` also does `x <- x - mu` and adds `mu` back before the interval (exact and normal). The 1 ulp of the issue is the same rounding as ordinary data ((0.1 - 0.4) + 0.4 = 0.09999999999999998): taking `x0` always changes the interval or estimate of 12 to 33% of ordinary data sets (by 1 to 2 ulp, and by uniroot's tolerance, up to 5e-3 relative, in the normal approximation). Where `mu` dwarfs the data the observations are lost (R: interval NaN, estimate 0).
- Method: K3 fallback. Form `(x - mu) + mu` as before; if some value differs from the observation by more than 2^-26 of the largest observation, use `x0` without the values equal to `mu` (x - mu = 0 exactly where x = mu, so the same observations in the same order). The halved branch (#210, overflowing differences) already uses `x0`.
- Why: ordinary data keep R's bits (2500 data sets of the preparation: no change; the fixture: no change outside the 7 cases); the cases where R's interval is NaN or far off get the interval of the observations.

## Reproduction (main `c9017d1`, R 4.5.2, values by `%a`)

| Call (`confInt: true`) | R | rStats.js before | now |
|---|---|---|---|
| `wilcoxTest([8841848152503256, 8841848152503264], {mu: -5054035322351469, exact: true})` | [...255, ...263], estimate ...259 | the same bits | unchanged |
| `wilcoxTest([1, 2, 3, 4.5], {mu: 1e17})` | NaN NaN, estimate 0 ("midrange") | the same | [1.00007, 4.49993], 2.5464 (= R's interval of the data with mu = 0, exact: false, to the bit) |
| `wilcoxTest([1, 2, 3, 4.5, 7], {mu: 1e16})` | [0, 8], 3.9999 | the same | [1.99994, 5.00001], 3.2500 (same check) |
| `wilcoxTest([0.1, 0.7, 1.3, 2.2, 3.1], {mu: 0.4})` | 0x1.9999999999998p-4, ... | the same | unchanged (R's bits) |

The differences from mu all round to -mu there, so they are tied and the normal approximation is used (as R); the interval itself does not depend on mu.

Note: Windows R prints the issue's lower end as ...256 with `%.17g`; `%a` shows 0x1.f699d3249b3d7p+52 (...255), the same bits as rStats.js.

## Fix

- `src/htest/wilcoxTest.ts`, `signedRank()`: the fallback described above.
- `test/wilcox.test.ts`: `lostObservations()` (the same test on the fixture's arguments); knownDifference for confInt, confLevel and estimate, and a substitute of R's estimateNames "midrange" by "(pseudo)median" (string fields are not passed to knownDifference). 7 cases of `wilcoxTest.json` (rnorm(12, 0, 1e-200) with mu 0.5 and 1, one-sample and paired with y = 0): R's interval NaN NaN, confLevel 0, estimate 0; now the interval of the data with mu = 0 (as R gives for mu = 0).
- `docs/differences-from-r.md`, `docs/ja/`: an entry under the hypothesis tests.

## Tests

- `test/issue502.test.ts`: mu = 1e17 and 1e16 give R's interval and estimate of the data (mu = 0, exact: false) to the bit; the issue's example and an ordinary data set keep R's bits. With `src/` stashed, the two fallback tests fail.
- `test/wilcox.test.ts` (2212 cases), `issue210`, `issue49`, `rev45`, `review59`, `formulaTests` pass. `npx tsc --noEmit -p .`: no errors.

## Out of scope (recorded)

- The 7 fixture cases have data of size 1e-200, where R's normal-approximation interval with the default `tolRoot` 1e-4 (absolute) degenerates to [min, max] with the estimate at the max (R does the same for mu = 0). Not changed here.
- Normal-approximation interval ends already differ from R by a few ulp in some cases (e.g. the lower end 0x1.00002e911451ap+1 against R's ...51fp+1 for c(1, 2, 3, 4.5, 7, 8, 9.5, 11)); the estimates agree. As before.

## close comment

Fixed in part in <commit of #502, see git log --grep='#502'>. R's `wilcox.test` also forms the interval from `(x - mu) + mu`, and for the issue's example R 4.5.2 gives the same bits as rStats.js ([8841848152503255, 8841848152503263], estimate 8841848152503259; Windows R's `%.17g` prints ...256, but `%a` shows ...255). That 1 ulp is the same rounding as ordinary data such as (0.1 - 0.4) + 0.4, and using the observations always would change R's values for many ordinary data sets, so it is kept as R's bits. Where `mu` dwarfs the data, however, the reconstruction loses the observations: `wilcoxTest([1, 2, 3, 4.5], {mu: 1e17, confInt: true})` gave the interval NaN NaN and the estimate 0, as R. When some reconstructed value is off by more than 2^-26 of the largest observation, rStats.js now takes the observations themselves, giving the interval of the data ([1.00007, 4.49993], 2.546). Ordinary data keep their values; 7 fixture cases (data of size 1e-200 with mu 0.5 and 1) now differ from R's NaN. Recorded in docs/differences-from-r.md. A test was added: test/issue502.test.ts. (Not pushed yet.)
