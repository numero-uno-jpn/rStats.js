# Pairwise dissimilarities: dist and as.dist

Reference: R 4.6.2 stats::dist and stats::as.dist, public help and public-call outputs. No R source or implementation internals were consulted.

## Condensed representation

For n rows and m columns, the result contains n(n-1)/2 values in lower-triangle column order:
d(2,1), d(3,1), ..., d(n,1), d(3,2), ..., d(n,2), ..., d(n,n-1).

Labels are the row names when present; otherwise labels are absent. R's diag and upper attributes control printing only, not the stored vector. Defaults are diag=FALSE and upper=FALSE. The method attribute is the canonical method name for dist and NULL for as.dist. A numeric vector is treated as n observations in one column (dist_vector); data frames are accepted (dist_data_frame).

## Six distance methods

For rows x_i and x_j in R^m, let K be the coordinates where both values are non-missing, q=|K|. A pair with q=0 is NA.

- Euclidean: d = sqrt((m/q) * sum((x_i-x_j)^2 over K)). Verified: dist_euclidean, dist_na_euclidean, dist_all_na_row_euclidean.
- Manhattan: d = (m/q) * sum(abs(x_i-x_j) over K). Verified: dist_manhattan, dist_na_manhattan.
- Minkowski, finite p>0: d = ((m/q) * sum(abs(x_i-x_j)^p over K))^(1/p). Verified at p=2, 3, 1, and 0.5: dist_minkowski, dist_minkowski_p3, dist_minkowski_p1, dist_minkowski_p05, and dist_na_minkowski. R rejects p=0 and p=Inf: dist_minkowski_p0 and dist_minkowski_pInf.
- Maximum: d = max(abs(x_i-x_j) over K). There is no m/q rescaling. Verified: dist_maximum, dist_na_maximum.
- Canberra: let L contain the coordinates in K where |x_i|+|x_j|>0, and r=|L|. Then d = (m/r) * sum(abs(x_i-x_j)/(|x_i|+|x_j|) over L). Zero-over-zero coordinates are omitted and the remaining terms are rescaled by m/r; if r=0, the result is NA. Verified: dist_canberra, dist_na_canberra, dist_canberra_zeros, dist_canberra_all_zero. An infinite-valued term is observed as 1 in dist_inf_canberra.
- Binary: a coordinate is present when its value is nonzero. Let U be coordinates where at least one row is present, and a the number where exactly one row is present. Then d=a/|U|. There is no missing-coordinate rescaling. The observed all-zero/all-zero pair is 1 (not 0): dist_binary_zero_rows. Verified: dist_binary, dist_na_binary, dist_binary_logical. Non-finite values are treated as missing with warning "treating non-finite values as NA" for each affected pair: dist_inf_binary.

## Missing and non-finite values

NA and NaN are omitted pairwise as described above; a pair with no jointly usable coordinate produces NA. For Euclidean, Manhattan and Minkowski, m/q corrects for the number of retained coordinates. Canberra additionally omits zero-over-zero terms and corrects for its remaining term count. Maximum and binary are not rescaled. Checked by dist_na_*, dist_all_na_row_*, dist_nan, and dist_inf_*.

For Euclidean/Manhattan/Minkowski, an infinite difference remains infinite; a coordinate where both rows contain the same infinity is omitted as an undefined difference. Canberra's infinite term is 1. Binary emits the non-finite-as-NA warning. See dist_inf_* and dist_inf_both_*.

R coerces a character matrix and warns "NAs introduced by coercion": dist_character. R's straightforward arithmetic overflows at scale 1e200 and underflows at 1e-200: dist_scale and dist_scale_small.

## as.dist

For a square matrix A, only entries below the diagonal are read, in the same condensed order. The upper triangle is ignored even if it disagrees: as_dist and as_dist_upper_used. The resulting method is NULL. Row/column-name handling and validation of nonsquare inputs have not yet been independently probed.

## R-observed argument matching

A unique prefix is accepted: method="max" selects maximum (dist_partial_name). An unknown method errors (dist_bad_method). Minkowski requires finite positive p.

## Numerical checks

The complete 10-pair vectors were read from experiments/cluster110.json. Direct hand calculations reproduce the values for all six methods on small. Examples: Euclidean d(a,b)=4.69041575982343; Manhattan d(a,b)=8; Canberra d(a,b)=2.6; binary d(a,b)=2/3; Minkowski p=0.5 gives d(a,b)=23.7979589711327. The missing-value case dist_na_euclidean gives d(a,b)=4.41588043316392, using two of three coordinates and factor 3/2.

## Decisions for the user

1. Return a structured condensed-distance value with values, size, labels, and method; include diag and upper as optional display metadata. Recommended: keep these flags but do not expand the stored vector.
2. Accept unique method prefixes, matching R ("max" is observed). Recommended: accept them and normalize to the canonical name.
3. For finite extreme magnitudes, either mimic R's overflow/underflow or use scaled arithmetic. Recommended: use numerically stable arithmetic; this is a documented difference from R's naive 1e±200 results.
4. For binary distance when both rows are all-zero, R returns 1. Recommended: preserve 1 exactly.
5. For as.dist, accept a square matrix and return the same structured condensed representation; decide separately whether an existing condensed object is an identity input.

## rStats.js's choices

