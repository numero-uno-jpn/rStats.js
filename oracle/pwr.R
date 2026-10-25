source("/oracle/_anova.R")
source("/oracle/_power.R")
suppressPackageStartupMessages(library(pwr))

# Power calculations of the pwr package (fixture pwr), and its effect-size helpers ES.h, ES.w1, ES.w2, cohen.ES.
# Same format as oracle/power.R: fn, the arguments by pwr's names, "NULL" for the quantity solved for. For ES.w1 the
# arguments are P0 and P1 (vectors), for ES.w2 P (a matrix of probabilities), for cohen.ES test and size. A string
# effect size (d = "medium") is passed as is (pwr looks it up with cohen.ES). "reference" as in oracle/power.R.

nul <- "NULL"
cases <- list()
add <- function(.fn, ...) cases[[length(cases) + 1]] <<- c(list(fn = .fn), list(...))  # .fn: f = would match fn
for (alt in c("two.sided", "less", "greater")) {
  dd <- if (alt == "less") -0.5 else 0.5
  for (type in c("two.sample", "one.sample", "paired")) {
    add("pwr.t.test", n = 20, d = dd, type = type, alternative = alt, power = nul)
    add("pwr.t.test", n = nul, d = dd, power = 0.8, type = type, alternative = alt)
    add("pwr.t.test", n = 20, d = nul, power = 0.8, type = type, alternative = alt)
    add("pwr.t.test", n = 20, d = dd, sig.level = nul, power = 0.8, type = type, alternative = alt)
  }
  add("pwr.t2n.test", n1 = 15, n2 = 25, d = dd, alternative = alt, power = nul)
  add("pwr.t2n.test", n1 = 15, n2 = nul, d = dd, power = 0.7, alternative = alt)
  add("pwr.t2n.test", n1 = nul, n2 = 30, d = dd, power = 0.7, alternative = alt)
  add("pwr.t2n.test", n1 = 15, n2 = 25, d = nul, power = 0.7, alternative = alt)
  add("pwr.t2n.test", n1 = 15, n2 = 25, d = dd, sig.level = nul, power = 0.7, alternative = alt)
  hh <- if (alt == "less") -0.3 else 0.3
  for (fn in c("pwr.2p.test", "pwr.p.test", "pwr.norm.test")) {
    es <- if (fn == "pwr.norm.test") "d" else "h"
    a1 <- list(fn, n = 60, power = nul, alternative = alt); a1[[es]] <- hh; do.call(add, a1)
    a2 <- list(fn, n = nul, power = 0.8, alternative = alt); a2[[es]] <- hh; do.call(add, a2)
    a3 <- list(fn, n = 60, power = 0.8, alternative = alt); a3[[es]] <- nul; do.call(add, a3)
    a4 <- list(fn, n = 60, power = 0.8, sig.level = nul, alternative = alt); a4[[es]] <- hh; do.call(add, a4)
  }
  add("pwr.2p2n.test", h = hh, n1 = 40, n2 = 60, power = nul, alternative = alt)
  add("pwr.2p2n.test", h = hh, n1 = 40, n2 = nul, power = 0.6, alternative = alt)
  add("pwr.2p2n.test", h = nul, n1 = 40, n2 = 60, power = 0.6, alternative = alt)
  rr <- if (alt == "less") -0.3 else 0.3
  add("pwr.r.test", n = 50, r = rr, power = nul, alternative = alt)
  add("pwr.r.test", n = nul, r = rr, power = 0.8, alternative = alt)
  add("pwr.r.test", n = 50, r = nul, power = 0.8, alternative = alt)
  add("pwr.r.test", n = 50, r = rr, sig.level = nul, power = 0.8, alternative = alt)
}
add("pwr.t.test", n = 20, d = "medium", power = nul)
add("pwr.t.test", n = 20, d = -0.5, power = nul)
add("pwr.t.test", n = 1e4, d = 0.01, power = nul)
add("pwr.t.test", n = nul, d = 1e-3, power = 0.8)                 # no root in the interval: an error
add("pwr.t.test", n = 20, d = 0.5, power = nul, sig.level = 2)
add("pwr.t2n.test", n1 = 1, n2 = 25, d = 0.5, power = nul)
add("pwr.r.test", n = 3, r = 0.3, power = nul)
add("pwr.r.test", n = 50, r = "large", power = nul)
for (df in c(1, 3, 6)) {
  add("pwr.chisq.test", w = 0.3, N = 100, df = df, power = nul)
  add("pwr.chisq.test", w = 0.3, N = nul, df = df, power = 0.8)
  add("pwr.chisq.test", w = nul, N = 100, df = df, power = 0.8)
  add("pwr.chisq.test", w = 0.3, N = 100, df = df, sig.level = nul, power = 0.8)
}
add("pwr.chisq.test", w = -0.1, N = 100, df = 2, power = nul)
add("pwr.anova.test", k = 4, n = 10, f = 0.25, power = nul)
add("pwr.anova.test", k = 4, n = nul, f = 0.25, power = 0.8)
add("pwr.anova.test", k = nul, n = 20, f = 0.25, power = 0.8)
add("pwr.anova.test", k = 4, n = 10, f = nul, power = 0.8)
add("pwr.anova.test", k = 4, n = 10, f = 0.25, sig.level = nul, power = 0.8)
add("pwr.anova.test", k = 4, n = 10, f = "small", power = nul)
add("pwr.anova.test", k = 1, n = 10, f = 0.25, power = nul)
add("pwr.f2.test", u = 3, v = 50, f2 = 0.15, power = nul)
add("pwr.f2.test", u = 3, v = nul, f2 = 0.15, power = 0.8)
add("pwr.f2.test", u = nul, v = 50, f2 = 0.15, power = 0.8)
add("pwr.f2.test", u = 3, v = 50, f2 = nul, power = 0.8)
add("pwr.f2.test", u = 3, v = 50, f2 = 0.15, sig.level = nul, power = 0.8)
add("ES.h", p1 = 0.65, p2 = 0.45)
add("ES.h", p1 = 0.1, p2 = 0.9)
add("ES.w1", P0 = I(rep(0.25, 4)), P1 = I(c(0.375, rep((1 - 0.375) / 3, 3))))
add("ES.w2", P = matrix(c(0.225, 0.125, 0.125, 0.125, 0.16, 0.16, 0.04, 0.04), 2, byrow = TRUE))
for (test in c("p", "t", "r", "anov", "chisq", "f2")) for (size in c("small", "medium", "large"))
  add("cohen.ES", test = test, size = size)

call_of <- function(a) {
  args <- a[setdiff(names(a), "fn")]
  args <- lapply(args, function(v) if (identical(v, nul)) NULL else if (inherits(v, "AsIs")) unclass(v) else v)
  list(fn = get(a$fn, envir = asNamespace("pwr")), args = args)
}

write_anova_fixture("pwr", cases, function(a) {
  cl <- call_of(a)
  r <- with_warnings(function() do.call(cl$fn, cl$args))
  v <- r$value
  out <- if (is.list(v)) lapply(unclass(v), function(x) if (is.numeric(x)) num2str(x) else x) else list(value = num2str(v))
  c(out, list(warnings = r$warnings))
}, ref = function(a) power_ref(a$fn, a[setdiff(names(a), "fn")]))
