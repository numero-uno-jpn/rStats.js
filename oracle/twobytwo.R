source("/oracle/_htest.R")

# Effect measures of a 2×2 table with intervals (see oracle/contingency-behaviour.md):
#   binomDiffCI   DescTools::BinomDiffCI, methods wald, score (Newcombe's hybrid score), mn (Miettinen-Nurminen); also
#                 mee (Farrington-Manning / Mee) and ac (Agresti-Caffo, DescTools' default) for comparison
#   binomRatioCI  DescTools::BinomRatioCI, methods katz.log and koopman
#   oddsRatio     epitools::oddsratio, methods wald, midp, fisher (estimate, limits and the three p-values)
#   epi2by2       epiR::epi.2by2(method = "cohort.count"): the Wald and score intervals of the risk ratio, the odds
#                 ratio and the attributable risk (and the conditional MLE of the odds ratio)
# Field names are the packages' own.
#
# References (where the package solves an equation inexactly): the roots of the same equations solved with Rmpfr at
# 128 bits (score statistics) or on the log scale to a relative 1e-14 (mid-p). They are the values rStats.js should
# give; the packages' values are what they print.

suppressPackageStartupMessages({
  library(DescTools); library(epitools); library(epiR); library(Rmpfr)
})

set.seed(20261106)
BITS <- 128
mpi <- Rmpfr::Const("pi", BITS)
m128 <- function(x) Rmpfr::mpfr(x, BITS)
mroot <- function(f, lo, hi) {
  # root of f on [lo, hi] (doubles) by bisection-safeguarded unirootR in mpfr
  r <- Rmpfr::unirootR(f, c(m128(lo), m128(hi)), tol = 1e-30, maxiter = 2000)
  as.numeric(r$root)
}

# ---- risk difference: score statistics of Farrington-Manning (mee) and Miettinen-Nurminen (mn) ----
# Constrained MLE (p1 - p2 = d) by the closed-form cubic of Farrington and Manning (1990), in mpfr
fm_mle <- function(p1, n1, p2, n2, d) {
  t <- n2 / n1; a <- 1 + t
  b <- -(1 + t + p1 + t * p2 + d * (t + 2))
  c <- d * d + d * (2 * p1 + t + 1) + p1 + t * p2
  dd <- -p1 * d * (1 + d)
  v <- (b / a / 3)^3 - b * c / (6 * a * a) + dd / a / 2
  s <- sqrt(pmax((b / a / 3)^2 - c / a / 3, 0))
  u <- if (v > 0) s else -s
  arg <- v / u^3
  if (arg > 1) arg <- m128(1)
  if (arg < -1) arg <- m128(-1)
  w <- (mpi + acos(arg)) / 3
  q1 <- 2 * u * cos(w) - b / a / 3
  q1 <- max(min(q1, m128(1)), m128(0))
  list(q1 = q1, q2 = q1 - d)
}
diff_stat <- function(x1, n1, x2, n2, d, mn) {
  p1 <- m128(x1) / n1; p2 <- m128(x2) / n2
  diff <- p1 - p2 - d
  if (diff == 0) return(m128(0))
  q <- fm_mle(p1, n1, p2, n2, d)
  v <- q$q1 * (1 - q$q1) / n1 + q$q2 * (1 - q$q2) / n2
  if (mn) v <- v * (n1 + n2) / (n1 + n2 - 1)
  if (v <= 0) return(m128(Inf))
  diff^2 / v
}
diff_score_ci <- function(x1, n1, x2, n2, cl, mn) {
  z <- qchisq(cl, 1)
  est <- x1 / n1 - x2 / n2
  f <- function(d) diff_stat(x1, n1, x2, n2, d, mn) - z
  lo <- if (est <= -1) -1 else mroot(f, -1 + 1e-15, est)
  hi <- if (est >= 1) 1 else mroot(f, est, 1 - 1e-15)
  c(lo, hi)
}

