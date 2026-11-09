# oracle-platform: amd64
source("/oracle/_anova.R")
suppressPackageStartupMessages(library(cmprsk))

# Cumulative incidence (competing risks) and Gray's test: cmprsk::cuminc and cmprsk::timepoints (fixture cuminc).
# Behaviour in oracle/competing-behaviour.md. The API of rStats.js is not decided yet, so the fixture keeps R's
# argument names.
#   Arguments: ftime, fstatus (numbers, or strings when fstatusType is "character"), and optionally group, strata
#   (labels, numbers or strings; "NA" for a missing number), rho, cencode, subset (booleans), timepoints (times at
#   which timepoints() is evaluated), naFail (TRUE: na.action = na.fail).
#   Written: curves (one per group and cause in R's order: name as R gives it, time, est, var), tests (absent with one
#   group: cause, stat, pv, df), omitted (the number in R's message "<k> cases omitted due to missing values", 0 when
#   none), timepoints ({ est, var }: one array per curve, "NA" where R gives NA; only with the timepoints argument),
#   warnings. Errors as {"error": message}.
#   reference (some cases): the variance computed exactly (rational arithmetic, gmp) from the formula of the
#   behaviour document, for curves where R's value is a rounding remnant of an exact 0; refKind says so.

set.seed(20261109)
cases <- list()
add <- function(...) cases[[length(cases) + 1]] <<- list(...)

# the example of the help page (ties: rexp(100) has none, but sample() gives 3 groups, 2 strata)
set.seed(2)
ss <- rexp(100); gg <- c("a", "b", "c")[sample(1:3, 100, replace = TRUE)]; cc <- sample(0:2, 100, replace = TRUE)
strt <- sample(1:2, 100, replace = TRUE)
add(ftime = I(ss), fstatus = I(cc), group = I(gg), strata = I(strt))
add(ftime = I(ss), fstatus = I(cc), group = I(gg))
add(ftime = I(ss), fstatus = I(cc))
add(ftime = I(ss), fstatus = I(cc), group = I(gg), timepoints = I(c(0, 0.25, 0.5, 1, 2, 3, 10)))
set.seed(20261109)
# untied data: 2 and 3 groups, rho, strata, three causes, another cencode
u1 <- list(t = round(rexp(80, 0.2), 6), s = sample(0:2, 80, TRUE, prob = c(0.3, 0.4, 0.3)), g = sample(1:2, 80, TRUE))
add(ftime = I(u1$t), fstatus = I(u1$s), group = I(u1$g))
for (rho in c(-1, 0.5, 1, 2)) add(ftime = I(u1$t), fstatus = I(u1$s), group = I(u1$g), rho = rho)
u2 <- list(t = round(rexp(150, 0.1), 5), s = sample(0:3, 150, TRUE), g = sample(c("x", "y", "z"), 150, TRUE),
           st = sample(c("s1", "s2", "s3"), 150, TRUE))
add(ftime = I(u2$t), fstatus = I(u2$s), group = I(u2$g))
add(ftime = I(u2$t), fstatus = I(u2$s), group = I(u2$g), strata = I(u2$st))
add(ftime = I(u2$t), fstatus = I(u2$s), group = I(u2$g), strata = I(u2$st), rho = 1)
add(ftime = I(u2$t), fstatus = I(c(9, 1, 2, 3)[u2$s + 1]), group = I(u2$g), cencode = 9)
add(ftime = I(u2$t), fstatus = I(c("cens", "local", "distant", "death")[u2$s + 1]), fstatusType = "character",
    group = I(u2$g), cencode = "cens")
