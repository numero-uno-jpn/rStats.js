source("/oracle/_anova.R")
suppressPackageStartupMessages(library(survival))

# The Kaplan-Meier estimate of counting-process data Surv(start, stop, event) (fixture survfitCounting), for the
# decision whether survfit should accept (start, stop] data (oracle/coxph2-behaviour.md, part C); survdiff's error.
#   survfit   survfit(Surv(start, stop, status) ~ group or ~ 1, id, conf.type, conf.int): the fields of
#             oracle/survival.R (the rows of summary(fit, censored = TRUE): strata, time, n.risk, n.event, n.censor,
#             surv, std.err, lower, upper; median, medianRows) and cumhaz (Nelson-Aalen, summary's cumhaz).
#   survdiff  survdiff(Surv(start, stop, status) ~ group): R's error.
#   Arguments: fn, start, stop, status, and optionally group, id (labels: rows of one subject; a split point is then not
#   a censoring), conf.type ("log" default), conf.int (0.95 default).

set.seed(20261112)
cases <- list()
add <- function(fn, d, ...) cases[[length(cases) + 1]] <<- c(list(fn = fn, start = I(d$start), stop = I(d$stop), status = I(d$status)), list(...))

# right-censored data split at 2, 5 and 10 (the same curve as unsplit; without id each split point is a censoring)
s <- local({ n <- 40; t <- rexp(n, 0.1); c <- rexp(n, 0.04)
  data.frame(id = 1:n, time = round(pmin(t, c), 1) + 0.1, status = as.integer(t <= c), g = rep(c("a", "b"), 20)) })
sp <- survSplit(Surv(time, status) ~ ., s, cut = c(2, 5, 10))
dsp <- list(start = sp$tstart, stop = sp$time, status = sp$status)
add("survfit", dsp); add("survfit", dsp, id = I(sp$id)); add("survfit", dsp, group = I(sp$g)); add("survfit", dsp, group = I(sp$g), id = I(sp$id))
# delayed entry (left truncation), tied boundaries, a curve that reaches 0, a time with nobody at risk in between
de <- list(start = c(0, 0, 3, 3, 5, 1, 2, 0, 4, 6), stop = c(4, 6, 7, 9, 8, 2, 4, 3, 6, 10), status = c(1, 0, 1, 1, 0, 1, 1, 0, 1, 1))
for (ct in c("log", "plain", "log-log")) add("survfit", de, conf.type = ct)
add("survfit", de, conf.int = 0.9)
gap <- list(start = c(0, 0, 0, 5, 5, 6), stop = c(1, 2, 3, 7, 8, 9), status = c(1, 0, 1, 1, 0, 1))
add("survfit", gap)
neg <- de; neg$start <- neg$start - 20; neg$stop <- neg$stop - 20; add("survfit", neg)
# the heart transplant data, by surgery
add("survfit", list(start = heart$start, stop = heart$stop, status = heart$event), id = I(heart$id))
add("survfit", list(start = heart$start, stop = heart$stop, status = heart$event), group = I(ifelse(heart$surgery == 1, "yes", "no")), id = I(heart$id))
add("survdiff", dsp, group = I(sp$g))

write_anova_fixture("survfitCounting", cases, function(a) {
  df <- data.frame(start = unclass(a$start), stop = unclass(a$stop), status = unclass(a$status))
  if (!is.null(a$group)) df$group <- unclass(a$group)
  if (!is.null(a$id)) df$id <- unclass(a$id)
  r <- tryCatch(with_warnings(function() {
    if (a$fn == "survdiff") {
      survdiff(Surv(start, stop, status) ~ group, df)
      list(error = "no error")
    } else {
      fml <- if (is.null(a$group)) Surv(start, stop, status) ~ 1 else Surv(start, stop, status) ~ group
      args <- list(fml, data = df, conf.type = if (is.null(a$conf.type)) "log" else a$conf.type,
                   conf.int = if (is.null(a$conf.int)) 0.95 else a$conf.int)
      if (!is.null(a$id)) args$id <- quote(id)
      f <- do.call(survfit, args)
      s <- summary(f, censored = TRUE)
      strata <- if (is.null(s$strata)) rep("all", length(s$time)) else as.character(s$strata)
      tab <- summary(f)$table; if (is.null(dim(tab))) tab <- t(as.matrix(tab))
      list(strata = I(strata), time = I(num2str(s$time)), n.risk = I(num2str(s$n.risk)), n.event = I(num2str(s$n.event)),
           n.censor = I(num2str(s$n.censor)), surv = I(num2str(s$surv)), std.err = I(num2str(s$std.err)),
           lower = I(num2str(s$lower)), upper = I(num2str(s$upper)), cumhaz = I(num2str(s$cumhaz)),
           median = lapply(seq_len(nrow(tab)), function(i) I(num2str(tab[i, c("median", grep("LCL$", colnames(tab), value = TRUE), grep("UCL$", colnames(tab), value = TRUE))]))),
           medianRows = I(if (is.null(rownames(tab))) "all" else rownames(tab)))
    }
  }), error = function(e) list(value = list(error = conditionMessage(e)), warnings = I(character(0))))
  c(r$value, list(warnings = r$warnings))
})
