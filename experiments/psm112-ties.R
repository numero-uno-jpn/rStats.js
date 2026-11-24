# psm112-ties.R: how Match(ties = FALSE) breaks ties, public functions only (1.12.0). Small designs where the tie sets
# are known: one treated unit with k controls at the same distance, two treated units sharing a tie set
# (replace = FALSE), M = 2, distances within distance.tolerance, and the caliper with dropped treated units in bal.tab.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages({ library(Matching); library(cobalt) })
out <- list(R = R.version.string, arch = R.version$arch, Matching = as.character(packageVersion("Matching")))
# state after Match compared with the state after k uniform draws; the uniforms themselves for the candidates
probe <- function(seed, tr, X, ...) {
  set.seed(seed); u <- runif(20)
  set.seed(seed); m <- Match(Tr = tr, X = X, ties = FALSE, ...); after <- .Random.seed
  set.seed(seed); k <- 0
  while (k <= 200 && !identical(.Random.seed, after)) { runif(1); k <- k + 1 }
  list(seed = seed, draws = if (k > 200) NA else k, u = u, treated = m$index.treated, control = m$index.control,
       weights = m$weights)
}
seeds <- 1:12
## 1 treated (row 1, X = 0) with k controls all at X = 1 (the same distance)
for (k in 2:5) {
  tr <- c(1, rep(0, k)); X <- c(0, rep(1, k))
  out[[paste0("one_k", k)]] <- lapply(seeds, function(s) probe(s, tr, X, estimand = "ATT", M = 1, replace = FALSE))
}
## controls on both sides at the same distance (X = -1 and X = 1), k = 3
out$bothSides <- lapply(seeds, function(s) probe(s, c(1, 0, 0, 0), c(0, -1, 1, 1), estimand = "ATT", M = 1,
                                                 replace = FALSE))
## 1 treated, 4 tied controls, M = 2
out$m2_k4 <- lapply(seeds, function(s) probe(s, c(1, 0, 0, 0, 0), c(0, 1, 1, 1, 1), estimand = "ATT", M = 2,
                                             replace = FALSE))
## 1 treated, nearest control alone then 3 tied at the second distance, M = 2
out$m2_near_then_k3 <- lapply(seeds, function(s) probe(s, c(1, 0, 0, 0, 0), c(0, 0.5, 1, 1, 1), estimand = "ATT",
                                                       M = 2, replace = FALSE))
## 2 treated (rows 1, 2) sharing 3 tied controls, replace = FALSE and TRUE
out$two_k3 <- lapply(seeds, function(s) probe(s, c(1, 1, 0, 0, 0), c(0, 0, 1, 1, 1), estimand = "ATT", M = 1,
                                              replace = FALSE))
out$two_k3_replace <- lapply(seeds, function(s) probe(s, c(1, 1, 0, 0, 0), c(0, 0, 1, 1, 1), estimand = "ATT",
                                                      M = 1, replace = TRUE))
## distances that differ by less than distance.tolerance (1e-5 by default) and by more
out$tol_inside <- lapply(seeds, function(s) probe(s, c(1, 0, 0), c(0, 1, 1 + 5e-6), estimand = "ATT", M = 1,
                                                  replace = FALSE))
out$tol_outside <- lapply(seeds, function(s) probe(s, c(1, 0, 0), c(0, 1, 1 + 5e-5), estimand = "ATT", M = 1,
                                                   replace = FALSE))
## ATC with 1 control and k = 3 tied treated
out$atc_k3 <- lapply(seeds, function(s) probe(s, c(0, 1, 1, 1), c(0, 1, 1, 1), estimand = "ATC", M = 1,
                                              replace = FALSE))

## bal.tab after a caliper that drops treated units: which SD is the denominator of Diff.Adj
set.seed(20261124)
n <- 70; x1 <- round(rnorm(n), 3); x2 <- rbinom(n, 1, 0.4)
tr <- rbinom(n, 1, plogis(-1.3 + 0.9 * x1 + 0.8 * x2))
d <- data.frame(tr = tr, x1 = x1, x2 = x2)
ps <- fitted(glm(tr ~ x1 + x2, data = d, family = binomial())); lp <- log(ps / (1 - ps))
set.seed(1234); m <- Match(Tr = tr, X = lp, estimand = "ATT", M = 2, ties = FALSE, replace = FALSE, caliper = 0.2)
b <- bal.tab(m, formula = tr ~ x1 + x2, data = d, un = TRUE, disp.v.ratio = TRUE, binary = "std")
w <- get.w(m)
wm <- function(v, g) sum((w * v)[tr == g]) / sum(w[tr == g])
wv <- function(v, g) { ww <- w[tr == g]; vv <- v[tr == g]; mu <- sum(ww * vv) / sum(ww)
                       sum(ww * (vv - mu)^2) / (sum(ww) - sum(ww^2) / sum(ww)) }
out$balCaliper <- list(
  Balance = lapply(as.list(b$Balance), function(v) if (is.numeric(v)) v else as.character(v)), rows = rownames(b$Balance),
  weights = w, treated = m$index.treated, control = m$index.control, dropped = m$index.dropped,
  cand = lapply(c(x1 = "x1", x2 = "x2"), function(nm) { v <- d[[nm]]
    list(diffAdj = wm(v, 1) - wm(v, 0), sdTreatedAll = sd(v[tr == 1]), sdTreatedMatched = sqrt(wv(v, 1)),
         varAdj1 = wv(v, 1), varAdj0 = wv(v, 0)) }))

cat(toJSON(out, auto_unbox = TRUE, digits = I(17), null = "null", na = "null"), "\n")