# ---- risk ratio: Koopman's score statistic (constrained MLE p1 = phi p2, boundary-aware) ----
koop_stat <- function(x, m, y, n, phi) {
  # constrained MLE of p1: the smaller root of (m + n) p^2 - (phi (m + y) + x + n) p + phi (x + y) = 0, at most 1
  B <- phi * (m + y) + x + n
  disc <- B^2 - 4 * phi * (m + n) * (x + y)
  p1 <- (B - sqrt(pmax(disc, 0))) / (2 * (m + n))
  if (p1 > 1) p1 <- m128(1)
  if (p1 > phi) p1 <- phi                # p2 = p1 / phi at most 1 (y = n)
  p2 <- p1 / phi
  term <- function(o, k, p) {
    num <- (o - k * p)^2
    if (num == 0) return(m128(0))
    den <- k * p * (1 - p)
    if (den <= 0) return(m128(Inf))
    num / den
  }
  term(x, m, p1) + term(y, n, p2)
}
# Interval {phi: U(phi) <= qchisq(cl, 1)} from a start s where U(s) < the bound, searching outward on log phi
score_ci_log <- function(f, s, lower0, upperInf) {
  lo <- if (lower0) 0 else {
    a <- s; while (as.numeric(f(a)) < 0) a <- a - 1
    exp(mroot(f, a, min(a + 1, s)))
  }
  hi <- if (upperInf) Inf else {
    b <- s; while (as.numeric(f(b)) < 0) b <- b + 1
    exp(mroot(f, max(b - 1, s), b))
  }
  c(lo, hi)
}
start_below <- function(f, s, step) { while (as.numeric(f(s)) >= 0) s <- s + step; s }
koop_ci <- function(x, m, y, n, cl) {
  z <- qchisq(cl, 1)
  if (x == 0 && y == 0) return(c(0, Inf))
  f <- function(l) koop_stat(m128(x), m, m128(y), n, exp(l)) - z
  s <- if (x == 0) start_below(f, log((0.5 / m) / (y / n)) - 20, -5) else
       if (y == 0) start_below(f, log((x / m) / (0.5 / n)) + 20, 5) else log((x / m) / (y / n))
  score_ci_log(f, s, x == 0, y == 0)
}

# ---- odds ratio: epiR's score statistic (zORscore / zlimit, without the N/(N - 1) factor) ----
or_stat <- function(x1, n1, x2, n2, th) {
  px <- x1 / n1
  if (abs(th - 1) < 1e-10) { p2d <- (x1 + x2) / (n1 + n2); p1d <- p2d } else {
    a <- n2 * (th - 1); b <- n1 * th + n2 - (x1 + x2) * (th - 1); c <- -(x1 + x2)
    p2d <- (-b + sqrt(b^2 - 4 * a * c)) / (2 * a)
    p1d <- p2d * th / (1 + p2d * (th - 1))
  }
  (n1 * (px - p1d))^2 * (1 / (n1 * p1d * (1 - p1d)) + 1 / (n2 * p2d * (1 - p2d)))
}
or_score_ci <- function(x1, n1, x2, n2, cl) {
  z <- qchisq(cl, 1)
  if ((x1 == 0 && x2 == 0) || (x1 == n1 && x2 == n2)) return(c(0, Inf))
  f <- function(l) or_stat(m128(x1), n1, m128(x2), n2, exp(l)) - z
  zero <- x1 == 0 || x2 == n2; inf <- x1 == n1 || x2 == 0
  if (zero && inf) return(c(0, Inf))
  s <- if (zero) start_below(f, -20, -5) else if (inf) start_below(f, 20, 5) else
       log((x1 / (n1 - x1)) / (x2 / (n2 - x2)))
  score_ci_log(f, s, zero, inf)
}

# ---- odds ratio, mid-p (epitools or.midp): median-unbiased estimate and mid-p limits, solved on the log scale ----
midp_or <- function(x, cl) {
  a1 <- x[1, 1]; m <- sum(x[, 1]); n <- sum(x[, 2]); k <- sum(x[1, ])
  lo <- max(0, k - n); hi <- min(k, m); s <- lo:hi
  ld <- dhyper(s, m, n, k, log = TRUE)
  probs <- function(l) { d <- ld + l * s; d <- exp(d - max(d)); d / sum(d) }
  lt <- function(l) { d <- probs(l); sum(d[s < a1]) + 0.5 * d[s == a1] }   # P(X < a) + P(X = a) / 2
  ut <- function(l) { d <- probs(l); sum(d[s > a1]) + 0.5 * d[s == a1] }
  rt <- function(f) {
    a <- -1; while (f(a) > 0) a <- a * 2
    b <- 1; while (f(b) < 0) b <- b * 2
    exp(uniroot(f, c(a, b), tol = 1e-15, maxiter = 5000)$root)
  }
  alpha <- 1 - cl
  est <- if (a1 == lo) 0 else if (a1 == hi) Inf else rt(function(l) ut(l) - lt(l))
  lcl <- if (a1 == lo) 0 else rt(function(l) ut(l) - alpha / 2)
  ucl <- if (a1 == hi) Inf else rt(function(l) alpha / 2 - lt(l))
  c(est, lcl, ucl)
}

