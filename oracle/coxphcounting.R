# oracle-platform: amd64
source("/oracle/_anova.R")
suppressPackageStartupMessages(library(survival))

# Cox regression with counting-process data Surv(start, stop, event) (fixture coxphCounting): time-dependent
# covariates as split rows, delayed entry, tied start/stop boundaries, strata, weights, ties, the robust variance with
# a cluster or an id spanning rows. Behaviour in oracle/coxph2-behaviour.md, part B; the fit itself in
# oracle/coxph-behaviour.md, the robust variance in oracle/robust-behaviour.md section 5. The matrix interface of
# oracle/coxph.R: coxph(Surv(start, stop, status) ~ x [+ strata(strata)], weights, ties, init, robust, cluster, id,
# control).
#   Arguments: start, stop, status (1 event, 0 censored), x (the covariate matrix, one row per row of data, "NA" for a
#   missing value; "Inf"/"-Inf" in start or stop as written), and optionally weights, strata (labels), ties ("efron" or
#   "breslow"), init, iter.max, eps, robust (TRUE/FALSE; absent: R's default), cluster (labels), id (labels), timefix
#   (FALSE: coxph.control(timefix = FALSE); absent: TRUE).
#   Written (fit): coef (NA for an aliased column), var (the robust variance when used), naive.var (absent without a
#   robust variance), rscore (likewise), loglik (initial and final), score, wald (unrounded, from var), iter, means, n,
#   nevent, n.id (absent without id), linear.predictors, first (R's score vector at the final coefficients, a field
#   only counting-process fits have), converged (R's info["convergence"] == 0); (summary) se (from naive.var when
#   present), robustSe (absent without a robust variance), z, p, lower, upper (the 95% interval of exp(coef)),
#   logtest, sctest, waldtest, robscore (each test, df, pvalue), rsq (rsq, maxrsq); (residuals, one row per row used,
#   in input order, only for fits with at most 180 rows) scoreResid (type "score", unweighted) and, with the robust
#   variance, dfbeta (type "dfbeta", weighted); warnings. Errors as {"error": message}.

set.seed(20261109)
cases <- list()
add <- function(d, ...) cases[[length(cases) + 1]] <<- c(list(start = I(d$start), stop = I(d$stop), status = I(d$status), x = d$x), list(...))

# subjects followed from a (possibly delayed) entry time, with a binary covariate that switches on at a random time
# (split into two rows) and a fixed one; digits rounds the times (ties)
td <- function(n, beta = c(0.5, 0.7), digits = 0, entry = TRUE, multi = FALSE) {
  z <- round(rnorm(n), 3); sw <- round(runif(n, 0, 8), digits)
  ent <- if (entry) round(runif(n, 0, 3), digits) else rep(0, n)
  rows <- list()
  for (i in seq_len(n)) {
    tcur <- ent[i]; on <- 0; k <- 0
    repeat {
      rate <- 0.12 * exp(beta[1] * z[i] + beta[2] * on)
      tev <- tcur + rexp(1, rate); tc <- ent[i] + rexp(1, 0.04) + 0.5
      nxt <- if (on == 0 && sw[i] > tcur) sw[i] else Inf
      end <- min(tev, tc, nxt); endr <- round(end, digits) + 10^-digits
      if (endr <= tcur) endr <- tcur + 10^-digits
      ev <- as.integer(end == tev)
      rows[[length(rows) + 1]] <- c(i, tcur, endr, ev, z[i], on)
      k <- k + 1
      if (end == tc || (ev == 1 && !multi) || k > 6) break
      if (end == nxt) on <- 1
      tcur <- endr
    }
  }
  m <- do.call(rbind, rows)
  list(id = m[, 1], start = m[, 2], stop = m[, 3], status = m[, 4], x = cbind(m[, 5], m[, 6]))
}

