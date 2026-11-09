source("/oracle/_anova.R")
suppressPackageStartupMessages(library(survival))

# survfit, continued (ROADMAP item 1): the cumulative hazard (Nelson-Aalen, Fleming-Harrington), ctype/stype, the
# conf.type variants, case weights (integer: weighted counts; non-integer: R's default robust variance), and the table
# of summary(fit)$table (records, n.max, n.start, events, rmean, se(rmean), median and its limits) with the rmean
# options. Behaviour in oracle/survfit2-behaviour.md.
#
#   Arguments (R's names, the API is not decided): time, status (1 event, 0 censored), and optionally group (labels;
#   one curve per group, R's strata names "group=a"), weights, ctype (1, 2), stype (1, 2), conf.type ("log",
#   "log-log", "plain", "logit", "arcsin", "none"), conf.int, robust (TRUE/FALSE; absent = R's default), rmean
#   ("none", "common", "individual" or a number, written as a string; absent = R's default, which is "common" for the
#   table), scale (summary's scale), refKind (see below).
#   Expected: the rows of the fit (every distinct time, censored ones included, curves pasted end to end): strata,
#   time, n.risk, n.event, n.censor, surv, std.err (the fit's: the standard error of log S, or of S when logse is
#   false), cumhaz, std.chaz, lower, upper (absent for conf.type "none"); logse; n (fit$n, unweighted per curve);
#   counts (unweighted n.risk, n.event, n.censor; present when there are weights); summary.std.err (std.err of
#   summary(fit, censored = TRUE), the standard error of S); table (summary(fit, rmean, scale)$table as {colNames,
#   rowNames, table}; rowNames "all" for a single curve); warnings. Errors as {"error": message}.
#   refKind, with a "reference" holding what rStats.js may return instead:
#     "scaled"      times * 2^1000: R's se(rmean) overflows to NaN; reference table = 2^1000 times the table of the
#                   unscaled data (records, n.max, n.start, events unscaled)
#     "robustStype2" stype = 2 with the robust variance: R's std.err is the standard error of the cumulative hazard
#                   but is treated as that of S (logse FALSE); reference summary.std.err = S * std.chaz and lower/upper
#                   from the formulas of conf.type with the standard error of log S = std.chaz
#     "rmeanBelowMin" a numeric rmean in [t0, min(time)): R stops; reference table with rmean = the area from t0 to
#                   rmean (= rmean - t0, S = 1 there) and se(rmean) = 0

set.seed(20261109)
mk <- function(n, rate, cens, digits = 1) {
  t <- rexp(n, rate); c <- rexp(n, cens)
  list(time = round(pmin(t, c), digits) + 10^-digits, status = as.integer(t <= c))
}
small <- list(time = c(1, 2, 2, 2, 3, 4, 4, 5, 6, 6, 7, 8), status = c(1, 1, 1, 0, 1, 1, 0, 1, 1, 1, 0, 1))
wInt <- c(2, 1, 3, 1, 1, 2, 1, 1, 1, 2, 1, 1)
a <- mk(25, 0.10, 0.03, 0); b <- mk(30, 0.06, 0.03, 0); cc <- mk(20, 0.15, 0.05, 0)
two <- list(time = c(a$time, b$time), status = c(a$status, b$status), group = rep(c("a", "b"), c(25, 30)))
three <- list(time = c(a$time, b$time, cc$time), status = c(a$status, b$status, cc$status),
              group = rep(c("a", "b", "c"), c(25, 30, 20)))
lung1 <- list(time = lung$time, status = lung$status - 1L, group = ifelse(lung$sex == 1, "male", "female"))
half <- list(time = c(1, 2, 3, 4, 1, 2, 2, 5, 6, 6), status = c(1, 1, 1, 1, 1, 1, 0, 1, 1, 1), group = rep(c("p", "q"), c(4, 6)))
cont <- mk(40, 0.2, 0.05, 3)                                                # few ties
neg <- list(time = small$time - 3, status = small$status)                  # negative times: t0 = min(time)
zero <- list(time = c(0, 0, 1, 2, 3, 3, 4), status = c(1, 0, 1, 1, 0, 1, 1)) # events at time 0
lastCens <- list(time = c(1, 2, 3, 3, 5, 8), status = c(1, 0, 1, 1, 1, 0))

