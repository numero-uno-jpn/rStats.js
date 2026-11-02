# Issue #136 log: noncentral t quantile where farLimit overflows (the issue's example does not reproduce; a quantile beyond the largest double was wrong)

GitHub Issue #136. Checked overnight (no change; the nearby wrong answers were left for a decision in commit `a44741a`, then in Japanese). On the morning of 2026-11-03 the user chose option A (the check at the largest double, for every df when ncp is large). The plan was approved.

## Plan

- Intent: the issue says that `qt(0.9, 2, { ncp: 1e299 })` breaks because `farLimit` overflows to Infinity. Check the claim, and fix the wrong answers found nearby: where the quantile exceeds the largest double (1.797e308), qt returned 1 or another wrong finite value instead of Infinity.
- Method (overnight): compute the issue's example and variants with npx tsx, map them back with pt, and compare with the df = 2 limit ncp / sqrt(-log p) (for a large ncp, P(T <= t) is about exp(-ncp^2 / t^2)) and with R 4.5.2.
- Method (fix): `qnt1` (`src/distributions/nt.ts`) checked whether the distribution function at Number.MAX_VALUE reaches the target only for df < 1e-3 on the near side. Now, wherever the normal starting value x0 is beyond 1e300 or not finite, it checks for every df and on both sides. That covers ncp near the largest double and a huge ncp^2 / df; for ncp > 1.3e154, ncp^2 overflows. If the target is not reached at the largest double (lower side: log P[T <= MAX] < target; far side: log P[T > MAX] > target), the quantile is s Infinity. Otherwise the code goes on as before.
- Why: user decision (option A). Here R is right (Inf) and rStats.js was wrong. The check is local, and its condition limits the extra evaluation of pt to huge starting values. Where it does not return, the path is unchanged, so finite answers keep their bits. Option B (check the result afterwards) needed a tolerance and could hide other faults.

## Check (main `f389330` overnight, `9e44863` for the fix; R 4.5.2)

The issue's example and its neighbours were already finite and correct:

