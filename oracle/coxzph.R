# oracle-platform: amd64
source("/oracle/_anova.R")
suppressPackageStartupMessages(library(survival))

# The test of proportional hazards (fixture coxZph): survival::cox.zph(fit, transform, terms, global) of a coxph fit
# with the matrix interface of oracle/coxph.R (right-censored) or oracle/coxphcounting.R (counting process, when start
# is given). Behaviour in oracle/coxph2-behaviour.md, part A.
#   Arguments: time (the stop time with start), status, x ("NA" for a missing value), and optionally start, weights,
#   strata, ties, init, iter.max, robust, cluster (the fit's options, as in coxph.R / coxphrobust.R); transform ("km"
#   default, "rank", "identity", "log"); transformFn (instead of transform, a function of the times: "sqrt" = sqrt(t),
#   "square" = t^2, "constant" = rep(1, length(t)), "exp1000" = exp(t * 1000)); assign (the terms: an array of arrays
#   of 1-based column numbers, each group one term of the formula; absent: each column its own term); terms (TRUE
#   default, FALSE); global (TRUE default, FALSE).
#   Written: rowNames (R's row names of the table: "x<j>" for a one-column term, "g<k>" for the k-th multi-column term
#   with terms = TRUE, "g<k><name>" for its columns with terms = FALSE, and "GLOBAL"), chisq, df, p (the columns of
#   the table), x (transformed times, one per event, sorted by stratum and time), time (the event times, after the
#   tie merging of the fit), strata (the stratum label of each event; absent without strata), y (the scaled Schoenfeld
#   residuals, one row per event), var; the fit's coef and nevent (for checking the fit), and warnings (of the fit and
#   of cox.zph, each once). Errors as {"error": message}.

set.seed(20261111)
cases <- list()
grp <- function(...) lapply(list(...), function(g) I(g))   # the terms: each group an array in the fixture
add <- function(d, ...) cases[[length(cases) + 1]] <<- c(list(time = I(d$time), status = I(d$status), x = d$x),
                                                        if (!is.null(d$start)) list(start = I(d$start)), list(...))
sim <- function(n, beta, rate = 0.1, cens = 0.05, digits = NULL, p01 = FALSE, tvary = 0) {
  x <- matrix(round(rnorm(n * length(beta)), 4), n)
  if (p01) x[, 1] <- rbinom(n, 1, 0.4)
  # a non-proportional effect of the first column: the log hazard ratio changes by tvary per unit of log time
  u <- runif(n); lp <- drop(x %*% beta)
  t <- if (tvary == 0) -log(u) / (rate * exp(lp)) else
    vapply(seq_len(n), function(i) uniroot(function(s) rate * integrate(function(v) exp(lp[i] + tvary * x[i, 1] * log1p(v)), 0, s)$value + log(u[i]), c(0, 1e4))$root, 0)
  c <- rexp(n, cens)
  time <- pmin(t, c); if (!is.null(digits)) time <- round(time, digits) + 10^-digits
  list(time = time, status = as.integer(t <= c), x = x)
}

s1 <- sim(60, c(0.7, -0.3))
s2 <- sim(120, c(0.5, -0.8), digits = 0)                       # heavy ties
s3 <- sim(150, c(0.6, 0.4, -0.5), p01 = TRUE, digits = 1, tvary = -0.5)   # non-proportional first column
# 1. the transforms, both ties
for (tr in c("km", "rank", "identity", "log")) for (ties in c("efron", "breslow")) {
  add(s1, transform = tr, ties = ties); add(s2, transform = tr, ties = ties)
}
for (tr in c("km", "rank", "identity", "log")) add(s3, transform = tr)
add(s1, transformFn = "sqrt"); add(s2, transformFn = "square"); add(s3, transformFn = "sqrt", ties = "breslow")
# 2. terms: a multi-column term (2 or 3 columns), terms = FALSE, global = FALSE
add(s3, assign = grp(1, c(2, 3))); add(s3, assign = grp(1, c(2, 3)), terms = FALSE)
add(s3, assign = grp(c(1, 2, 3))); add(s3, assign = grp(c(1, 3), 2), transform = "identity")
add(s1, global = FALSE); add(s3, assign = grp(1, c(2, 3)), global = FALSE)
add(list(time = s1$time, status = s1$status, x = s1$x[, 1, drop = FALSE]))   # one column: GLOBAL equals its row
# 3. weights (integer and non-integer; the fit's robust variance is not used), strata, robust fits, init
w2 <- as.numeric(sample(1:3, 120, replace = TRUE)); wn <- round(runif(120, 0.4, 2.5), 3)
add(s2, weights = I(w2)); add(s2, weights = I(wn)); add(s2, weights = I(wn), transform = "identity", ties = "breslow")
st <- rep(c("b", "a", "c"), 40)
add(s2, strata = I(st)); add(s2, strata = I(st), transform = "rank"); add(s2, strata = I(st), weights = I(wn), ties = "breslow")
cl <- rep(1:30, each = 4)
add(s2, cluster = I(cl)); add(s2, robust = TRUE, transform = "identity")
# 4. fits that did not converge: the variance is recomputed at the coefficients (R's fit$var is not used); a start
# value with no iterations
add(s1, iter.max = 1); add(s1, iter.max = 2, transform = "identity"); add(s1, iter.max = 0, init = I(c(0.5, -0.2)))
# 5. an aliased column (dropped), tied deaths in input order, times scaled by 2^-30 and 2^600 (identity: g^2 overflows
# in R), a covariate scaled by 2^40
s4 <- s1; s4$x <- cbind(s4$x, s4$x[, 1] + s4$x[, 2]); add(s4); add(s4, transform = "identity")
tie <- list(time = c(5, 3, 5, 5, 2, 7, 5, 9, 3, 6), status = c(1, 1, 1, 0, 1, 1, 1, 0, 1, 1),
            x = cbind(c(0.3, 1.2, -0.5, 0.8, 2, -1, 0.1, 0.4, 0.6, -0.2)))
