# mds110.R: stats (cmdscale) and MASS 7.3.66 (isoMDS) on small data and boundary cases, public functions only (1.10.0)
# Output: JSON on stdout, 17 significant digits. Only numbers and strings are kept (no R objects)
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
# ties in the dissimilarities (isoMDS uses the primary approach to ties or another one: compare)
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

cat(toJSON(out, digits = NA, auto_unbox = TRUE, null = "null", na = "string", pretty = FALSE))