cases <- list()
add <- function(d, ...) {
  a <- list(time = I(d$time), status = I(d$status))
  if (!is.null(d$group)) a$group <- I(d$group)
  cases[[length(cases) + 1]] <<- c(a, list(...))
}

# the ctype x stype x conf.type grid
for (d in list(small, two, half)) for (ct in 1:2) for (st in 1:2)
  for (cf in c("log", "log-log", "plain", "logit", "arcsin", "none")) add(d, ctype = ct, stype = st, conf.type = cf)
for (d in list(three, lung1, cont, neg, zero, lastCens)) for (ct in 1:2) for (st in 1:2) add(d, ctype = ct, stype = st)
for (cf in c("logit", "arcsin")) add(lung1, conf.type = cf)
add(two, conf.int = 0.9, conf.type = "logit"); add(small, conf.int = 0.99, stype = 2, conf.type = "log-log")

# boundaries
add(list(time = 5, status = 1)); add(list(time = 5, status = 0)); add(list(time = 5, status = 1), ctype = 2, stype = 2)
add(list(time = c(1, 2, 3), status = c(0, 0, 0)), conf.type = "log-log"); add(list(time = c(1, 2, 3), status = c(0, 0, 0)), conf.type = "logit")
add(list(time = c(1, 2, 3), status = c(0, 0, 0)), conf.type = "arcsin")
for (ct in 1:2) for (st in 1:2) add(list(time = c(2, 2, 2), status = c(1, 1, 1)), ctype = ct, stype = st)
add(list(time = c(2, 2, 2, 3), status = c(1, 1, 1, 1)), ctype = 2, conf.type = "plain")
add(list(time = c(1, 1, 1, 2, 2, 3, 3, 3, 3), status = c(1, 1, 0, 1, 1, 1, 1, 1, 1)), ctype = 2)

# weights
for (ct in 1:2) for (st in 1:2) add(small, weights = I(wInt), ctype = ct, stype = st)
add(c(two, list()), weights = I(rep(c(1, 2, 3), length.out = 55)), ctype = 2)
wHalf <- wInt * 0.5
for (ct in 1:2) add(small, weights = I(wHalf), ctype = ct)                                        # robust (default)
for (cf in c("log", "log-log", "plain", "logit", "arcsin")) add(small, weights = I(wHalf), conf.type = cf)
for (ct in 1:2) add(small, weights = I(wHalf), ctype = ct, robust = FALSE)
for (ct in 1:2) add(small, weights = I(wInt), ctype = ct, robust = TRUE)
add(small, robust = TRUE)
wFrac <- round(runif(55, 0.2, 3), 2)
add(two, weights = I(wFrac)); add(two, weights = I(wFrac), ctype = 2); add(two, weights = I(wFrac), robust = FALSE)
for (cf in c("log", "log-log", "plain")) add(small, weights = I(wHalf), stype = 2, conf.type = cf, refKind = "robustStype2")
add(two, weights = I(wFrac), stype = 2, refKind = "robustStype2")
w0 <- wInt; w0[c(3, 11)] <- 0; add(small, weights = I(w0)); add(small, weights = I(w0), ctype = 2)
w0b <- wInt; w0b[12] <- 0; add(small, weights = I(w0b))                                          # n.risk 0 rows
add(c(small, list(group = rep(c("a", "b"), 6))), weights = I(rep(c(1, 0), 6)))                     # a group of zero weight
add(small, weights = I(rep(0, 12)))
add(small, weights = I(-wInt)); add(small, weights = I(replace(wInt, 1, Inf))); add(small, weights = I(replace(wInt, 1, NA)))

