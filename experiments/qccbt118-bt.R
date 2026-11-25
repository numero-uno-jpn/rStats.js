# qccbt118-bt.R: BradleyTerry2's BTm without random effects, BTabilities, countsToBinomial and qvcalc (1.18.0).
# Candidates written for this experiment:
#   BTm(cbind(win1, win2), player1, player2) = glm(binomial) without intercept on X, X[k, j] = 1 if player1 of contest
#     k is player j, -1 if player2 is, the column of the reference player (first level, or refcat) dropped;
#   with a contest-level covariate (at.home1 - at.home2) as one more column; links logit, probit, cauchit;
#   BTabilities: (0, 0) for the reference, the coefficient and its se for the others, vcov with a zero row;
#   qvcalc: quasi-variances q minimizing sum_{i<j} (log(q_i + q_j) - log v_ij)^2, v_ij = var(b_i - b_j) (Firth 2003),
#     relerrs = sqrt((q_i + q_j) / v_ij) - 1.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages({ library(BradleyTerry2); library(qvcalc) })
out <- list(R = R.version.string, arch = R.version$arch, BradleyTerry2 = as.character(packageVersion("BradleyTerry2")),
            qvcalc = as.character(packageVersion("qvcalc")))
set.seed(20261201)
try1 <- function(expr) tryCatch(expr, error = function(e) list(error = conditionMessage(e)))
lev <- c("A", "B", "C", "D", "E")
ab_true <- c(0, 0.5, -0.3, 1.2, 0.2)
pairs <- t(combn(5, 2))
pairs <- pairs[-3, ]                         # A vs D not played
nn <- sample(5:15, nrow(pairs), TRUE)
pw <- plogis(ab_true[pairs[, 1]] - ab_true[pairs[, 2]])
w1 <- rbinom(nrow(pairs), nn, pw)
agg <- data.frame(player1 = factor(lev[pairs[, 1]], levels = lev), player2 = factor(lev[pairs[, 2]], levels = lev),
                  win1 = w1, win2 = nn - w1)
X <- matrix(0, nrow(agg), 5, dimnames = list(NULL, lev))
X[cbind(seq_len(nrow(agg)), as.integer(agg$player1))] <- 1
X[cbind(seq_len(nrow(agg)), as.integer(agg$player2))] <- -1

fit <- BTm(cbind(win1, win2), player1, player2, data = agg)
g <- glm(cbind(agg$win1, agg$win2) ~ 0 + X[, -1], family = binomial)
sfit <- summary(fit)
abil <- BTabilities(fit)
out$basic <- list(
  class = class(fit), names = names(fit), coef = coef(fit), coef_names = names(coef(fit)),
  se = sqrt(diag(vcov(fit))), deviance = fit$deviance, null.deviance = fit$null.deviance, aic = fit$aic,
  df.residual = fit$df.residual, df.null = fit$df.null, iter = fit$iter, converged = fit$converged,
  fitted = unname(fitted(fit)), lp = unname(fit$linear.predictors),
  summary_coef = unname(sfit$coefficients), summary_dimnames = dimnames(sfit$coefficients),
  printed = capture.output(print(sfit)),
  cand = list(coef = unname(coef(g)), se = unname(sqrt(diag(vcov(g)))), deviance = g$deviance,
              null.deviance = g$null.deviance, aic = g$aic, df.residual = g$df.residual, df.null = g$df.null,
              iter = g$iter),
  abilities = unname(abil[, 1:2]), abilities_dimnames = dimnames(abil), abilities_class = class(abil),
  abilities_vcov = unname(attr(abil, "vcov")), abilities_vcov_dimnames = dimnames(attr(abil, "vcov")),
  abilities_factorname = attr(abil, "factorname"),
  resid = list(deviance = unname(residuals(fit)), pearson = unname(residuals(fit, type = "pearson")),
               response = unname(residuals(fit, type = "response")),
               grouped = unname(residuals(fit, type = "grouped")),
               grouped_weights = unname(attr(residuals(fit, type = "grouped"), "weights")),
               working = unname(residuals(fit, type = "working")))
)
fitR <- BTm(cbind(win1, win2), player1, player2, data = agg, refcat = "C")
abR <- BTabilities(fitR)
out$refcat <- list(coef = coef(fitR), abilities = unname(abR[, 1:2]), rownames = rownames(abR),
                   deviance = fitR$deviance)
