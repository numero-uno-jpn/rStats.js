# Issue #145 log (with #146): q just below an integer in the discrete distribution functions

GitHub Issues #145 (pgeom) and #146 (pnbinom, both parameterizations). Checked overnight (group D of the overnight notes); on the morning of 2026-11-03 the user chose option D3, with psignrank on the same rule (sub-option a). This reverses the decision of review 25 (see below). The plan was approved. #146 is handled in the same commit; its log (`review_fix_log_issue146.md`) refers here.

## Plan

- Intent: the issues say that `pgeom(0.99999999, 0.5)` and `pnbinom(0.99999999, 1, prob = 0.5 / mu = 1)` are 0.75 = P[X <= 1], while P[X <= 0.99999999] = P[X <= 0] = 0.5. The cause is `floor(q + 1e-7)`, which counts every q in [k - 1e-7, k) as k. The same `floor(q + 1e-7)` is in ppois, pbinom, phyper, pwilcox and the exact Ansari-Bradley distribution, and psignrank uses `round(q + 1e-7)` (nearest integer), so `psignrank(0.6, 4)` is P[V <= 1] = 0.125 instead of P[V <= 0] = 0.0625.
- Method (D3): one helper `countAtMost(q)` in `src/internal/integer.ts`: a q within 1e-9 max(1, abs(q)) of an integer (`nonInt(q)` false, the rule of the densities) is that integer; any other q gives floor(q). Used at all eight call sites (pgeom, pnbinom, pnbinomMu, ppois, pbinom, phyper, pwilcox, psignrank, pansariExact).
- Why: user decision. It returns the mathematically correct value for every q that is not within the densities' slack of an integer, and makes p agree with d: before, `dpois(0.99999999, 1)` was 0 (not an integer) while `ppois(0.99999999, 1)` counted it as 1 (R 4.5.2 has the same disagreement). Computed integers such as 2.9999999999999996 still count as 3, which was the purpose of R's 1e-7. Option D2 (plain floor(q)) would have lost that; D1 (no change) would have kept the wrong values.
- Expected effect: values change only for q within 1e-7 of an integer (and, for k > 100, within 1e-9 k: see below), plus psignrank at fractional parts of 0.5 or more. Integer q and q at least 1e-7 (and 1e-9 k) away from an integer keep their bits.

## Reversal of review 25

Review 25 (`review_fix_log_20261031_25.md`, the table row "pbinom などの `floor(q + 1e-7)`") kept `pbinom(0.99999995, 1, 0.5)` = 1 because the reviewer withdrew the finding as "the same processing as R". The audit ledger also judged pbinom and psignrank "R-compatible, no problem" while flagging pgeom and pnbinom, so the judgments were not consistent. On 2026-11-03 the user reversed the review 25 decision: correct values and agreement with the densities take precedence over R's 1e-7 (the policy "mathematically correct values over agreement with R"). Now `pbinom(0.99999995, 1, 0.5)` is 0.5.

## Check (main `ccba0d2` before the fix; R 4.5.2)

Scripts: scratchpad `dz.R`, `dz.ts`, `big145.R`, `big145.ts`.