add(ftime = I(u1$t), fstatus = I(u1$s), group = I(u1$g), subset = I(u1$t > 1))
# scaled times (powers of 2): every value must be unchanged
add(ftime = I(u1$t * 2^-40), fstatus = I(u1$s), group = I(u1$g))
add(ftime = I(u1$t * 2^40), fstatus = I(u1$s), group = I(u1$g))
# tied times (integer days): the curves are exact; Gray's test with ties is not fully determined (see the document)
tt <- list(t = sample(1:12, 90, TRUE), s = sample(0:2, 90, TRUE), g = sample(1:2, 90, TRUE))
add(ftime = I(tt$t), fstatus = I(tt$s), group = I(tt$g))
add(ftime = I(tt$t), fstatus = I(tt$s), group = I(tt$g), rho = 1)
add(ftime = I(tt$t), fstatus = I(tt$s), group = I(tt$g), timepoints = I(c(-1, 0, 1, 1.5, 6, 12, 13)))
add(ftime = I(c(1, 1, 2, 2, 3, 3, 4)), fstatus = I(rep(1, 7)), group = I(c(1, 2, 1, 1, 2, 2, 1)))
add(ftime = I(c(1, 2, 2, 3, 3)), fstatus = I(c(1, 1, 1, 0, 0)), group = I(c(1, 1, 2, 2, 1)))
add(ftime = I(c(1, 1, 2)), fstatus = I(c(1, 1, 0)), group = I(c(1, 2, 1)))
# the tie formula of the variance (several causes at one time, censored at an event time)
add(ftime = I(c(1, 1, 1, 2, 2, 2, 2, 3, 3, 4)), fstatus = I(c(1, 2, 0, 1, 1, 2, 3, 0, 1, 2)))
add(ftime = I(c(0, 0, 1, 1, 1, 2, 3, 3)), fstatus = I(c(1, 2, 2, 1, 0, 1, 1, 2)))
# boundaries
add(ftime = 5, fstatus = 1)                                                       # one observation
add(ftime = I(rep(1, 4)), fstatus = I(c(1, 1, 2, 1)))                             # all at one time
add(ftime = I(1:5), fstatus = I(rep(1, 5)), refExact = TRUE)                      # one at risk at the end, F = 1
add(ftime = I(c(1, 2, 3, 3, 3)), fstatus = I(c(2, 1, 1, 1, 1)), refExact = TRUE)  # all remaining fail together
add(ftime = I(c(1, 2, 3, 4, 10)), fstatus = I(c(1, 2, 1, 0, 0)))                  # last time censored
add(ftime = I(1:8), fstatus = I(c(1, 2, 1, 0, 1, 1, 0, 1)), group = I(c(2, 2, 2, 2, 1, 1, 1, 1)))  # a group without cause 2
add(ftime = I(c(0.5, 0.6, 1:10)), fstatus = I(c(0, 0, 1, 2, 1, 0, 1, 2, 1, 1, 0, 1)),
    group = I(c(3, 3, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2)))                              # singular test: stat -1
add(ftime = I(c(1:5, 1:5)), fstatus = I(c(1, 2, 1, 0, 1, 1, 2, 1, 0, 1)), group = I(rep(1:2, each = 5)))  # z = 0
add(ftime = I(1:6), fstatus = I(c(1, 0, 1, 0, 1, 1)), group = I(c(1, 1, 1, 2, 2, 2)))  # one cause only
add(ftime = I(1:30), fstatus = I(c(rep(c(1, 2, 0), 10))), group = I(rep(1:3, 10)), strata = I(c(rep(1, 10), rep(2, 20))))
gs <- sample(1:3, 30, TRUE); add(ftime = I(sample(30)), fstatus = I(sample(0:2, 30, TRUE)), group = I(gs),
                               strata = I(ifelse(gs == 3, 2, sample(1:2, 30, TRUE))))  # a stratum without group 3
add(ftime = I(c(1, 2, NA, 4, 5, 6)), fstatus = I(c(1, 2, 1, NA, 1, 0)), group = I(c(1, 1, 2, 2, NA, 2)))  # missing values
add(ftime = I(c(1, 2, NA, 4)), fstatus = I(c(1, 2, 1, 0)), naFail = TRUE)
add(ftime = I(c(-3, -1, 2, 4)), fstatus = I(c(1, 2, 1, 0)))                       # negative times: R starts at 0
add(ftime = I(c(0, 2, 3, Inf)), fstatus = I(c(1, 2, 1, 1)))                      # error
add(ftime = I(c(1, 2, 3)), fstatus = I(c(0, 0, 0)))                               # no events: error
add(ftime = I(1:4), fstatus = I(c(1, 2, 1, 1)), group = I(c(1, 2, 1, 2)), rho = NA_real_)   # error
add(ftime = I(c(1, 2, 3, 4, 5, 6)), fstatus = I(c(1, 2, 1, 0, 1, 2)), group = I(c(1, 1, 1, 2, 2, 2)),
    timepoints = I(c(0, 0.5, 1, 2.5, 3, 5, 6, 7, 100)))
add(ftime = I(c(1, 2, 3, 4, 5, 6)), fstatus = I(c(1, 2, 1, 0, 1, 2)), timepoints = I(c(6, 3, 3, NA, 2)))

