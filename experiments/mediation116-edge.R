# mediation116-edge.R: mediate, sim_slopes and mvrnorm at the edges (1.16.0), public functions only. Scales of the
# variables (x 1e+-150, 1e+-300), large common values (1e8, 1e15), perfect separation in a binary mediator, all draws
# of one sign (p = 0), missing values that give the two models different rows, a factor covariate, an outcome model
# without the treatment, HC3 with a leverage-1 row, and the time of large n and sims. Results are written out for
# test/mediationEdge.test.ts.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages({ library(MASS); library(mediation); library(interactions) })
run <- function(expr) {
  warns <- character(0)
  value <- withCallingHandlers(
    tryCatch(expr, error = function(e) structure(list(message = conditionMessage(e)), class = "caught")),
    warning = function(w) { warns <<- c(warns, conditionMessage(w)); invokeRestart("muffleWarning") },
    message = function(m) invokeRestart("muffleMessage"))
  if (inherits(value, "caught")) return(list(error = value$message, warnings = warns))
  list(value = value, warnings = warns)
}
out <- list(R = R.version.string, arch = R.version$arch)
set.seed(116)
n <- 60
C <- rnorm(n); X <- rbinom(n, 1, 0.5); G <- factor(sample(c("a", "b", "c"), n, TRUE))
M <- 0.6 * X + 0.3 * C + rnorm(n)
Y <- 0.5 * M + 0.4 * X + 0.2 * C + 0.3 * (G == "b") + rnorm(n)
Ms <- as.integer(X == 1)                                  # a mediator perfectly separated by X
Yp <- 2 * M + 1 * X + rnorm(n, 0, 0.1)                    # strong effects: all draws positive
d <- data.frame(C, X, G, M, Y, Ms, Yp)
d$Mna <- d$M; d$Mna[c(3, 9)] <- NA                        # missing mediator values
d$Yna <- d$Y; d$Yna[c(5)] <- NA
assign("d", d, envir = globalenv())
out$data <- list(C = C, X = X, G = as.character(G), M = M, Y = Y, Ms = Ms, Yp = Yp, Mna = d$Mna, Yna = d$Yna)
keys <- c("d0", "d1", "z0", "z1", "tau", "n0", "n1", "d.avg", "z.avg", "n.avg")
grab <- function(r) { o <- list(); for (k in keys) { pk <- if (k == "tau") "tau.coef" else k; sk <- if (k == "tau") "tau" else k
  o[[k]] <- list(est = r[[pk]], ci = unname(r[[paste0(k, ".ci")]]), p = r[[paste0(k, ".p")]], sims = as.vector(r[[paste0(sk, ".sims")]])) }; o }
med <- function(fm, fy, ...) { set.seed(1234); r <- run(mediate(fm, fy, treat = "X", mediator = names(model.frame(fm))[1], sims = 100, ...))
  if (!is.null(r$error)) return(r); list(result = grab(r$value), warnings = r$warnings) }

## scales: M, Y and C multiplied by s (a b and c' scale with Y; the draws scale exactly in theory)
out$scales <- lapply(c(1e-150, 1e150, 1e-300, 1e300), function(s) {
  dd <- transform(d, M = M * s, Y = Y * s, C = C * s)
  assign("dd", dd, envir = globalenv())
  list(s = s, quasi = med(lm(M ~ X + C, data = dd), lm(Y ~ X + M + C, data = dd)),
       boot = med(lm(M ~ X + C, data = dd), lm(Y ~ X + M + C, data = dd), boot = TRUE))
})
## common values: 1e8 and 1e15 added to M and C
out$common <- lapply(c(1e8, 1e15), function(cv) {
  dd <- transform(d, M = M + cv, C = C + cv)
  assign("dd", dd, envir = globalenv())
  list(cv = cv, quasi = med(lm(M ~ X + C, data = dd), lm(Y ~ X + M + C, data = dd)))
})
## perfect separation in a binary mediator (glm does not converge)
out$separation <- med(glm(Ms ~ X, family = binomial, data = d), lm(Y ~ X + Ms, data = d))
## all draws positive
out$one_sign <- med(lm(M ~ X, data = d), lm(Yp ~ X + M, data = d))
## missing values: the models on different rows, and on the same rows
out$missing_different <- med(lm(Mna ~ X + C, data = d), lm(Yna ~ X + Mna + C, data = d))
d2 <- d[!is.na(d$Mna) & !is.na(d$Yna), ]
assign("d2", d2, envir = globalenv())
out$missing_same <- med(lm(Mna ~ X + C, data = d2), lm(Yna ~ X + Mna + C, data = d2))
## a factor covariate in both models
out$factor <- med(lm(M ~ X + G, data = d), lm(Y ~ X + M + G, data = d))
out$factor_boot <- med(lm(M ~ X + G, data = d), lm(Y ~ X + M + G, data = d), boot = TRUE)
## no treatment in the outcome model
out$no_treat_in_y <- med(lm(M ~ X + C, data = d), lm(Y ~ M + C, data = d))
## HC3 with a leverage-1 row (a dummy for one observation)
d$one <- as.numeric(seq_len(n) == 7)
assign("d", d, envir = globalenv())
out$hc3_leverage1 <- med(lm(M ~ X + one, data = d), lm(Y ~ X + M, data = d), robustSE = TRUE)
## sim_slopes on the scales
out$slopes_scales <- lapply(c(1e-150, 1e150), function(s) {
  dd <- transform(d, M = M * s, Y = Y * s)
  assign("dd", dd, envir = globalenv())
  ss <- sim_slopes(lm(Y ~ M * C, data = dd), pred = "M", modx = "C", modx.values = "mean-plus-minus", johnson_neyman = TRUE,
                   jnalpha = 0.05, confint = TRUE, ci.width = 0.95, robust = FALSE)
  sl <- ss$slopes; j <- attr(ss, "jns")[[1]]
  list(s = s, est = sl[["Est."]], se = sl[["S.E."]], p = sl[["p"]], bounds = j$bounds, inside = attr(j, "inside"))
})
## mvrnorm with very different scales (a covariance of coefficients on scales 1e-150 and 1e150)
S <- matrix(c(1e-300, 1e-301, 1e-301, 1e-300), 2)
set.seed(42); out$mvrnorm_tiny <- run(mvrnorm(3, c(0, 0), S))
S2 <- matrix(c(1e300, 1e299, 1e299, 1e300), 2)
set.seed(42); out$mvrnorm_huge <- run(mvrnorm(3, c(0, 0), S2))
## time of n = 2000, sims = 1000 (quasi) and sims = 200 (boot)
nb <- 2000
set.seed(5); Cb <- rnorm(nb); Xb <- rbinom(nb, 1, 0.5); Mb <- 0.5 * Xb + rnorm(nb); Yb <- 0.4 * Mb + 0.3 * Xb + 0.1 * Cb + rnorm(nb)
db <- data.frame(Cb, Xb, Mb, Yb); assign("db", db, envir = globalenv())
t1 <- system.time({ set.seed(1); mediate(lm(Mb ~ Xb + Cb, data = db), lm(Yb ~ Xb + Mb + Cb, data = db), treat = "Xb", mediator = "Mb", sims = 1000) })
t2 <- system.time({ set.seed(1); mediate(lm(Mb ~ Xb + Cb, data = db), lm(Yb ~ Xb + Mb + Cb, data = db), treat = "Xb", mediator = "Mb", sims = 200, boot = TRUE) })
out$time <- list(quasi_n2000_sims1000 = unname(t1["elapsed"]), boot_n2000_sims200 = unname(t2["elapsed"]))
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "null", pretty = FALSE))