add(tie); add(tie, ties = "breslow"); add(tie, weights = I(c(1, 2, 1.5, 1, 1, 3, 0.5, 1, 1, 2)), transform = "identity")
# times of order 1e-9: below the absolute tolerance of the tie merging, so every time is merged into one (R fails)
sm <- s1; sm$time <- sm$time * 2^-30; add(sm, transform = "identity", refKind = "scaled", refTimeExp = -30)
add(sm, refKind = "scaled", refTimeExp = -30)
bg <- s1; bg$time <- bg$time * 2^600; add(bg, transform = "identity", refKind = "scaled", refTimeExp = 600); add(bg, transform = "log"); add(bg)
bx <- s1; bx$x[, 2] <- bx$x[, 2] * 2^40; add(bx, refKind = "scaled", refXCol = 2, refXExp = 40)
# near ties merged by the fit (the transform sees the merged times)
nt <- tie; nt$time[c(3, 9)] <- c(5 * (1 + 1e-12), 3 - 1e-11); add(nt, transform = "rank"); add(nt, transform = "identity")
# 6. degenerate: no events, one event, all events at one time, a constant transform, log of times <= 0, two events
add(list(time = tie$time, status = rep(0, 10), x = tie$x))
add(list(time = tie$time, status = c(1, rep(0, 9)), x = tie$x))
add(list(time = rep(4, 10), status = tie$status, x = tie$x))
add(tie, transformFn = "constant"); add(list(time = tie$time - 2, status = tie$status, x = tie$x), transform = "log")
add(list(time = tie$time - 4, status = tie$status, x = tie$x), transform = "log")
add(list(time = tie$time, status = c(1, 1, rep(0, 8)), x = tie$x))
add(tie, transformFn = "exp1000")
# 7. counting-process fits (start given): time-dependent covariates as split rows, delayed entry; km is the
# product-limit curve of the (start, stop] data, rank the rank of the stop times of all rows
td <- local({
  n <- 50; z <- round(rnorm(n), 2); sw <- round(runif(n, 0, 8)); T <- round(rexp(n, 0.15 * exp(0.4 * z))) + 1
  C <- round(rexp(n, 0.04)) + 1; fu <- pmin(T, C); ev <- as.integer(T <= C); en <- pmin(round(runif(n, 0, 3)), fu - 1)
  r <- do.call(rbind, lapply(1:n, function(i) {
    if (sw[i] > en[i] && sw[i] < fu[i]) cbind(i, c(en[i], sw[i]), c(sw[i], fu[i]), c(0, ev[i]), z[i], c(0, 1))
    else cbind(i, en[i], fu[i], ev[i], z[i], as.numeric(sw[i] <= en[i]))
  }))
  list(id = r[, 1], start = r[, 2], time = r[, 3], status = r[, 4], x = r[, 5:6])
})
for (tr in c("km", "rank", "identity")) { add(td, transform = tr); add(td, transform = tr, ties = "breslow") }
add(td, cluster = I(td$id)); add(td, strata = I(ifelse(td$id %% 2 == 0, "e", "o")))
add(td, weights = I(round(runif(length(td$time), 0.5, 2), 2)), transform = "identity")
add(td, iter.max = 2)
# 8. the ovarian and lung data (survival's examples)
add(list(time = ovarian$futime, status = ovarian$fustat, x = cbind(ovarian$age, ovarian$ecog.ps)))
lx <- as.matrix(lung[, c("age", "sex", "ph.ecog")])
add(list(time = lung$time, status = lung$status - 1, x = lx)); add(list(time = lung$time, status = lung$status - 1, x = lx), transform = "rank")
add(list(time = lung$time, status = lung$status - 1, x = lx[, c(1, 3)]), strata = I(ifelse(lung$sex == 1, "m", "f")))

