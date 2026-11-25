# qccbt118-bt-pql3.R: the REML fixed point of qccbt118-bt-pql.R as a general candidate (any fixed design X, random
# design Z, link), against the cases of qccbt118-bt-pql2.R (1.18.0):
#   home: X = (x_i - x_j, home1 - home2); probit; a player with a missing covariate (p03): X = (x with 0 for p03 ...,
#   +-1 indicator of p03) with p03's random effect kept (candidate A) or dropped (candidate B);
#   no extra variation (R gave sigma = 0 and the glm): the REML log-likelihood profile near 0 and the REML score at 0.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages(library(BradleyTerry2))
out <- list(R = R.version.string, arch = R.version$arch, BradleyTerry2 = as.character(packageVersion("BradleyTerry2")))
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
preds <- data.frame(x = xcov, z = zcov)
f1 <- BTm(cbind(win1, win2), player1, player2, ~ x[..] + (1 | ..), data = list(contests = cont, predictors = preds),
          tol = 1e-10, maxiter = 500, IWLSiter = 100)   # keeps the random stream of qccbt118-bt-pql2.R

Zfull <- matrix(0, nrow(pr), np); Zfull[cbind(1:nrow(pr), pr[, 1])] <- 1; Zfull[cbind(1:nrow(pr), pr[, 2])] <- -1
reml_fit <- function(X, Z, y, nn, linkinv, mu.eta) {
  q <- ncol(Z); p <- ncol(X)
  pirls <- function(sig, beta, e) {
    for (it in 1:300) {
      eta <- drop(X %*% beta + Z %*% e); mu <- linkinv(eta); de <- mu.eta(eta)
      w <- nn * de^2 / (mu * (1 - mu)); zz <- eta + (y - mu) / de
      A <- rbind(cbind(t(X) %*% (w * X), t(X) %*% (w * Z)), cbind(t(Z) %*% (w * X), t(Z) %*% (w * Z) + diag(q) / sig^2))
      sol <- solve(A, c(t(X) %*% (w * zz), t(Z) %*% (w * zz)))
      done <- max(abs(sol - c(beta, e))) < 1e-14
      beta <- sol[1:p]; e <- sol[-(1:p)]
      if (done) break
    }
    eta <- drop(X %*% beta + Z %*% e); mu <- linkinv(eta); de <- mu.eta(eta)
    list(beta = beta, e = e, w = nn * de^2 / (mu * (1 - mu)), z = eta + (y - mu) / de)
  }
  ll <- function(sig, w, zz) {
    V <- diag(1 / w) + sig^2 * Z %*% t(Z); Vi <- solve(V); XtViX <- t(X) %*% Vi %*% X
    b <- solve(XtViX, t(X) %*% Vi %*% zz); r <- zz - X %*% b
    -0.5 * (determinant(V)$modulus + determinant(XtViX)$modulus + drop(t(r) %*% Vi %*% r))
  }
  sig <- 0.5; beta <- rep(0, p); e <- rep(0, q)
  for (k in 1:300) {
    pp <- pirls(sig, beta, e); beta <- pp$beta; e <- pp$e
    ns <- optimize(function(s) -ll(s, pp$w, pp$z), c(1e-4, 10), tol = 1e-15)$minimum
    if (abs(ns - sig) < 1e-12) { sig <- ns; break }
    sig <- ns
  }
  pp <- pirls(sig, beta, e)
  list(sigma = sig, beta = pp$beta, e = pp$e)
}
y <- w1 / nn
lg <- binomial()
# home
set.seed(99); h1 <- rbinom(nrow(cont), 1, 0.5)
cont_h <- cont
cont_h$player1 <- data.frame(.. = cont$player1, home = h1)
cont_h$player2 <- data.frame(.. = cont$player2, home = 1 - h1)
f_h <- BTm(cbind(win1, win2), player1, player2, ~ x[..] + home + (1 | ..),
           data = list(contests = cont_h, predictors = preds), tol = 1e-10, maxiter = 500, IWLSiter = 100)
