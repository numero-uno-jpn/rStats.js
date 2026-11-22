# K-means clustering

Reference: R 4.6.2 `stats::kmeans`, its public help, Hartigan & Wong (1979), Lloyd (1982), Forgy (1965), and MacQueen (1967). No R source or AS 136 Fortran was inspected or used.

## Objective and returned quantities

For clusters (C_1,\ldots,C_k), centers (μ_j) are the arithmetic means and
[
W_j=\sum_{i\in C_j}\|x_i-\mu_j\|_2^2,\qquad
W=\sum_j W_j.
]
The total sum of squares is
[
T=\sum_i\|x_i-\bar x\|_2^2,
]
and between-cluster sum of squares is (B=T-W). Returned `withinss` contains (W_j), `totWithinss` is (W), and `betweenss` is (B). `size` contains (|C_j|). Cluster labels refer to the center order, not to sorted data values. Numeric vector input is treated as a one-column matrix. Verified on `kmeans_iris_Hartigan-Wong`, `kmeans_usarrests_Hartigan-Wong`, `kmeans_vector_Hartigan-Wong`, `kmeans_k1_Hartigan-Wong`, and the other algorithm cases.

## Four update procedures

- **Lloyd / Forgy (same R result for a supplied initial-center matrix):** assign every observation to its nearest current center,
  [
  c_i=\arg\min_j\|x_i-\mu_j\|_2^2,
  ]
  resolving an exact tie by the first center; then replace each nonempty center by the mean of its assigned observations. Repeat assignment and mean updates until the assignment is unchanged or the iteration limit is reached. R returns the same cluster, center and sum-of-squares values for Lloyd and Forgy on the supplied-center cases (`kmeans_iris_Lloyd`, `kmeans_iris_Forgy`).
- **MacQueen (online updates):** visit observations in input order; assign each to its nearest current center and update the selected center to the running mean of observations assigned to that cluster. The update for a cluster with current count (n_j) is
  [
  \mu_j\leftarrow\mu_j+\frac{x_i-\mu_j}{n_j+1}.
  ]
  The public outputs confirm different results from batch Lloyd/Forgy for poor starts and one-pass cases (`kmeans_iris_poor_start_MacQueen`, `kmeans_iris_iter1_MacQueen`). The exact handling of the initial pseudo-count associated with a supplied center remains unverified.
- **Hartigan–Wong:** use individual point transfers rather than simultaneous batch reassignment. For a point (x) currently in cluster (A) and candidate cluster (B), with (n_A>1), the change in total within-cluster sum of squares is
  [
  \Delta W=
  \frac{n_B}{n_B+1}\|x-\mu_B\|^2
  -\frac{n_A}{n_A-1}\|x-\mu_A\|^2.
  ]
  Transfer when (Delta W<0), update the two means and counts, and continue the optimal-transfer / quick-transfer phases described in Hartigan & Wong (1979) until no improving transfer remains or the iteration limit is reached. The transfer criterion is the direct difference of the two affected clusters' SSE terms. Full pass scheduling and all fault codes have not been independently reconstructed from the paper's prose and public outputs.
- **Forgy** is accepted as a separate algorithm name but shares the batch result with Lloyd in the tested supplied-center examples; any distinct initialization semantics when centers are requested numerically are not yet established.

## Initialization and multiple starts

When `centers` is a number (k), R chooses initial rows from the data using its random generator; `nstart` requests multiple starts, and the solution with the smallest `tot.withinss` is returned. The existing R cases verify the random sequence for distinct data (`sample_int_150_3_seed42`, `sample_int_150_3_seed1_x10`), final RNG states (`kmeans_seed_state_after*`), and best-of-(nstart) examples (`kmeans_seed_nstart`, `kmeans_seed_nstart_lloyd`). A new public probe, `duplicate_start_seed_1` through `duplicate_start_seed_12`, shows that sampling rows with identical values does not itself make the call fail: seed 3's separate `sample.int(4,2)` probe picks rows 1 and 2 (equal rows), while `kmeans(dup,2,nstart=1)` still returns two distinct centers. The follow-up probe `seed3_fit_then_rng` resolves this: after `sample.int(4,2)` returns the duplicate-valued rows [1,2], `kmeans` consumes a second draw [4,3] and the subsequent `runif(3)` matches the state after exactly two `sample.int` calls. Thus it retries the row sample until the chosen centers are distinct by value. The retry consumes RNG state.

