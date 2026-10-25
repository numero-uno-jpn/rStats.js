# oracle-platform: amd64
# RNG kinds other than R's default (fixtures rngRounding, rngLecuyer, rngStreams). Generated with x86_64 R
# (see oracle/_random.R).
#
# Each case starts from RNGkind("default", "default", "default"), then runs set.seed(seed, kind, sample.kind)
# (omitted entries keep the default) and the call described by args, with the same fn and argument names as
# oracle/random.R (n = 20000 cases are written as summaries: sum, index-weighted sum, last 5 values).
# Cases with "script" instead of fn are described where they are written.
# Written for each case:
#   expected:   the values (or {"error": message} if R throws)
#   randomSeed: .Random.seed afterwards. All 7 integers for L'Ecuyer-CMRG; for Mersenne-Twister only the first,
#               which encodes the kinds: uniform kind + 100 * normal kind + 10000 * sample kind
#               (10403 = Mersenne-Twister/Inversion/Rejection, 403 with Rounding, 10407 for L'Ecuyer-CMRG).
#               R stores the L'Ecuyer seeds (unsigned, below 2^32) as signed 32-bit integers, so values of 2^31 or
#               more appear as negative numbers.
#   next:       a runif(1) drawn afterwards (to check how many uniforms were consumed)
source("/oracle/_random.R")
library(parallel)

summ <- function(v) { v <- as.numeric(v); c(sum(v), sum(v * seq_along(v)), tail(v, 5)) }
LEC <- "L'Ecuyer-CMRG"

kcase <- function(seed, kind, sampleKind, args, f) {
  RNGkind("default", "default", "default")
  head <- list()
  if (!is.null(seed)) {
    suppressWarnings(set.seed(seed, kind = kind, sample.kind = sampleKind))
    head$seed <- seed
  }
  if (!is.null(kind)) head$kind <- kind
  if (!is.null(sampleKind)) head$sampleKind <- sampleKind
  v <- tryCatch(suppressWarnings(f()), error = function(e) structure(conditionMessage(e), class = "rerror"))
  rs <- get(".Random.seed", envir = globalenv())
  rs <- if (rs[1] %% 100 == 7) rs else rs[1]
  nxt <- runif(1)
  expected <- if (inherits(v, "rerror")) sprintf('{"error":%s}', jstr(gsub("[\r\n]+", " ", unclass(v))))
              else jarr(num2str(as.numeric(v)))
  fields <- c(sprintf("%s:%s", jstr(names(head)), vapply(head, jval, "")),
              sprintf('"args":%s', jobj(args)), sprintf('"expected":%s', expected),
              sprintf('"randomSeed":%s', jarr(num2str(rs))), sprintf('"next":%s', jstr(num2str(nxt))))
  CASES[[length(CASES) + 1]] <<- paste0("{", paste(fields, collapse = ","), "}")
}

