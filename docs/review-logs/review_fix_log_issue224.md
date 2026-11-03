# Issue #224 log: mantelhaenTest (I x J x K) fails for large finite counts

GitHub Issue #224. Session 11, group A8.

## Plan

- Intent: the generalized CMH statistic forms each stratum's covariance as `f * vr * vc` with `f = 1 / (t^2 (t - 1))`, `vr = t r_i d - r_i r_ii`, `vc = t c_j d - c_j c_jj`. From counts near 1e103, t^3 overflows (f = 0) while `vr * vc` overflows (Infinity), so the entries are NaN. With counts near 1e308 the stratum totals and the sums over the strata overflow as well.
- Method, only where the plain formulas fail (both keep the bits elsewhere):
  - per entry: where `f * vr * vc` is not finite or f is below the normal range (t above 2^340), the same quantity as `r_i (d_ii - r_ii / t) (d_jj - c_jj / t) c_j / (t - 1)`, each factor at most t in magnitude; where `r_i c_j` overflows in the expected count, `productOver` (the margins scaled to [1, 2), as for the Pearson terms of other tests) so that balanced tables still give a zero difference (the ratio `(r_i / t) c_j` leaves a rounding residue: 2.1e170 at counts 1e200).
  - globally: where a stratum total or an entry of the summed differences or covariance is not finite, all counts are divided by a power of 2, 2^s (largest count below 2^1020 / (8 I J K)), the sums formed again with the count 1 of `t - 1` as 2^-s, and the statistic multiplied by 2^s. The differences and the covariance are of degree 1 in the counts, so this is exact.
- Why this: the HANDOFF rule of a fallback only where the plain formula overflows, and the 2-power scaling of the shared helpers (`ldexp`, `productOver`). The scaling helpers (`stratumTotal`, `countExponent`, `scaledStrata`) are written for both branches; #226 uses them for 2 x 2 x K.
- R fails (error in `qr`), so the new value is recorded in docs/differences-from-r.md and docs/ja.

## Check (main `bebaeb2`)

| call | R 4.5.2 | Before | After | Reference |
|---|---|---|---|---|
| every cell 1e103, 3 x 3 x 2 (the issue) | error "NA/NaN/Inf in foreign function call" | error "the system is exactly singular" | statistic 0, p 1 | 0 (balanced) |
| every cell 1e200 / 1e308 | error (same) | error / NaN | 0, p 1 | 0 |
| two unbalanced 3 x 3 strata near 1e103 (`g3`, `g4` in the test) | error | error | 3.153599720003036e103 | exact (gmp bigq on the doubles): `0x1.c290ca7b8bf48p+343` = 3.1535997200030353e103, 1 ulp apart |
| the same divided by 2^300 | 15481315777631.44 | 15481315777631.43 | the same bits | |

The issue says the statistic becomes NaN; in fact `solve` stops with "exactly singular" on the NaN matrix.

## Fix

- `src/htest/mantelhaenTest.ts`: the per-stratum sums of `general` moved to `generalSums` (with the per-entry fallbacks and `one` for the count 1); `general` repeats them on the counts divided by 2^s where a total or a sum is not finite and scales the statistic back. New helpers `stratumTotal` (also for `totals`, the same expression), `countExponent`, `scaledStrata`.

## Tests

- `test/issue224.test.ts`: balanced strata at 1e103, 1e200, 1e308 (statistic 0, p 1), the unbalanced pair against the exact value, and the unchanged value of the pair divided by 2^300. With `src/` stashed the first two tests fail.
- `npx vitest run`: 330 files passed (2742 tests passed, 38 skipped). `npx tsc --noEmit -p .`: no errors.

## Out of scope

- The 2 x 2 x K branch with overflowing totals is #226 (next commit).

## close comment

Fixed in <commit of #224, see git log --grep='#224'>: in the general I x J x K branch of `mantelhaenTest`, a covariance entry whose plain form `f * vr * vc` is not finite (t^2 (t - 1) and the products overflow from counts near 1e103) is now formed as r_i (d_ii - r_ii / t) (d_jj - c_jj / t) c_j / (t - 1), each factor in range, and an expected count whose margin product overflows is formed from the margins scaled to [1, 2). Where a stratum total or a sum over the strata overflows (counts near 1e308), all counts are divided by a power of 2 and the statistic is scaled back, which is exact because the statistic is homogeneous in the counts. The issue's table now gives statistic 0 and p-value 1 (it stopped with "the system is exactly singular"; R fails with "NA/NaN/Inf in foreign function call"), and an unbalanced pair of strata near 1e103 is within 1 ulp of exact rational arithmetic. Values where nothing overflows are unchanged. Recorded in docs/differences-from-r.md.

Test: test/issue224.test.ts. (Not pushed yet.)