# 1. ordinary time-dependent data, both ties, delayed entry
d1 <- td(70, digits = 1)
d2 <- td(90, digits = 0)                                      # heavy ties of the stop times and at the boundaries
for (ties in c("efron", "breslow")) {
  add(d1, ties = ties); add(d2, ties = ties)
  add(d2, ties = ties, id = I(d2$id))                         # id with one event per subject: not robust
  add(d2, ties = ties, cluster = I(d2$id))                    # cluster spanning rows
}
# 2. right-censored data split at fixed times: the same fit as Surv(time, status) (oracle/coxph.R)
s <- local({ n <- 60; x <- round(rnorm(n), 3); t <- rexp(n, 0.1 * exp(0.6 * x)); c <- rexp(n, 0.05)
  data.frame(id = 1:n, time = round(pmin(t, c), 1) + 0.1, status = as.integer(t <= c), x = x) })
sp <- survSplit(Surv(time, status) ~ ., s, cut = c(2, 5, 10))
dsp <- list(start = sp$tstart, stop = sp$time, status = sp$status, x = cbind(sp$x))
add(dsp); add(dsp, id = I(sp$id), robust = TRUE); add(dsp, cluster = I(sp$id))
add(list(start = rep(0, 60), stop = s$time, status = s$status, x = cbind(s$x)))   # start 0: right-censored data
# 3. weights (integer: not robust; non-integer: robust with each row its own cluster unless a cluster or id is given),
# strata (a subject's rows may lie in different strata), init
wi <- sample(1:3, length(d1$stop), replace = TRUE); wn <- round(runif(length(d1$stop), 0.4, 2.5), 3)
add(d1, weights = I(wi)); add(d1, weights = I(wi), ties = "breslow"); add(d1, weights = I(wn))
add(d1, weights = I(wn), id = I(d1$id)); add(d1, weights = I(wn), cluster = I(d1$id), ties = "breslow")
st1 <- ifelse(d1$id %% 3 == 0, "b", "a"); st2 <- ifelse(d1$x[, 2] == 1, "on", "off")   # st2 changes within a subject
add(d1, strata = I(st1)); add(d1, strata = I(st2), ties = "breslow"); add(d1, strata = I(st1), weights = I(wn), cluster = I(d1$id))
add(d1, init = I(c(0.3, 0.2))); add(d1, init = I(c(0.3, 0.2)), cluster = I(d1$id))
# 4. recurrent events (several events per id): robust by default with id
d3 <- td(40, digits = 0, multi = TRUE)
add(d3, id = I(d3$id)); add(d3, id = I(d3$id), ties = "breslow"); add(d3, id = I(d3$id), robust = FALSE)
add(d3, id = I(d3$id), cluster = I(d3$id %% 7))              # the cluster wins over the id
# 5. the iterations: ran out (counting fits report iter = iter.max and the proper inverse), a loose eps (no
# "coefficient may be infinite" warning for counting data), iter.max = 0, a monotone likelihood
add(d1, iter.max = 1); add(d1, iter.max = 2); add(d1, iter.max = 0); add(d1, eps = 1e-3)
mono <- list(start = c(0, 0, 0, 1, 0, 2, 0, 0, 0, 0), stop = 1:10 + 0, status = c(1, 1, 1, 1, 1, 0, 0, 0, 0, 1),
             x = cbind(c(3, 2.5, 2, 1.8, 1.5, 0, 0.2, 0.1, 0.3, 1)))
add(mono, iter.max = 4)
lse <- local({ set.seed(40); n <- 40; x <- cbind(rnorm(n), rnorm(n)); t <- rexp(n, 0.1 * exp(0.05 * x[, 1]))
  c <- rexp(n, 0.03); list(start = rep(0, n), stop = round(pmin(t, c), 2) + 0.01, status = as.integer(t <= c), x = x) })
add(lse, eps = 0.01)
set.seed(20261110)
# 6. boundaries of the risk set: rows starting exactly at an event time (not at risk), censored rows ending at it (at
# risk), a subject's row ending and the next starting at an event time, negative start times, an infinite censored stop
tb <- list(start = c(1, 2, 5, 2, 1, 7, 3, 4, 8, 8), stop = c(2, 3, 6, 7, 8, 9, 9, 9, 14, 17),
           status = c(1, 1, 1, 1, 1, 1, 1, 0, 0, 0), x = cbind(c(1, 0, 0, 1, 0, 1, 1, 1, 0, 0)))