# rmean
for (rm in list("none", "common", "individual", 8, 5.5, 3, 1, 1.5, 10, 6))
  add(c(small, list(group = rep(c("a", "b"), 6))), rmean = if (is.numeric(rm)) rm else rm)
for (rm in list("common", "individual", 5, 1000)) add(three, rmean = rm)
for (rm in list(8, 5.5, 3, 1, 1.0000001, 10)) add(small, rmean = rm)
add(small, rmean = 0.5, refKind = "rmeanBelowMin"); add(small, rmean = 0, refKind = "rmeanBelowMin")
add(c(small, list(group = rep(c("a", "b"), 6))), rmean = 0.25, refKind = "rmeanBelowMin")
add(small, rmean = -1); add(small, rmean = "foo")
add(list(time = c(0.5, small$time), status = c(0, small$status)), rmean = 0.5)
for (rm in list(-2.5, -2, -1, 0, 1, "common")) add(neg, rmean = rm)
add(zero, rmean = 4); add(lastCens); add(lastCens, rmean = 6); add(lastCens, rmean = 10)
add(c(small, list(group = rep(c("a", "b"), 6))), rmean = 5, scale = 2)
add(small, weights = I(wInt), rmean = 6); add(small, weights = I(wHalf), rmean = 6); add(small, weights = I(wHalf), stype = 2, rmean = 6)
add(small, stype = 2, rmean = "common"); add(small, ctype = 2, stype = 2, rmean = 7)
add(two, conf.type = "none"); add(two, conf.int = 0.9)

# scaled times
for (k in c(-20, 20)) add(list(time = small$time * 2^k, status = small$status), stype = 2)
add(list(time = small$time * 2^1000, status = small$status), refKind = "scaled")

# argument errors
add(small, ctype = 3); add(small, stype = 0); add(small, conf.int = 1); add(small, conf.int = 0); add(small, conf.type = "foo")

table_out <- function(tab) {
  if (is.null(dim(tab))) tab <- t(as.matrix(tab))
  list(colNames = I(colnames(tab)), rowNames = I(if (is.null(rownames(tab))) "all" else rownames(tab)),
       table = lapply(seq_len(nrow(tab)), function(i) I(num2str(unname(tab[i, ])))))
}
fit_of <- function(a) {
  df <- data.frame(time = unclass(a$time), status = unclass(a$status))
  if (!is.null(a$group)) df$group <- unclass(a$group)
  args <- list(formula = if (is.null(a$group)) Surv(time, status) ~ 1 else Surv(time, status) ~ group, data = df)
  if (!is.null(a$weights)) { df$w <- unclass(a$weights); args$data <- df; args$weights <- quote(w) }
  for (nm in c("ctype", "stype", "conf.type", "conf.int", "robust")) if (!is.null(a[[nm]])) args[[nm]] <- a[[nm]]
  do.call(survfit, args)
}
summary_args <- function(a) {
  s <- list()
  if (!is.null(a$rmean)) s$rmean <- a$rmean
  if (!is.null(a$scale)) s$scale <- a$scale
  s
}
# Confidence limits from S and the standard error of log S, as survival's conf.type formulas (section 3 of the document)
limits <- function(S, se, type, level) {
  z <- qnorm(1 - (1 - level) / 2); sp <- S * se
  r <- switch(type,
    log = cbind(S * exp(-z * se), pmin(1, S * exp(z * se))),
    "log-log" = cbind(exp(-exp(log(-log(S)) - z * se / log(S))), exp(-exp(log(-log(S)) + z * se / log(S)))),
    plain = cbind(pmax(0, S - z * sp), pmin(1, S + z * sp)))
  r[S == 0, ] <- NA
  r
}

