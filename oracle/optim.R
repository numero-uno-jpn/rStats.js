# oracle-platform: amd64
source("/oracle/_anova.R")
source("/oracle/_optimfns.R")

# optim (ROADMAP: Nelder-Mead, BFGS, CG, L-BFGS-B, Brent; SANN in oracle/optimsann.R) and factanal. Run on x86_64 R:
# the arm64 build of R fuses multiply-adds in optim's C code, which changes the last bits and so the iterations.
#   optim        fn (a name in oracle/_optimfns.R), par, method, gradient (TRUE: use the analytic gradient), lower,
#                upper, hessian, control (maxit, reltol, abstol, parscale, fnscale, type for CG, lmm, factr, pgtol,
#                ndeps). Written: par, value, counts (function, gradient), convergence, message ("NULL" for R's
#                NULL), hessian.
#   factanal     data generated here (x, a matrix) or covmat with n.obs; factors, rotation ("none", "varimax",
#                "promax"). Written: uniquenesses, loadings (columns signed so that each column's sum is positive),
#                STATISTIC, dof, PVAL, converged.
cases <- list()
add <- function(...) cases[[length(cases) + 1]] <<- list(...)
for (m in c("Nelder-Mead", "BFGS", "CG", "L-BFGS-B")) for (g in c(FALSE, TRUE)) {
  if (m == "Nelder-Mead" && g) next
  add(fn = "rosenbrock", par = I(c(-1.2, 1)), method = m, gradient = g)
  add(fn = "rosenbrock", par = I(c(-1.2, 1, -1.2, 1)), method = m, gradient = g, control = list(maxit = 5000))
  add(fn = "quadratic", par = I(c(0, 0, 0)), method = m, gradient = g, hessian = TRUE)
  add(fn = "beale", par = I(c(1, 1)), method = m, gradient = g)
}
add(fn = "wood", par = I(c(-3, -1, -3, -1)), method = "Nelder-Mead", control = list(maxit = 10000))
add(fn = "wood", par = I(c(-3, -1, -3, -1)), method = "BFGS", control = list(maxit = 1000))
for (t in 1:3) add(fn = "rosenbrock", par = I(c(-1.2, 1)), method = "CG", gradient = TRUE, control = list(type = t, maxit = 10000))
add(fn = "rosenbrock", par = I(c(-1.2, 1)), method = "Nelder-Mead", control = list(reltol = 1e-12, maxit = 2000))
add(fn = "rosenbrock", par = I(c(-1.2, 1)), method = "Nelder-Mead", control = list(maxit = 20))
add(fn = "rosenbrock", par = I(c(-1.2, 1)), method = "BFGS", control = list(parscale = c(2, 1)))
add(fn = "quadratic", par = I(c(0, 0)), method = "BFGS", gradient = TRUE, control = list(fnscale = 2))
add(fn = "rosenbrock", par = I(c(-1.2, 1)), method = "L-BFGS-B", lower = I(c(-2, -2)), upper = I(c(0.5, 2)))
add(fn = "rosenbrock", par = I(c(-1.2, 1)), method = "L-BFGS-B", gradient = TRUE, lower = I(c(-2, 1.5)), upper = I(c(2, 3)))
add(fn = "quadratic", par = I(c(5, 5, 5)), method = "L-BFGS-B", gradient = TRUE, lower = I(c(2, -Inf, 0)), upper = I(c(Inf, 1.5, 2.5)),
    control = list(factr = 1e10, lmm = 3))
add(fn = "cosine", par = 1, method = "Brent", lower = -10, upper = 10)
add(fn = "cosine", par = 1, method = "Brent", lower = 0, upper = 5)
add(fn = "rosenbrock", par = I(c(-1.2, 1)), method = "Nelder-Mead", hessian = TRUE)
add(fn = "rosenbrock", par = I(c(-1.2, 1)), method = "BFGS", control = list(ndeps = c(1e-4, 1e-4)))

