source("/oracle/_anova.R")

# Mauchly's test of sphericity: mauchly.test(lm(y ~ 1 or y ~ group), X, M, idata) (fixture mauchlyTest). Each case has
#   y      the responses, one row per subject and one column per measurement
#   group  (optional) between-subjects group labels: the test uses the residuals from the group means
#   X, M   (optional) formulas over idata, as in R: the test is on the contrasts spanned by M and orthogonal to X
#          (R's defaults: M the identity, X ~0)
#   idata  (optional) the within-subject design, one row per column of y (R's default: a column "index" 1..p)
# Written: statistic (W), statisticName, pValue, method ("Mauchly's test of sphericity"); "reference" holds W
# computed exactly and the p-value at that W.

set.seed(20261107)
S <- matrix(c(1, 0.5, 0.3, 0.2, 0.5, 1, 0.4, 0.1, 0.3, 0.4, 1.5, 0.6, 0.2, 0.1, 0.6, 2), 4)
y4 <- round(matrix(rnorm(15 * 4), 15) %*% chol(S) + 10, 2)
y3 <- y4[, 1:3]
y6 <- round(matrix(rnorm(14 * 6), 14) + rnorm(14), 2)
g <- rep(c("a", "b", "c"), length.out = 15)
id23 <- expand.grid(W1 = c("a", "b"), W2 = c("x", "y", "z"), stringsAsFactors = FALSE)

cases <- list(
  list(y = y4), list(y = y4, X = "~1"), list(y = y3, X = "~1"), list(y = y4, group = I(g), X = "~1"),
  list(y = y4[1:5, ], X = "~1"), list(y = y6, X = "~1"),
  list(y = y6, idata = id23, X = "~1"), list(y = y6, idata = id23, M = "~W1 + W2", X = "~W1"),
  list(y = y6, idata = id23, M = "~W1 * W2", X = "~W1 + W2"),
  list(y = y4[, 1:2], X = "~1")
)

# Exact reference: W from the exact SSD and an exact basis of the contrasts tested (rows of the projection onto
# span(M) minus the projection onto span(X), the independent ones kept), its p-value R's formula at that W
q_proj <- function(Z) {                  # projection matrix onto the column space of Z (bigq)
  gs <- q_gs(q_cols(Z)); k <- nrow(Z); P <- matrix.bigq(as.bigq(0), k, k)
  for (b in seq_along(gs$basis)) { v <- gs$basis[[b]]; for (i in seq_len(k)) for (j in seq_len(k)) P[i, j] <- P[i, j] + v[i] * v[j] / gs$norms[[b]] }
  P
}
mauchly_ref <- function(a) {
  Y <- a$y; k <- ncol(Y)
  idata <- if (is.null(a$idata)) data.frame(index = seq_len(k)) else a$idata
  Mm <- if (is.null(a$M)) diag(k) else model.matrix(as.formula(a$M), idata)
  Xm <- if (is.null(a$X) || a$X == "~0") NULL else model.matrix(as.formula(a$X), idata)
  D <- q_proj(Mm); if (!is.null(Xm)) D <- D - q_proj(Xm)
  rows <- q_gs(lapply(seq_len(k), function(i) D[i, ]))$kept
  Tm <- D[rows, , drop = FALSE]; pp <- nrow(Tm)
  G <- if (is.null(a$group)) rep("1", nrow(Y)) else unclass(a$group)
  R <- matrix.bigq(as.bigq(0), nrow(Y), k)
  for (g in unique(G)) { idx <- which(G == g)
    for (j in seq_len(k)) { col <- q_of(Y[idx, j]); R[idx, j] <- col - sum(col) / length(idx) } }
  SSD <- t(R) %*% R; n <- nrow(Y) - length(unique(G))
  U <- solve(Tm %*% t(Tm), Tm %*% SSD %*% t(Tm))
  trU <- Reduce(`+`, lapply(seq_len(pp), function(i) U[i, i]))
  W <- q_det(U) / (trU / pp)^pp
  logW <- log(qn(W))
  rho <- 1 - (2 * pp^2 + pp + 2) / (6 * pp * n)
  w2 <- (pp + 2) * (pp - 1) * (pp - 2) * (2 * pp^3 + 6 * pp^2 + 3 * k + 2) / (288 * (n * pp * rho)^2)
  z <- -n * rho * logW; f <- pp * (pp + 1) / 2 - 1
  pr1 <- pchisq(z, f, lower.tail = FALSE); pr2 <- pchisq(z, f + 4, lower.tail = FALSE)
  list(statistic = num2str(qn(W)), pValue = num2str(pr1 + w2 * (pr2 - pr1)))
}

write_anova_fixture("mauchlyTest", cases, function(a) {
  Y <- a$y
  m <- if (is.null(a$group)) lm(Y ~ 1) else { G <- factor(unclass(a$group)); lm(Y ~ G) }
  args <- list(m)
  if (!is.null(a$X)) args$X <- as.formula(a$X)
  if (!is.null(a$M)) args$M <- as.formula(a$M)
  if (!is.null(a$idata)) args$idata <- a$idata
  r <- do.call(mauchly.test, args)
  list(statistic = num2str(unname(r$statistic)), statisticName = names(r$statistic),
       pValue = num2str(r$p.value), method = r$method[1])
}, ref = mauchly_ref)