# As write_htest_fixture, except that the reference is also written for a case where R stops (refKind
# "rmeanBelowMin": R's error is the expected value, the reference what rStats.js may return instead)
write_fixture_with_refs <- function(name, cases, fun, ref) {
  lines <- vapply(cases, function(args) {
    expected <- tryCatch(fun(args), error = function(e) list(error = conditionMessage(e)))
    out <- list(args = lapply(args, arg_json), expected = expected)
    r <- suppressWarnings(ref(args))
    if (!is.null(r)) out$reference <- r
    jsonlite::toJSON(out, auto_unbox = TRUE, digits = NA)
  }, character(1))
  tj <- function(x) jsonlite::toJSON(x, auto_unbox = TRUE)
  writeLines(c("{", sprintf('  "function": %s,', tj(name)), sprintf('  "r_version": %s,', tj(R.version.string)),
               sprintf('  "generated": %s,', tj(format(Sys.time(), "%Y-%m-%dT%H:%M:%S%z"))), '  "cases": [',
               paste0("    ", lines, c(rep(",", length(lines) - 1), "")), "  ]", "}"),
             file.path(HTEST_OUT, paste0(name, ".json")))
  cat(sprintf("%s: %d cases (%d errors) (%s)\n", name, length(lines), sum(grepl('"expected":\\{"error"', lines)), R.version.string))
}

write_fixture_with_refs("survfit2", cases, function(a) {
  r <- with_warnings(function() {
    f <- fit_of(a)
    s <- summary(f, censored = TRUE)
    tab <- do.call(summary, c(list(f), summary_args(a)))$table
    strata <- if (is.null(f$strata)) rep("all", length(f$time)) else rep(names(f$strata), f$strata)
    out <- list(strata = I(strata), time = I(num2str(f$time)), n.risk = I(num2str(f$n.risk)), n.event = I(num2str(f$n.event)),
                n.censor = I(num2str(f$n.censor)), surv = I(num2str(f$surv)), std.err = I(num2str(f$std.err)),
                cumhaz = I(num2str(f$cumhaz)), std.chaz = I(num2str(f$std.chaz)))
    if (!is.null(f$lower)) { out$lower <- I(num2str(f$lower)); out$upper <- I(num2str(f$upper)) }
    out$logse <- f$logse; out$conf.type <- f$conf.type; out$conf.int <- num2str(f$conf.int)
    out$n <- I(num2str(as.vector(f$n)))
    if (!is.null(f$counts)) out$counts <- list(n.risk = I(num2str(f$counts[, 1])), n.event = I(num2str(f$counts[, 2])),
                                               n.censor = I(num2str(f$counts[, 3])))
    out$summary.std.err <- I(num2str(s$std.err))
    out$table <- table_out(tab)
    out
  })
  c(r$value, list(warnings = r$warnings))
}, ref = function(a) {
  if (is.null(a$refKind)) return(NULL)
  if (a$refKind == "scaled") {
    b <- a; b$time <- I(unclass(a$time) / 2^1000)
    tab <- summary(fit_of(b))$table
    sc <- !(names(tab) %in% c("records", "n.max", "n.start", "events"))
    tab[sc] <- tab[sc] * 2^1000
    return(list(table = table_out(tab)))
  }
  if (a$refKind == "robustStype2") {
    f <- fit_of(a)
    lim <- limits(f$surv, f$std.chaz, f$conf.type, f$conf.int)
    # summary(censored = TRUE) has every row of the fit
    return(list(summary.std.err = I(num2str(f$surv * f$std.chaz)), lower = I(num2str(lim[, 1])), upper = I(num2str(lim[, 2]))))
  }
  if (a$refKind == "rmeanBelowMin") {
    f <- fit_of(a)
    tab <- summary(f, rmean = max(f$time))$table
    t0 <- min(0, unclass(a$time))
    if (is.null(dim(tab))) { tab["rmean"] <- a$rmean - t0; tab["se(rmean)"] <- 0 }
    else { tab[, "rmean"] <- a$rmean - t0; tab[, "se(rmean)"] <- 0 }
    return(list(table = table_out(tab)))
  }
  NULL
})
