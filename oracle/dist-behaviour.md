# Pairwise dissimilarities: `dist` and `asDist`

Reference: R 4.6.2 `stats::dist` and `stats::as.dist`, public help and public-call outputs. No R source or implementation internals were consulted.

## Condensed representation

For (n) rows and (m) columns, the result contains (n(n-1)/2) values in lower-triangle column order:
[
d_{2,1},d_{3,1},\ldots,d_{n,1},d_{3,2},\ldots,d_{n,2},\ldots,d_{n,n-1}.
]
The observation labels are the row names when present; otherwise labels are absent. R's `diag` and `upper` attributes control only printing, not the stored vector. The observed defaults are `diag = FALSE`, `upper = FALSE`. The stored method is the canonical method name for `dist`; it is NULL for `as.dist`.

## Six distance methods

For rows (x_i,x_j\in\mathbb R^m), let (K_{ij}) be the coordinates for which both values are non-missing, and (q=|K_{ij}|). A pair with (q=0) is NA. For the four rescaled methods below, the multiplier is (m/q).

- Euclidean:
  [
  d_{ij}=\sqrt{\frac m q\sum_{k\in K_{ij}}(x_{ik}-x_{jk})^2}.
  ]
  Verified numerically: `dist_euclidean` (all 10 pairs); missing-value rescaling: `dist_na_euclidean`; one row containing only missing values: `dist_all_na_row_euclidean`.
- Manhattan:
  [
  d_{ij}=\frac m q\sum_{k\in K_{ij}}|x_{ik}-x_{jk}|.
  ]
  Verified: `dist_manhattan`, `dist_na_manhattan`.
- Minkowski, finite (p>0):
  [
  d_{ij}=\left(\frac m q\sum_{k\in K_{ij}}|x_{ik}-x_{jk}|^p\right)^{1/p}.
  ]
  Verified at (p=2,3,1,0.5): `dist_minkowski`, `dist_minkowski_p3`, `dist_minkowski_p1`, `dist_minkowski_p05`, and with missing values `dist_na_minkowski`. R rejects (p=0) and (p=\infty): `dist_minkowski_p0`, `dist_minkowski_pInf`.
- Maximum:
  [
  d_{ij}=\max_{k\in K_{ij}}|x_{ik}-x_{jk}|.
  ]
  There is no (m/q) rescaling. Verified: `dist_maximum`, `dist_na_maximum`.
- Canberra: let (L=\{k\in K_{ij}:|x_{ik}|+|x_{jk}|>0\}), (r=|L|). Then
  [
  d_{ij}=\frac m r\sum_{k\in L}\frac{|x_{ik}-x_{jk}|}{|x_{ik}|+|x_{jk}|}.
  ]
  Zero-over-zero coordinates are omitted, and the remaining terms are rescaled by (m/r); if (r=0), the result is NA. Verified: `dist_canberra`, `dist_na_canberra`, `dist_canberra_zeros`, `dist_canberra_all_zero`. An infinite-valued term is observed as 1 in `dist_inf_canberra`.
- Binary: a coordinate is present when its value is nonzero. Let (U) be the coordinates where at least one row is present, and (a) the number of coordinates where exactly one row is present:
  [
  d_{ij}=a/|U|.
  ]
  There is no missing-coordinate rescaling. The observed all-zero/all-zero pair is 1 (not 0): `dist_binary_zero_rows`. Verified: `dist_binary`, `dist_na_binary`, `dist_binary_logical`. Non-finite values are treated as missing with the warning `treating non-finite values as NA` for each affected pair: `dist_inf_binary`.

## Missing and non-finite values

NA and NaN are omitted pairwise as described above; a row with no jointly usable coordinate produces NA distances. For Euclidean, Manhattan and Minkowski, the factor (m/q) corrects for the number of retained coordinates. Canberra additionally omits zero-over-zero terms and corrects for its remaining term count. Maximum and binary are not rescaled. These statements are checked by `dist_na_*`, `dist_all_na_row_*`, `dist_nan`, and `dist_inf_*`.

For Euclidean/Manhattan/Minkowski, an infinite difference remains infinite; a coordinate where both rows contain the same infinity is omitted as an undefined difference. Canberra's infinite term is 1. Binary emits the non-finite-as-NA warning. See `dist_inf_*` and `dist_inf_both_*`.

R coerces a character matrix and warns `NAs introduced by coercion`: `dist_character`. R's straightforward arithmetic overflows at scale (10^{200}) and underflows at (10^{-200}): `dist_scale`, `dist_scale_small`.

## `asDist`

For a square matrix (A), only entries below the diagonal are read, in the same condensed order. The upper triangle is ignored, even if it disagrees: `as_dist`, `as_dist_upper_used`. The resulting method is NULL. Row/column-name handling and validation of nonsquare inputs have not yet been independently probed.

## R-observed argument matching

A unique prefix is accepted: `method = "max"` selects maximum (`dist_partial_name`). An unknown method errors (`dist_bad_method`). Minkowski requires finite positive (p).

## Numerical checks

The complete 10-pair vectors were read from `experiments/cluster110.json`. Direct hand calculations reproduce the values for all six methods on `small`; examples include Euclidean (d(a,b)=4.69041575982343), Manhattan (d(a,b)=8), Canberra (d(a,b)=2.6), binary (d(a,b)=2/3), and Minkowski (p=0.5), (d(a,b)=23.7979589711327). The missing-value case `dist_na_euclidean` gives (d(a,b)=4.41588043316392), using two of three coordinates and the factor (3/2).

## Decisions for the user

1. Return a structured condensed-distance value with `values`, `size`, `labels`, and `method`; include `diag` and `upper` as optional display metadata. **Recommended:** keep these flags but do not expand the stored vector.
2. Accept unique method prefixes, matching R (`"max"` is observed). **Recommended:** accept them and normalize to the canonical name.
3. For finite extreme magnitudes, either mimic R's overflow/underflow or use scaled arithmetic. **Recommended:** use numerically stable arithmetic; this is a documented difference from R's naive (10^{\pm200}) results.
4. For binary distance when both rows are all-zero, R returns 1. **Recommended:** preserve 1 exactly.
5. For `asDist`, accept a square matrix and return the same structured condensed representation; decide separately whether an existing condensed object is an identity input.

## rStats.js's choices

