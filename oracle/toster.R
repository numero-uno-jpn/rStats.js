# oracle-memory: 1g
source("/oracle/_htest.R")

# Equivalence and minimal-effect t tests: TOSTER::t_TOST (fixture tTOST). See oracle/methodcomparison-behaviour.md,
# section 4.
#
# Arguments: x, y (absent for one sample), and where given (R's names in camelCase) paired, varEqual, eqb,
# lowEqbound, highEqbound, hypothesis, eqboundType, alpha, mu, biasCorrection, rmCorrection, glass, smdCi.
# Expected:
#   TOST       rows "t-test", "TOST Lower", "TOST Upper": [t, SE, df, p.value]
#   eqb        [type, low_eq, high_eq] for the raw scale and the SMD scale (type is the SMD's label)
#   effsize    rows "Raw" and the SMD's label: [estimate, SE, lower.ci, upper.ci, conf.level]
#   smd        TOSTER's internal SMD list: d, d_df, dlow, dhigh, d_sigma, d_lambda, J, d_denom, ntilde, t_stat
#              ("NA" when absent), smd_label, smd_ci
#   method     the t test's method ("Welch Two Sample t-test", " Two Sample t-test", "Paired t-test",
#              "One Sample t-test"); hypothesis ("Hypothesis Tested: Equivalence" / "... Minimal Effect")
#   decision   TOSTER's three sentences (TOST, ttest, combined): text with rounded numbers, for information
#   warnings, messages (TOSTER's notes such as "Equivalence interval does not include zero." are messages)
# Errors as {"error": message}.
#
# Reference (refKind "nct"): for smdCi "nct" (the default), TOSTER finds the noncentrality limits by minimising
# (qt(alpha, df, ncp) - t)^2 with optimize()/nlm() (tolerance 1e-9 on ncp, about 1e-9 relative error). The reference
# solves pt(|t|, df, ncp) = 1 - alpha (lower) and = alpha (upper) with uniroot to 1e-15 and applies TOSTER's
# scaling (sqrt(hn) J) and sign: smd.dlow, smd.dhigh and the SMD row's lower.ci, upper.ci.

suppressPackageStartupMessages(library(TOSTER))

set.seed(20261109)
cases <- list()
add <- function(...) cases[[length(cases) + 1]] <<- list(...)

x8 <- c(5.1, 4.9, 5.6, 5.8, 6.0, 5.4, 5.2, 6.1)
y9 <- c(5.3, 5.0, 5.5, 5.7, 5.9, 5.2, 4.8, 5.6, 5.0)
a30 <- round(rnorm(30, 100, 15), 1); b25 <- round(rnorm(25, 103, 10), 1)
pre <- round(rnorm(20, 50, 8), 1); post <- round(pre + rnorm(20, 1, 3), 1)

# two samples, Welch (default) and Student
for (ve in c(FALSE, TRUE)) {
  add(x = x8, y = y9, eqb = 0.5, varEqual = ve)
  add(x = a30, y = b25, eqb = 5, varEqual = ve)
  add(x = y9, y = x8, eqb = 0.5, varEqual = ve)                    # negative difference
  add(x = a30, y = b25, eqb = c(-8, 3), varEqual = ve)             # asymmetric bounds
  add(x = a30, y = b25, eqb = 5, varEqual = ve, hypothesis = "MET")
}
add(x = a30, y = b25, lowEqbound = -2, highEqbound = 6)
add(x = a30, y = b25, eqb = -5)
add(x = a30, y = b25, eqb = c(1, 6))                               # interval without zero
add(x = a30, y = b25, eqb = 5, alpha = 0.025)
add(x = a30, y = b25, eqb = 5, alpha = 0.1)
add(x = a30, y = b25, eqb = 5, mu = 2)
add(x = a30, y = b25, eqb = 0.3, eqboundType = "SMD")
add(x = a30, y = b25, eqb = 0.3, eqboundType = "SMD", varEqual = TRUE)
# effect-size options
for (ci in c("nct", "goulet", "t", "z")) for (ve in c(FALSE, TRUE)) add(x = a30, y = b25, eqb = 5, smdCi = ci, varEqual = ve)
add(x = a30, y = b25, eqb = 5, biasCorrection = FALSE)
add(x = a30, y = b25, eqb = 5, biasCorrection = FALSE, varEqual = TRUE)
for (g in c("glass1", "glass2")) { add(x = a30, y = b25, eqb = 5, glass = g); add(x = a30, y = b25, eqb = 5, glass = g, smdCi = "t") }
add(x = x8, y = x8 + c(0.1, -0.1, 0, 0.2, -0.2, 0, 0.1, -0.1), eqb = 0.5)   # equal means: d = 0
# paired
add(x = pre, y = post, paired = TRUE, eqb = 3)
add(x = post, y = pre, paired = TRUE, eqb = 3)
add(x = pre, y = post, paired = TRUE, eqb = 3, hypothesis = "MET")
add(x = pre, y = post, paired = TRUE, eqb = c(-4, 1))
add(x = pre, y = post, paired = TRUE, eqb = 3, rmCorrection = TRUE)
for (ci in c("goulet", "t", "z")) add(x = pre, y = post, paired = TRUE, eqb = 3, smdCi = ci)
add(x = pre, y = post, paired = TRUE, eqb = 3, rmCorrection = TRUE, smdCi = "goulet")
add(x = pre, y = post, paired = TRUE, eqb = 3, glass = "glass1")
add(x = pre, y = post, paired = TRUE, eqb = 0.4, eqboundType = "SMD")
add(x = pre, y = post, paired = TRUE, eqb = 3, mu = 1)
add(x = c(pre, NA), y = c(post, 50), paired = TRUE, eqb = 3)
add(x = x8, y = y9[1:8], paired = TRUE, eqb = 0.5)
# one sample
add(x = x8, eqb = 0.3, mu = 5.5)
add(x = x8, eqb = c(5, 6))
add(x = x8, eqb = c(5, 6), hypothesis = "MET")
add(x = a30, eqb = 5, mu = 100)
for (ci in c("goulet", "t", "z")) add(x = a30, eqb = 5, mu = 100, smdCi = ci)
add(x = a30, eqb = 5, mu = 100, biasCorrection = FALSE)
add(x = c(a30, NA), eqb = 5, mu = 100)
# small samples
add(x = c(1.2, 1.5), y = c(1.4, 1.9, 1.3), eqb = 0.5)
add(x = c(1.2, 1.5, 1.1), y = c(1.4, 1.9, 1.3), eqb = 0.5, varEqual = TRUE)
add(x = c(1.2, 1.5, 1.1), y = c(1.4, 1.9, 1.6), eqb = 0.5, paired = TRUE)
add(x = c(1.2, 1.5, 1.1), eqb = 0.5, mu = 1)
# errors
add(x = x8, y = y9)
add(x = x8, y = y9, eqb = c(1, 2, 3))
add(x = x8, y = y9, eqb = 0.5, alpha = 0.6)
add(x = x8, y = y9, eqb = 0.5, alpha = 0.5)
add(x = x8, y = y9, eqb = 0.5, alpha = 0)
add(x = x8, y = y9, eqb = 0.5, hypothesis = "X")
add(x = x8, y = y9, eqb = 0.5, hypothesis = "M")
add(x = rep(1, 5), y = rep(1, 5), eqb = 0.5)
add(x = I(1), y = y9, eqb = 0.5)
add(x = x8, y = y9[1:7], eqb = 0.5, paired = TRUE)