# ---------------------------------------------------------------------------------------------------------------
pairs <- list(c(56, 70, 48, 80), c(0, 10, 0, 10), c(0, 10, 10, 10), c(10, 10, 10, 10), c(10, 10, 0, 10),
              c(9, 10, 1, 10), c(5, 10, 5, 10), c(0, 20, 20, 20), c(1, 10, 0, 10), c(0, 10, 3, 10),
              c(10, 10, 5, 10), c(3, 10, 10, 10), c(1, 100, 3, 50), c(500, 1000, 450, 1000), c(5, 6, 1, 7),
              c(1, 1, 0, 1), c(15, 20, 15, 30), c(2, 3000, 9, 3000), c(4000, 5000, 3900, 5000), c(20, 20, 7, 30),
              c(4, 30, 15, 15), c(1, 2001, 3, 1003))
for (i in 1:8) {
  n1 <- floor(10^runif(1, 0.5, 3)); n2 <- floor(10^runif(1, 0.5, 3))
  pairs[[length(pairs) + 1]] <- c(sample(0:n1, 1), n1, sample(0:n2, 1), n2)
}

# ---- binomDiffCI ----
cases <- list()
add <- function(...) cases[[length(cases) + 1]] <<- list(...)
dmethods <- c("wald", "score", "mn", "mee", "ac")
for (m in dmethods) {
  for (v in pairs) add(x1 = v[1], n1 = v[2], x2 = v[3], n2 = v[4], method = m)
  for (v in pairs[c(1, 3, 6, 7, 13)]) {
    for (s in c("left", "right")) add(x1 = v[1], n1 = v[2], x2 = v[3], n2 = v[4], method = m, sides = s)
    for (cl in c(0.5, 0.9, 0.99, 0.999999)) add(x1 = v[1], n1 = v[2], x2 = v[3], n2 = v[4], method = m, confLevel = cl)
    add(x1 = v[1], n1 = v[2], x2 = v[3], n2 = v[4], method = m, confLevel = 0.9, sides = "left")
  }
  add(x1 = 11, n1 = 10, x2 = 3, n2 = 10, method = m)
  add(x1 = 2.5, n1 = 10, x2 = 3, n2 = 10, method = m)
  add(x1 = 0, n1 = 0, x2 = 3, n2 = 10, method = m)
  add(x1 = 3, n1 = 10, x2 = 3, n2 = 10, method = m, confLevel = 1)
}
add(x1 = 56, n1 = 70, x2 = 48, n2 = 80)                    # default method ac
add(x1 = 56, n1 = 70, x2 = 48, n2 = 80, method = "foo")
add(x1 = 56, n1 = 70, x2 = 48, n2 = 80, method = "m")      # ambiguous (mn, mee)
add(x1 = 56, n1 = 70, x2 = 48, n2 = 80, confLevel = 1.5)
add(x1 = 56, n1 = 70, x2 = 48, n2 = 80, confLevel = 0.3)
diff_ref <- function(a) {
  if (is.null(a$method) || !(a$method %in% c("mn", "mee"))) return(NULL)
  ok <- all(c(a$x1, a$x2) == round(c(a$x1, a$x2))) && a$x1 >= 0 && a$x2 >= 0 && a$x1 <= a$n1 && a$x2 <= a$n2 && a$n1 > 0
  cl <- if (is.null(a$confLevel)) 0.95 else a$confLevel
  if (!ok || cl >= 1) return(NULL)
  sides <- if (is.null(a$sides)) "two.sided" else a$sides
  if (sides != "two.sided") cl <- 1 - 2 * (1 - cl)
  ci <- diff_score_ci(a$x1, a$n1, a$x2, a$n2, cl, a$method == "mn")
  if (sides == "left") ci[2] <- 1
  if (sides == "right") ci[1] <- -1
  list(lwr.ci = num2str(ci[1]), upr.ci = num2str(ci[2]))
}
write_htest_fixture("binomDiffCI", cases, function(a) {
  r <- call_with(BinomDiffCI, list(x1 = a$x1, n1 = a$n1, x2 = a$x2, n2 = a$n2, conf.level = a$confLevel,
                                   sides = a$sides, method = a$method))
  list(est = num2str(r[1, "est"]), lwr.ci = num2str(r[1, "lwr.ci"]), upr.ci = num2str(r[1, "upr.ci"]))
}, diff_ref, warnings = TRUE)

