# K-means clustering

Reference: R 4.6.2 stats::kmeans, its public help, Hartigan & Wong (1979), Lloyd (1982), Forgy (1965), and MacQueen (1967). No R source or AS 136 Fortran was inspected or used.

## Objective and returned quantities

For clusters C1,...,Ck, centers μj are arithmetic means and:

Wj = sum over i in Cj of ||x_i-μj||²
W = sum over j of Wj
T = sum over i of ||x_i-xbar||²
B = T-W.

Returned withinss contains Wj, tot.withinss is W, betweenss is B, and size contains |Cj|. Cluster labels refer to center order, not sorted data values. Numeric vector input is treated as a one-column matrix. Verified on kmeans_iris_Hartigan-Wong, kmeans_usarrests_Hartigan-Wong, kmeans_vector_Hartigan-Wong, kmeans_k1_Hartigan-Wong, and the other algorithm cases.

## Four update procedures

- Lloyd / Forgy (R documents these as two names for the same method): assign every observation to its nearest current center, ci=argmin_j ||xi-μj||², resolving an exact tie by the first center; then replace each nonempty center by the mean of its assigned observations. Repeat assignment and mean updates until the assignment is unchanged or the iteration limit is reached. The public cases confirm identical cluster, center and sum-of-squares values (kmeans_iris_Lloyd, kmeans_iris_Forgy).
- MacQueen (online updates): visit observations in input order; assign each to its nearest current center and update the selected center to the running mean of observations assigned to that cluster. For a cluster with current count nj, the update is μj ← μj + (xi-μj)/(nj+1). The public outputs confirm different results from batch Lloyd/Forgy for poor starts and one-pass cases (kmeans_iris_poor_start_MacQueen, kmeans_iris_iter1_MacQueen). The midpoint probe midpoint_MacQueen returns center 0.5 for the two assigned observations 0 and 1; counting the supplied initial center as an extra pseudo-observation would instead give 1/3. This supports initializing the assigned-observation count at zero (the supplied center is a prototype, not an extra data row). R's help describes repeating passes until no point changes cluster; exact iteration accounting remains unverified.
- Hartigan–Wong: use individual point transfers rather than simultaneous batch reassignment. For a point x currently in cluster A and candidate cluster B, with nA>1, the change in total within-cluster sum of squares is:
  ΔW = [nB/(nB+1)]*||x-μB||² - [nA/(nA-1)]*||x-μA||².
  Transfer when ΔW<0, update the two means and counts, and continue the optimal-transfer / quick-transfer phases described in Hartigan & Wong (1979) until no improving transfer remains or the iteration limit is reached. The transfer criterion is the direct difference of the two affected clusters' SSE terms. Full pass scheduling and all fault codes have not been independently reconstructed from the paper's prose and public outputs.
- Forgy is accepted as a name for the Lloyd batch method; it is not a distinct update procedure.

## Initialization and multiple starts

When centers is a number k, R chooses initial rows from the data using its random generator; nstart requests multiple starts, and the solution with smallest tot.withinss is returned. Existing R cases verify the random sequence for distinct data (sample_int_150_3_seed42, sample_int_150_3_seed1_x10), final RNG states (kmeans_seed_state_after*), and best-of-nstart examples (kmeans_seed_nstart, kmeans_seed_nstart_lloyd).

The new public probe duplicate_start_seed_1 through duplicate_start_seed_12 shows that sampling rows with identical values does not make the call fail. The follow-up probe seed3_sample_then_rng, seed3_fit_then_rng, and seed3_two_samples_then_rng resolves the retry: sample.int(4,2) first returns duplicate-valued rows [1,2]; kmeans then consumes a second draw [4,3], and the subsequent runif(3) matches the state after exactly two sample.int calls. Therefore numeric-center initialization retries the row sample until the chosen centers are distinct by value. The retry consumes RNG state.

