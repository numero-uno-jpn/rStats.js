# Hierarchical clustering: `hclust` and `cutree`

Reference: R 4.6.2 `stats::hclust` and `stats::cutree`, public help and public-call outputs. No R source, C/Fortran implementation, or implementation excerpts were consulted.

## Lance–Williams updates

For current clusters (A,B,C), sizes (n_A,n_B,n_C), and dissimilarities (d_{AC},d_{BC},d_{AB}), the update is
[
d_{(A\cup B),C}=\alpha_A d_{AC}+\alpha_B d_{BC}+\beta d_{AB}+\gamma|d_{AC}-d_{BC}|.
]
The eight methods use:

| Method | (α_A) | (α_B) | (β) | (γ) |
|---|---:|---:|---:|---:|
| single | (1/2) | (1/2) | 0 | (-1/2) |
| complete | (1/2) | (1/2) | 0 | (+1/2) |
| average (UPGMA) | (n_A/(n_A+n_B)) | (n_B/(n_A+n_B)) | 0 | 0 |
| mcquitty (WPGMA) | (1/2) | (1/2) | 0 | 0 |
| ward.D | ((n_A+n_C)/N) | ((n_B+n_C)/N) | (-n_C/N) | 0 |
| ward.D2 | same coefficients applied to squared dissimilarities, then square root | | | |
| median (WPGMC) | (1/2) | (1/2) | (-1/4) | 0 |
| centroid (UPGMC) | (n_A/(n_A+n_B)) | (n_B/(n_A+n_B)) | (-n_An_B/(n_A+n_B)^2) | 0 |

Here (N=n_A+n_B+n_C). For `ward.D`, the update acts on the supplied dissimilarities; for `ward.D2`, the update is applied to their squares and the resulting height is square-rooted. Median and centroid likewise operate on the supplied dissimilarities (R does not silently square them); users commonly supply squared Euclidean dissimilarities when that is the intended geometry.

The recurrences were independently evaluated against the grid and line examples for all eight methods, and against non-unit initial cluster sizes in `hclust_members_*`. In particular, `hclust_members_average`, `hclust_members_ward.D`, `hclust_members_ward.D2`, `hclust_members_median`, and `hclust_members_centroid` reproduce the reported heights with (members=(2,1,3,1,1)). Inversions for median/centroid are present in `hclust_triangle_centroid`, `hclust_triangle_median`, and `hclust_small_centroid`.

## Empirical tie rule, merge encoding, and leaf order

The following deterministic rule reproduces the public R outputs in **all 40 tie cases** (8 methods × 5 inputs): `hclust_grid_*`, `hclust_line_*`, `hclust_line_shuffled_*`, `hclust_all_equal_*`, and `hclust_zero_*).

1. At each step, find the smallest current inter-cluster dissimilarity.
2. If several pairs have exactly the same minimum, order each cluster by its smallest original observation index. Choose the pair whose two such indices, sorted ascending, are lexicographically smallest.
3. The first child in `merge` is ordered by the current cluster list: singleton observations in original input order, followed by formed clusters in merge-creation order. Thus singleton/singleton children have increasing negative indices, cluster/cluster children have increasing positive merge indices, and a mixed pair places the negative singleton first.
4. A singleton (i) is encoded as (-i); a previously formed cluster is encoded by its 1-based merge-row number. `order` is the left-to-right leaf traversal of this oriented binary tree.

Independent Lance–Williams calculations reproduce every `merge`, `height`, and the tree-traversal `order` in those 40 cases. Examples: the grid's first four merges are ((-1,-2),(-3,-6),(-4,-5),(-7,-8)) for Ward/complete/average/mcquitty; single instead continues ((-3,1),(-4,2),(-5,3)); median/centroid begin ((-1,-2),(-4,1),(-5,2),(-3,-6)). The shuffled-line case begins ((-1,-5),(-2,-4),(-3,-6)) for all methods except single's chain-like sequence, and all-equal distances give ((-1,-2),(-3,1),(-4,2),(-5,3)). The zero-distance case gives ((-1,-2),(-3,-4),(-5,2),(1,3)). The exact numeric heights and orders are in the named R cases.

This tie rule is an empirical characterization of the tested public outputs, not a claim about R's internal search data structure. It is deliberately stated in terms of clusters and their original observation indices.

## Heights, members, and input conditions

- `members` supplies the initial sizes of the (n) objects and changes size-weighted updates. Its length must equal the number of initial objects (`hclust_members_wrong_length`).
- Median and centroid can produce a non-monotone height sequence; e.g. `hclust_small_centroid` and `hclust_triangle_centroid`. The height is not forced to be monotone.
- `cutree(h=)` rejects a tree whose heights are not increasing: `cutree_inversion_h`. `cutree(k=)` remains usable: `cutree_inversion_k`.
- A two-object tree works; one object errors (`hclust_two`, `hclust_one`). NA/Inf in the dissimilarities errors. Negative dissimilarities are accepted. A square matrix passed directly is not accepted as a condensed-distance object (`hclust_matrix`).
- `method="ward"` is an alias for `ward.D` and emits the rename message (`hclust_ward_name`). Unique prefixes are accepted (`hclust_partial_name`); invalid methods error (`hclust_bad_method`).
- A (10^{200})-scaled Ward.D2 input can crash R itself; the scale tests use single/other stable cases and should not use that failing R call as an oracle.

## `cutree`

For requested cluster count (k), cut the merge tree after (n-k) merges. For height (h), include every merge whose height is at most (h); the result is the connected components remaining after those merges. A vector of (k) or (h) returns a matrix whose columns follow the request order. If both are supplied, R uses (k).

Cluster labels are canonicalized by first appearance in original observation order (the first observed member receives cluster 1, then the next unseen cluster receives 2, etc.). Labels are returned only when the input tree has labels. Verified by `cutree_k`, `cutree_k_vector`, `cutree_h`, `cutree_h_vector`, `cutree_k_and_h`, `cutree_grid_ties_k1` through `cutree_grid_ties_k9`, `cutree_grid_ties_h`, `cutree_h_exact`, and the no-label cases.

R-observed boundaries: (k=2.5) is truncated to 2 (`cutree_k_fraction`); (h<0) leaves every observation separate (`cutree_h_negative`); (k=0) or (k>n) errors (`cutree_k_zero`, `cutree_k_too_big`); neither (k) nor (h) errors (`cutree_none`).

## Decisions for the user

1. Implement all eight methods with the equations above and use cluster sizes for the weighted coefficients. **Recommended:** use the empirical tie key and child orientation above; it matches all 40 supplied tie cases.
2. Preserve height inversions for median/centroid, and reject `cutree(h=)` on a non-monotone tree as R does. **Recommended:** match R.
3. Canonicalize cutree labels by first observation appearance; preserve input labels only as names. **Recommended:** match R.
4. Accept `"ward"` as an alias with the R message and accept unique method prefixes. **Recommended:** match R.
5. For numerical extremes where R itself fails, use stable arithmetic and test scale equivariance rather than reproduce a crash.

## rStats.js's choices

