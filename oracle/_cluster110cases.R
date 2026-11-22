# _cluster110cases.R: shared public-call cases for dist, hclust/cutree, kmeans, cmdscale and isoMDS.
# Kept independent of experiments/: copied case definitions; oracle scripts select a named prefix into /out.
# Public outputs only. No R object internals, source inspection, or private calls.
library(MASS)
library(jsonlite)
# Helpers (the same in each script): run() records the value, the warnings, the messages and the error of one call
run <- function(expr) {
  warns <- character(0); msgs <- character(0)
  value <- withCallingHandlers(
    tryCatch(expr, error = function(e) structure(list(message = conditionMessage(e)), class = "caught")),
    warning = function(w) { warns <<- c(warns, conditionMessage(w)); invokeRestart("muffleWarning") },
    message = function(m) { msgs <<- c(msgs, conditionMessage(m)); invokeRestart("muffleMessage") })
  if (inherits(value, "caught")) return(list(error = value$message, warnings = warns, messages = msgs))
  list(value = value, warnings = warns, messages = msgs)
}
tab <- function(m) list(rows = rownames(m), cols = colnames(m), values = unname(as.matrix(m)))
out <- list()

## dist: the lower triangle by columns, its attributes, every method
dd <- function(d) list(values = as.vector(d), size = attr(d, "Size"), labels = attr(d, "Labels"),
                       method = attr(d, "method"), diag = attr(d, "Diag"), upper = attr(d, "Upper"))
small <- matrix(c(1, 2, 0, 4, 0, 3, -1, 5, 2, 2, 7, 0, 0, 0, 1), nrow = 5, byrow = TRUE,
                dimnames = list(c("a", "b", "c", "d", "e"), c("x", "y", "z")))
dmeth <- c("euclidean", "maximum", "manhattan", "canberra", "binary", "minkowski")
for (m in dmeth) out[[paste0("dist_", m)]] <- run(dd(dist(small, method = m)))
out$dist_minkowski_p3 <- run(dd(dist(small, method = "minkowski", p = 3)))
out$dist_minkowski_p05 <- run(dd(dist(small, method = "minkowski", p = 0.5)))
out$dist_minkowski_p1 <- run(dd(dist(small, method = "minkowski", p = 1)))
out$dist_minkowski_pInf <- run(dd(dist(small, method = "minkowski", p = Inf)))
out$dist_minkowski_p0 <- run(dd(dist(small, method = "minkowski", p = 0)))
out$dist_partial_name <- run(dd(dist(small, method = "max")))
out$dist_bad_method <- run(dd(dist(small, method = "cosine")))
out$dist_diag_upper <- run(dd(dist(small, diag = TRUE, upper = TRUE)))
out$dist_no_names <- run(dd(dist(unname(small))))
out$dist_one_row <- run(dd(dist(small[1, , drop = FALSE])))
out$dist_vector <- run(dd(dist(c(3, 1, 4, 1, 5))))
out$dist_data_frame <- run(dd(dist(USArrests[1:6, ])))
# missing values: each method drops the coordinates where either row is NA and (for some dmeth) rescales
na <- small; na[2, 1] <- NA; na[4, 3] <- NA
for (m in dmeth) out[[paste0("dist_na_", m)]] <- run(dd(dist(na, method = m)))
allna <- small; allna[2, ] <- NA
for (m in dmeth) out[[paste0("dist_all_na_row_", m)]] <- run(dd(dist(allna, method = m)))
nan <- small; nan[3, 2] <- NaN
out$dist_nan <- run(dd(dist(nan)))
inf <- small; inf[1, 1] <- Inf; inf[3, 1] <- -Inf
for (m in dmeth) out[[paste0("dist_inf_", m)]] <- run(dd(dist(inf, method = m)))
inf2 <- small; inf2[1, 1] <- Inf; inf2[2, 1] <- Inf
for (m in dmeth) out[[paste0("dist_inf_both_", m)]] <- run(dd(dist(inf2, method = m)))
# canberra: 0/0 terms, signs of opposite values, terms with x + y = 0
cz <- matrix(c(0, 0, 1, 0, 0, 2, 1, -1, 3, -1, 1, 0), nrow = 4, byrow = TRUE)
out$dist_canberra_zeros <- run(dd(dist(cz, method = "canberra")))
out$dist_canberra_all_zero <- run(dd(dist(matrix(0, 3, 2), method = "canberra")))
# binary: nonzero is "on"; columns where both rows are 0 are dropped; all-zero rows
bz <- matrix(c(0, 0, 0, 1, 0, 2, 0, 0, 0, 3, 3, 0, 0, 0, 0, 0), nrow = 4, byrow = TRUE)
out$dist_binary_zero_rows <- run(dd(dist(bz, method = "binary")))
out$dist_binary_logical <- run(dd(dist(matrix(c(TRUE, FALSE, TRUE, TRUE, FALSE, FALSE), nrow = 3), method = "binary")))
out$dist_character <- run(dd(dist(matrix(c("a", "b", "c", "d"), 2))))
out$dist_scale <- run(dd(dist(small * 1e200)))
out$dist_scale_small <- run(dd(dist(small * 1e-200)))
out$as_dist <- run(dd(as.dist(matrix(c(0, 1, 2, 9, 0, 3, 9, 9, 0), 3))))
out$as_dist_upper_used <- run(dd(as.dist(t(matrix(c(0, 1, 2, 9, 0, 3, 9, 9, 0), 3)))))