| Call | Limit ncp/sqrt(-log p) | R 4.5.2 | rStats.js | pt(rStats.js value) |
|---|---|---|---|---|
| qt(0.9, 2, ncp = 1e299) (the issue's example) | 3.080782624761102e299 | Inf (wrong) | 3.0807826247611014e299 | 0.9 |
| qt(0.1, 2, ncp = 1e299) | 6.5901022898226085e298 | 9.48075190810903e153 (wrong) | 6.5901022898226085e298 | 0.09999999999999998 |
| qt(0.5, 2, ncp = 1e299) | 1.2011224087864499e299 | | 1.2011224087864497e299 | 0.4999999999999999 |
| qt(0.9, 1, ncp = 1e299) | | Inf | 7.957896561090548e299 | 0.9 |
| qt(0.9, 10, ncp = 1e299) | | | 1.433674141138895e299 | 0.9 |
| qt(0.9, 2, ncp = 1e200) | 3.080782624761102e200 | Inf | 3.0807826247611006e200 | 0.9 |
| qt(0.1, 2, ncp = 1e308) | 6.590102289822609e307 | 9.4807519081087683e153 | 6.590102289822609e307 | 0.09999999999999998 |
| qt(0.9, 2, ncp = 5e307) | 1.5403913123805511e308 | | 1.5403913123805503e308 | 0.9 |

`farLimit(1, 1e299)` does overflow to Infinity as the issue says. For p = 0.9 (the smaller tail is the upper one), the `!lowerY` branch of `qnt1` calls `farTailLog(Infinity, ...)`, which falls to `pntBoth(Infinity, ...)`. That gives an upper log probability of -Infinity. The test "the target is below it, so solve with the power law" is then false, and the ordinary solver, with upper bound hi = T0 = Infinity, finds the quantile. Only the power-law shortcut is skipped.

Quantiles beyond the largest double (wrong before, fixed):

| Call | Limit | R 4.5.2 | Before | After |
|---|---|---|---|---|
| qt(0.9, 2, ncp = 6e307) | 1.85e308 | Inf | 1 (pt 0) | Inf |
| qt(0.9, 2, ncp = 1e308) | 3.08e308 | Inf | 1 | Inf |
| qt(0.95, 2, ncp = 5e307) | 2.2e308 | Inf | 1 | Inf |
| qt(0.5, 2, ncp = 1.5e308) | 1.80e308 | Inf | 2.2844135865397565e222 | Inf |
| qt(0.9, 1, ncp = 1e308) | | Inf | 1 | Inf |
| qt(0.99, 10, ncp = 1e308) | | Inf | 1 | Inf |
| qt(1e-300, 2, ncp = 1e299, lower = FALSE) | | Inf | 1 | Inf |
| qt(0.5, 0.01, ncp = 1e299) | | Inf | 2.2844135865397565e222 | Inf |
| qt(0.1, 2, ncp = -1e308) | | -Inf | -1 | -Inf |

pt(1.7e308, 2, ncp = 1e308) = 0.7074977984184172 < 0.9, so qt(0.9, ...) is Inf.

- Sweep (scratchpad `s136.ts`): 20 ncp (-1e308 to 1.7e308, including 0.5, 10, 1e5 and 1e150 to 2e154 around the overflow of ncp^2) x 10 df (1e-5 to 1e10) x 8 p x both tails, 3200 quantiles before and after. 353 changed, all to ±Infinity, and all from wrong values: 1 or -1 (313), 2.2844135865397565e222 (24) and 2.718281828459045 (16, ncp = 1.7e308 with df <= 0.01). No finite answer changed, and none of those wrong values remains.
- R gives Inf here, so the fixed values agree with R; nothing is added to the docs.

## Fix

- `src/distributions/nt.ts` (`qnt1`): before the far-tail branch, where abs(x0) is not <= 1e300, compare the log distribution function at Number.MAX_VALUE with the target on the side being solved, and return s Infinity if the target lies beyond it.

## Tests

- `test/issue136.test.ts`: the nine Infinity cases above (with pt at 1.7e308 below 0.9), a far-tail quantile that stays finite (9.999999999749997e303), and the eight finite quantiles of the first table with their bits from before. With src stashed, the Infinity test fails and the finite one passes.
- Whole suite `npx vitest run`: 276 files, 2570 passed / 38 skipped, 0 failed. `npx tsc --noEmit -p .`: no errors.

## close comment

The issue's example was already right: qt(0.9, 2, ncp = 1e299) returns 3.0807826247611014e299, and pt at that value is 0.9 (the df = 2 limit ncp / sqrt(-log p) is 3.080782624761102e299; R 4.5.2 returns Inf). farLimit(1, 1e299) does overflow, and farTailLog(Infinity, ...) falls to pntBoth(Infinity, ...) as traced, but that gives the upper log probability -Infinity, so the power-law shortcut is skipped and the ordinary solver finds the quantile. Checking it led to a related failure, fixed in <commit of #136, see git log --grep='#136'>. Where the quantile exceeds the largest double, qt returned 1 or another wrong finite value: qt(0.9, 2, ncp = 1e308) gave 1 (true value about 3.1e308; R gives Inf), and qt(0.5, 2, ncp = 1.5e308) gave 2.28e222. qnt1 checked the distribution function at the largest double only for df < 1e-3. Wherever the normal starting value is beyond 1e300 or not finite, it now checks for every df on the side being solved, and returns ±Infinity when the target is not reached there, as R does. In a sweep of 3200 quantiles (ncp up to ±1.7e308, df 1e-5 to 1e10), 353 wrong values (1, -1, 2.28e222, e) became ±Infinity and no finite answer changed. Test: test/issue136.test.ts. (Not pushed yet.)
