source("/oracle/_anova.R")
suppressPackageStartupMessages(library(survival))

# Survival analysis (ROADMAP): the log-rank test and the Kaplan-Meier estimate.
#   survdiff   survdiff(Surv(time, status) ~ group, rho): n, obs, exp, var (matrix), chisq, pvalue (pchisq upper tail
#              on number of groups - 1 df). rho = 0 log-rank, 1 Peto & Peto.
#   survfit    survfit(Surv(time, status) ~ group or ~ 1, conf.type, conf.int): for each stratum (strata names as R's,
#              "group=a") the rows of summary(fit, censored = TRUE): time, n.risk, n.event, n.censor, surv, std.err,
#              lower, upper; and the median (summary(fit)$table "median", "0.95LCL", "0.95UCL").
# status: 1 = event, 0 = censored.

set.seed(20261122)
mk <- function(n, rate, cens) {
  t <- rexp(n, rate); c <- rexp(n, cens)
  list(time = round(pmin(t, c), 1) + 0.1, status = as.integer(t <= c))
}
a <- mk(25, 0.10, 0.03); b <- mk(30, 0.06, 0.03); cc <- mk(20, 0.15, 0.05)
two <- list(time = c(a$time, b$time), status = c(a$status, b$status), group = rep(c("a", "b"), c(25, 30)))
three <- list(time = c(a$time, b$time, cc$time), status = c(a$status, b$status, cc$status),
              group = rep(c("a", "b", "c"), c(25, 30, 20)))
tied <- list(time = c(1, 2, 2, 3, 3, 3, 4, 5, 5, 6, 2, 2, 3, 4, 4, 5, 6, 6, 7, 8),
             status = c(1, 1, 0, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1), group = rep(c("x", "y"), each = 10))
lung1 <- list(time = lung$time, status = lung$status - 1L, group = ifelse(lung$sex == 1, "male", "female"))

cases <- list()
for (d in list(two, three, tied, lung1)) {
  for (rho in c(0, 1, 0.5)) cases[[length(cases) + 1]] <- list(fn = "survdiff", time = I(d$time), status = I(d$status), group = I(d$group), rho = rho)
  for (ct in c("log", "plain", "log-log")) {
    cases[[length(cases) + 1]] <- list(fn = "survfit", time = I(d$time), status = I(d$status), group = I(d$group), conf.type = ct)
    cases[[length(cases) + 1]] <- list(fn = "survfit", time = I(d$time), status = I(d$status), conf.type = ct)
  }
  cases[[length(cases) + 1]] <- list(fn = "survfit", time = I(d$time), status = I(d$status), group = I(d$group), conf.type = "log", conf.int = 0.9)
}

write_anova_fixture("survival", cases, function(a) {
  df <- data.frame(time = unclass(a$time), status = unclass(a$status))
  if (!is.null(a$group)) df$group <- unclass(a$group)
  r <- with_warnings(function() {
    if (a$fn == "survdiff") {
      v <- survdiff(Surv(time, status) ~ group, df, rho = a$rho)
      list(n = I(num2str(as.vector(v$n))), groups = I(names(v$n)), obs = I(num2str(v$obs)), exp = I(num2str(v$exp)),
           var = lapply(seq_len(nrow(v$var)), function(i) I(num2str(v$var[i, ]))), chisq = num2str(v$chisq),
           pvalue = num2str(pchisq(v$chisq, length(v$n) - 1, lower.tail = FALSE)))
    } else {
      f <- if (is.null(a$group)) survfit(Surv(time, status) ~ 1, df, conf.type = a$conf.type, conf.int = if (is.null(a$conf.int)) 0.95 else a$conf.int)
           else survfit(Surv(time, status) ~ group, df, conf.type = a$conf.type, conf.int = if (is.null(a$conf.int)) 0.95 else a$conf.int)
      s <- summary(f, censored = TRUE)
      strata <- if (is.null(s$strata)) rep("all", length(s$time)) else as.character(s$strata)
      tab <- summary(f)$table; if (is.null(dim(tab))) tab <- t(as.matrix(tab))
      list(strata = I(strata), time = I(num2str(s$time)), n.risk = I(num2str(s$n.risk)), n.event = I(num2str(s$n.event)),
           n.censor = I(num2str(s$n.censor)), surv = I(num2str(s$surv)), std.err = I(num2str(s$std.err)),
           lower = I(num2str(s$lower)), upper = I(num2str(s$upper)),
           median = lapply(seq_len(nrow(tab)), function(i) I(num2str(tab[i, c("median", grep("LCL$", colnames(tab), value = TRUE), grep("UCL$", colnames(tab), value = TRUE))]))),
           medianRows = I(if (is.null(rownames(tab))) "all" else rownames(tab)))
    }
  })
  c(r$value, list(warnings = r$warnings))
})