add(tb); add(tb, ties = "breslow")
tb2 <- list(start = c(0, 2, 0, 0, 3, 3, 2, 0, 6, 0, 1), stop = c(2, 5, 3, 3, 6, 8, 6, 6, 9, 4, 9),
            status = c(0, 1, 1, 0, 1, 0, 1, 0, 1, 1, 0), x = cbind(c(0.4, 0.4, -1.1, 0.3, 0.9, -0.2, 1.5, 0.1, -0.7, 0.6, 0.2),
                                                                   c(1, 2, 0, 1, 3, 1, 2, 0, 1, 2, 3)))
add(tb2); add(tb2, ties = "breslow"); add(tb2, weights = I(c(1, 1, 2, 1, 1, 3, 1, 2, 1, 1, 1)))
neg <- tb2; neg$start <- neg$start - 10; neg$stop <- neg$stop - 10; add(neg)
inf <- tb2; inf$stop[11] <- Inf; add(inf)
# 7. timefix: start and stop values within sqrt(eps) are merged (pooled distinct values), also across start and stop;
# a merge that leaves an interval of length 0 is an error; timefix = FALSE keeps them apart
nt <- tb2; nt$start[c(2, 7)] <- c(2 + 1e-10, 2 - 1e-10); nt$stop[c(3, 4)] <- c(3 * (1 + 1e-12), 3); add(nt); add(nt, timefix = FALSE)
nt2 <- tb2; nt2$start[2] <- 2 + 3e-9; nt2$stop[1] <- 2 + 1e-9; add(nt2)
z0 <- tb2; z0$start[2] <- 5 - 1e-10; add(z0)                  # (5 - 1e-10, 5] collapses: aeqSurv's error
rel <- list(start = rep(0, 5), stop = c(1e6, 1e6, 1e6, 1e6, 1e6 + 0.012), status = c(1, 1, 0, 1, 1), x = cbind(c(0.2, 1.1, -0.3, 0.5, -0.8)))
add(rel)                                                       # 0.012/1e6 = 1.2e-8 < tol, but the pooled mean includes 0
# 8. invalid rows: start >= stop (Surv's warning, the row dropped), missing values, all rows invalid
bad <- tb2; bad$start[4] <- 3; bad$start[9] <- 10; add(bad)
na <- tb2; na$start[3] <- NA; na$x[5, 1] <- NA; add(na)
add(list(start = c(2, 3, 4), stop = c(1, 2, 3), status = c(1, 0, 1), x = cbind(c(1, 2, 3))))
# 9. degenerate data: no events, one event, an aliased column, a zero weight, robust = TRUE without a cluster or an id,
# a single cluster
add(list(start = tb2$start, stop = tb2$stop, status = rep(0, 11), x = tb2$x))
add(list(start = tb2$start, stop = tb2$stop, status = c(0, 1, rep(0, 9)), x = tb2$x))
al <- d1; al$x <- cbind(al$x, al$x[, 1] - 2 * al$x[, 2]); add(al)
add(tb2, weights = I(c(0, rep(1, 10)))); add(tb2, robust = TRUE); add(tb2, cluster = I(rep(1, 11)))
# 10. scaling: times by 2^-20 and 2^40, a covariate by 2^30 (the coefficient scales exactly in R)
sc <- d1; sc$start <- sc$start * 2^-20; sc$stop <- sc$stop * 2^-20; add(sc)
sc2 <- d1; sc2$start <- sc2$start * 2^40; sc2$stop <- sc2$stop * 2^40; add(sc2)
sc3 <- d1; sc3$x[, 1] <- sc3$x[, 1] * 2^30; add(sc3)
# 11. the Stanford heart transplant data (survival's heart: age, year, surgery, transplant; 103 subjects, 172 rows) and
# the bladder cancer recurrences (bladder2: rx, number, size; several events per id)
hx <- cbind(heart$age, heart$year, heart$surgery, as.numeric(heart$transplant == "1"))
hd <- list(start = heart$start, stop = heart$stop, status = heart$event, x = hx)
add(hd); add(hd, ties = "breslow"); add(hd, id = I(heart$id)); add(hd, cluster = I(heart$id))
add(hd, strata = I(ifelse(heart$surgery == 1, "s", "n")), cluster = I(heart$id))
bx <- cbind(bladder2$rx, bladder2$number, bladder2$size)
bd <- list(start = bladder2$start, stop = bladder2$stop, status = bladder2$event, x = bx)
add(bd, id = I(bladder2$id)); add(bd, id = I(bladder2$id), strata = I(paste0("e", pmin(bladder2$enum, 3))))