write_anova_fixture("optim", cases, function(a) {
  f <- OPT_FNS[[a$fn]]
  args <- list(par = unclass(a$par), fn = f$fn, method = a$method)
  if (isTRUE(a$gradient)) args$gr <- f$gr
  for (k in c("lower", "upper")) if (!is.null(a[[k]])) args[[k]] <- unclass(a[[k]])
  if (!is.null(a$hessian)) args$hessian <- a$hessian
  if (!is.null(a$control)) args$control <- lapply(a$control, unclass)
  r <- with_warnings(function() do.call(optim, args))
  c(opt_out(r$value), list(warnings = r$warnings))
})

set.seed(20261123)
n <- 200
F <- matrix(rnorm(n * 2), n)
L <- matrix(c(0.8, 0.7, 0.6, 0.1, 0.2, 0.1, 0.1, 0.2, 0.1, 0.7, 0.8, 0.6), 6)
X <- round(F %*% t(L) + matrix(rnorm(n * 6, 0, 0.5), n), 3)
F3 <- matrix(rnorm(n * 3), n); L3 <- matrix(runif(9 * 3, -0.2, 0.9), 9)
X3 <- round(F3 %*% t(L3) + matrix(rnorm(n * 9, 0, 0.6), n), 3)
fcases <- list()
for (rot in c("none", "varimax", "promax")) {
  fcases[[length(fcases) + 1]] <- list(x = X, factors = 2, rotation = rot)
  fcases[[length(fcases) + 1]] <- list(x = X3, factors = 3, rotation = rot)
  fcases[[length(fcases) + 1]] <- list(x = X3, factors = 2, rotation = rot)
}
fcases[[length(fcases) + 1]] <- list(x = X, factors = 1, rotation = "none")
fcases[[length(fcases) + 1]] <- list(covmat = cov(X), n.obs = n, factors = 2, rotation = "varimax")
fcases[[length(fcases) + 1]] <- list(x = X, factors = 4, rotation = "none")       # too many factors: an error
# (added later, at the end) scores
for (sc in c("regression", "Bartlett")) for (rot in c("none", "varimax", "promax")) {
  fcases[[length(fcases) + 1]] <- list(x = X, factors = 2, rotation = rot, scores = sc)
  fcases[[length(fcases) + 1]] <- list(x = X3, factors = 3, rotation = rot, scores = sc)
}
fcases[[length(fcases) + 1]] <- list(x = X, factors = 1, rotation = "none", scores = "regression")
fcases[[length(fcases) + 1]] <- list(covmat = cov(X), n.obs = n, factors = 2, rotation = "varimax", scores = "regression")

write_anova_fixture("factanal", fcases, function(a) {
  r <- with_warnings(function() {
    sc <- if (is.null(a$scores)) "none" else a$scores
    fa <- if (!is.null(a$covmat)) factanal(covmat = a$covmat, n.obs = a$n.obs, factors = a$factors, rotation = a$rotation, scores = sc)
          else factanal(a$x, factors = a$factors, rotation = a$rotation, scores = sc)
    sg <- ifelse(colSums(unclass(fa$loadings)) < 0, -1, 1)
    Lm <- unclass(fa$loadings); Lm <- sweep(Lm, 2, sg, "*")
    c(if (sc != "none") list(scores = lapply(seq_len(nrow(fa$scores)), function(i) I(num2str(unname(fa$scores[i, ] * sg))))),
    list(uniquenesses = I(num2str(unname(fa$uniquenesses))), loadings = lapply(seq_len(nrow(Lm)), function(i) I(num2str(Lm[i, ]))),
         STATISTIC = if (is.null(fa$STATISTIC)) "NA" else num2str(unname(fa$STATISTIC)), dof = num2str(fa$dof),
         PVAL = if (is.null(fa$PVAL)) "NA" else num2str(unname(fa$PVAL)), converged = fa$converged))
  })
  c(r$value, list(warnings = r$warnings))
})