Xh <- cbind(xcov[pr[, 1]] - xcov[pr[, 2]], h1 - (1 - h1))
out$home <- list(R = list(coef = unname(coef(f_h)), sigma = f_h$sigma), cand = reml_fit(Xh, Zfull, y, nn, lg$linkinv, lg$mu.eta))
# probit
f_p <- BTm(cbind(win1, win2), player1, player2, ~ x[..] + (1 | ..), data = list(contests = cont, predictors = preds),
           family = binomial(link = "probit"), tol = 1e-10, maxiter = 500, IWLSiter = 100)
pl <- binomial("probit")
out$probit <- list(R = list(coef = unname(coef(f_p)), sigma = f_p$sigma, random = unname(attr(coef(f_p), "random"))),
                   cand = reml_fit(matrix(xcov[pr[, 1]] - xcov[pr[, 2]]), Zfull, y, nn, pl$linkinv, pl$mu.eta))
# missing covariate
preds_na <- preds; preds_na$x[3] <- NA
f_na <- BTm(cbind(win1, win2), player1, player2, ~ x[..] + (1 | ..), data = list(contests = cont, predictors = preds_na),
            tol = 1e-10, maxiter = 500, IWLSiter = 100)
x0 <- xcov; x0[3] <- 0
Xna <- cbind(Zfull[, 3], x0[pr[, 1]] - x0[pr[, 2]])
out$na <- list(R = list(coef = unname(coef(f_na)), sigma = f_na$sigma, random = unname(attr(coef(f_na), "random")),
                        random_dim = dim(f_na$random)),
               candA = reml_fit(Xna, Zfull, y, nn, lg$linkinv, lg$mu.eta),
               candB = reml_fit(Xna, Zfull[, -3], y, nn, lg$linkinv, lg$mu.eta))
# no extra variation
set.seed(7)
ab0 <- 0.9 * xcov
w0 <- rbinom(nrow(pr), nn * 20, plogis(ab0[pr[, 1]] - ab0[pr[, 2]]))
X1 <- matrix(xcov[pr[, 1]] - xcov[pr[, 2]])
g0 <- glm(cbind(w0, nn * 20 - w0) ~ 0 + X1, family = binomial)
mu0 <- fitted(g0); w0w <- nn * 20 * mu0 * (1 - mu0); z0 <- g0$linear.predictors + (w0 / (nn * 20) - mu0) / (mu0 * (1 - mu0))
llz <- function(sig) {
  V <- diag(1 / w0w) + sig^2 * Zfull %*% t(Zfull); Vi <- solve(V); XtViX <- t(X1) %*% Vi %*% X1
  b <- solve(XtViX, t(X1) %*% Vi %*% z0); r <- z0 - X1 %*% b
  -0.5 * (determinant(V)$modulus + determinant(XtViX)$modulus + drop(t(r) %*% Vi %*% r))
}
Wd <- diag(w0w); P0 <- Wd - Wd %*% X1 %*% solve(t(X1) %*% Wd %*% X1) %*% t(X1) %*% Wd
r0 <- z0 - drop(X1 %*% coef(g0))
ZZ <- Zfull %*% t(Zfull)
out$zero <- list(profile = sapply(c(0, 1e-3, 0.01, 0.03, 0.05, 0.1, 0.2), llz),
                 score_sigma2_at0 = 0.5 * (drop(t(r0) %*% Wd %*% ZZ %*% Wd %*% r0) - sum(diag(P0 %*% ZZ))),
                 refit = { ff <- BTm(cbind(win1, win2), player1, player2, ~ x[..] + (1 | ..),
                                     data = list(contests = data.frame(player1 = cont$player1, player2 = cont$player2,
                                                                       win1 = w0, win2 = nn * 20 - w0), predictors = preds))
                           list(sigma = ff$sigma, coef = unname(coef(ff)), names = names(ff), iter = ff$iter,
                                varSigma = ff$varSigma, varFix = ff$varFix, random = attr(coef(ff), "random")) })
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "null"))