## hclust: merge, height, order, labels for every method; ties; members; inversions
hcl <- function(h) list(merge = unname(h$merge), height = h$height, order = h$order, labels = h$labels,
                       method = h$method, dist.method = h$dist.method)
hmethods <- c("ward.D", "ward.D2", "single", "complete", "average", "mcquitty", "median", "centroid")
du <- dist(USArrests)
for (m in hmethods) out[[paste0("hclust_usarrests_", m)]] <- run(hcl(hclust(du, method = m)))
for (m in hmethods) out[[paste0("hclust_usarrests_sq_", m)]] <- run(hcl(hclust(du^2, method = m)))
ds <- dist(small)
for (m in hmethods) out[[paste0("hclust_small_", m)]] <- run(hcl(hclust(ds, method = m)))
# ties: points on an integer grid and on a line with equal gaps (many equal distances)
grid <- as.matrix(expand.grid(x = 0:2, y = 0:2)); rownames(grid) <- paste0("g", 1:9)
dg <- dist(grid)
for (m in hmethods) out[[paste0("hclust_grid_", m)]] <- run(hcl(hclust(dg, method = m)))
dl <- dist(c(0, 1, 2, 3, 4, 5))
for (m in hmethods) out[[paste0("hclust_line_", m)]] <- run(hcl(hclust(dl, method = m)))
dl2 <- dist(c(5, 1, 3, 0, 4, 2))
for (m in hmethods) out[[paste0("hclust_line_shuffled_", m)]] <- run(hcl(hclust(dl2, method = m)))
dequal <- as.dist(matrix(1, 5, 5))
for (m in hmethods) out[[paste0("hclust_all_equal_", m)]] <- run(hcl(hclust(dequal, method = m)))
dzero <- dist(c(1, 1, 2, 2, 2))
for (m in hmethods) out[[paste0("hclust_zero_", m)]] <- run(hcl(hclust(dzero, method = m)))
# inversions with median and centroid (an equilateral triangle and its centre)
tri <- rbind(c(0, 0), c(2, 0), c(1, sqrt(3)), c(1, 0.6))
for (m in hmethods) out[[paste0("hclust_triangle_", m)]] <- run(hcl(hclust(dist(tri), method = m)))
for (m in c("median", "centroid")) out[[paste0("hclust_triangle_sq_", m)]] <- run(hcl(hclust(dist(tri)^2, method = m)))
# members: the dissimilarities between clusters of the given sizes
mem <- c(2, 1, 3, 1, 1)
for (m in hmethods) out[[paste0("hclust_members_", m)]] <- run(hcl(hclust(ds, method = m, members = mem)))
out$hclust_members_wrong_length <- run(hcl(hclust(ds, members = c(1, 2))))
out$hclust_ward_name <- run(hcl(hclust(ds, method = "ward")))
out$hclust_partial_name <- run(hcl(hclust(ds, method = "cent")))
out$hclust_bad_method <- run(hcl(hclust(ds, method = "flexible")))
out$hclust_two <- run(hcl(hclust(dist(c(1, 4)))))
out$hclust_one <- run(hcl(hclust(dist(1))))
out$hclust_na <- run(hcl(hclust(as.dist(matrix(c(0, 1, NA, 1, 0, 2, NA, 2, 0), 3)))))
out$hclust_inf <- run(hcl(hclust(as.dist(matrix(c(0, 1, Inf, 1, 0, 2, Inf, 2, 0), 3)))))
out$hclust_negative <- run(hcl(hclust(as.dist(matrix(c(0, -1, 2, -1, 0, 3, 2, 3, 0), 3)))))
out$hclust_matrix <- run(hcl(hclust(as.matrix(ds))))
out$hclust_no_labels <- run(hcl(hclust(dist(unname(small)))))
# ward.D2 at 1e200 crashes R 4.6.2 itself (segfault on arm64, hangs on x86_64): the squared distances overflow
out$hclust_scale <- run(hcl(hclust(ds * 1e100, method = "ward.D2")))
out$hclust_scale_single <- run(hcl(hclust(ds * 1e200, method = "single")))