| q | function | R 4.5.2 | Before | After | True |
|---|---|---|---|---|---|
| 0.99999999 | pgeom(q, 0.5) | 0.75 | 0.75 | 0.5 | 0.5 |
| 0.99999999 | pnbinom(q, 1, prob = 0.5), (q, 1, mu = 1) | 0.75, 0.75 | 0.75, 0.75 | 0.5, 0.5 | 0.5 |
| 0.99999999 | ppois(q, 1) | 0.7357589 | 0.7357588823428847 | 0.36787944117144245 | e^-1 |
| 0.99999999 | pbinom(q, 5, 0.5) | 0.1875 | 0.1875 | 0.03125 | 1/32 |
| 0.99999999 | phyper(q, 5, 5, 5) | 0.1031746 | 0.10317460317460317 | 0.003968253968253968 | 1/252 |
| 0.99999999 | pwilcox(q, 3, 3) | 0.1 | 0.1 | 0.05 | 1/20 |
| 0.99999999 | psignrank(q, 4) | 0.125 | 0.125 | 0.0625 | 1/16 |
| 1 - 1e-7 | all of the above | as at 0.99999999 | as R | as at 0.99999999 | P[X <= 0] |
| 1 - 2e-7 | all of the above | P[X <= 0] (psignrank 0.125) | as R | P[X <= 0] (psignrank 0.0625) | P[X <= 0] |
| 2.9999999999999996 | all of the above | P[X <= 3] | as R | unchanged (P[X <= 3]) | the computed 3 |
| 0.99999999 | dpois(q, 1), dgeom(q, 0.5) | 0, 0 | 0, 0 | unchanged | 0 |
| 1000 - 5e-7 | ppois(q, 1000) | 0.4957948 (P[X <= 999]) | 0.4957947558197845 | 0.508409367168506 (P[X <= 1000]) | P[X <= 999] |
| 1000 - 5e-7 | dpois(q, 1000) | 0.01261461 (the density at 1000) | 0.012614611348721503 | unchanged | 0 |

- Large q: the densities' slack 1e-9 max(1, abs(q)) is wider than 1e-7 for q > 100. There q in [k - 1e-9 k, k - 1e-7) now counts as k (R: k - 1). This follows the user's rule (the same judgment as the densities, which in R and here already give the density at k for such q). It is listed in the docs as a deliberate difference. Mathematically P[X <= q] there is P[X <= k - 1]; the rule trades this for agreement with d and for treating computed integers (relative rounding errors) as integers at every scale, where R's absolute 1e-7 no longer helps above about 1e9.
- Fixtures (scratchpad `scan145.mjs`): over the R and mpmath/Rmpfr fixtures of ppois, pbinom, pbinomLargeN, pgeom, pnbinom, pnbinom_mu, phyper, pwilcox, psignrank, pansari_exact and the audit_* fixtures, no q falls in either changed range. The only fixture values that change are psignrank's: 96 cases of `psignrank.json` (and 5 of `psignrank.ref.json`) with q at a fractional part of 0.5 or more (q = 2.5 and the like), of which 78 differ from R beyond the tolerance.
- Quantile functions (scratchpad `q145.ts`): qgeom, qnbinom (prob, mu), qpois, qbinom, qhyper, qwilcox and qsignrank over 211 linear p and 205 log p, both tails, and wilcoxTest (one and two samples, with confidence intervals), ansariTest, binomTest and poissonTest for three alternatives: the output is byte-identical before and after. The searches evaluate the distribution functions at integers only.

## Fix

- `src/internal/integer.ts`: `countAtMost(q)` = `nonInt(q) ? Math.floor(q) : roundHalfEven(q)`.
- `src/distributions/geometric.ts`, `negbinomial.ts` (prob and mu), `poisson.ts`, `binomial.ts`, `hypergeometric.ts`, `wilcox.ts`, `signrank.ts`, `src/htest/core/ansari.ts`: `countAtMost(q)` instead of `Math.floor(q + 1e-7)` (psignrank: instead of `roundHalfEven(q + 1e-7)`).
- Docs: `docs/differences-from-r.md` and `docs/ja/differences-from-r.md`, three rows in the deliberate differences of the distributions and a paragraph (including the reversal of review 25); the line under "Behaviour matched to R" that said psignrank uses round(q + 1e-7) and the others floor(q + 1e-7) now points there.

## Tests

- `test/issue145.test.ts`: the issues' examples; for all nine functions, q in [k - 1e-7, k) gives the value at k - 1, computed integers (k(1 +- 2^-52), k +- 1e-10, 0.1 * 30) give the value at k, and other non-integers give the value at floor(q); psignrank(0.6, 4) = 0.0625 and psignrank(3.6, 5) = psignrank(3, 5); the quantile functions still invert the distribution functions. With src stashed, 12 of the 30 tests fail (the examples, the [k - 1e-7, k) test of every function, and the two psignrank tests); the others pass.
- `test/rank.test.ts`: `knownDifference` for the psignrank fixture: q with a fractional part where R's round(q + 1e-7) differs from floor(q), and the value equals psignrank at floor(q).
- Whole suite `npx vitest run`: 278 files, 2603 passed / 38 skipped, no failures. `npx tsc --noEmit -p .`: no errors.

