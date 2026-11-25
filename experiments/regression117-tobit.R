# regression117-tobit.R: how AER::tobit relates to survival::survreg (1.17.0). Candidates, from tobit's help page
# ("a convenience interface to survreg"): left censoring only -> Surv(pmax(y, left), y > left, type = "left");
# right only -> Surv(pmin(y, right), y < right) (right censoring); both -> Surv(lower, upper, type = "interval2")
# with lower = NA where y <= left and upper = NA where y >= right. Each candidate is compared with tobit's
# coefficients, log scale, log-likelihoods (model and null), iterations and variance. Also recorded: the fields of
# tobit and of its summary (the Wald test), what happens to y below left / above right, dist = "t" with df, and the
# McFadden R^2 and likelihood-ratio test of ReactiveStat (null model y ~ 1).
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages({ library(survival); library(AER) })
out <- list(R = R.version.string, arch = R.version$arch, AER = as.character(packageVersion("AER")),
            survival = as.character(packageVersion("survival")))
set.seed(20261125)
n <- 80
x1 <- rnorm(n); x2 <- rbinom(n, 1, 0.4)
ys <- 0.5 + 1.2 * x1 - 0.8 * x2 + rnorm(n, 0, 1.3)
yl <- pmax(ys, 0)                 # left censored at 0
yb <- pmin(pmax(ys, -0.5), 2)     # censored at -0.5 and 2
d <- data.frame(x1, x2, ys, yl, yb)
assign("d", d, envir = globalenv())

summ_fit <- function(f) list(coef = unname(coef(f)), names = names(coef(f)), logscale = log(f$scale),
                             loglik = unname(f$loglik), iter = f$iter, var = unname(f$var), df = f$df,
                             n = unname(nrow(d)))
cmp <- function(a, b) max(abs(c(coef(a) - coef(b), log(a$scale) - log(b$scale), a$loglik - b$loglik, a$var - b$var)))

cases <- list(
  list(name = "left0", y = "yl", left = 0, right = Inf),
  list(name = "left0_raw", y = "ys", left = 0, right = Inf),
  list(name = "both", y = "yb", left = -0.5, right = 2),
  list(name = "both_raw", y = "ys", left = -0.5, right = 2),
  list(name = "right2", y = "ys", left = -Inf, right = 2),
  list(name = "none", y = "ys", left = -Inf, right = Inf)
)
res <- list()
for (cs in cases) {
  fml <- as.formula(paste(cs$y, "~ x1 + x2"))
  for (dname in c("gaussian", "logistic", "t")) {
    ft <- tryCatch(tobit(fml, left = cs$left, right = cs$right, dist = dname, data = d), error = function(e) e)
    if (inherits(ft, "error")) { res[[paste(cs$name, dname)]] <- list(error = conditionMessage(ft)); next }
    yy <- d[[cs$y]]
    lo <- ifelse(yy <= cs$left, NA, yy); hi <- ifelse(yy >= cs$right, NA, yy)
    lo2 <- ifelse(yy <= cs$left, cs$left, ifelse(yy >= cs$right, cs$right, yy))
    cand <- list()
    # A: interval2 with NA ends
    sA <- tryCatch(survreg(Surv(lo, hi, type = "interval2") ~ x1 + x2, data = d, dist = dname), error = function(e) e)
    cand$interval2_na <- if (inherits(sA, "error")) conditionMessage(sA) else cmp(ft, sA)
    # B: left-type Surv on the clipped values (only meaningful without a right limit)
    if (!is.finite(cs$right)) {
      sB <- tryCatch(survreg(Surv(lo2, yy > cs$left, type = "left") ~ x1 + x2, data = d, dist = dname), error = function(e) e)
      cand$left_type <- if (inherits(sB, "error")) conditionMessage(sB) else cmp(ft, sB)
    }
    if (!is.finite(cs$left)) {
      sC <- tryCatch(survreg(Surv(lo2, yy < cs$right) ~ x1 + x2, data = d, dist = dname), error = function(e) e)
      cand$right_type <- if (inherits(sC, "error")) conditionMessage(sC) else cmp(ft, sC)
    }
    # null model, McFadden and the likelihood-ratio test (ReactiveStat)
    f0 <- tobit(as.formula(paste(cs$y, "~ 1")), left = cs$left, right = cs$right, dist = dname, data = d)
    st <- summary(ft)
    res[[paste(cs$name, dname)]] <- list(
      fit = summ_fit(ft), class = class(ft), fields = names(ft), call = format(ft$call),
      yfield = if (!is.null(ft$y)) as.matrix(ft$y)[1:6, , drop = FALSE] else NULL,
      summary_fields = names(st), coefficients = matrix(as.numeric(st$coefficients), nrow(st$coefficients)), coef_rows = rownames(st$coefficients),
      wald = if (!is.null(st$wald)) as.numeric(st$wald) else NULL,
      null_loglik = as.numeric(logLik(f0)), loglik = as.numeric(logLik(ft)), logLik_df = attr(logLik(ft), "df"),
      mcfadden = 1 - as.numeric(logLik(ft)) / as.numeric(logLik(f0)),
      icoef_vs_null = max(abs(ft$icoef - c(coef(f0), log(f0$scale)))),
      loglik1_vs_null = ft$loglik[1] - as.numeric(logLik(f0)),
      ncens = c(left = sum(d[[cs$y]] <= cs$left), right = sum(d[[cs$y]] >= cs$right)),
      candidates = cand)
  }
}
out$cases <- res
# t with other df, and printed output of summary for the field names of the Wald statistic
ft5 <- tobit(yl ~ x1 + x2, dist = "t", parms = 5, data = d)
out$t_parms5 <- list(fit = summ_fit(ft5), parms = ft5$parms)
out$t_df3 <- tryCatch({ ft3 <- tobit(yl ~ x1 + x2, dist = "t", df = 3, data = d); list(fit = summ_fit(ft3), parms = ft3$parms) },
                      error = function(e) list(error = conditionMessage(e)))
out$print_summary <- capture.output(print(summary(tobit(yl ~ x1 + x2, data = d))))
out$print_fit <- capture.output(print(tobit(yl ~ x1 + x2, data = d)))
cat(toJSON(out, digits = 17, auto_unbox = TRUE, na = "null", null = "null"))