# ---- binomRatioCI ----
cases <- list()
for (m in c("katz.log", "koopman")) {
  for (v in pairs) add(x1 = v[1], n1 = v[2], x2 = v[3], n2 = v[4], method = m)
  for (v in pairs[c(1, 3, 7, 13)]) {
    for (s in c("left", "right")) add(x1 = v[1], n1 = v[2], x2 = v[3], n2 = v[4], method = m, sides = s)
    for (cl in c(0.5, 0.9, 0.99, 0.999999)) add(x1 = v[1], n1 = v[2], x2 = v[3], n2 = v[4], method = m, confLevel = cl)
  }
  add(x1 = 11, n1 = 10, x2 = 3, n2 = 10, method = m)
  add(x1 = 2.5, n1 = 10, x2 = 3, n2 = 10, method = m)
  add(x1 = 3, n1 = 10, x2 = 3, n2 = 10, method = m, confLevel = 1)
}
add(x1 = 56, n1 = 70, x2 = 48, n2 = 80)                    # default katz.log
add(x1 = 56, n1 = 70, x2 = 48, n2 = 80, method = "koop")
add(x1 = 56, n1 = 70, x2 = 48, n2 = 80, method = "foo")
ratio_ref <- function(a) {
  if (is.null(a$method) || a$method != "koopman") return(NULL)
  ok <- all(c(a$x1, a$x2) == round(c(a$x1, a$x2))) && a$x1 >= 0 && a$x2 >= 0 && a$x1 <= a$n1 && a$x2 <= a$n2
  cl <- if (is.null(a$confLevel)) 0.95 else a$confLevel
  if (!ok || cl >= 1) return(NULL)
  # DescTools ignores `sides` in BinomRatioCI apart from changing the level (see the behaviour document)
  sides <- if (is.null(a$sides)) "two.sided" else a$sides
  if (sides != "two.sided") cl <- 1 - 2 * (1 - cl)
  ci <- koop_ci(a$x1, a$n1, a$x2, a$n2, cl)
  list(lwr.ci = num2str(ci[1]), upr.ci = num2str(ci[2]))
}
write_htest_fixture("binomRatioCI", cases, function(a) {
  r <- call_with(BinomRatioCI, list(x1 = a$x1, n1 = a$n1, x2 = a$x2, n2 = a$n2, conf.level = a$confLevel,
                                    sides = a$sides, method = a$method))
  list(est = num2str(r[1, "est"]), lwr.ci = num2str(r[1, "lwr.ci"]), upr.ci = num2str(r[1, "upr.ci"]))
}, ratio_ref, warnings = TRUE)

# ---- oddsRatio (epitools) ----
# x is the 2×2 table as epitools takes it: rows exposure (row 1 the reference), columns outcome (column 1 "no")
m2 <- function(v) matrix(v, 2, byrow = TRUE)
tabs <- list(m2(c(56, 14, 48, 32)), m2(c(3, 1, 1, 3)), m2(c(2, 15, 10, 3)), m2(c(1000, 2000, 3000, 4000)),
             m2(c(1, 2000, 3, 1000)), m2(c(0, 10, 5, 5)), m2(c(10, 0, 5, 5)), m2(c(5, 5, 0, 10)), m2(c(0, 10, 0, 10)),
             m2(c(1, 1, 1, 1)), m2(c(20, 25, 30, 35)), m2(c(100, 1, 1, 100)), m2(c(7, 3, 2, 9)), m2(c(1, 9, 9, 1)),
             m2(c(30, 2, 1, 40)), m2(c(150, 50, 60, 140)))