# ---- sample.kind = "Rounding" (R before 3.6.0: index = floor(n * unif_rand())) ----
for (s in c(1, 42, 2024, -7)) {
  kcase(s, NULL, "Rounding", list(fn = "sample.int", n = 10), function() sample.int(10))
  kcase(s, NULL, "Rounding", list(fn = "sample.int", n = 1e6, size = 5), function() sample.int(1e6, 5))
  kcase(s, NULL, "Rounding", list(fn = "sample.int", n = 6, size = 20, replace = TRUE), function() sample.int(6, 20, replace = TRUE))
  kcase(s, NULL, "Rounding", list(fn = "rwilcox", nn = 10, m = 4, n = 6), function() rwilcox(10, 4, 6))
}
kcase(3, NULL, "Rounding", list(fn = "sample.int", n = 2^31 - 1, size = 3), function() sample.int(2^31 - 1, 3))
kcase(3, NULL, "Rounding", list(fn = "sample.int", n = 1e10, size = 3), function() sample.int(1e10, 3))
# The default "Rejection" with n >= 2^31 (31 to 52 random bits, drawn 16 at a time)
kcase(3, NULL, NULL, list(fn = "sample.int", n = 2^31, size = 5, replace = TRUE), function() sample.int(2^31, 5, replace = TRUE))
kcase(3, NULL, NULL, list(fn = "sample.int", n = 1e10, size = 3), function() sample.int(1e10, 3))
kcase(3, NULL, NULL, list(fn = "sample.int", n = 2^48 + 1, size = 5, replace = TRUE), function() sample.int(2^48 + 1, 5, replace = TRUE))
kcase(3, NULL, NULL, list(fn = "sample.int", n = 4.5e15, size = 5, replace = TRUE), function() sample.int(4.5e15, 5, replace = TRUE))
kcase(3, NULL, "Rounding", list(fn = "sample.int", n = 1, size = 3, replace = TRUE), function() sample.int(1, 3, replace = TRUE))
# Not affected by sample.kind: weighted sampling, rsignrank, runif, rnorm
pr <- c(0.1, 0.2, 0.3, 0.2, 0.2)
kcase(4, NULL, "Rounding", list(fn = "sample.int", n = 5, size = 20, replace = TRUE, prob = pr), function() sample.int(5, 20, TRUE, pr))
kcase(4, NULL, "Rounding", list(fn = "sample.int", n = 5, size = 5, replace = FALSE, prob = pr), function() sample.int(5, 5, FALSE, pr))
kcase(4, NULL, "Rounding", list(fn = "rsignrank", nn = 10, n = 8), function() rsignrank(10, 8))
kcase(4, NULL, "Rounding", list(fn = "runif", n = 5), function() runif(5))
kcase(4, NULL, "Rounding", list(fn = "rnorm", n = 5), function() rnorm(5))
kcase(5, NULL, "Rounding", list(fn = "sample.int", n = 20000, size = 20000, replace = TRUE), function() summ(sample.int(20000, 20000, TRUE)))
# script "switch-sample-kind": set.seed(seed); sample.int(10); RNGkind(sample.kind = to); sample.int(10)
# (changing only sample.kind keeps the stream); expected is both samples
for (to in c("Rounding", "Rejection")) {
  from <- if (to == "Rounding") "Rejection" else "Rounding"
  kcase(6, NULL, from, list(script = "switch-sample-kind", to = to),
        function() { a <- sample.int(10); RNGkind(sample.kind = to); c(a, sample.int(10)) })
}
write_random_fixture("rngRounding")

# ---- L'Ecuyer-CMRG ----
for (s in c(1, 42, 0, -7, 123456789, 2147483647, -2147483647))
  kcase(s, LEC, NULL, list(fn = "runif", n = 10), function() runif(10))