## cutree: k, h, vectors of both, ties in height, inversions
ct <- function(x) if (is.matrix(x)) tab(x) else list(names = names(x), values = unname(x))
hu <- hclust(du, method = "average")
out$cutree_k <- run(ct(cutree(hu, k = 4)))
out$cutree_k_vector <- run(ct(cutree(hu, k = c(1, 3, 5, 50))))
out$cutree_h <- run(ct(cutree(hu, h = 100)))
out$cutree_h_vector <- run(ct(cutree(hu, h = c(200, 50, 0))))
out$cutree_k_and_h <- run(ct(cutree(hu, k = 3, h = 100)))
out$cutree_k_zero <- run(ct(cutree(hu, k = 0)))
out$cutree_k_too_big <- run(ct(cutree(hu, k = 51)))
out$cutree_k_fraction <- run(ct(cutree(hu, k = 2.5)))
out$cutree_none <- run(ct(cutree(hu)))
out$cutree_h_exact <- run(ct(cutree(hu, h = hu$height[40])))
out$cutree_h_negative <- run(ct(cutree(hu, h = -1)))
hg <- hclust(dg, method = "single")
for (k in 1:9) out[[paste0("cutree_grid_ties_k", k)]] <- run(ct(cutree(hg, k = k)))
out$cutree_grid_ties_h <- run(ct(cutree(hg, h = 1)))
hcen <- hclust(dist(tri), method = "centroid")
out$cutree_inversion_k <- run(ct(cutree(hcen, k = 2)))
out$cutree_inversion_h <- run(ct(cutree(hcen, h = 1)))
out$cutree_no_labels <- run(ct(cutree(hclust(dist(unname(small))), k = 2)))
out$cutree_vector_labels <- run(ct(cutree(hclust(dist(c(3, 1, 4, 1, 5))), k = 2)))

## kmeans with centers given as a matrix (no random numbers) for every algorithm
km <- function(k) list(cluster = unname(k$cluster), cluster_names = names(k$cluster), centers = tab(k$centers),
                       totss = k$totss, withinss = k$withinss, tot.withinss = k$tot.withinss,
                       betweenss = k$betweenss, size = k$size, iter = k$iter, ifault = k$ifault)
