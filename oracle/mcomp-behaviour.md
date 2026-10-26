# Multiple comparisons: the behaviour to reproduce

What PMCMRplus 1.9.12, dunn.test 1.4.2 and multcomp 1.4-32 compute, in words, for an implementation that must not
read their source. Fixtures `mcompPMCMR`, `mcompDunn`, `mcompDunnett` (`oracle/mcomp.R`; formats in its header and
`oracle/_anova.R`). Where this file and a fixture seem to disagree, report it.

## Easy to get wrong

1. **Dunnett-type p-values** (PMCMRplus `dunnettTest`, the single-step `kwManyOneDunnTest`, multcomp's Dunnett) are
   computed by R with mvtnorm's randomised integration and are only about 1e-3 (absolute) accurate. This library
   computes them exactly with a one-dimensional integral (see "Dunnett's probabilities"); they are compared with the
   fixtures' `reference`, not with R.
2. PMCMRplus's two-sided `dunnettTest` p-value is **min(1, 2 × the one-sided upper p-value at |t|)**, not the
   two-sided probability; multcomp's and the single-step `kwManyOneDunnTest`'s are the true two-sided ones.
3. dunn.test's step-wise adjustments (Holm, Holm-Šidák, Hochberg, BH, BY) **do not enforce monotonicity**, unlike
   `p.adjust`: each p-value is multiplied (or transformed) by its own factor and capped at 1, nothing more.
4. dunn.test's unadjusted p-value is **one-sided** (upper tail of |Z|) unless `altp`.
5. The Steel-Dwass statistic uses the smaller Mann-Whitney U, so it is never positive.
6. Groups are the sorted labels (code point order); the first is the control of the many-one tests.

## API

One function per test, with R's names in camelCase: `dscfAllPairsTest`, `kwAllPairsDunnTest`,
`kwManyOneDunnTest`, `dunnettTest`, `gamesHowellTest`, `tukeyTest`, `steelTest` (PMCMRplus), `dunnTest`
(dunn.test), `glhtDunnett(x, g, { alternative })` (multcomp's `summary(glht(aov(y ~ g), mcp(g = "Dunnett")))`).
Arguments `(x, g, options)` like the other k-sample tests
(`src/htest/groups.ts`); options `pAdjustMethod`, `alternative` as in R (`"two.sided"`, `"greater"`, `"less"`).

PMCMRplus results: `{ method, statistic, pValue, rowNames, colNames, pAdjustMethod, warnings }`, the matrices as
arrays of rows with `NaN` in the empty upper triangle (all-pairs: rows = levels 2..k, columns = levels 1..k−1, cell
(i, j) for level i+1 against level j, lower triangle only; many-one: rows = levels 2..k, one column = level 1).

## PMCMRplus

With `R_i` the mean rank of group i in the ranking of all observations (midranks), `n_i` sizes, N their sum, and
the tie term `C = Σ (t³ − t) / (12 (N − 1))` over the tie groups t of the ranks:

- **kwAllPairsDunnTest** (`pAdjustMethod` default `"holm"`, any of `p.adjust`'s): `z_ij = |R_i − R_j| /
  sqrt((N(N + 1)/12 − C)(1/n_i + 1/n_j))`, p = 2 × upper normal tail, adjusted with `p.adjust` over the lower-triangle
  cells (column by column, as `pairwise.table`). Warning `Ties are present. z-quantiles were corrected for ties.` when
  C ≠ 0. Method `"Dunn's all-pairs test"`.
- **kwManyOneDunnTest** (`alternative`, `pAdjustMethod` default `"single-step"`): `z_j = (R_j − R_1) / sqrt((N(N +
  1)/12 − C)(1/n_1 + 1/n_j))`; with a `p.adjust` method: p two-sided 2 × upper tail of |z|, greater the upper tail,
  less the lower tail, then `p.adjust`; single-step: the multivariate normal probability with correlations
  `sqrt(λ_i λ_j)`, `λ_i = n_i / (n_i + n_1)`: two-sided `P(max |Z_i| ≥ |z|)`, greater `P(max Z_i ≥ z)`, less `P(min Z_i
  ≤ z)`. Same tie warning. Method `"Dunn's many-to-one test"`.
- **dunnettTest** (`alternative`): pooled variance `s² = Σ (n_i − 1) s_i² / Σ (n_i − 1)`, `t_j = (m_j − m_1) / (s
  sqrt(1/n_j + 1/n_1))`, df = N − k; greater `P(max T_i ≥ t)`, less `P(min T_i ≤ t)`, two-sided `min(1, 2 P(max T_i ≥
  |t|))`, T multivariate t with the correlations above. Method: R's exact string, `"Dunnett's-test for multiple"`, a tab, a newline, 25 spaces,
  `"comparisons with one control"` (see the fixture). `pAdjustMethod` `"single-step"`.
- **dscfAllPairsTest** (Dwass-Steel-Critchlow-Fligner): for each pair, rank the two groups' values together
  (midranks), `U` = the smaller of the two Mann-Whitney U statistics, `S = n_i + n_j`, `VAR = n_i n_j / (S (S − 1)) ×
  ((S³ − S)/12 − Σ (t³ − t)/12)` (ties within the pair), statistic `sqrt(2)(U − n_i n_j/2)/sqrt(VAR)`, p = upper tail of
  the studentized range (k means, df = ∞) at |statistic|. Method `"Dwass-Steele-Critchlow-Fligner all-pairs test"`,
  `pAdjustMethod` `"single-step"`.
- **gamesHowellTest**: `q_ij = (m_i − m_j) / sqrt(s_i²/n_i + s_j²/n_j) × sqrt(2)`, df_ij Welch's `(s_i²/n_i +
  s_j²/n_j)² / (s_i⁴/(n_i²(n_i − 1)) + s_j⁴/(n_j²(n_j − 1)))`, p = upper studentized range tail (k, df_ij) at |q|.
  Method `"Games-Howell test"`, `pAdjustMethod` `"none"`.
- **tukeyTest**: pooled `s²` over N − k df, `q_ij = (m_i − m_j)/sqrt(s² (1/n_i + 1/n_j)/2)`, p = upper studentized
  range tail (k, N − k) at |q|. Method `"Tukey's test"`, `"single-step"`.
- **steelTest**: PMCMRplus 1.9.12 fails on every input of the fixture (errors recorded); reproduce those errors for
  those inputs (`'arg' should be one of “greater”, “less”` for two-sided, `Steel's test is only valid for balanced
  designs.` for unequal sizes, and for balanced data the error string of the fixture).

## dunn.test: `dunnTest(x, g, { method, altp })`

Groups sorted; `chi2` = the Kruskal-Wallis statistic with the tie correction (as `kruskalTest`). For each pair
(i > j in group order), `Z = (R_j − R_i) / sqrt((N(N + 1)/12 − C)(1/n_j + 1/n_i))` (C as above), labelled `"<label
j> - <label i>"`, listed in the order (2,1), (3,1), (3,2), (4,1), ... P = upper normal tail of |Z| (`altp`: twice
that). Adjustment of the m = k(k − 1)/2 values: `none`; `bonferroni` min(1, m P); `sidak` min(1, 1 − (1 − P)^m);
sorting the P increasingly, the i-th smallest (i = 1..m): `holm` min(1, (m + 1 − i) P), `hs` min(1, 1 − (1 − P)^(m +
1 − i)); sorting decreasingly, the i-th largest: `hochberg` min(1, i P), `bh` min(1, m/(m + 1 − i) P), `by` min(1, m/(m +
1 − i) Σ_{l ≤ m} 1/l × P); each value then back in its original position (no monotonicity step). Result `{ chi2, Z,
P, PAdjusted, comparisons }` (with `altp`, `P` and `PAdjusted` are the two-sided values).

## multcomp: `glhtDunnett(x, g, { alternative })`

The one-way ANOVA fit; estimates `m_j − m_1`, standard errors `s sqrt(1/n_j + 1/n_1)` (pooled s, N − k df), `t` their
ratios, p-values: two-sided `P(max |T_i| ≥ |t|)`, greater `P(max T_i ≥ t)`, less `P(min T_i ≤ t)`. Names
`"<level> - <level 1>"` as the fixture. Result `{ names, estimate, se, t, p, df }`.

## Dunnett's probabilities

With `λ_i = n_i/(n_i + n_1)`, the statistics are `T_i = (sqrt(λ_i) Z_0 + sqrt(1 − λ_i) Z_i)/U` with independent
standard normals and `U = sqrt(χ²_df/df)` (U = 1 for df = ∞). So, for c ≥ 0,

`P(max |T_i| < c) = E_U E_Z0 Π_i [Φ((sqrt(λ_i) Z_0 + c U)/sqrt(1 − λ_i)) − Φ((sqrt(λ_i) Z_0 − c U)/sqrt(1 − λ_i))]`

and `P(max T_i < c)` with the product of `Φ((sqrt(λ_i) Z_0 + c U)/sqrt(1 − λ_i))` alone. Compute these to full
double precision (adaptive quadrature over Z_0 and U; the fixtures' references are such integrals at relative
tolerance 1e-13 and 1e-12 for the outer integral).

## Accuracy

Everything not listed in rule 1 within a relative 1e-12 of R. The Dunnett-type p-values within a relative 1e-10 of the
`reference` (the reference's own integration tolerance), and they need not be listed as known differences. Other
known differences only within 1e-12 of a reference, listed with reasons. No loosening.
