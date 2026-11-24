# psm112-rng.R: uniform draws consumed by successive calls of base R's random generators under the seeds of
# psm112-ties.R (1.12.0), to compare with the draws of Match(ties = FALSE). Public functions only. Output: text.
# For each seed and generator: the cumulative number of uniforms consumed after the 1st, 2nd, ... 6th call.
pos <- function(after, seed) {
  set.seed(seed); k <- 0
  while (k <= 300 && !identical(.Random.seed, after)) { runif(1); k <- k + 1 }
  k
}
gens <- list(rnorm = function() rnorm(1), rexp = function() rexp(1), rbinom = function() rbinom(1, 1, 0.5),
             rpois = function() rpois(1, 1), rgamma = function() rgamma(1, 1), sample2 = function() sample(2, 1),
             sample3 = function() sample(3, 1), sample4 = function() sample(4, 1))
for (s in 1:12) for (g in names(gens)) {
  set.seed(s); cum <- integer(0)
  for (j in 1:6) { set.seed(s); for (i in seq_len(j)) gens[[g]](); after <- .Random.seed; cum <- c(cum, pos(after, s)) }
  cat(sprintf("seed=%-2d %-8s %s\n", s, g, paste(cum, collapse = " ")))
}