for (s in c(1, 42, 2024)) {
  kcase(s, LEC, NULL, list(fn = "rnorm", n = 10), function() rnorm(10))
  kcase(s, LEC, NULL, list(fn = "rexp", n = 10), function() rexp(10))
  kcase(s, LEC, NULL, list(fn = "rgamma", n = 10, shape = 2.5, scale = 1), function() rgamma(10, 2.5))
  kcase(s, LEC, NULL, list(fn = "rgamma", n = 10, shape = 0.3, scale = 1), function() rgamma(10, 0.3))
  kcase(s, LEC, NULL, list(fn = "rbinom", n = 10, size = 20, prob = 0.3), function() rbinom(10, 20, 0.3))
  kcase(s, LEC, NULL, list(fn = "rbinom", n = 5, size = 1000, prob = 0.4), function() rbinom(5, 1000, 0.4))
  kcase(s, LEC, NULL, list(fn = "rpois", n = 10, lambda = 4), function() rpois(10, 4))
  kcase(s, LEC, NULL, list(fn = "rpois", n = 5, lambda = 100), function() rpois(5, 100))
  kcase(s, LEC, NULL, list(fn = "sample.int", n = 10), function() sample.int(10))
  kcase(s, LEC, NULL, list(fn = "sample.int", n = 1e6, size = 4), function() sample.int(1e6, 4))
  kcase(s, LEC, NULL, list(fn = "sample.int", n = 6, size = 20, replace = TRUE), function() sample.int(6, 20, replace = TRUE))
  kcase(s, LEC, NULL, list(fn = "rmultinom", n = 2, size = 20, prob = c(0.2, 0.3, 0.5)), function() rmultinom(2, 20, c(0.2, 0.3, 0.5)))
}
kcase(7, LEC, NULL, list(fn = "runif", n = 20000), function() summ(runif(20000)))
kcase(7, LEC, NULL, list(fn = "rnorm", n = 20000), function() summ(rnorm(20000)))
kcase(7, LEC, NULL, list(fn = "rbinom", n = 20000, size = 100, prob = 0.3), function() summ(rbinom(20000, 100, 0.3)))
# With sample.kind = "Rounding"
kcase(8, LEC, "Rounding", list(fn = "sample.int", n = 10), function() sample.int(10))
kcase(8, LEC, "Rounding", list(fn = "sample.int", n = 1e6, size = 4), function() sample.int(1e6, 4))
# script "switch-kind": after set.seed (with kind), draw runif(2), call RNGkind(to), draw runif(3); expected is
# all 5 values. R reseeds the new generator from the next uniform of the current one, also when the kind does not
# change.
kcase(9, NULL, NULL, list(script = "switch-kind", to = LEC), function() { a <- runif(2); RNGkind(LEC); c(a, runif(3)) })
kcase(9, LEC, NULL, list(script = "switch-kind", to = "Mersenne-Twister"),
      function() { a <- runif(2); RNGkind("Mersenne-Twister"); c(a, runif(3)) })
kcase(9, LEC, NULL, list(script = "switch-kind", to = LEC), function() { a <- runif(2); RNGkind(LEC); c(a, runif(3)) })
# script "assign-seed": .Random.seed <- randomSeed (args), then runif(5) (setRandomSeed).
# Not in the fixture because R's result is not reproducible: seeds that R considers invalid (here all zeros, and
# values of 2^32 - 6 and above such as c(10407, -1, -2, ..., -6)) and an invalid kind code (410407) make R reseed
# from the clock (the invalid kind falls back to the default Mersenne-Twister).
lec_seeds <- list(c(10407, 1806547166, -983674937, 643431772, 1882594449, 1072598346, -1062234221),
                  c(10407, 1, 2, 3, 4, 5, 6),
                  c(10407, 1, 2, 3, 0, 0, 0))
for (rs in lec_seeds) kcase(NULL, NULL, NULL, list(script = "assign-seed", randomSeed = rs),
                            function() { assign(".Random.seed", as.integer(rs), envir = globalenv()); runif(5) })
write_random_fixture("rngLecuyer")

# ---- parallel::nextRNGStream / nextRNGSubStream ----
# script "streams": set.seed(seed, kind = "L'Ecuyer-CMRG"), then steps applied in order to .Random.seed
# (space-separated; "stream" = nextRNGStream, "substream" = nextRNGSubStream); expected is the 7 integers after each step,
# concatenated, followed by runif(5) drawn after assigning the last one.
steps_list <- list(c("stream"), c("substream"), c("stream", "stream", "stream"), c("substream", "substream"),
                   c("stream", "substream", "stream"), c("substream", "stream"))
for (s in c(1, 42, 123456789)) for (steps in steps_list)
  kcase(s, LEC, NULL, list(script = "streams", steps = paste(steps, collapse = " ")), function() {
    x <- get(".Random.seed", envir = globalenv()); out <- c()
    for (st in steps) { x <- if (st == "stream") nextRNGStream(x) else nextRNGSubStream(x); out <- c(out, x) }
    assign(".Random.seed", x, envir = globalenv())
    c(out, runif(5))
  })
write_random_fixture("rngStreams")