write_anova_fixture("coxphCounting", cases, function(a) {
  df <- data.frame(start = unclass(a$start), stop = unclass(a$stop), status = unclass(a$status))
  x <- a$x; colnames(x) <- paste0("x", seq_len(ncol(x)))
  df$x <- x
  if (!is.null(a$strata)) df$s <- unclass(a$strata)
  if (!is.null(a$weights)) df$w <- unclass(a$weights)
  if (!is.null(a$cluster)) df$cl <- unclass(a$cluster)
  if (!is.null(a$id)) df$id <- unclass(a$id)
  ctl <- coxph.control(iter.max = if (is.null(a$iter.max)) 20 else a$iter.max, eps = if (is.null(a$eps)) 1e-9 else a$eps,
                       timefix = if (is.null(a$timefix)) TRUE else a$timefix)
  rhs <- c("x", if (!is.null(a$strata)) "strata(s)")
  fml <- as.formula(paste("Surv(start, stop, status) ~", paste(rhs, collapse = " + ")))
  r <- tryCatch(with_warnings(function() {
    args <- list(fml, data = df, ties = if (is.null(a$ties)) "efron" else a$ties, control = ctl)
    if (!is.null(a$weights)) args$weights <- quote(w)
    if (!is.null(a$init)) args$init <- unclass(a$init)
    if (!is.null(a$robust)) args$robust <- a$robust
    if (!is.null(a$cluster)) args$cluster <- quote(cl)
    if (!is.null(a$id)) args$id <- quote(id)
    fit <- do.call(coxph, args)
    s <- summary(fit)
    test3 <- function(v) I(num2str(unname(v[c("test", "df", "pvalue")])))
    m <- function(v) lapply(seq_len(nrow(v)), function(i) I(num2str(v[i, ])))
    cf <- s$coefficients
    out <- list(coef = I(num2str(unname(fit$coefficients))), var = m(fit$var))
    if (!is.null(fit$naive.var)) out$naive.var <- m(fit$naive.var)
    if (!is.null(fit$rscore)) out$rscore <- num2str(fit$rscore)
    out <- c(out, list(loglik = I(num2str(fit$loglik)), score = num2str(fit$score), wald = num2str(fit$wald.test),
      iter = fit$iter, means = I(num2str(unname(fit$means))), n = fit$n, nevent = fit$nevent))
    if (!is.null(fit$n.id)) out$n.id <- fit$n.id
    out$linear.predictors <- I(num2str(unname(fit$linear.predictors)))
    if (!is.null(fit$first)) out$first <- I(num2str(unname(fit$first)))
    if (!is.null(fit$info)) out$converged <- unname(fit$info["convergence"] == 0)
    out$se <- I(num2str(unname(cf[, "se(coef)"])))
    if ("robust se" %in% colnames(cf)) out$robustSe <- I(num2str(unname(cf[, "robust se"])))
    out <- c(out, list(z = I(num2str(unname(cf[, "z"]))), p = I(num2str(unname(cf[, "Pr(>|z|)"]))),
      lower = I(num2str(unname(s$conf.int[, 3]))), upper = I(num2str(unname(s$conf.int[, 4]))),
      logtest = test3(s$logtest), sctest = test3(s$sctest),
      waldtest = I(num2str(c(fit$wald.test, s$waldtest[c("df", "pvalue")]))), rsq = I(num2str(unname(s$rsq)))))
    if (!is.null(s$robscore)) out$robscore <- test3(s$robscore)
    if (fit$n <= 180 && fit$nevent > 0) {
      out$scoreResid <- m(as.matrix(residuals(fit, type = "score")))
      if (!is.null(fit$naive.var)) out$dfbeta <- m(as.matrix(residuals(fit, type = "dfbeta")))
    }
    out
  }), error = function(e) list(value = list(error = conditionMessage(e)), warnings = I(character(0))))
  c(r$value, list(warnings = r$warnings))
})
