# qccbt118-bt-pql.R: BTm with player covariates and random player effects, `~ x[..] + (1 | ..)`, fitted by PQL
# (1.18.0). First look at the fit, then candidate fixed points written for this experiment from Breslow and Clayton
# (1993) and the help of glmmPQL / glmmPQL.control:
#   contests k with player1 i and player2 j: eta_k = (x_i - x_j)' beta + (e_i - e_j), e ~ N(0, sigma^2 I);
#   given sigma, beta and e solve the penalized IWLS (Henderson's equations) on the working response
#   z = eta + (y - mu) / mu.eta, weights w = n mu.eta^2 / (mu (1 - mu));
#   sigma maximizes the ML or the REML log-likelihood of the working linear mixed model z = X beta + Z e + eps,
#   eps ~ N(0, W^-1), at the converged working response; iterate to a fixed point (to 1e-13 here).
# Compared with R's fit at the default tol 1e-6 and at tol 1e-10. Also: BTabilities of this model, the fields, summary.
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
dat <- list(contests = cont, predictors = preds)

f1 <- BTm(cbind(win1, win2), player1, player2, ~ x[..] + (1 | ..), data = dat)
f1t <- BTm(cbind(win1, win2), player1, player2, ~ x[..] + (1 | ..), data = dat, tol = 1e-10, maxiter = 500,
           IWLSiter = 100)
f2 <- BTm(cbind(win1, win2), player1, player2, ~ x[..] + z[..] + (1 | ..), data = dat, tol = 1e-10, maxiter = 500,
          IWLSiter = 100)
f0 <- BTm(cbind(win1, win2), player1, player2, ~ x[..], data = dat)
s1 <- summary(f1t)
ab1 <- BTabilities(f1t)
take <- function(f) list(class = class(f), names = names(f), coef = unname(coef(f)), coef_names = names(coef(f)),
                         random = unname(attr(coef(f), "random")), sigma = f$sigma, varSigma = f$varSigma,
                         varFix = unname(f$varFix), deviance = f$deviance, aic = f$aic, iter = f$iter,
                         converged = f$converged, df.residual = f$df.residual, null.deviance = f$null.deviance,
                         lp = unname(f$linear.predictors), weights = unname(f$weights), random_dim = dim(f$random))
out$f1 <- take(f1); out$f1t <- take(f1t); out$f2 <- take(f2)
out$f0 <- list(class = class(f0), coef = unname(coef(f0)), coef_names = names(coef(f0)), deviance = f0$deviance)
out$summary <- list(printed = capture.output(print(s1)), names = names(s1),
                    coefficients = unname(s1$coefficients), dimnames = dimnames(s1$coefficients))
out$abilities <- list(val = unname(ab1[, 1:2]), dimnames = dimnames(ab1), vcov = unname(attr(ab1, "vcov")),
                      x_beta = xcov * coef(f1t)[1], x_beta_plus_e = xcov * coef(f1t)[1] + attr(coef(f1t), "random"))

# candidates
X <- matrix(xcov[pr[, 1]] - xcov[pr[, 2]], ncol = 1)
Z <- matrix(0, nrow(pr), np); Z[cbind(1:nrow(pr), pr[, 1])] <- 1; Z[cbind(1:nrow(pr), pr[, 2])] <- -1
y <- w1 / nn
pirls <- function(sig, beta, e) {
  for (it in 1:200) {
    eta <- drop(X %*% beta + Z %*% e); mu <- plogis(eta); d <- mu * (1 - mu)
    w <- nn * d; zz <- eta + (y - mu) / d
    A <- rbind(cbind(t(X) %*% (w * X), t(X) %*% (w * Z)),
               cbind(t(Z) %*% (w * X), t(Z) %*% (w * Z) + diag(np) / sig^2))
    sol <- solve(A, c(t(X) %*% (w * zz), t(Z) %*% (w * zz)))
    nb <- sol[1:ncol(X)]; ne <- sol[-(1:ncol(X))]
    done <- max(abs(c(nb - beta, ne - e))) < 1e-14
    beta <- nb; e <- ne
    if (done) break
  }
  eta <- drop(X %*% beta + Z %*% e); mu <- plogis(eta); d <- mu * (1 - mu)
  list(beta = beta, e = e, w = nn * d, z = eta + (y - mu) / d)
}
ll <- function(sig, w, zz, reml) {
  V <- diag(1 / w) + sig^2 * Z %*% t(Z)
  Vi <- solve(V); XtViX <- t(X) %*% Vi %*% X
  b <- solve(XtViX, t(X) %*% Vi %*% zz); r <- zz - X %*% b
  -0.5 * (determinant(V)$modulus + (if (reml) determinant(XtViX)$modulus else 0) + drop(t(r) %*% Vi %*% r))
}
fixed_point <- function(reml) {
  sig <- 0.5; beta <- 0; e <- rep(0, np)
  for (k in 1:500) {
    p <- pirls(sig, beta, e); beta <- p$beta; e <- p$e
    ns <- optimize(function(s) -ll(s, p$w, p$z, reml), c(1e-4, 10), tol = 1e-15)$minimum
    if (abs(ns - sig) < 1e-13) { sig <- ns; break }
    sig <- ns
  }
  p <- pirls(sig, beta, e)
  list(sigma = sig, beta = p$beta, e = p$e, iter = k)
}
out$cand <- list(reml = fixed_point(TRUE), ml = fixed_point(FALSE))
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "null"))
