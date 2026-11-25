# qccbt118-bt-pql2.R: what qccbt118-bt-pql.R left open (1.18.0), with the REML fixed point found there.
# (a) varFix: candidates (X' V^-1 X)^-1 with V = W^-1 + sigma^2 Z Z' at the final working weights, and the fixed block
#     of the inverse of Henderson's matrix;
# (b) varSigma: candidates 1 / I(sigma) with the REML information I(sigma^2) = tr(P ZZ' P ZZ') / 2,
#     P = V^-1 - V^-1 X (X' V^-1 X)^-1 X' V^-1, I(sigma) = 4 sigma^2 I(sigma^2); and the ML version (V^-1 for P);
# (c) a player with a missing covariate (separate ability), a contest-level covariate with random effects, the probit
#     link, a random-effects-only formula `~ (1 | ..)`, and data with no extra variation (sigma towards 0).
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages(library(BradleyTerry2))
out <- list(R = R.version.string, arch = R.version$arch, BradleyTerry2 = as.character(packageVersion("BradleyTerry2")))
try1 <- function(expr) tryCatch(expr, error = function(e) list(error = conditionMessage(e)),
                                warning = function(w) list(warning = conditionMessage(w)))
set.seed(20261202)
np <- 12
lev <- sprintf("p%02d", 1:np)
xcov <- rnorm(np); zcov <- rnorm(np)
ab <- 0.8 * xcov + rnorm(np, 0, 0.6)
pr <- t(combn(np, 2)); pr <- pr[sample(nrow(pr), 40), ]
nn <- sample(3:8, nrow(pr), TRUE)
w1 <- rbinom(nrow(pr), nn, plogis(ab[pr[, 1]] - ab[pr[, 2]]))
cont <- data.frame(player1 = factor(lev[pr[, 1]], levels = lev), player2 = factor(lev[pr[, 2]], levels = lev),
                   win1 = w1, win2 = nn - w1)
dat <- list(contests = cont, predictors = data.frame(x = xcov, z = zcov))
ok <- function(f) is.null(f[["error"]]) && is.null(f[["warning"]])
f1 <- BTm(cbind(win1, win2), player1, player2, ~ x[..] + (1 | ..), data = dat, tol = 1e-10, maxiter = 500, IWLSiter = 100)

X <- matrix(xcov[pr[, 1]] - xcov[pr[, 2]], ncol = 1)
Z <- matrix(0, nrow(pr), np); Z[cbind(1:nrow(pr), pr[, 1])] <- 1; Z[cbind(1:nrow(pr), pr[, 2])] <- -1
sig <- f1$sigma; w <- f1$weights; wp <- f1$prior.weights
V <- diag(1 / w) + sig^2 * Z %*% t(Z); Vi <- solve(V)
XtViX <- t(X) %*% Vi %*% X
P <- Vi - Vi %*% X %*% solve(XtViX) %*% t(X) %*% Vi
ZZ <- Z %*% t(Z)
A <- rbind(cbind(t(X) %*% (w * X), t(X) %*% (w * Z)), cbind(t(Z) %*% (w * X), t(Z) %*% (w * Z) + diag(np) / sig^2))
out$a <- list(varFix = f1$varFix, cand_gls = solve(XtViX), cand_henderson = solve(A)[1, 1],
              weights_head = w[1:5], prior_head = wp[1:5], mu_head = unname(fitted(f1))[1:5])
I2_reml <- sum(diag(P %*% ZZ %*% P %*% ZZ)) / 2
I2_ml <- sum(diag(Vi %*% ZZ %*% Vi %*% ZZ)) / 2
out$b <- list(varSigma = f1$varSigma, reml = 1 / (4 * sig^2 * I2_reml), ml = 1 / (4 * sig^2 * I2_ml),
              reml_var_sigma2 = 1 / I2_reml)

# (c)
preds_na <- data.frame(x = xcov, z = zcov); preds_na$x[3] <- NA
f_na <- try1(BTm(cbind(win1, win2), player1, player2, ~ x[..] + (1 | ..), data = list(contests = cont, predictors = preds_na),
                 tol = 1e-10, maxiter = 500, IWLSiter = 100))
out$c <- list()
out$c$na <- (if (ok(f_na)) list(coef = coef(f_na), coef_names = names(coef(f_na)), sigma = f_na$sigma,
                                            abilities = unname(BTabilities(f_na)[, 1:2]),
                                            separate = attr(BTabilities(f_na), "separate"), varFix = unname(f_na$varFix))
           else f_na)
h1 <- rbinom(nrow(cont), 1, 0.5)
cont_h <- cont
cont_h$player1 <- data.frame(.. = cont$player1, home = h1)
cont_h$player2 <- data.frame(.. = cont$player2, home = 1 - h1)
f_h <- try1(BTm(cbind(win1, win2), player1, player2, ~ x[..] + home + (1 | ..),
                data = list(contests = cont_h, predictors = dat$predictors), tol = 1e-10, maxiter = 500, IWLSiter = 100))
out$c$home <- (if (ok(f_h)) list(coef = coef(f_h), coef_names = names(coef(f_h)), sigma = f_h$sigma,
                                             h = h1) else f_h)
f_p <- try1(BTm(cbind(win1, win2), player1, player2, ~ x[..] + (1 | ..), data = dat, family = binomial(link = "probit"),
                tol = 1e-10, maxiter = 500, IWLSiter = 100))
out$c$probit <- (if (ok(f_p)) list(coef = unname(coef(f_p)), sigma = f_p$sigma,
                                               random = unname(attr(coef(f_p), "random"))) else f_p)
f_r <- try1(BTm(cbind(win1, win2), player1, player2, ~ (1 | ..), data = dat, tol = 1e-10, maxiter = 500, IWLSiter = 100))
out$c$random_only <- (if (ok(f_r)) list(coef = coef(f_r), sigma = f_r$sigma, class = class(f_r),
                                                    random = unname(attr(coef(f_r), "random"))) else f_r)
# no extra variation: abilities exactly 0.9 x
set.seed(7)
ab0 <- 0.9 * xcov
w0 <- rbinom(nrow(pr), nn * 20, plogis(ab0[pr[, 1]] - ab0[pr[, 2]]))
cont0 <- cont; cont0$win1 <- w0; cont0$win2 <- nn * 20 - w0
f_0 <- try1(BTm(cbind(win1, win2), player1, player2, ~ x[..] + (1 | ..), data = list(contests = cont0, predictors = dat$predictors)))
out$c$zero <- (if (ok(f_0)) list(coef = unname(coef(f_0)), sigma = f_0$sigma, class = class(f_0),
                                             iter = f_0$iter, converged = f_0$converged,
                                             glm = unname(coef(glm(cbind(w0, nn * 20 - w0) ~ 0 + X, family = binomial))))
              else f_0)
out$c$zero_messages <- tryCatch({ withCallingHandlers(BTm(cbind(win1, win2), player1, player2, ~ x[..] + (1 | ..),
                                   data = list(contests = cont0, predictors = dat$predictors)),
                                   warning = function(w) { out$c$zero_warning <<- conditionMessage(w); invokeRestart("muffleWarning") },
                                   message = function(m) { out$c$zero_message <<- conditionMessage(m); invokeRestart("muffleMessage") })
                                  "done" }, error = function(e) conditionMessage(e))
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "null"))