When (nstart>1), R retains a solution with minimum (W). Whether an exact tie retains the earliest start has not yet been isolated. The exact initial ordering of numeric centers also affects cluster numbers.

## Iteration and fault reporting observed in R

- Hartigan–Wong reports `ifault=0` on convergence and `ifault=2` when the iteration limit is reached; at `iter.max=1`, the warning is `did not converge in 1 iteration` (`kmeans_iris_iter1_Hartigan-Wong`, `iter_Hartigan-Wong_1`).
- Lloyd/Forgy have the same cluster assignments and centers in the supplied-center examples, but their reported `iter` differs from Hartigan–Wong. For the iris case, HW reports 2 and Lloyd/Forgy 4; for the small probe, Lloyd/Forgy report 2. At the limit, they warn and report `ifault=2`; on convergence `ifault` is NULL.
- MacQueen reports `ifault=NULL`; the small probe reports `iter=1`, while the iris example reports `iter=3`.
- Thus `iter` is algorithm-specific and cannot be inferred simply as the number of centroid recomputations. The exact accounting for all stopping paths remains unconfirmed.
- Empty clusters are an error for Hartigan–Wong and a warning (twice in the tested case) for Lloyd, Forgy and MacQueen: `kmeans_empty_*`. Hartigan–Wong rejects (k=n) (`kmeans_k_equals_n_Hartigan-Wong`); the other algorithms accept it. A matrix of duplicate initial centers errors (`kmeans_duplicate_centers`); too many centers for distinct data points errors (`kmeans_seed_k_too_big`).

Other observed input errors include non-finite data, mismatched columns, nonpositive `iter.max`, and unsupported algorithm names. A unique algorithm prefix such as `"Mac"` is accepted (`kmeans_partial_name`).

## Numerical checks

The SSE identities (T=W+B) and the mean centers were independently checked against the returned iris, USArrests, vector, and (k=1) results. The iris result has (T=681.3706), (W=78.851441426146), and (B=602.519158573854); (W+B=T) at floating-point precision (`kmeans_iris_Hartigan-Wong`). The (k=1) case has (W=T=681.3706) and (B) approximately zero (`kmeans_k1_Hartigan-Wong`). The four algorithms were compared on iris, poor starts, (k=1), (k=n), empty clusters, duplicates, and vector inputs.

## Decisions for the user

1. Support all four named algorithms. **Recommended:** match R's algorithm-specific behavior, but keep Lloyd/Forgy as a shared batch implementation unless a numeric-start probe demonstrates a difference.
2. For Hartigan–Wong, implement the transfer criterion above and document any scheduling details that cannot be established from the paper's prose. **Recommended:** prioritize the mathematically defined SSE decrease and stable termination over copying undocumented internals.
3. Numeric `centers` initialization: choose between exact R random-start behavior (including duplicate-row repair) and a simpler deterministic distinct-row policy. **Recommended:** preserve R's random draws when distinct; investigate duplicate repair/RNG consumption before implementation.
4. `nstart` ties: choose earliest minimum-WSS start or another deterministic tie rule. **Recommended:** retain the first minimum; this is stable and consistent with ordinary best-so-far selection, but is not yet directly confirmed.
5. Match the R warning/error distinctions for empty clusters, (k=n), invalid centers, and iteration limits. **Recommended:** match the observed public behavior.
6. Preserve algorithm-specific `iter` and `ifault` only if their semantics can be reproduced; otherwise document a simpler iteration count as a deliberate difference. **Recommended:** do not claim exact R compatibility until the remaining probes are complete.

## rStats.js's choices

