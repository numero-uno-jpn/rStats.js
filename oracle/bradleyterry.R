# issue: 568
# oracle-platform: amd64
# Public outputs of BradleyTerry2 1.1.4 (BTm, BTabilities, countsToBinomial) and qvcalc 1.0.4 (qvcalc, worstErrors)
# for test/fixtures/bradleyterry.json (1.18.0). The behaviour is in oracle/qcc-bt-behaviour.md; the experiments behind
# it in experiments/qccbt118-bt*.R. Public calls only. The PQL fits are made at tol 1e-10 (R's default 1e-6 stops
# short of the fixed point). The data sets are written out so that the tests fit the same models.
library(jsonlite)
suppressPackageStartupMessages({ library(BradleyTerry2); library(qvcalc) })
run <- function(expr) {
  warns <- character(0)
  value <- withCallingHandlers(
    tryCatch(expr, error = function(e) structure(list(message = conditionMessage(e)), class = "caught")),
    warning = function(w) { warns <<- c(warns, conditionMessage(w)); invokeRestart("muffleWarning") },
    message = function(m) invokeRestart("muffleMessage"))
  if (inherits(value, "caught")) return(list(error = value$message, warnings = warns))
  list(value = value, warnings = warns)
}
out <- list(R = R.version.string, arch = R.version$arch, BradleyTerry2 = as.character(packageVersion("BradleyTerry2")),
            qvcalc = as.character(packageVersion("qvcalc")))
set.seed(20261126)

## data 1: five players, aggregated (one pair not played), home indicator
lev <- c("A", "B", "C", "D", "E")
pr <- t(combn(5, 2))[-3, ]
nn <- sample(5:15, nrow(pr), TRUE)
w1 <- rbinom(nrow(pr), nn, plogis(c(0, 0.5, -0.3, 1.2, 0.2)[pr[, 1]] - c(0, 0.5, -0.3, 1.2, 0.2)[pr[, 2]]))
h1 <- rbinom(nrow(pr), 1, 0.5)
agg <- data.frame(player1 = lev[pr[, 1]], player2 = lev[pr[, 2]], win1 = w1, win2 = nn - w1, home1 = h1, home2 = 1 - h1,
                  stringsAsFactors = FALSE)
## data 2: one row per contest (outcome 1 = player1 won)
k <- 60
p1 <- sample(lev, k, TRUE); p2 <- sapply(p1, function(a) sample(setdiff(lev, a), 1))
res <- rbinom(k, 1, 0.55)
single <- data.frame(player1 = p1, player2 = unname(p2), result = res, stringsAsFactors = FALSE)
## data 3: twelve players with covariates
np <- 12; lev3 <- sprintf("p%02d", 1:np)
xcov <- round(rnorm(np), 4); zcov <- round(rnorm(np), 4)
ab <- 0.8 * xcov + rnorm(np, 0, 0.6)
pr3 <- t(combn(np, 2)); pr3 <- pr3[sample(nrow(pr3), 40), ]
nn3 <- sample(3:8, nrow(pr3), TRUE)
w3 <- rbinom(nrow(pr3), nn3, plogis(ab[pr3[, 1]] - ab[pr3[, 2]]))
h3 <- rbinom(nrow(pr3), 1, 0.5)
cov3 <- data.frame(player1 = lev3[pr3[, 1]], player2 = lev3[pr3[, 2]], win1 = w3, win2 = nn3 - w3, home1 = h3,
                   home2 = 1 - h3, stringsAsFactors = FALSE)
preds <- data.frame(x = xcov, z = zcov)
w0 <- rbinom(nrow(pr3), nn3 * 20, plogis(0.9 * (xcov[pr3[, 1]] - xcov[pr3[, 2]])))
zero <- data.frame(player1 = cov3$player1, player2 = cov3$player2, win1 = w0, win2 = nn3 * 20 - w0)
out$data <- list(agg = as.list(agg), single = as.list(single), cov3 = as.list(cov3), preds = as.list(preds),
                 zero = as.list(zero), levels = lev, levels3 = lev3)

fac <- function(v, l) factor(v, levels = l)
abil_out <- function(f) { a <- BTabilities(f)
  list(ability = unname(a[, 1]), se = unname(a[, 2]), rows = rownames(a), vcov = unname(attr(a, "vcov")),
       separate = attr(a, "separate")) }
glm_out <- function(f) list(coefficients = unname(coef(f)), names = names(coef(f)), se = unname(sqrt(diag(vcov(f)))),
                            deviance = f$deviance, null_deviance = f$null.deviance, aic = f$aic,
                            df_residual = f$df.residual, df_null = f$df.null, iter = f$iter,
                            fitted = unname(fitted(f)), abilities = abil_out(f))
pql_out <- function(f) list(coefficients = unname(coef(f)), names = names(coef(f)),
                            random = unname(as.numeric(attr(coef(f), "random"))), sigma = f$sigma,
                            var_sigma = if (is.null(f$varSigma)) NULL else f$varSigma, var_fix = unname(f$varFix),
                            fitted = unname(fitted(f)), df_residual = f$df.residual, abilities = abil_out(f),
                            summary_fixed = unname(summary(f)$fixef), summary_ran = unname(summary(f)$ranef))
