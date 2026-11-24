# psm112-sample.R: the number of uniform draws of base R's sample() under the seeds of psm112-ties.R, to compare with
# the draws of Match(ties = FALSE) on k tied controls (1.12.0). Public functions only. Output: text.
cnt <- function(seed, f) {
  set.seed(seed); v <- f(); after <- .Random.seed
  set.seed(seed); k <- 0
  while (k <= 200 && !identical(.Random.seed, after)) { runif(1); k <- k + 1 }
  sprintf("%d:%s", k, paste(v, collapse = "."))
}
for (k in 2:5) for (s in 1:12)
  cat(sprintf("k=%d seed=%-2d sample(k,1)=%-8s sample(k,k-1)=%-12s sample(k)=%-12s\n", k, s,
              cnt(s, function() sample(k, 1)), cnt(s, function() sample(k, k - 1)), cnt(s, function() sample(k))))
