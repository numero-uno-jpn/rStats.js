# wilcox.test in R 4.6.2: the behaviour to reproduce

This file describes, in words and formulas, what `wilcox.test` (the default method) of R 4.6.2 computes, for an
implementation that must give R 4.6.2's results without reading R's source. It was written by reading R 4.6.2's R
code (deparsed from the image `rstats-oracle:4.6.2`), its help page and NEWS, comparing with R 4.5.2
(`rstats-oracle:latest`), and checking every statement against R's output. The C routines that R 4.6 added for the
tied case (`dpermdist1`, `dpermdist2`) were not read (the source tarball is not in the image); what they return is
described from experiments. The fixture is `test/fixtures/wilcoxTest.json`, made by `oracle/wilcox.R`; the cases of
R 4.6's new behaviour are in the block headed "R 4.6" of that file. Where this file and the fixture seem to disagree,
report it instead of working around it.

Notation: for one sample (or paired, after `x <- x - y` on the complete pairs) `d_i = x_i - mu`, i = 1..n, where n
counts every non-NA value, **zeros included**. For two samples `m = length(x)`, `n = length(y)`, `N = m + n`,
and the pooled vector is `(x_1 - mu, ..., x_m - mu, y_1, ..., y_n)`. `rank` is the mid-rank (average ranks for
ties). `digits.rank` (default Inf) is unchanged from R 4.5: when finite, the values are rounded with
`signif(., digits.rank)` before ranking in the test statistic (rStats.js has no such option; nothing below needs it).

## Easy to get wrong

1. **Ties and zeros no longer switch to the normal approximation.** `exact = NULL` means exact when n < 50 (one
   sample, n counting zeros) or both m < 50 and n < 50; `exact = TRUE` is exact at any size, ties or not. With ties or
   zeros the exact test is the **conditional** (permutation) test given the observed mid-ranks.
