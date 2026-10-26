source("/oracle/_anova.R")
suppressPackageStartupMessages({library(psych); library(GPArotation)})

# McDonald's omega (ROADMAP): psych::omega(m, nfactors, plot = FALSE) with its defaults (fm = "minres", rotate =
# "oblimin", option = "equal", flip = TRUE), from raw data (x, one row per observation) or a correlation matrix (r).
# Behaviour in oracle/omega-behaviour.md.
#   Written: omega_h, omega.lim, alpha, omega.tot, G6, ECV; the Schmid-Leiman matrix sl (rows: g, F1*, ..., h2, u2, p2,
#   com); orthog (the varimax loadings of the first-order minres solution), oblique (the oblimin pattern), phi (the
#   factor correlations; absent for one factor), gloading (the loadings of the factors on g), key (the item signs),
#   omega.group (rows g, F1*, ...: total, general, group); warnings and messages (unique, in order).

set.seed(20261129)
bifactor <- function(n, g, s, groups) {
  p <- length(g); f <- matrix(rnorm(n * (groups + 1)), n)
  grp <- rep(seq_len(groups), length.out = p)[order(rep(seq_len(groups), length.out = p))]
  x <- sapply(seq_len(p), function(j) g[j] * f[, 1] + s[j] * f[, 1 + grp[j]] + sqrt(1 - g[j]^2 - s[j]^2) * rnorm(n))
  x
}
cont12 <- round(bifactor(300, g = c(0.7, 0.6, 0.65, 0.5, 0.55, 0.6, 0.7, 0.45, 0.6, 0.5, 0.65, 0.55),
                         s = c(0.4, 0.5, 0.35, 0.45, 0.5, 0.3, 0.4, 0.55, 0.45, 0.4, 0.3, 0.5), groups = 3), 2)
lik9 <- bifactor(400, g = c(0.6, 0.55, 0.5, 0.65, 0.6, 0.5, 0.55, 0.7, 0.6),
                 s = c(0.5, 0.45, 0.4, 0.35, 0.5, 0.45, 0.4, 0.3, 0.45), groups = 3)
lik9 <- apply(lik9, 2, function(v) as.integer(cut(v, c(-Inf, -1.2, -0.4, 0.4, 1.2, Inf))))
rev12 <- cont12; rev12[, c(2, 7)] <- -rev12[, c(2, 7)]

cases <- list()
add <- function(...) cases[[length(cases) + 1]] <<- list(...)
for (nf in c(3, 2, 4, 1)) add(x = cont12, nfactors = nf)
add(x = rev12, nfactors = 3)                               # two reversed items (flipped by omega)
add(x = lik9, nfactors = 3)                                # five-point items
add(x = cont12[, 1:6], nfactors = 3)                       # 6 items, 3 factors
add(r = unname(as.matrix(Thurstone)), nfactors = 3)        # a correlation matrix (psych's Thurstone, 9 variables)
add(r = unname(as.matrix(Thurstone)), nfactors = 2)

mat <- function(m) lapply(seq_len(nrow(m)), function(i) I(num2str(unname(m[i, ]))))
write_anova_fixture("omega", cases, function(a) {
  msgs <- character(0)
  r <- with_warnings(function() withCallingHandlers(
    omega(if (!is.null(a$x)) a$x else a$r, nfactors = a$nfactors, plot = FALSE),
    message = function(cnd) { msgs <<- c(msgs, conditionMessage(cnd)); invokeRestart("muffleMessage") }))
  om <- r$value; sl <- om$schmid
  out <- list(omega_h = num2str(om$omega_h), omega.lim = num2str(om$omega.lim), alpha = num2str(om$alpha),
              omega.tot = num2str(om$omega.tot), G6 = num2str(unname(om$G6)), ECV = num2str(unname(om$ECV)),
              sl = mat(unclass(sl$sl)), slNames = I(colnames(sl$sl)), orthog = mat(unclass(sl$orthog)),
              oblique = mat(unclass(sl$oblique)), gloading = I(num2str(as.vector(unclass(sl$gloading)))),
              key = I(num2str(unname(om$key))), omega.group = mat(as.matrix(om$omega.group)))
  if (!is.null(sl$phi) && length(sl$phi) > 1) out$phi <- mat(unclass(sl$phi))
  c(out, list(warnings = r$warnings, messages = I(unique(msgs))))
})
