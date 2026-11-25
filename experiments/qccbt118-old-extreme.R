# qccbt118-old-extreme.R: the third edge-case pass over 1.16.0 and 1.17.0 (done in 1.18.0, the user's decision
# 2026-11-26): R at the cases where the rStats.js probe found failures or was unsure. tobit with a covariate shifted by
# 1e8 (rStats.js: NaN coefficients); tobit and betareg with a covariate times 1e+-300 (their coefficient variances are
# 1e-+600: R's vcov, Wald statistic and confint); betareg with a response of 1e-300; interactions::johnson_neyman with
# the outcome times 1e+-150 and the moderator shifted by 1e8; lm's coefficient variances (Sobel's inputs) at 1e+-200.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages({ library(survival); library(AER); library(betareg); library(interactions) })
out <- list(R = R.version.string, arch = R.version$arch)
try1 <- function(expr) tryCatch(expr, error = function(e) list(error = conditionMessage(e)),
                                warning = function(w) list(warning = conditionMessage(w)))
td <- data.frame(y = c(0, 0.4, 1.3, 0, 2.2, 0.9, 0, 3.1, 1.7, 0, 2.6, 1.1),
                 x = c(0.5, 1.2, 2.1, 0.3, 3.4, 1.8, 0.9, 4.2, 2.6, 0.2, 3.8, 2.3), z = c(3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8))
t0 <- tobit(y ~ x + z, data = td)
tob <- function(d) { f <- tobit(y ~ x + z, data = d); s <- summary(f)
  list(coef = unname(coef(f)), se = unname(sqrt(diag(vcov(f)))), wald = as.numeric(s$wald), loglik = f$loglik) }
out$tobit <- list(base = tob(td), shift = try1(tob(transform(td, x = x + 1e8))),
                  x300 = try1(tob(transform(td, x = x * 1e300))), xm300 = try1(tob(transform(td, x = x * 1e-300))))
bd <- data.frame(y = c(0.21, 0.35, 0.3, 0.52, 0.48, 0.66, 0.6, 0.81, 0.44, 0.73, 0.27, 0.58),
                 x = c(1, 2, 3, 4, 5, 6, 7, 8, 4.5, 7.5, 2.5, 5.5))
br <- function(d) { f <- betareg(y ~ x, data = d); list(coef = unname(unlist(coef(f))), se = unname(sqrt(diag(vcov(f)))),
                                                     ci = unname(confint(f))) }
out$betareg <- list(base = br(bd), x300 = try1(br(transform(bd, x = x * 1e300))), xm300 = try1(br(transform(bd, x = x * 1e-300))),
                    y0 = try1(br(transform(bd, y = replace(y, 1, 1e-300)))))
d0 <- data.frame(X = c(0, 0, 0, 0, 0, 1, 1, 1, 1, 1), Y = c(2.0, 1.1, 1.5, 2.4, 0.8, 3.1, 2.2, 3.9, 1.9, 2.8),
                 W = c(3.1, 2.2, 4.0, 2.8, 3.5, 2.9, 3.8, 2.4, 3.3, 4.2), M = c(1.1, 0.4, 0.9, 1.6, 0.2, 1.9, 1.3, 2.6, 1.0, 1.8))
jn <- function(d) { f <- lm(Y ~ X * W, data = d); j <- johnson_neyman(f, pred = "X", modx = "W", alpha = 0.1, plot = FALSE); j$bounds }
out$jn <- list(base = jn(d0), y150 = try1(jn(transform(d0, Y = Y * 1e150))), ym150 = try1(jn(transform(d0, Y = Y * 1e-150))),
               w300 = try1(jn(transform(d0, W = W * 1e300))), wshift = try1(jn(transform(d0, W = W + 1e8))),
               wshift_coef = unname(coef(lm(Y ~ X * W, data = transform(d0, W = W + 1e8)))))
lmv <- function(d) { a <- lm(M ~ X, data = d); b <- lm(Y ~ X + M, data = d); c(vcov(a)["X", "X"], vcov(b)["M", "M"]) }
out$lm_var <- list(base = lmv(d0), s200 = lmv(transform(d0, M = M * 1e200, Y = Y * 1e200)), sm200 = lmv(transform(d0, M = M * 1e-200, Y = Y * 1e-200)))
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "null"))