FNS <- list(sqrt = sqrt, square = function(t) t^2, constant = function(t) rep(1, length(t)), exp1000 = function(t) exp(t * 1000))

# the table of cox.zph for the arguments a (data as given); used for the case and for its reference
zph_run <- function(a, collect) {
  df <- data.frame(time = unclass(a$time), status = unclass(a$status))
  if (!is.null(a$start)) df$start <- unclass(a$start)
  x <- a$x; p <- ncol(x)
  groups <- if (is.null(a$assign)) as.list(seq_len(p)) else lapply(a$assign, unclass)
  rhs <- character(0)
  for (k in seq_along(groups)) {
    g <- groups[[k]]
    if (length(g) == 1) { nm <- paste0("x", g); df[[nm]] <- x[, g] }
    else { nm <- paste0("g", k); m <- x[, g, drop = FALSE]; colnames(m) <- paste0("x", g); df[[nm]] <- m }
    rhs <- c(rhs, nm)
  }
  if (!is.null(a$strata)) { df$s <- unclass(a$strata); rhs <- c(rhs, "strata(s)") }
  if (!is.null(a$weights)) df$w <- unclass(a$weights)
  if (!is.null(a$cluster)) df$cl <- unclass(a$cluster)
  lhs <- if (is.null(a$start)) "Surv(time, status)" else "Surv(start, time, status)"
  fml <- as.formula(paste(lhs, "~", paste(rhs, collapse = " + ")))
  ctl <- coxph.control(iter.max = if (is.null(a$iter.max)) 20 else a$iter.max)
  args <- list(fml, data = df, ties = if (is.null(a$ties)) "efron" else a$ties, control = ctl)
  if (!is.null(a$weights)) args$weights <- quote(w)
  if (!is.null(a$init)) args$init <- unclass(a$init)
  if (!is.null(a$robust)) args$robust <- a$robust
  if (!is.null(a$cluster)) args$cluster <- quote(cl)
  fit <- do.call(coxph, args)
  collect$coef <- I(num2str(unname(fit$coefficients))); collect$nevent <- fit$nevent
  tr <- if (!is.null(a$transformFn)) FNS[[a$transformFn]] else if (is.null(a$transform)) "km" else a$transform
  cox.zph(fit, transform = tr, terms = if (is.null(a$terms)) TRUE else a$terms,
          global = if (is.null(a$global)) TRUE else a$global)
}

zph_ref <- function(a) {
  # refKind "scaled": the data were scaled by a power of 2 (times by 2^refTimeExp, column refXCol by 2^refXExp); the
  # test is invariant under both, so the reference is R's table on the unscaled data (exact division by 2^k)
  if (is.null(a$refKind)) return(NULL)
  b <- a
  if (!is.null(a$refTimeExp)) b$time <- unclass(a$time) * 2^-a$refTimeExp
  if (!is.null(a$refXExp)) b$x[, a$refXCol] <- a$x[, a$refXCol] * 2^-a$refXExp
  z <- zph_run(b, new.env()); tab <- z$table
  list(refKind = a$refKind, rowNames = I(rownames(tab)), chisq = I(num2str(unname(tab[, "chisq"]))),
       df = I(num2str(unname(tab[, "df"]))), p = I(num2str(unname(tab[, "p"]))))
}

write_anova_fixture("coxZph", cases, function(a) {
  fitInfo <- new.env()
  r <- tryCatch(with_warnings(function() {
    z <- zph_run(a, fitInfo)
    tab <- z$table
    m <- function(v) lapply(seq_len(nrow(v)), function(i) I(num2str(v[i, ])))
    out <- list(rowNames = I(rownames(tab)), chisq = I(num2str(unname(tab[, "chisq"]))), df = I(num2str(unname(tab[, "df"]))),
                p = I(num2str(unname(tab[, "p"]))), x = I(num2str(unname(z$x))), time = I(num2str(unname(z$time))))
    if (!is.null(z$strata)) out$strata <- I(as.character(z$strata))
    c(out, list(y = m(unname(as.matrix(z$y))), var = m(as.matrix(z$var)), coef = fitInfo$coef, nevent = fitInfo$nevent))
  }), error = function(e) list(value = c(list(error = conditionMessage(e)),
                                         if (!is.null(fitInfo$coef)) list(coef = fitInfo$coef, nevent = fitInfo$nevent)),
                               warnings = I(character(0))))
  # where R fails on scaled data, the reference (zph_ref) goes into the expected value
  if (!is.null(r$value$error) && !is.null(a$refKind)) r$value$reference <- zph_ref(a)
  c(r$value, list(warnings = r$warnings))
}, ref = function(a) zph_ref(a))