for (i in 1:5) tabs[[length(tabs) + 1]] <- m2(rpois(4, c(3, 10, 40, 150)[i %% 4 + 1]))
cases <- list()
for (x in tabs) for (m in c("wald", "midp", "fisher")) {
  add(x = x, method = m)
  add(x = x, method = m, confLevel = 0.9)
}
add(x = tabs[[1]])                                    # default method midp
for (m in c("wald", "midp", "fisher")) {
  add(x = tabs[[2]], method = m, confLevel = 0.5)
  add(x = tabs[[2]], method = m, confLevel = 0.999)
  add(x = m2(c(3.5, 1, 1, 3)), method = m)
  add(x = m2(c(-1, 1, 1, 3)), method = m)
}
add(x = tabs[[1]], method = "foo")
or_ref <- function(a) {
  m <- if (is.null(a$method)) "midp" else a$method
  if (m != "midp") return(NULL)
  x <- a$x
  if (any(x < 0) || any(x != round(x))) return(NULL)
  cl <- if (is.null(a$confLevel)) 0.95 else a$confLevel
  # or.midp takes the table rearranged as rows (a1, a0) / (b1, b0); its odds ratio equals x11 x22 / (x12 x21)
  r <- midp_or(matrix(c(x[2, 2], x[1, 2], x[2, 1], x[1, 1]), 2, byrow = TRUE), cl)
  list(estimate = num2str(r[1]), lower = num2str(r[2]), upper = num2str(r[3]))
}
write_htest_fixture("oddsRatio", cases, function(a) {
  r <- call_with(oddsratio, list(x = a$x, method = a$method, conf.level = a$confLevel))
  list(estimate = num2str(r$measure[2, "estimate"]), lower = num2str(r$measure[2, "lower"]),
       upper = num2str(r$measure[2, "upper"]), midp.exact = num2str(r$p.value[2, "midp.exact"]),
       fisher.exact = num2str(r$p.value[2, "fisher.exact"]), chi.square = num2str(r$p.value[2, "chi.square"]),
       method = attr(r, "method"))
}, or_ref, warnings = TRUE)

# ---- epi2by2 (epiR, cohort.count, one stratum) ----
# x: rows exposure + / -, columns outcome + / - (epiR's layout, outcome = "as.columns")
cases <- list()
etabs <- list(m2(c(56, 14, 48, 32)), m2(c(3, 1, 1, 3)), m2(c(2, 15, 10, 3)), m2(c(1000, 2000, 3000, 4000)),
              m2(c(1, 2000, 3, 1000)), m2(c(10, 0, 5, 5)), m2(c(5, 5, 10, 0)), m2(c(0, 10, 5, 5)), m2(c(0, 10, 0, 10)),
              m2(c(10, 0, 10, 0)), m2(c(20, 25, 30, 35)), m2(c(7, 3, 2, 9)), m2(c(13, 2283, 5, 2278)),
              m2(c(150, 50, 60, 140)), m2(c(40, 160, 10, 190)))
for (x in etabs) {
  add(x = x)
  add(x = x, confLevel = 0.9)
}
add(x = etabs[[1]], confLevel = 0.5)
add(x = etabs[[1]], confLevel = 1)
add(x = m2(c(3.5, 1, 1, 3)))
epi_ref <- function(a) {
  x <- a$x
  if (any(x != round(x))) return(NULL)
  cl <- if (is.null(a$confLevel)) 0.95 else a$confLevel
  if (cl <= 0 || cl >= 1) return(NULL)
  aa <- x[1, 1]; b <- x[1, 2]; c <- x[2, 1]; d <- x[2, 2]
  rr <- koop_ci(aa, aa + b, c, c + d, cl)
  or <- or_score_ci(aa, aa + b, c, c + d, cl)
  ar <- diff_score_ci(aa, aa + b, c, c + d, cl, FALSE) * 100
  list(RR.strata.score = I(num2str(rr)), OR.strata.score = I(num2str(or)), ARisk.strata.score = I(num2str(ar)))
}
write_htest_fixture("epi2by2", cases, function(a) {
  r <- call_with(epi.2by2, list(dat = as.table(a$x), method = "cohort.count", conf.level = a$confLevel))$massoc.detail
  g <- function(k) I(num2str(as.numeric(unlist(r[[k]]))))
  list(RR.strata.wald = g("RR.strata.wald"), RR.strata.score = g("RR.strata.score"),
       OR.strata.wald = g("OR.strata.wald"), OR.strata.score = g("OR.strata.score"), OR.strata.mle = g("OR.strata.mle"),
       ARisk.strata.wald = g("ARisk.strata.wald"), ARisk.strata.score = g("ARisk.strata.score"))
}, epi_ref, warnings = TRUE)