out$links <- list(
  probit = try1({ f <- BTm(cbind(win1, win2), player1, player2, data = agg, family = binomial(link = "probit"))
                  list(coef = unname(coef(f)), se = unname(sqrt(diag(vcov(f)))), deviance = f$deviance,
                       cand = unname(coef(glm(cbind(agg$win1, agg$win2) ~ 0 + X[, -1], family = binomial("probit"))))) }),
  cauchit = try1({ f <- BTm(cbind(win1, win2), player1, player2, data = agg, family = binomial(link = "cauchit"))
                   list(coef = unname(coef(f)), deviance = f$deviance) }),
  br = try1({ f <- BTm(cbind(win1, win2), player1, player2, data = agg, br = TRUE); list(coef = unname(coef(f))) })
)

# countsToBinomial
tab <- matrix(c(0, 3, 5, 2, 0, 4, 1, 6, 0), 3, 3, byrow = TRUE, dimnames = list(winner = c("x", "y", "z"),
                                                                              loser = c("x", "y", "z")))
cb <- countsToBinomial(as.table(tab))
out$counts <- list(df = cb, names = names(cb), levels1 = levels(cb[[1]]), levels2 = levels(cb[[2]]),
                   zero_pair = try1(countsToBinomial(as.table(matrix(c(0, 0, 2, 0, 0, 1, 3, 0, 0), 3, 3,
                     dimnames = list(c("p", "q", "r"), c("p", "q", "r")))))))

# home advantage (contest-level variable in data frames for the two players)
h1 <- rbinom(nrow(agg), 1, 0.5)
dd <- agg
dd$player1 <- data.frame(team = agg$player1, at.home = h1)
dd$player2 <- data.frame(team = agg$player2, at.home = 1 - h1)
fh <- BTm(cbind(win1, win2), player1, player2, formula = ~ team + at.home, id = "team", data = dd)
gh <- glm(cbind(agg$win1, agg$win2) ~ 0 + X[, -1] + I(h1 - (1 - h1)), family = binomial)
out$home <- list(coef = coef(fh), se = unname(sqrt(diag(vcov(fh)))), deviance = fh$deviance,
                 cand = unname(coef(gh)), cand_se = unname(sqrt(diag(vcov(gh)))),
                 abilities = unname(BTabilities(fh)[, 1:2]))

# qvcalc
qv <- qvcalc(abil)
V <- attr(abil, "vcov")
vij <- outer(diag(V), diag(V), "+") - 2 * V
obj <- function(lq) { q <- exp(lq); s <- 0
  for (i in 1:4) for (j in (i + 1):5) s <- s + (log(q[i] + q[j]) - log(vij[i, j]))^2; s }
o1 <- optim(log(pmax(diag(V), 1e-3) + 0.01), obj, method = "BFGS", control = list(reltol = 1e-14, maxit = 1000))
q_c <- exp(o1$par)
out$qv <- list(class = class(qv), names = names(qv), qvframe = qv$qvframe, qv_rownames = rownames(qv$qvframe),
               relerrs = qv$relerrs, relerrs_names = names(qv$relerrs), covmat = unname(qv$covmat),
               factorname = qv$factorname, coef.indices = qv$coef.indices,
               cand_q = q_c, cand_obj = o1$value,
               cand_relerrs = { r <- c(); for (i in 1:4) for (j in (i + 1):5) r <- c(r, sqrt((q_c[i] + q_c[j]) / vij[i, j]) - 1); r },
               printed = capture.output(print(qv)), worst = worstErrors(qv))
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "null"))