run_tost <- function(a) {
  msgs <- character(0)
  args <- list(x = a$x, y = a$y, paired = a$paired, var.equal = a$varEqual, eqb = a$eqb, low_eqbound = a$lowEqbound,
               high_eqbound = a$highEqbound, hypothesis = a$hypothesis, eqbound_type = a$eqboundType, alpha = a$alpha,
               mu = a$mu, bias_correction = a$biasCorrection, rm_correction = a$rmCorrection, glass = a$glass,
               smd_ci = a$smdCi)
  r <- withCallingHandlers(call_with(t_TOST, lapply(args, function(v) if (inherits(v, "AsIs")) unclass(v) else v)),
    message = function(m) { msgs <<- c(msgs, sub("\n$", "", conditionMessage(m))); invokeRestart("muffleMessage") })
  list(r = r, messages = unique(msgs))
}

nz <- function(v) if (is.null(v)) "NA" else num2str(unname(v))

write_htest_fixture("tTOST", cases, function(a) {
  rr <- run_tost(a); r <- rr$r
  T <- r$TOST; E <- r$effsize; Q <- r$eqb; S <- r$smd
  list(
    TOST = setNames(lapply(rownames(T), function(nm) I(num2str(unlist(T[nm, ])))), rownames(T)),
    eqb = lapply(seq_len(nrow(Q)), function(i) I(c(Q$type[i], num2str(c(Q$low_eq[i], Q$high_eq[i]))))),
    effsize = setNames(lapply(rownames(E), function(nm) I(num2str(unlist(E[nm, ])))), rownames(E)),
    smd = list(d = nz(S$d), d_df = nz(S$d_df), dlow = nz(S$dlow), dhigh = nz(S$dhigh), d_sigma = nz(S$d_sigma),
               d_lambda = nz(S$d_lambda), J = nz(S$J), d_denom = nz(S$d_denom), ntilde = nz(S$ntilde),
               t_stat = nz(S$t_stat), smd_label = S$smd_label, smd_ci = S$smd_ci),
    method = r$method, hypothesis = r$hypothesis,
    decision = list(TOST = r$decision$TOST, ttest = r$decision$ttest, combined = r$decision$combined),
    messages = I(rr$messages))
}, ref = function(a) {
  rr <- run_tost(a); S <- rr$r$smd
  if (S$smd_ci != "nct") return(NULL)
  alpha <- if (is.null(a$alpha)) 0.05 else a$alpha
  t <- abs(S$t_stat); df <- S$d_df; hn <- S$d_lambda; J <- S$J
  root <- function(target, lower.tail) {
    f <- function(nc) pt(t, df, nc, lower.tail = lower.tail) - target
    lo <- t - 1; hi <- t + 1
    while (f(lo) * f(hi) > 0) { lo <- lo - 2 * (hi - lo); hi <- hi + 2 * (hi - lo) }
    uniroot(f, c(lo, hi), tol = 1e-15 * max(1, abs(t)), maxiter = 5000)$root
  }
  L <- root(alpha, FALSE); U <- root(alpha, TRUE)
  dlow <- L * sqrt(hn) * J; dhigh <- U * sqrt(hn) * J
  if (S$t_stat < 0) { tmp <- dlow; dlow <- -dhigh; dhigh <- -tmp }
  list(refKind = "nct", smd = list(dlow = num2str(dlow), dhigh = num2str(dhigh)),
       effsize = setNames(list(list(lower.ci = num2str(dlow), upper.ci = num2str(dhigh))), S$smd_label))
}, warnings = TRUE)