algs <- c("Hartigan-Wong", "Lloyd", "Forgy", "MacQueen")
X <- as.matrix(iris[, 1:4])
c3 <- X[c(1, 51, 101), ]
for (a in algs) out[[paste0("kmeans_iris_", a)]] <- run(km(kmeans(X, c3, algorithm = a)))
c3b <- X[c(1, 2, 3), ]
for (a in algs) out[[paste0("kmeans_iris_poor_start_", a)]] <- run(km(kmeans(X, c3b, algorithm = a)))
for (a in algs) out[[paste0("kmeans_iris_iter1_", a)]] <- run(km(kmeans(X, c3b, iter.max = 1, algorithm = a)))
ua <- as.matrix(USArrests)
c4 <- ua[c(1, 10, 20, 30), ]
for (a in algs) out[[paste0("kmeans_usarrests_", a)]] <- run(km(kmeans(ua, c4, algorithm = a)))
# one cluster; as many clusters as points; empty clusters; identical points; a vector; NA
for (a in algs) out[[paste0("kmeans_k1_", a)]] <- run(km(kmeans(X, X[5, , drop = FALSE], algorithm = a)))
sm <- small
for (a in algs) out[[paste0("kmeans_k_equals_n_", a)]] <- run(km(kmeans(sm, sm, algorithm = a)))
far <- rbind(sm[1:2, ], c(100, 100, 100))
for (a in algs) out[[paste0("kmeans_empty_", a)]] <- run(km(kmeans(sm, far, algorithm = a)))
dup <- rbind(c(1, 1), c(1, 1), c(1, 1), c(2, 2))
for (a in algs) out[[paste0("kmeans_duplicates_", a)]] <- run(km(kmeans(dup, dup[c(1, 4), ], algorithm = a)))
out$kmeans_duplicate_centers <- run(km(kmeans(dup, dup[c(1, 2), ])))
v <- c(1, 2, 3, 10, 11, 12, 30)
for (a in algs) out[[paste0("kmeans_vector_", a)]] <- run(km(kmeans(v, c(1, 10, 30), algorithm = a)))
for (a in algs) out[[paste0("kmeans_vector_center_matrix_", a)]] <- run(km(kmeans(v, matrix(c(1, 30)), algorithm = a)))
nax <- X; nax[3, 2] <- NA
out$kmeans_na <- run(km(kmeans(nax, c3)))
out$kmeans_wrong_columns <- run(km(kmeans(X, c3[, 1:3])))
out$kmeans_partial_name <- run(km(kmeans(X, c3, algorithm = "Mac")))
out$kmeans_bad_algorithm <- run(km(kmeans(X, c3, algorithm = "Elkan")))
out$kmeans_iter_zero <- run(km(kmeans(X, c3, iter.max = 0)))
out$kmeans_scale <- run(km(kmeans(X * 1e150, c3 * 1e150)))
out$kmeans_data_frame <- run(km(kmeans(USArrests, USArrests[c(1, 10, 20), ])))

## kmeans with a number of centers: the starts come from the random number generator (x86_64 R)
for (a in algs) out[[paste0("kmeans_seed_", a)]] <- run({ set.seed(42); km(kmeans(X, 3, algorithm = a)) })
out$kmeans_seed_nstart <- run({ set.seed(1); km(kmeans(X, 3, nstart = 10)) })
out$kmeans_seed_nstart_lloyd <- run({ set.seed(1); km(kmeans(X, 4, nstart = 5, algorithm = "Lloyd")) })
out$kmeans_seed_usarrests <- run({ set.seed(123); km(kmeans(ua, 4)) })
out$kmeans_seed_k_too_big <- run({ set.seed(1); km(kmeans(dup, 3)) })
out$kmeans_seed_k_equals_distinct <- run({ set.seed(1); km(kmeans(dup, 2)) })
out$kmeans_seed_vector <- run({ set.seed(7); km(kmeans(v, 2)) })
out$kmeans_seed_nstart_vector <- run({ set.seed(7); km(kmeans(v, 3, nstart = 4)) })
# the random numbers kmeans would see, to compare with rStats.js's setSeed + sample
out$sample_int_150_3_seed42 <- run({ set.seed(42); sample.int(150, 3) })
out$sample_int_150_3_seed1_x10 <- run({ set.seed(1); lapply(1:10, function(i) sample.int(150, 3)) })
out$kmeans_seed_state_after <- run({ set.seed(42); kmeans(X, 3); runif(3) })
out$kmeans_seed_state_after_nstart <- run({ set.seed(1); kmeans(X, 3, nstart = 10); runif(3) })
out$kmeans_seed_state_after_matrix <- run({ set.seed(1); kmeans(X, c3); runif(3) })



# cmdscale and isoMDS cases; share the helpers and out list above.

