# mediation116-eigensign.R: the signs of the eigenvectors of eigen(symmetric = TRUE) (LAPACK's dsyevr in R) for
# covariance matrices of 2 to 6 dimensions (1.16.0), because MASS's mvrnorm depends on them. The vectors are written
# out and candidate sign rules are checked outside R.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
out <- list(R = R.version.string, arch = R.version$arch, La = La_version())
set.seed(116)
mk <- function(p) {
  kind <- sample(3, 1)
  if (kind == 1) { A <- matrix(rnorm(p * (p + 3)), p + 3); S <- crossprod(A) }
  if (kind == 2) { R <- crossprod(matrix(rnorm(p * p), p)); s <- 10^runif(p, -3, 3); S <- R * tcrossprod(s) }
  if (kind == 3) { r <- runif(1, -0.95, 0.95); S <- r^abs(outer(seq_len(p), seq_len(p), "-")) * sample(c(-1, 1), 1)^outer(seq_len(p), seq_len(p), "+"); S <- S * tcrossprod(10^runif(p, -2, 2)) }
  S <- (S + t(S)) / 2
  S
}
out$cases <- lapply(c(rep(2, 600), rep(3, 400), rep(4, 300), rep(6, 200)), function(p) {
  S <- mk(p); e <- eigen(S, symmetric = TRUE)
  list(S = S, values = e$values, vectors = e$vectors)
})
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "string"))
