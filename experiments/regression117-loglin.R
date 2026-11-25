# regression117-loglin.R: stats::loglin's iterative proportional fitting (1.17.0). The help page: IPF as in Haberman
# (1972, AS 51), margins adjusted in the order given, at most `iter` iterations, convergence when the largest absolute
# difference between observed and fitted margins is below `eps` (default 0.1). Candidates for an iteration: for each
# margin in order, scale the fit by observed / fitted margin (0 where the fitted margin is 0); the deviation is
#   (a) the largest |observed - fitted| margin difference found *before* each adjustment during the cycle,
#   (b) the same measured after the full cycle,
# and the iteration stops when the deviation < eps. Compared: the fit (to the last digit), the printed iteration
# count and deviation, lrt = 2 sum obs log(obs / fit), pearson = sum (obs - fit)^2 / fit, df, and the parameters
# (sum-to-zero constraints, from log(fit)). Tables: 2-way and 3-way (HairEyeColor), with zeros, a start with
# structural zeros, margins given by name, the empty margin list, and eps / iter changed.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
out <- list(R = R.version.string, arch = R.version$arch)
mx <- function(a, b) max(abs(a - b))

ipf <- function(tab, margin, start, eps, iter, where) {
  fit <- start; dims <- seq_along(dim(tab)); it <- 0; dev <- NA
  if (length(margin) == 0) return(list(fit = fit * sum(tab) / sum(fit), it = 0, dev = NA))
  repeat {
    it <- it + 1; dmax <- 0
    for (m in margin) {
      obs <- apply(tab, m, sum); cur <- apply(fit, m, sum)
      if (where == "before") dmax <- max(dmax, abs(obs - cur))
      ratio <- ifelse(cur == 0, 0, obs / cur)
      fit <- sweep(fit, m, ratio, "*")
    }
    if (where == "after") for (m in margin) dmax <- max(dmax, abs(apply(tab, m, sum) - apply(fit, m, sum)))
    dev <- dmax
    if (dmax < eps || it >= iter) break
  }
  list(fit = fit, it = it, dev = dev)
}
stats_of <- function(tab, fit) {
  pos <- tab > 0
  c(lrt = 2 * sum(tab[pos] * log(tab[pos] / fit[pos])), pearson = sum(((tab - fit)^2 / fit)[fit > 0]))
}

set.seed(20261130)
t2 <- matrix(rpois(12, 8), 3, 4, dimnames = list(A = c("a1", "a2", "a3"), B = c("b1", "b2", "b3", "b4")))
t3 <- HairEyeColor
t3z <- t3; t3z[1, 1, 1] <- 0; t3z[2, 3, 2] <- 0
t4 <- array(rpois(36, 5), c(3, 3, 2, 2), dimnames = list(P = 1:3, Q = 1:3, R = 1:2, S = 1:2))
st <- array(1, dim(t3)); st[4, 4, 2] <- 0
cases <- list(
  list(name = "2way indep", tab = t2, margin = list(1, 2)),
  list(name = "3way no3", tab = t3, margin = list(c(1, 2), c(1, 3), c(2, 3))),
  list(name = "3way no3 reversed", tab = t3, margin = list(c(2, 3), c(1, 3), c(1, 2))),
  list(name = "3way cond indep", tab = t3, margin = list(c(1, 2), c(1, 3))),
  list(name = "3way mutual", tab = t3, margin = list(1, 2, 3)),
  list(name = "3way names", tab = t3, margin = list(c("Hair", "Eye"), c("Hair", "Sex"), c("Eye", "Sex"))),
  list(name = "3way zeros", tab = t3z, margin = list(c(1, 2), c(1, 3), c(2, 3))),
  list(name = "3way structural", tab = t3, margin = list(c(1, 2), c(1, 3), c(2, 3)), start = st),
  list(name = "3way eps1e-8", tab = t3, margin = list(c(1, 2), c(1, 3), c(2, 3)), eps = 1e-8, iter = 100),
  list(name = "3way iter2", tab = t3, margin = list(c(1, 2), c(1, 3), c(2, 3)), iter = 2),
  list(name = "4way pairs", tab = t4, margin = list(c(1, 2), c(2, 3), c(3, 4), c(1, 4))),
  list(name = "3way saturated", tab = t3, margin = list(c(1, 2, 3))),
  list(name = "empty", tab = t2, margin = list())
)
res <- list()
for (cs in cases) {
  eps <- if (is.null(cs$eps)) 0.1 else cs$eps; iter <- if (is.null(cs$iter)) 20 else cs$iter
  start <- if (is.null(cs$start)) array(1, dim(cs$tab)) else cs$start
  printed <- capture.output(r <- loglin(cs$tab, cs$margin, start = start, fit = TRUE, param = TRUE, eps = eps, iter = iter))
  mnum <- lapply(cs$margin, function(m) if (is.character(m)) match(m, names(dimnames(cs$tab))) else m)
  cand_a <- ipf(cs$tab, mnum, start, eps, iter, "before"); cand_b <- ipf(cs$tab, mnum, start, eps, iter, "after")
  res[[cs$name]] <- list(printed = printed, lrt = r$lrt, pearson = r$pearson, df = r$df, margin = r$margin,
                         fit_a = mx(r$fit, cand_a$fit), it_a = cand_a$it, dev_a = cand_a$dev,
                         fit_b = mx(r$fit, cand_b$fit), it_b = cand_b$it, dev_b = cand_b$dev,
                         stats_cand = stats_of(cs$tab, r$fit), fit_head = as.vector(r$fit)[1:4],
                         param_names = names(r$param), param = lapply(r$param, as.vector))
}
out$cases <- res
# parameters: candidate = sum-to-zero decomposition of log(fit) (the saturated ANOVA of log fit)
r <- loglin(t3, list(c(1, 2), c(1, 3), c(2, 3)), fit = TRUE, param = TRUE, print = FALSE)
lf <- log(r$fit); mu <- mean(lf)
m1 <- apply(lf, 1, mean) - mu; m12 <- apply(lf, c(1, 2), mean) - outer(apply(lf, 1, mean), apply(lf, 2, mean), "+") + mu
out$param_cand <- list(const = mx(r$param[["(Intercept)"]], mu), hair = mx(r$param$Hair, m1), hair_eye = mx(r$param[["Hair.Eye"]], m12))
cat(toJSON(out, digits = 17, auto_unbox = TRUE, na = "null", null = "null"))