2. **The exact signed rank test keeps zeros (Pratt).** The ranks are those of `|d_i|` over **all** n values,
   zeros included; zeros then contribute nothing to V and are not part of the permutation distribution. The normal
   approximation still **drops** zeros first (Wilcoxon's convention), as in R 4.5. So V of the same data differs
   between `exact = TRUE` and `exact = FALSE` when there are zeros.
3. **No warnings in the exact case any more**, and the exact confidence level is the achieved one
   (`attr(conf.int, "conf.level")` = 0.9609375 for n = 9, not 0.95), always, not only when the request cannot be met.
4. **`correct` may be 0, 1, 2 or 3.** 0 is the same as TRUE (continuity correction only); k >= 1 adds k Edgeworth
   terms on top of the continuity correction, and only when there are no ties and no zeros.
5. **Two-sided normal p-values are `2 min(F(z), 1 - F(z))`**, computed as one minus the lower tail, so a large
   positive statistic gives p = 0 (`wilcox.test(1:300, exact = FALSE)`: p = 0, while `-(1:300)` gives
   6.1141368593044447e-51). R 4.5.2 used the upper tail of pnorm.
6. **The two-sided exact two-sample p-value** is `min(2 P(W <= w), 2 P(W >= w), 1)`, not chosen by the side of
   mn/2.
7. **The conditional one-sample interval's lower end is one Walsh average higher than the classical one** for the
   same data (a strict tail `P(V > v)` where the two-sample version uses `P(W >= w)`; see "Intervals"). This looks
   like a bug in R 4.6.2; it is what R returns.
8. **The normal-approximation interval of the signed rank test now uses the data with the zeros kept** (values
   equal to mu are no longer removed before the root search), so with zeros the interval and estimate change.

## 1. Which method is used

| case | exact (`exact = TRUE`, or NULL with n < 50 / m, n < 50) | normal approximation |
|---|---|---|
| one sample / paired, no ties, no zeros | classical exact signed rank distribution (`psignrank(., n)`) | as R 4.5 |
| one sample / paired, ties or zeros | conditional distribution of V given the scores (below) | zeros dropped, tie-corrected variance, as R 4.5 |
| two samples, no ties | classical `pwilcox(., m, n)` | as R 4.5 |
| two samples, ties | conditional distribution of W given the mid-ranks | tie-corrected variance, as R 4.5 |

"Ties" for one sample: the ranks of `|d_i|` over all n values (zeros included) are not all distinct. "Zeros": some
`d_i == 0`. Both are judged on `d` after `signif(., digits.rank)` when that is finite. For two samples, ties of the
pooled vector `(x - mu, y)`. The default switch counts n with zeros in R 4.6 (R 4.5 counted the non-zero values).

`exact` is not looked at when the normal approximation is chosen, and `correct` is not looked at in the exact case.

## 2. Exact tests

### Statistics

- One sample: `r = rank(|d|)` over all n values (zeros get the smallest ranks, as values 0). `V = sum of r_i over
  d_i > 0`. The **scores** are the ranks `r_i` of the non-zero `d_i` (zeros removed from the score set). Without
  ties and zeros the scores are 1..n and the classical distribution is used.
- Two samples: `r = rank(x - mu, y)` (pooled), `W = sum_{i<=m} r_i - m(m + 1)/2`. The scores are all N ranks.

Example (point 3 of the task): `x = c(1.5, 2, 2, -3, 4, 0, 5, -1, 2)`. With Pratt's ranks, |x| = 1.5 2 2 3 4 0 5
1 2 has ranks 3 5 5 7 8 1 9 2 5, the positives sum to 3 + 5 + 5 + 8 + 9 + 5 = 35. With the zero dropped first (R 4.5.2,
and R 4.6.2's normal approximation) the ranks are 2 4 4 6 7 8 1 4 and V = 2 + 4 + 4 + 7 + 8 + 4 = 29. R 4.5.2 used the
normal approximation here (ties and a zero), with V = 29 and two warnings; R 4.6.2 uses the exact conditional test with
V = 35.

### The conditional distribution

Scores are mid-ranks, multiples of 1/2. Let `f = 1` when all scores are integers and `f = 2` otherwise, and work with
the integer scores `a_j = f * score_j` (each >= 1).

- Signed rank (scores a_1..a_k of the k non-zero values): under H0 each sign is + or - with probability 1/2
  independently, so `f V` is distributed as `sum_j a_j B_j` with `B_j` iid Bernoulli(1/2). Its probability
  function on 0, 1, ..., sum(a) is the coefficient list of `prod_j (1 + t^{a_j}) / 2^k`.
- Rank sum (scores a_1..a_N): under H0 the m positions of x are a uniformly random m-subset, so
  `f (W + m(m + 1)/2)` is distributed as the sum of a random m-subset of the a_j; the probability of a total s is
  (number of m-subsets with sum s) / C(N, m).

R computes these with the Streitberg-Röhmel shift algorithm (Streitberg and Röhmel 1986, 1987) in C. Any method that
gives the same probabilities (polynomial multiplication for the signed rank case; the two-way recursion on (number
chosen, sum) for the rank sum case, adding one score at a time) is fine. Experiments show:

- The probabilities are doubles, accurate to a few ulps: for 80 scores 2 rank(c(1:40, 1:40)), m = 40, the smallest
  probability is 9.3017018280181422e-24 against 1 / C(80, 40) = 9.301701828018126e-24, and the probabilities sum to
  1 + 1.1e-15. Dyadic cases are exact (scores rep(2, 60): P(0) = 2^-60 exactly).
- R stops with the error "overflow error: cannot compute exact distribution" for the signed rank case with more than
  about 1024 scores (1:1024 works, 1:1025 and rep(1, 1024) do not; `wilcox.test(c(0, 1:1025), exact = TRUE)` fails).
  rStats.js need not copy this limit; its own limit is rule 4 (time and memory), with a RangeError suggesting
  `exact: false` (as for `pwilcox`).

### Tail probabilities

The distribution is tabulated on the grid `s = 0, 1, ..., M` (`f = 1`) or `s = 0, 1/2, ..., M` (`f = 2`), with
`M = n(n + 1)/2` for the signed rank test (n with zeros, so the grid can extend past the support) and `M = m n` for the
rank sum test, `P(s)` being the probability of `V = s` (`W = s`), 0 off the support.

- Lower tail at q: `L(q) = sum of P(s) over s < q + 1e-8`, then `min(L, 1)`.
- Upper tail at q (strictly: the probability of `s >= q + 1e-8`): `1 - L(q)`, **except** when `|L(q) - 1| < 1/64`,
  where it is `sum of P(s) over s >= q + 1e-8` summed directly. This is the R 4.6.2 change for p-values near 0 (and,
  through two-sided p-values, near 1): before it, `1 - L` lost the digits of a small upper tail. The 1/64 is R's
  absolute threshold; with it the result is `1 - L` in the bulk and the direct sum in the far upper tail.
- The statistic's upper tail `P(V >= v)` is requested as the upper tail at `v - 1/4`, which on the half-integer grid
  includes `s = v` and excludes `s = v - 1/2`.

Without ties and zeros R uses its classical `psignrank` / `pwilcox` (unchanged algorithms except Löffler's formula in
the C `cwilcox`, which gives the same values to the last bits or so; the `pwilcox` fixture changed by a few ulps). For
these the upper tail `P(V >= v)` is asked as `psignrank(v - 1/4, n, lower.tail = FALSE)`: R 4.6.2's psignrank
**floors** a non-integer q (R 4.5.2 rounded it: `psignrank(9.75, 10, lower.tail = FALSE)` is 0.9677734375 in 4.6.2,
0.9580078125 in 4.5.2), so this is `P(V > v - 1) = P(V >= v)`. Inside wilcox.test the result equals R 4.5.2's
`psignrank(v - 1, n, lower.tail = FALSE)`; the change of psignrank itself belongs to the distribution functions (its
fixture changed accordingly).

### p-values

- One sample, `less`: `L(V)`. `greater`: upper tail at `V - 1/4`, i.e. `P(V' >= V)`. `two.sided`: with the centre
  `c = n(n + 1)/4` (classical) or `c = (sum of the scores)/2` (conditional; zeros are not in the score sum), take the
  upper tail `P(V' >= V)` when `V > c`, else `L(V)`, and return `min(2 p, 1)`.
- Two samples, `less`: `L(W)`. `greater`: `P(W' >= W)` (upper tail at `W - 1/4`). `two.sided`:
  `min(2 L(W), 2 P(W' >= W), 1)` (both tails, classical or conditional).

Worked examples (R 4.6.2, method "Wilcoxon signed rank exact test" / "Wilcoxon rank sum exact test"):

| call | statistic | p-value |
|---|---|---|
| `wilcox.test(c(1.5, 2, 2, -3, 4, 0, 5, -1, 2))` | V = 35 | 0.1328125 |
| same, `alternative = "greater"` / `"less"` | V = 35 | 0.06640625 / 0.94140625 |
| same, `mu = 2` | V = 13 | 0.53125 |
| `wilcox.test(c(0, 1, 2, 3, 4, 5))` | V = 20 | 0.0625 |
| `wilcox.test(c(1, 2, 2, 3, 4, 5))` | V = 21 | 0.03125 |
| `wilcox.test(c(1, 2, 2, 3, 4, 5), mu = 2)`; `less`; `greater` | V = 14.5 | 0.375; 0.9375; 0.1875 |
| `wilcox.test(c(0, 0))`, `wilcox.test(c(3, 3, 3, 3), mu = 3)` | V = 0 | 1 |
| `wilcox.test(5)` | V = 1 | 1 |
| `wilcox.test(c(5, 5, 5))` | V = 6 | 0.25 |
| `wilcox.test(4:2, 3:1, paired = TRUE)` | V = 6 | 0.25 |
| `wilcox.test(c(1, 2, 2, 4, 5, 7), c(3, 3, 4, 6, 8, 9, 9))`; `less`; `greater` | W = 9.5 | 0.10606060606060606; 0.053030303030303032; 0.95279720279720281 |
| same with `mu = -1` | W = 13 | 0.27272727272727271 |
| `wilcox.test(c(1, 2, 3), c(3, 4, 5))`; `less`; `greater` | W = 0.5 | 0.20000000000000001; 0.10000000000000001; 1 |
| `wilcox.test(c(1, 2, 2), c(3, 3))` | W = 0 | 0.20000000000000001 |
| `wilcox.test(c(1, 2, 3), c(0, 4, 5), mu = 1)` | W = 2.5 | 0.5 |
| `wilcox.test(c(1, 1), c(1, 1))`; `wilcox.test(1, 1)` | W = 2; 0.5 | 1; 1 |
| `z = -c(t, t, t)`, `t = c(-5, -4, -3, -3, -2, -1, -6, -7, -8, -9, -10, -11, 1)`: greater; less; two-sided | V = 769.5 | 8.1854523159563541e-11; 0.99999999995452526; 1.6370904631912708e-10 |
| `x = c(10, 11, 11, 12, 13, 14, 15, 16, 17, 18)`, `y = c(1, 2, 2, 3, 4, 5, 6, 7, 8)`: greater; less; two-sided | W = 90 | 1.082508822446903e-05; 1; 2.1650176448938059e-05 |

In the last row the upper tail is 1 / C(19, 10) = 1.082508822446903e-05 summed directly; `1 - L` would have given
1.0825088224475365e-05.

## 3. Zeros (one sample and paired)

- Exact: zeros are **kept** in the ranking (Pratt 1959): they take the smallest ranks of |d|, add nothing to V and
  are excluded from the scores of the permutation distribution. The distribution's centre for the two-sided rule is
  half the sum of the non-zero scores. A sample of zeros only (`c(0, 0)`) has no scores: the distribution is a point
  mass at 0, V = 0 and p = 1 (no error, no warning).
- Normal approximation: zeros are **dropped** before ranking (Wilcoxon), n becomes the number of non-zero values, as
  in R 4.5: `wilcox.test(c(1.5, 2, 2, -3, 4, 0, 5, -1, 2), exact = FALSE)` gives V = 29, p = 0.13952696844257639
  (R 4.5.2: 0.13952696844257642; the last digits differ through `1 - F`, point 5 above). All zeros: the variance is 0 and
  p is NaN (as R 4.5; rStats.js keeps its error for that case).
- Whether the conditional exact path is used depends on the zeros (and ties) of `x - mu`, not of x:
  `wilcox.test(c(1.1, 2.3, 3.6), mu = 2.3, conf.int = TRUE)` is conditional.

## 4. Intervals and estimates

### Exact, classical (no ties and no zeros in the test)

Unchanged in its order statistics except at the ends; the reported level and the warnings changed.

- One sample: the Walsh averages `(x_i + x_j)/2`, i <= j, of the **original** x (all values), sorted:
  `A_1 <= ... <= A_K`, K = n(n + 1)/2. Two samples: the sorted differences `x_i - y_j`, K = m n. Estimate: the median
  of these (names "(pseudo)median", "difference in location", unchanged).
- Let `a = 1 - conf.level`, `a' = a/2` for two-sided, `a` for one-sided, `P` the classical lower-tail cdf (psignrank
  or pwilcox) and `tol = 10 * .Machine$double.eps` (2.220446e-15).
- `q = qsignrank(a', n)` (or `qwilcox(a', m, n)`): the smallest q with `P(q) >= a'` (R's quantile). **New**: if
  `P(q) <= a' + tol`, q is increased by 1 (so that the excluded tail has probability at most a').
- If q = 0 (the request cannot be met even by the whole line): the interval is `(-Inf, Inf)` for **every**
  alternative, the achieved alpha is 0, so the level is 1. No warning. (R 4.5.2 used q = 1 and warned.)
- Otherwise: two-sided `[A_q, A_{K + 1 - q}]`, greater `[A_q, Inf)`, less `(-Inf, A_{K + 1 - q}]`; achieved alpha
  `2 P(q - 1)` two-sided, `P(q - 1)` one-sided.
- `attr(conf.int, "conf.level") = 1 - achieved alpha`, always (R 4.5.2 reported the requested level unless the
  achieved alpha exceeded 1.5 a, and then `1 - signif(alpha, 2)` for one sample, `1 - alpha` for two samples, with a
  warning). Not rounded.

### Exact, conditional (ties or zeros in the test)

The same sorted Walsh averages (all of the original x, including values equal to mu) or differences
`A_1 <= ... <= A_K`, and the same estimate (their median). The ends are found by scanning, with test inversion at the
midpoints between consecutive sorted values. For a shift t define, recomputing ranks and scores at each t:

- One sample: `e = x - t` (all n values), `r = rank(|e|)` over all n values, `v(t) = sum of r_i over e_i > 0`,
  scores = all n ranks r (here values with `e_i = 0` are **not** removed from the scores: at a shift equal to an
  observation they are treated as having a random sign). `lowerP(t) = P(V <= v(t))`, `upperP(t) = P(V > v(t))`
  (strictly greater: the upper tail at `v(t)` itself, without the 1/4 shift) under the conditional distribution of
  these scores, with the tail rules of section 2 (grid with `M = n(n + 1)/2`, same n).
- Two samples: `r = rank(x - t, y)`, `w(t) = sum_{i<=m} r_i - m(m + 1)/2`, scores all N ranks;
  `lowerP(t) = P(W <= w(t))`, `upperP(t) = P(W >= w(t))` (upper tail at `w(t) - 1/4`).

With `a'` as above and `a'' = a' + tol`:

- Lower end (two-sided and greater): if `upperP(A_1 - 1) > a''` the end is `-Inf` with tail 0. Otherwise, for
  k = 1, ..., K - 1 in turn, compute `p = upperP((A_k + A_{k+1})/2)`; at the first k with `p > a''` the end is
  `A_k`, and its tail is the p of the previous k (0 if k = 1). If no k qualifies, the end is `A_K` with the last p as
  its tail.
- Upper end (two-sided and less): if `lowerP(A_K + 1) > a''` the end is `Inf` with tail 0. Otherwise for
  k = K - 1, ..., 1 compute `p = lowerP((A_k + A_{k+1})/2)`; at the first k with `p > a''` the end is `A_{k+1}`, its
  tail the previous p (0 at the first k); if none, the end is `A_1` with the last p.
- Two-sided: `[lower, upper]`, achieved alpha = lower tail + upper tail. greater: `[lower, Inf)`, alpha = lower
  tail. less: `(-Inf, upper]`, alpha = upper tail. Level `1 - alpha`. No warning in any case.

Note that consecutive equal values `A_k = A_{k+1}` give a midpoint equal to them, where the shifted data have extra
ties; that tail is used as it comes.

Because the one-sample lower end uses `P(V > v)` (not `P(V >= v)`), applying the conditional rule to data without
ties gives a lower end one Walsh average above the classical one, with the same reported level: for
`x = c(1.83, 0.50, 1.62, 2.48, 1.68, 1.88, 1.55, 3.06, 1.30)` the classical interval is [1.165, 2.37], the conditional
rule (forced, via R's internal function) [1.19, 2.37], both with level 0.9609375. Also, the lower end can never be
`-Inf` in the one-sample case (`P(V > maximum) = 0`), while the upper end can be `Inf`, which gives two-sided intervals
like `[1, Inf]` with level 1 for `c(1, 2, 2, 3)`. The two-sample rule is symmetric.

Infinite observations in the conditional interval: R stops with "missing value where TRUE/FALSE needed" (a midpoint of
Inf and Inf, or of -Inf and a number, gives NaN ranks), e.g. `wilcox.test(c(1, 2, Inf, Inf), conf.int = TRUE)` and
`wilcox.test(c(-Inf, 1, 2, 2, 5), conf.int = TRUE)`. With rule 1 an error in rStats.js too (the fixture records R's
message; the implementer may use a clearer one through `substitute`). The classical path handles Inf as before
(`c(1, 2, Inf)`: (-Inf, Inf), level 1, estimate Inf).

### Worked examples (exact intervals; `est` is the estimate)

| call | method | interval | conf.level | est |
|---|---|---|---|---|
| `x9 = c(1.83, 0.50, 1.62, 2.48, 1.68, 1.88, 1.55, 3.06, 1.30)`, `wilcox.test(x9, conf.int = TRUE)` | classical | 1.165, 2.3700000000000001 | 0.9609375 | 1.7250000000000001 |
| same, `conf.level = 0.99` | classical | 0.90000000000000002, 2.77000000000000002 | 0.9921875 | |
| same, `alternative = "less"` | classical | -Inf, 2.1800000000000002 | 0.951171875 | |
| `c(1.1, 2.3, 3.6, 4.2, 5.9, 6.1, 7.7)` | classical | 2.2999999999999998, 6.8000000000000007 | 0.953125 | 4.3000000000000007 |
| `c(1.1, 2.3, 3.6)`, two-sided and less | classical, q = 0 | -Inf, Inf | 1 | 2.3250000000000002 |
| `1:10, conf.level = 1e-6` | classical | 5.5, 5.5 | 0.078125 | 5.5 |
| `c(1, 2, 3, 4), conf.level = 0.999999` | classical | -Inf, Inf | 1 | 2.5 |
| `c(1.5, 2, 2, -3, 4, 0, 5, -1, 2)` | conditional | -0.5, 3.5 | 0.95703125 | 1.75 |
| same, `mu = 2` | conditional | -0.5, 3.5 | 0.95703125 | 1.75 |
| `c(1, 2, 2, 3, 4, 5)` | conditional | 1.5, 5.0 | 0.984375 | 3 |
| same, `conf.level = 0.8` | conditional | 2.0, 3.5 | 0.859375 | 3 |
| same, `mu = 2`, less; greater | conditional | -Inf, 4; 2, Inf | 0.953125; 0.953125 | 3 |
| `c(0, 1, 2, 3, 4, 5)` | conditional | 0.5, 5.0 | 0.984375 | 2.5 |
| `c(0, 1, 2, 2, 3, 4, 5)` | conditional | 1, 4 | 0.9609375 | 2.5 |
| `c(0, 0, 1.5, -2.5, 3, 4.25, -0.5)` (V = 17, p = 0.5) | conditional | -1.25, 3.00 | 0.9609375 | 0.75 |
| `c(1, 2, 2, 3)` | conditional | 1, Inf | 1 | 2 |
| `c(5, 5, 5)` | conditional | 5, Inf | 1 | 5 |
| `c(0, 0)`; `c(0, 3)` | conditional | 0, Inf; 0, Inf | 1; 1 | 0; 1.5 |
| `c(3, 3, 3, 3), mu = 3` | conditional | 3, Inf | 1 | 3 |
| `c(1:10, 3), conf.level = 1e-6`; `0.5` | conditional | 5.5, 5.5; 4.5, 6.0 | 0.09521484375; 0.5625 | 5.25 |
| `4:2, 3:1, paired = TRUE` | conditional | 1, Inf | 1 | 1 |
| `5` | classical | -Inf, Inf | 1 | 5 |
| `x10 = c(0.80, 0.83, 1.89, 1.04, 1.45, 1.38, 1.91, 1.64, 0.73, 1.46)`, `y5 = c(1.15, 0.88, 0.90, 0.74, 1.21)` | classical | -0.15000000000000002, 0.75999999999999990 | 0.96003996003996006 | 0.30500000000000005 |
| same, greater | classical | -0.07999999999999996, Inf | 0.9503829503829504 | |
| `c(1.1, 2.2), c(3.3, 4.4)`, two-sided and greater | classical, q = 0 | -Inf, Inf | 1 | -2.2000000000000002 |
| `c(1, 2, 2, 4, 5, 7), c(3, 3, 4, 6, 8, 9, 9)` (also with `mu = -1`) | conditional | -6, 1 | 0.9533799533799534 | -2 |
| same, less, `conf.level = 0.9` | conditional | -Inf, -1 | 0.93473193473193472 | -2 |
| same, greater, `conf.level = 0.9` | conditional | -5, Inf | 0.92540792540792538 | -2 |
| `c(1, 2, 3), c(3, 4, 5)`: two-sided; less; greater | conditional | -Inf, Inf; -Inf, 0; -4, Inf | 1; 1; 1 | -2 |
| `1:10, c(2.5, 4.5, 6.5)` | conditional | -3.5, 5.5 | 0.95104895104895104 | 1 |
| `c(2.5, 4.5), 1:6`, less | conditional | -Inf, 3.5 | 0.9642857142857143 | 0 |
| `c(1, 1), c(1, 1)`; `1, 1` | conditional | -Inf, Inf | 1 | 0 |
| `c(1, Inf), c(2, 3)`; `c(1, Inf, Inf), c(2, 3)` | classical | -Inf, Inf | 1 | Inf |

### Normal approximation

Unchanged from R 4.5 except:

- One sample: the root search runs on the data **with the values equal to mu kept** (R 4.5.2 removed them first and
  added mu back). The statistic at a shift t still drops the zeros of `x - t` (as before), so only the range
  `[min x, max x]` and the values entering the search change. Example
  `wilcox.test(c(1.5, 2, 2, -3, 4, 0, 5, -1, 2), exact = FALSE, conf.int = TRUE)`: R 4.6.2
  [-0.50004754554209252, 3.49992331115281718], estimate 1.7499965986730397 (R 4.5.2: [-0.74998500065589879,
  3.50006096986502691], 1.9813934956341075). With `correct = FALSE`: [-0.50000543303511624, 3.25001298893552049],
  estimate 1.7499965986730397, p 0.12164285939134012. `c(0, 0, 1.5, -2.5, 3, 4.25, -0.5)`: V = 11,
  p = 0.41849223344681974, [-1.4999394180821946, 3.6249570433530423], estimate 0.75000647423583322. All zeros
  (`c(0, 0), exact = FALSE`): interval NaN NaN, level 0, estimate "midrange" 0, the warning "cannot compute
  confidence interval when all observations are zero or tied", p NaN.
- The interval uses the continuity correction when `correct` is TRUE or any number 0..3 (never Edgeworth terms);
  `correct = 3` and `correct = 0` give the same interval and estimate as TRUE.
- Everything else (doubling of alpha for one sample, the clamped two-sample search, `tol.root`, "midrange") is as in
  R 4.5.2 and as rStats.js has it.

## 5. Normal approximation of the p-value; Edgeworth terms

`correct` is converted first: a number must be one of 0, 1, 2, 3 (otherwise the error "'correct' must be an integer
between 0 and 3"; a vector of length > 1 gives R's "the condition has length > 1"); anything not numeric becomes
k = 0 if it is `TRUE` and k = -1 otherwise (`FALSE`, `NA`, strings). Then:

- k = -1: no continuity correction, method without "with continuity correction".
- k >= 0: continuity correction (0.5 towards the centre: `sign(S - E) * 0.5` two-sided, 0.5 for greater, -0.5 for
  less), method "... with continuity correction" (also for k = 1..3).
- If k >= 1 and there are ties (or, for one sample, zeros), k is set to 0: continuity correction only.

Statistic: one sample (zeros dropped, n' non-zero values) `E = n'(n' + 1)/4`,
`sd = sqrt(n'(n' + 1)(2n' + 1)/24 - sum(t^3 - t)/48)`; two samples `E = m n/2`,
`sd = sqrt(m n/12 * ((N + 1) - sum(t^3 - t)/(N(N - 1))))` (t: tie group sizes), as before. `z = (S - E - CC)/sd`.

Let `Phi`, `phi` be the normal cdf and density and the Hermite polynomials `He3 = z^3 - 3z`,
`He5 = z^5 - 10z^3 + 15z`, `He7 = z^7 - 21z^5 + 105z^3 - 105z`. The correction term `e(z)`:

- One sample (Fellingham and Stoker 1964), with `n` the number of observations given to the test (equal to n' since
  the terms are off with zeros), `D = n(n + 1)(2n + 1)`:
  `c4 = -(3n^2 + 3n - 1) / (10 D)`, `c6 = 4(3n^4 + 6n^3 - 3n + 1) / (35 D^2)`.
  `e = c4 He3` (k >= 1), `+ c6 He5` (k >= 2), `+ c4^2/2 He7` (k = 3).
- Two samples (Fix and Hodges 1955), m = length(x), n = length(y), N = m + n:
  `c3 = -(N(N + 1) - m n) / (20 m n (N + 1))`,
  `c5 = (2(m^4 + n^4) + 4mn(m^2 + n^2) + 6m^2 n^2 + 4(m^3 + n^3) + (7mn + N - 1)N) / (210 m^2 n^2 (N + 1)^2)`.
  `e = c3 He3` (k >= 1), `+ c5 He5` (k >= 2), `+ c3^2/2 He7` (k = 3).

Then `F(z) = min(1, max(Phi(z) - e(z) phi(z), 0))` (lower tail) and `G(z) = min(1, max(Phi(-z) + e(z) phi(z), 0))`
(upper tail, from pnorm's upper tail). For k <= 0, `F = Phi(z)` and `G = Phi(-z)`. p-values: less `F(z)`, greater
`G(z)`, two-sided `2 min(F(z), 1 - F(z))` (one minus the lower tail, not G). The 4.6.1 fix was the factor `phi(z)` on
e, missing in 4.6.0 ("got a missing dnorm(z) factor ... in addition to more fixes"); R 4.6.2 has it as above.

Worked examples, `x12 = c(0.8, 1.9, -0.4, 2.7, 1.1, -1.3, 0.5, 3.2, 1.6, -0.2, 2.1, 0.9)` (V = 68),
`y8 = c(-0.5, 0.3, 1.2, -1.1, 0.7, -0.9, 0.1, -1.6)` (W = 76), `exact = FALSE`:

| correct | one sample: two-sided / less / greater | two samples: two-sided / less / greater |
|---|---|---|
| FALSE | 0.022909099354356588 / 0.98854545032282171 / 0.011454549677178306 | 0.030753561259274642 / 0.98462321937036268 / 0.015376780629637292 |
| TRUE, 0 | 0.025369859822053753 / 0.98967081137938051 / 0.012684929911026852 | 0.033865370332825107 / 0.98605473543987676 / 0.016932685166412588 |
| 1 | 0.021863114916597759 / 0.99146023231143854 / 0.010931557458298857 | 0.031714180313091589 / 0.98720779155021843 / 0.015857090156545805 |
| 2 | 0.021064380726316667 / 0.99180168039730676 / 0.010532190363158271 | 0.031291263167280592 / 0.98739750481871191 / 0.015645631583640372 |
| 3 | 0.021274982201776149 / 0.99176244662311552 / 0.010637491100888007 | 0.031483183940728132 / 0.9873349187510303 / 0.015741591970364135 |

Also: `x12, mu = 3, correct = 3`: V = 1, p = 0.0009526853900371406; `x12, y8, mu = -3, correct = 3`: W = 96, p = 0
(z is large and positive, 1 - F = 0). With a tie or a zero the terms are off: `c(x12, 0.8), correct = 3` gives the
continuity-corrected p (V = 80, p = 0.017461758127902183, the same as `correct = TRUE`). `wilcox.test(1:300, exact = FALSE)`: V = 45150, p = 0;
greater 3.0570684296522223e-51; `-(1:300)`: V = 0, p = 6.1141368593044447e-51.

Note for rStats.js (rule 2): `2 (1 - F)` is R's arithmetic; where `1 - F` has lost its digits (small upper tails,
p = 0 above) the right value is `2 G`. Computing the upper tail directly agrees with R to about 1e-16 / p, i.e. within
the tests' 1e-12 for p above about 1e-4; below that R's value is wrong and the difference belongs in
differences-from-r.

## 6. Warnings and method strings

Method strings (verbatim): "Wilcoxon signed rank exact test", "Wilcoxon signed rank test with continuity
correction", "Wilcoxon signed rank test", "Wilcoxon rank sum exact test", "Wilcoxon rank sum test with continuity
correction", "Wilcoxon rank sum test". "exact" now also appears with ties and zeros.

Warnings in R 4.6.2 (all in the normal approximation, unchanged texts):

- "requested conf.level not achievable" (one sample, normal interval, when alpha had to be doubled), e.g.
  `wilcox.test(c(1, 2, 2, 3, 4, 5), exact = FALSE, conf.int = TRUE)`: V = 21, p = 0.03552233662341453,
  [1.5000252341962117, 4.0000380484149094], level 0.89999999999999991, estimate 2.9999021167100728.
- "cannot compute confidence interval when all observations are zero or tied" (one sample, normal interval).
- "cannot compute confidence interval when all observations are tied" (two samples, normal interval).

Gone (were given by R 4.5.2): "cannot compute exact p-value with ties", "cannot compute exact p-value with zeroes",
"cannot compute exact confidence interval with ties", "cannot compute exact confidence interval with zeroes",
"cannot compute exact confidence intervals with ties" (two samples), "requested conf.level not achievable" (exact one
sample) and "Requested conf.level not achievable" (exact two samples). The exact case gives no warning at all.

New error: "'correct' must be an integer between 0 and 3".

## 7. Exact p-values near 0 and 1 (4.6.2)

In the conditional case the upper tail is summed directly from the probabilities when the lower tail is within 1/64
of 1, instead of `1 - lower` (section 2, "Tail probabilities"); the lower tail is a direct sum anyway and is clamped
at 1. The classical case is not affected (R's `psignrank` / `pwilcox` give the same values in 4.5.2 and 4.6.2 for
integer arguments). Since rStats.js computes the tails from a table, the natural implementation sums each tail
directly; the 1/64 switch then only matters for the last bits of upper tails just below 1 - 1/64, which are within
the tests' tolerance either way.

## 8. Arguments, defaults, fields

- Arguments and defaults are unchanged (`correct = TRUE`, `exact = NULL`, `tol.root = 1e-4`, `digits.rank = Inf`);
  `correct` now also takes 0..3.
- Returned fields and names are unchanged (statistic V / W, no parameter, p.value, null.value named "location" or
  "location shift", conf.int with the attribute conf.level, estimate named "(pseudo)median", "difference in
  location" or "midrange"). Only the values of `attr(conf.int, "conf.level")` in the exact case changed.
- `pairwise.wilcox.test` calls wilcox.test and passes `...`, so it inherits all of the above (exact with ties, no
  ties warnings, `correct = k`).

## What changes in rStats.js (src/htest/wilcoxTest.ts)

- `exact`: drop the switch to the normal approximation for ties and zeros; the default counts n with zeros. Add the
  conditional distributions (signed rank of given scores; rank sum of given scores) and their tails as in section 2.
- Signed rank exact: Pratt's ranks (zeros kept in the ranking, out of the scores), V accordingly; the two-sided centre
  half the score sum.
- Rank sum exact two-sided: `min(2 L, 2 U, 1)`.
- Exact intervals: the classical rule's q + 1 step, `(-Inf, Inf)` with level 1 at q = 0, the achieved level always,
  no warnings; the conditional scan for ties and zeros (with its one-sample lower-tail quirk; see the decision in
  the report), on all of x including values equal to mu; the Walsh averages and the estimate from all of x.
- Normal interval of the signed rank test: keep the values equal to mu (`xo` is now the data itself, not the data
  without zeros; the #502 workaround of adding mu back may become unnecessary).
- Normal p-value: `correct` as boolean or 0..3 (the type of `WilcoxTestOptions.correct` changes; the test helper
  reads `correct` with `arg.bool`, and the fixture now has numbers "0".."3" as strings), the Edgeworth terms,
  `2 min(F, 1 - F)` two-sided (with the rule-2 note in section 5).
- Warnings: remove the exact-method warnings and the exact "requested conf.level not achievable" /
  "Requested conf.level not achievable"; the normal-approximation warnings stay. `test/htestWarnings.test.ts`,
  `pairwiseWilcoxTest` and the formula form follow.
- The known differences in test/wilcox.test.ts about the exact level rounded with signif (0.87 / 0.88) and the
  `allTied` p = 1 rule should be reviewed: R 4.6.2 gives the exact level unrounded, and the two-sample all-tied case
  is now exact with p = 1 by default (with `exact = FALSE` R 4.6.2 still gives p = NaN, sd = 0: the comment in wilcoxTest.ts saying "R 4.6 returns 1" is not true of the normal approximation).
- Unchanged: the classical distributions, the normal statistic and variance, the two-sample normal interval, the
  half-unit handling of overflowing differences (it must now also give Pratt ranks in the exact case).

## Cost of the exact computation

R 4.6.2's times on this Mac (arm64 container), rounded data (many ties):

| case | time |
|---|---|
| one sample n = 49, p only / with interval | 0.001 s / 0.16 s |
| one sample n = 100 / n = 150, with interval | 2.7 s / 15.4 s |
| one sample n = 200 / 1000, p only (`exact = TRUE`) | 0.004 s / 0.25 s |
| two samples 49 x 49, p only / with interval | 0.014 s / 13 s |
| two samples 20 x 20 / 30 x 30, with interval | 0.08 s / 0.68 s |
| two samples 200 x 200, p only | 4.1 s |

Operation counts for an implementation that builds the distribution once per tail evaluation:

- Signed rank: k scores with integer sum S (S <= n(n + 1), f = 2) cost about k S additions: n^3 (n = 1000: 1e9, a few
  seconds in JavaScript; n = 3000: 2.7e10, too long). A limit near n = 1000 to 1500 for the p-value keeps within 10 s.
- Rank sum: the (number chosen <= m) x (sum <= S) table with S about N^2 costs about N m S = m N^3 additions and
  m S doubles of memory: 49 x 49 is 4.6e7 (fast), 200 x 200 is 2.6e9 (seconds; memory 200 x 160000 = 3.2e7 doubles,
  above 2^24, so the table must be reduced, e.g. only the sums up to the observed tail, or rows kept for min(m, n)),
  500 x 500 too long.
- Intervals multiply this by the number of midpoints scanned: about `a' K` from each end plus one (K = n(n + 1)/2 or
  m n), e.g. 0.025 x 2401 = 60 per end for 49 x 49 (about 120 distributions of 4.6e7 each, about 6e9 additions:
  beyond 10 s in a direct implementation). Since only the tails at a' are needed, the scan can stop early, but each
  midpoint needs its own distribution (the scores change with t); caching by the multiset of scores helps only where
  it repeats. A practical limit: conditional intervals for n up to about 100 (one sample) and m n up to about 1000
  (two samples) in a few seconds, a RangeError suggesting `exact: false` beyond the measured limit.
