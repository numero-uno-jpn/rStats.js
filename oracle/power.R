source("/oracle/_anova.R")
source("/oracle/_power.R")

# Power calculations of R's stats: power.t.test, power.prop.test, power.anova.test (fixture powerStats). Each case
# has fn ("power.t.test", "power.prop.test" or "power.anova.test") and the arguments by R's names; an argument
# written as the string "NULL" is the quantity solved for (R: name = NULL); arguments left out take R's defaults.
# Written: every field of the result (numbers, and method, note, alternative as strings), warnings, or
# {"error": message}. "reference" (oracle/_power.R): for the cases with a noncentral distribution, the power computed
# accurately, or the solved quantity found by R's procedure (same uniroot call) on the accurate power.

nul <- "NULL"
cases <- list()
add <- function(.fn, ...) cases[[length(cases) + 1]] <<- c(list(fn = .fn), list(...))  # .fn: f = would match fn
for (type in c("two.sample", "one.sample", "paired")) for (alt in c("two.sided", "one.sided")) {
  add("power.t.test", n = 20, delta = 1, type = type, alternative = alt, power = nul)
  add("power.t.test", n = nul, delta = 0.5, power = 0.8, type = type, alternative = alt)
  add("power.t.test", n = 15, delta = nul, power = 0.9, type = type, alternative = alt)
  add("power.t.test", n = 15, delta = 1.2, sd = nul, power = 0.9, type = type, alternative = alt)
  add("power.t.test", n = 15, delta = 1, sig.level = nul, power = 0.9, type = type, alternative = alt)
}
add("power.t.test", n = 20, delta = 0.3, power = nul, strict = TRUE)
add("power.t.test", n = nul, delta = 0.2, power = 0.9, strict = TRUE)
add("power.t.test", n = 20, delta = -1, power = nul)
add("power.t.test", n = 20, delta = -1, power = nul, alternative = "one.sided")
add("power.t.test", n = 2, delta = 0.1, power = nul)
add("power.t.test", n = 1e5, delta = 0.01, power = nul)
add("power.t.test", n = nul, delta = 1e-3, power = 0.8)        # n beyond the initial interval: extended
add("power.t.test", n = 20, delta = 1, sd = 2, sig.level = 0.01, power = nul)
add("power.t.test", n = nul, delta = 1, power = nul)            # two NULLs: an error
add("power.t.test", n = 20, delta = 1, sig.level = 1.5, power = nul)
for (alt in c("two.sided", "one.sided")) {
  add("power.prop.test", n = 50, p1 = 0.5, p2 = 0.75, power = nul, alternative = alt)
  add("power.prop.test", n = nul, p1 = 0.5, p2 = 0.75, power = 0.9, alternative = alt)
  add("power.prop.test", n = 50, p1 = nul, p2 = 0.75, power = 0.9, alternative = alt)
  add("power.prop.test", n = 50, p1 = 0.5, p2 = nul, power = 0.9, alternative = alt)
  add("power.prop.test", n = 50, p1 = 0.5, p2 = 0.75, sig.level = nul, power = 0.9, alternative = alt)
}
add("power.prop.test", n = 50, p1 = 0.5, p2 = 0.75, power = nul, strict = TRUE)
add("power.prop.test", n = nul, p1 = 0.1, p2 = 0.12, power = 0.8, strict = TRUE)
add("power.prop.test", n = 20, p1 = nul, p2 = 0.3, power = 0.95)  # no p1 in [0, p2]: a warning
add("power.prop.test", n = 20, p1 = 0.7, p2 = nul, power = 0.95)
add("power.anova.test", groups = 4, n = 5, between.var = 1, within.var = 3, power = nul)
add("power.anova.test", groups = 4, n = nul, between.var = 1, within.var = 3, power = 0.8)
add("power.anova.test", groups = nul, n = 5, between.var = 1, within.var = 3, power = 0.8)
add("power.anova.test", groups = 4, n = 5, between.var = nul, within.var = 3, power = 0.8)
add("power.anova.test", groups = 4, n = 5, between.var = 1, within.var = nul, power = 0.8)
add("power.anova.test", groups = 4, n = 5, between.var = 1, within.var = 3, sig.level = nul, power = 0.8)
add("power.anova.test", groups = 1, n = 5, between.var = 1, within.var = 3, power = nul)
add("power.anova.test", groups = 4, n = 1, between.var = 1, within.var = 3, power = nul)

call_of <- function(a) {
  args <- a[setdiff(names(a), "fn")]
  args <- lapply(args, function(v) if (identical(v, nul)) NULL else v)
  list(fn = get(a$fn, envir = asNamespace("stats")), args = args)
}

write_anova_fixture("powerStats", cases, function(a) {
  cl <- call_of(a)
  r <- with_warnings(function() do.call(cl$fn, cl$args))
  v <- unclass(r$value)
  out <- lapply(v, function(x) if (is.numeric(x)) num2str(x) else x)
  out$note <- if (is.null(v$note)) NULL else v$note
  c(out, list(warnings = r$warnings))
}, ref = function(a) power_ref(a$fn, a[setdiff(names(a), "fn")]))