# exact variance of the formula in the behaviour document (sum form), with big rationals
exact_var <- function(t, s, cause, cencode = 0) {
  ut <- sort(unique(t[s != cencode])); S <- as.bigq(1); Fv <- list(); Y <- d <- dk <- integer(length(ut)); Sm <- list()
  Fc <- as.bigq(0)
  for (j in seq_along(ut)) {
    Y[j] <- sum(t >= ut[j]); d[j] <- sum(t == ut[j] & s != cencode); dk[j] <- sum(t == ut[j] & s == cause)
    Sm[[j]] <- S; Fc <- Fc + S * as.bigq(dk[j], Y[j]); Fv[[j]] <- Fc; S <- S * as.bigq(Y[j] - d[j], Y[j])
  }
  vapply(seq_along(ut), function(i) {
    v <- as.bigq(0)
    for (l in seq_len(i)) {
      D <- Fv[[i]] - Fv[[l]]
      a <- if (Y[l] == d[l]) as.bigq(0) else as.bigq(d[l] * (Y[l] - d[l]) + 2 * dk[l] * (d[l] - dk[l]), (Y[l] - 1) * (Y[l] - d[l])^2)
      b <- if (Y[l] == 1) as.bigq(dk[l]) else as.bigq(dk[l] * (Y[l] - dk[l]), Y[l]^2 * (Y[l] - 1))
      cc <- if (Y[l] == d[l] || Y[l] == 1) as.bigq(0) else as.bigq(dk[l] * (Y[l] - dk[l]), Y[l] * (Y[l] - d[l]) * (Y[l] - 1))
      v <- v + D^2 * a + Sm[[l]]^2 * b - 2 * D * Sm[[l]] * cc
    }
    Rmpfr::asNumeric(Rmpfr::mpfr(v, 300))
  }, 0)
}

run <- function(a) {
  ftime <- unclass(a$ftime); fstatus <- unclass(a$fstatus)
  args <- list(ftime, fstatus)
  if (!is.null(a$group)) args$group <- unclass(a$group)
  if (!is.null(a$strata)) args$strata <- unclass(a$strata)
  if (!is.null(a$rho)) args$rho <- a$rho
  if (!is.null(a$cencode)) args$cencode <- a$cencode
  if (!is.null(a$subset)) args$subset <- unclass(a$subset)
  if (isTRUE(a$naFail)) args$na.action <- na.fail
  out <- capture.output(r <- do.call(cuminc, args))
  om <- regmatches(out, regexpr("^[0-9]+(?= cases omitted)", out, perl = TRUE))
  curves <- lapply(names(r)[names(r) != "Tests"], function(nm) {
    x <- r[[nm]]
    list(name = nm, time = I(num2str(x$time)), est = I(num2str(x$est)), var = I(num2str(x$var)))
  })
  res <- list(curves = curves)
  if (!is.null(r$Tests)) {
    tb <- r$Tests
    res$tests <- lapply(seq_len(nrow(tb)), function(i)
      list(cause = rownames(tb)[i], stat = num2str(tb[i, "stat"]), pv = num2str(tb[i, "pv"]), df = num2str(tb[i, "df"])))
  }
  res$omitted <- if (length(om)) as.integer(om) else 0L
  if (!is.null(a$timepoints)) {
    tp <- timepoints(r, unclass(a$timepoints))
    res$timepoints <- list(times = I(colnames(tp$est)),
                           est = lapply(seq_len(nrow(tp$est)), function(i) I(num2str(tp$est[i, ]))),
                           var = lapply(seq_len(nrow(tp$var)), function(i) I(num2str(tp$var[i, ]))))
  }
  res
}

write_anova_fixture("cuminc", cases, function(a) {
  r <- tryCatch(with_warnings(function() run(a)),
                error = function(e) list(value = list(error = conditionMessage(e)), warnings = I(character(0))))
  c(r$value, list(warnings = r$warnings))
}, ref = function(a) {
  if (!isTRUE(a$refExact)) return(NULL)
  t <- unclass(a$ftime); s <- unclass(a$fstatus)
  causes <- sort(unique(s[s != 0]))
  list(refKind = "exact variance (gmp rationals) at the distinct event times of each cause, single group",
       var = lapply(causes, function(k) list(cause = num2str(k), time = I(num2str(sort(unique(t[s != 0])))),
                                              var = I(num2str(exact_var(t, s, k))))))
})