When nstart>1, R retains a solution with minimum W. The equal-best probes equal_best_start_1 through equal_best_start_8 use data 0,1,2,3 with nstart=8; every returned solution has W=1. The final center order follows the first sample.int draw for all eight seeds (e.g. seed 4 draws rows [4,3] and returns centers [2.5,0.5]). Thus an exact W tie retains the earliest start. Initial center order determines cluster numbering.

## Iteration and fault reporting observed in R

- Hartigan–Wong reports ifault=0 on convergence and ifault=2 when the iteration limit is reached; ifault=4 is mentioned in the initial task notes but is not produced by any supplied or additional public-output case, so its condition is unconfirmed; at iter.max=1, warning is "did not converge in 1 iteration" (kmeans_iris_iter1_Hartigan-Wong, iter_Hartigan-Wong_1).
- Lloyd/Forgy have the same cluster assignments and centers in supplied-center examples, but their reported iter differs from Hartigan–Wong. For iris, HW reports 2 and Lloyd/Forgy 4; for the small probe, Lloyd/Forgy report 2. The exact midpoint case reports HW=1, Lloyd/Forgy=2, MacQueen=1 (midpoint_*). At the limit, they warn and report ifault=2; on convergence ifault is NULL.
- MacQueen reports ifault=NULL; the small probe reports iter=1, while iris reports iter=3.
- Thus iter is algorithm-specific and cannot be inferred simply as the number of centroid recomputations. Exact accounting for all stopping paths remains unconfirmed.
- Empty clusters are an error for Hartigan–Wong and a warning (twice in the tested case) for Lloyd, Forgy and MacQueen: kmeans_empty_*. Hartigan–Wong rejects k=n (kmeans_k_equals_n_Hartigan-Wong); the other algorithms accept it. A matrix of duplicate initial centers errors (kmeans_duplicate_centers); too many centers for distinct data points errors (kmeans_seed_k_too_big).

Other observed input errors include non-finite data, mismatched columns, nonpositive iter.max, and unsupported algorithm names. A unique algorithm prefix such as "Mac" is accepted (kmeans_partial_name). Exact distance ties are assigned to the first center in all four algorithms: midpoint_Hartigan-Wong, midpoint_Lloyd, midpoint_Forgy, midpoint_MacQueen return cluster [1,2,1] for data [0,2,1] with centers [0,2].

## Numerical checks

The SSE identities T=W+B and the mean centers were independently checked against returned iris, USArrests, vector, and k=1 results. The iris result has T=681.3706, W=78.851441426146, B=602.519158573854; W+B=T at floating-point precision (kmeans_iris_Hartigan-Wong). The k=1 case has W=T=681.3706 and B approximately zero (kmeans_k1_Hartigan-Wong). The four algorithms were compared on iris, poor starts, k=1, k=n, empty clusters, duplicates, vector inputs, and an exact midpoint tie (midpoint_*).

## Decisions for the user

1. Support all four named algorithms. Recommended: match R's algorithm-specific behavior, but keep Lloyd/Forgy as a shared batch implementation unless a numeric-start probe demonstrates a difference.
2. For Hartigan–Wong, implement the transfer criterion above and document any scheduling details that cannot be established from the paper's prose. Recommended: prioritize the mathematically defined SSE decrease and stable termination over copying undocumented internals.
3. Numeric centers initialization: preserve R's random draws, including redraws until distinct row values are selected. Recommended: match this now-confirmed behavior.
4. nstart ties: R retains the first minimum-WSS start, verified by equal_best_start_1 through equal_best_start_8. Recommended: retain the first minimum.
5. Match R warning/error distinctions for empty clusters, k=n, invalid centers, and iteration limits. Recommended: match observed public behavior.
6. Preserve algorithm-specific iter and ifault only if their semantics can be reproduced; otherwise document a simpler iteration count as a deliberate difference. Recommended: do not claim exact R compatibility until the remaining probes are complete.

## rStats.js's choices