## cmdscale: points, eigenvalues, the additive constant, the doubly centred matrix, the goodness of fit
cm <- function(r) {
  if (!is.list(r)) return(list(points = tab(r)))
  list(points = tab(r$points), eig = r$eig, x = if (is.null(r$x)) NULL else tab(r$x), ac = r$ac, GOF = r$GOF)
}
de <- eurodist
out$cmdscale_eurodist <- run(cm(cmdscale(de)))
out$cmdscale_eurodist_list <- run(cm(cmdscale(de, k = 2, eig = TRUE)))
out$cmdscale_eurodist_k3_all <- run(cm(cmdscale(de, k = 3, eig = TRUE, x.ret = TRUE)))
out$cmdscale_eurodist_add <- run(cm(cmdscale(de, k = 2, eig = TRUE, add = TRUE)))
out$cmdscale_eurodist_add_k1 <- run(cm(cmdscale(de, k = 1, eig = TRUE, add = TRUE, x.ret = TRUE)))
out$cmdscale_list_only <- run(cm(cmdscale(de, list. = TRUE)))
du <- dist(USArrests)
out$cmdscale_usarrests <- run(cm(cmdscale(du, k = 3, eig = TRUE)))
out$cmdscale_usarrests_add <- run(cm(cmdscale(du, k = 2, eig = TRUE, add = TRUE)))
# compared with prcomp: Euclidean distances give the principal component scores up to sign
out$cmdscale_vs_pca <- run({ p <- prcomp(USArrests); list(scores = tab(p$x[, 1:2])) })
small <- matrix(c(1, 2, 0, 4, 0, 3, -1, 5, 2, 2, 7, 0, 0, 0, 1), nrow = 5, byrow = TRUE,
                dimnames = list(c("a", "b", "c", "d", "e"), c("x", "y", "z")))
ds <- dist(small)
for (k in 1:4) out[[paste0("cmdscale_small_k", k)]] <- run(cm(cmdscale(ds, k = k, eig = TRUE)))
out$cmdscale_small_add <- run(cm(cmdscale(ds, k = 2, eig = TRUE, add = TRUE)))
# non-Euclidean dissimilarities: negative eigenvalues, fewer positive eigenvalues than k
nonE <- as.dist(matrix(c(0, 1, 1, 3, 1, 0, 1, 1, 1, 1, 0, 1, 3, 1, 1, 0), 4))
out$cmdscale_non_euclidean <- run(cm(cmdscale(nonE, k = 2, eig = TRUE)))
out$cmdscale_non_euclidean_k3 <- run(cm(cmdscale(nonE, k = 3, eig = TRUE)))
out$cmdscale_non_euclidean_add <- run(cm(cmdscale(nonE, k = 3, eig = TRUE, add = TRUE)))
line <- dist(c(0, 1, 3, 6))
out$cmdscale_line_k2 <- run(cm(cmdscale(line, k = 2, eig = TRUE)))
out$cmdscale_line_k1 <- run(cm(cmdscale(line, k = 1, eig = TRUE)))
out$cmdscale_line_add <- run(cm(cmdscale(line, k = 1, eig = TRUE, add = TRUE)))
# ties in the eigenvalues (a regular simplex) and boundary cases
out$cmdscale_simplex <- run(cm(cmdscale(as.dist(matrix(1, 4, 4)), k = 2, eig = TRUE)))
out$cmdscale_k_too_big <- run(cm(cmdscale(ds, k = 5)))
out$cmdscale_k_n_minus_1 <- run(cm(cmdscale(ds, k = 4, eig = TRUE)))
out$cmdscale_k_zero <- run(cm(cmdscale(ds, k = 0)))
out$cmdscale_two <- run(cm(cmdscale(dist(c(1, 4)), k = 1, eig = TRUE)))
out$cmdscale_one <- run(cm(cmdscale(dist(1), k = 1)))
out$cmdscale_na <- run(cm(cmdscale(as.dist(matrix(c(0, 1, NA, 1, 0, 2, NA, 2, 0), 3)), k = 1)))
out$cmdscale_matrix <- run(cm(cmdscale(as.matrix(ds), k = 2)))
out$cmdscale_asymmetric <- run(cm(cmdscale(matrix(c(0, 1, 2, 3, 0, 4, 5, 6, 0), 3), k = 2)))
out$cmdscale_zero_distances <- run(cm(cmdscale(dist(c(1, 1, 2, 5)), k = 1, eig = TRUE)))
out$cmdscale_no_labels <- run(cm(cmdscale(dist(unname(small)), k = 2)))
out$cmdscale_scale <- run(cm(cmdscale(ds * 1e150, k = 2, eig = TRUE)))
out$cmdscale_scale_small <- run(cm(cmdscale(ds * 1e-150, k = 2, eig = TRUE)))