A <- data.frame(player1 = fac(agg$player1, lev), player2 = fac(agg$player2, lev), win1 = agg$win1, win2 = agg$win2)
fits <- list()
fits$basic <- glm_out(BTm(cbind(win1, win2), player1, player2, data = A))
fits$refcat <- glm_out(BTm(cbind(win1, win2), player1, player2, data = A, refcat = "C"))
fits$probit <- glm_out(BTm(cbind(win1, win2), player1, player2, data = A, family = binomial(link = "probit")))
fits$cauchit <- glm_out(BTm(cbind(win1, win2), player1, player2, data = A, family = binomial(link = "cauchit")))
Ah <- A
Ah$player1 <- data.frame(.. = A$player1, home = agg$home1); Ah$player2 <- data.frame(.. = A$player2, home = agg$home2)
fits$home <- glm_out(BTm(cbind(win1, win2), player1, player2, formula = ~ .. + home, data = Ah))
S1 <- data.frame(player1 = fac(single$player1, lev), player2 = fac(single$player2, lev), result = single$result)
fits$single <- glm_out(BTm(result, player1, player2, data = S1))
C3 <- data.frame(player1 = fac(cov3$player1, lev3), player2 = fac(cov3$player2, lev3), win1 = cov3$win1, win2 = cov3$win2)
fits$noRandom <- c(glm_out(suppressWarnings(BTm(cbind(win1, win2), player1, player2, ~ x[..], data = list(contests = C3, predictors = preds)))),
                   list(warnings = run(BTm(cbind(win1, win2), player1, player2, ~ x[..], data = list(contests = C3, predictors = preds)))$warnings))
fits$pql <- pql_out(BTm(cbind(win1, win2), player1, player2, ~ x[..] + (1 | ..), data = list(contests = C3, predictors = preds), tol = 1e-10, maxiter = 500, IWLSiter = 100))
fits$pql_default <- pql_out(BTm(cbind(win1, win2), player1, player2, ~ x[..] + (1 | ..), data = list(contests = C3, predictors = preds)))
fits$pql2 <- pql_out(BTm(cbind(win1, win2), player1, player2, ~ x[..] + z[..] + (1 | ..), data = list(contests = C3, predictors = preds), tol = 1e-10, maxiter = 500, IWLSiter = 100))
fits$pql_probit <- pql_out(BTm(cbind(win1, win2), player1, player2, ~ x[..] + (1 | ..), data = list(contests = C3, predictors = preds),
                                 family = binomial(link = "probit"), tol = 1e-10, maxiter = 500, IWLSiter = 100))
C3h <- C3
C3h$player1 <- data.frame(.. = C3$player1, home = cov3$home1); C3h$player2 <- data.frame(.. = C3$player2, home = cov3$home2)
fits$pql_home <- pql_out(BTm(cbind(win1, win2), player1, player2, ~ x[..] + home + (1 | ..), data = list(contests = C3h, predictors = preds), tol = 1e-10, maxiter = 500, IWLSiter = 100))
preds_na <- preds; preds_na$x[3] <- NA
fits$pql_na <- pql_out(BTm(cbind(win1, win2), player1, player2, ~ x[..] + (1 | ..), data = list(contests = C3, predictors = preds_na), tol = 1e-10, maxiter = 500, IWLSiter = 100))
Z0 <- data.frame(player1 = fac(zero$player1, lev3), player2 = fac(zero$player2, lev3), win1 = zero$win1, win2 = zero$win2)
f0 <- BTm(cbind(win1, win2), player1, player2, ~ x[..] + (1 | ..), data = list(contests = Z0, predictors = preds))
fits$pql_zero <- list(coefficients = unname(coef(f0)), sigma = f0$sigma, var_fix = unname(f0$varFix),
                      random = unname(as.numeric(attr(coef(f0), "random"))))
out$fits <- fits
out$errors <- list(
  random_only = run(BTm(cbind(win1, win2), player1, player2, ~ (1 | ..), data = list(contests = C3, predictors = preds)))$error)

## countsToBinomial
tab <- as.table(matrix(c(0, 3, 5, 2, 0, 4, 1, 6, 0), 3, 3, byrow = TRUE, dimnames = list(c("x", "y", "z"), c("x", "y", "z"))))
tab2 <- as.table(matrix(c(0, 0, 2, 0, 0, 1, 3, 0, 0), 3, 3, dimnames = list(c("p", "q", "r"), c("p", "q", "r"))))
cb_out <- function(d) list(player1 = as.character(d$player1), player2 = as.character(d$player2), win1 = d$win1, win2 = d$win2)
out$counts <- list(list(table = unname(split(unclass(tab), row(tab))), levels = rownames(tab), result = cb_out(countsToBinomial(tab))),
                   list(table = unname(split(unclass(tab2), row(tab2))), levels = rownames(tab2), result = cb_out(countsToBinomial(tab2))))

## qvcalc
qv_out <- function(q) list(estimate = q$qvframe$estimate, se = q$qvframe$SE, quasi_se = q$qvframe$quasiSE,
                           quasi_var = q$qvframe$quasiVar, rows = rownames(q$qvframe), relerrs = unname(q$relerrs),
                           relerrs_names = names(q$relerrs), worst = unname(worstErrors(q)))
out$qvcalc <- list(basic = qv_out(qvcalc(BTabilities(BTm(cbind(win1, win2), player1, player2, data = A)))),
                   refcat = qv_out(qvcalc(BTabilities(BTm(cbind(win1, win2), player1, player2, data = A, refcat = "C")))),
                   twelve = qv_out(qvcalc(BTabilities(BTm(cbind(win1, win2), player1, player2, data = C3)))))
writeLines(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "null", pretty = FALSE),
           file.path("/out", "bradleyterry.json"))