## Proposed addition to HANDOFF.md (policy section; HANDOFF.md itself is not edited here)

> - **離散分布の分布関数の q (#145・#146、ユーザー判断で 25 回目の判断を覆す):** P[X ≤ q] は q 以下の最大の整数 k の P[X ≤ k]。整数から min(1e-7, 1e-9·max(1, |q|)) 以内の q はその整数 (q < 100 では d 関数の `nonInt` と同じ判定。q ≥ 100 では R と同じ 1e-7 にとどめる)、それ以外は floor(q) (`countAtMost`、`src/internal/integer.ts`)。R の floor(q + 1e-7) (psignrank は round(q + 1e-7)) はやめた。pgeom・pnbinom (prob・mu)・ppois・pbinom・phyper・pwilcox・psignrank・ansari の正確分布。R と違うのは k < 100 の [k − 1e-7, k − 1e-9·max(1, k)) と、psignrank の小数部分 0.5 以上。psignrank の fixture は `knownDifference`。分位点の探索の結果は変わらない

(In the table of quick rules in "共通基盤", `countAtMost` could also be listed under `src/internal/discrete.ts` or a new `src/internal/integer.ts` entry.)

## Follow-up: the slack capped at 1e-7 (user decision)

With `nonInt`'s slack alone, 1e-9 max(1, |q|) is wider than R's 1e-7 above q = 100, so q in [k - 1e-9 k, k - 1e-7) counted as k:
`ppois(1000 - 5e-7, 1000)` was P[X <= 1000] = 0.5084, while the right value (and R's) is P[X <= 999] = 0.4958. 1000 - 5e-7 is
about 4e6 ulp from 1000, not a rounding error. The user chose to cap the slack: a q within min(1e-7, 1e-9 max(1, |q|)) of an
integer is that integer. Below q = 100 nothing changes; at and above it the rule agrees with R's floor(q + 1e-7) (for q within
1e-7 above an integer both give the integer). The docs row for k > 100 was removed and the paragraph rewritten (English and ja).
`test/issue145.test.ts` adds q = k - 5e-7, k - 2e-7, k - 5e-8 for k = 100, 101, 150 and `ppois(1000 - 5e-7, 1000)`; the latter
fails before the follow-up. Whole suite: 287 files, 2630 passed / 38 skipped; tsc no errors.

## Recorded as out of scope

- `docs/differences-from-r.md` (and the ja version), under the deliberate differences of the distributions, says "rStats.js's `dpois` and `dbinom` use a threshold of 1e-7, which may differ from R near integers (not verified)". `dpois` and `dbinom` now use `nonInt` (1e-9 relative), the same as R's dgeom and dnbinom, so the sentence looks stale. Not changed here.
- `src/htest/types.ts` (line 88) accepts counts within 1e-7 of an integer in the hypothesis tests. That is input validation, not a distribution function, and is left as it is.

## close comment

Fixed in <commit of #145 #146, see git log --grep='#145'>: the distribution functions of the discrete distributions take P[X <= q] as P[X <= k] with k the largest count not above q. A q within 1e-9 max(1, abs(q)) of an integer counts as that integer (the rule the densities use to decide whether x is an integer, so a computed 2.9999999999999996 is still 3); any other q gives floor(q). The issue's example pgeom(0.99999999, 0.5) is now 0.5 (was 0.75 = P[X <= 1]). The same rule replaces floor(q + 1e-7) in pnbinom (#146), ppois, pbinom, phyper, pwilcox and the exact Ansari-Bradley distribution, and round(q + 1e-7) in psignrank (psignrank(0.6, 4) is now 0.0625, was 0.125). R 4.5.2 gives the old values (it uses the same 1e-7, and its densities already treat such q as non-integer); this is a deliberate difference, documented in docs/differences-from-r.md, and reverses the review 25 decision that had kept pbinom's floor(q + 1e-7). Integer q and q away from integers are unchanged, and the quantile functions give the same results. Test: test/issue145.test.ts. (Not pushed yet.)