## isoMDS: the configuration and the stress (percent); the start is cmdscale's unless y is given
# trace output (the default) is captured, so it does not mix with the JSON
im <- function(expr) {
  printed <- capture.output(r <- expr)
  list(points = tab(r$points), stress = r$stress, printed = printed)
}
dsw <- dist(swiss)
out$isomds_swiss <- run(im(isoMDS(dsw)))
out$isomds_swiss_k3 <- run(im(isoMDS(dsw, k = 3)))
out$isomds_swiss_maxit5 <- run(im(isoMDS(dsw, maxit = 5)))
out$isomds_swiss_maxit0 <- run(im(isoMDS(dsw, maxit = 0)))
out$isomds_swiss_tol <- run(im(isoMDS(dsw, tol = 1e-8, maxit = 500)))
out$isomds_swiss_p1 <- run(im(isoMDS(dsw, p = 1)))
out$isomds_swiss_p3 <- run(im(isoMDS(dsw, p = 3)))
out$isomds_swiss_y <- run(im(isoMDS(dsw, y = as.matrix(swiss[, c(2, 3)]))))
out$isomds_swiss_y_k1 <- run(im(isoMDS(dsw, y = as.matrix(swiss[, 1, drop = FALSE]), k = 1)))
out$isomds_swiss_y_wrong <- run(im(isoMDS(dsw, y = as.matrix(swiss[1:10, 1:2]))))
out$isomds_swiss_trace <- run(im(isoMDS(dsw, maxit = 3)))
out$isomds_eurodist <- run(im(isoMDS(eurodist)))
out$isomds_usarrests <- run(im(isoMDS(du)))
out$isomds_small <- run(im(isoMDS(ds)))
out$isomds_small_k1 <- run(im(isoMDS(ds, k = 1)))
out$isomds_non_euclidean <- run(im(isoMDS(nonE)))
# ties in the dissimilarities (Kruskal's primary approach groups equal input dissimilarities)
grid <- as.matrix(expand.grid(x = 0:2, y = 0:2)); rownames(grid) <- paste0("g", 1:9)
out$isomds_grid_ties <- run(im(isoMDS(dist(grid), y = grid + 0.1 * cbind(sin(1:9), cos(1:9)))))
out$isomds_grid_ties_default <- run(im(isoMDS(dist(grid))))
# a perfect monotone fit (zero stress) and boundary cases
out$isomds_perfect <- run(im(isoMDS(dist(small[, 1:2]))))
out$isomds_line <- run(im(isoMDS(dist(c(0, 1, 3, 6, 10)), k = 1)))
out$isomds_zero_distance <- run(im(isoMDS(dist(c(1, 1, 2, 5)), k = 1)))
out$isomds_negative <- run(im(isoMDS(as.dist(matrix(c(0, -1, 2, -1, 0, 3, 2, 3, 0), 3)), k = 1)))
out$isomds_na <- run(im(isoMDS(as.dist(matrix(c(0, 1, NA, 1, 2, 0, 2, 3, NA, 2, 0, 1, 1, 3, 1, 0), 4)), k = 1)))
out$isomds_matrix <- run(im(isoMDS(as.matrix(ds))))
out$isomds_three <- run(im(isoMDS(dist(c(0, 1, 3)), k = 1)))
out$isomds_two <- run(im(isoMDS(dist(c(0, 1)), k = 1)))
out$isomds_k_too_big <- run(im(isoMDS(ds, k = 5)))
out$isomds_scale <- run(im(isoMDS(dsw * 1e150)))
out$isomds_scale_y <- run(im(isoMDS(dsw, y = cmdscale(dsw) * 1e100)))


