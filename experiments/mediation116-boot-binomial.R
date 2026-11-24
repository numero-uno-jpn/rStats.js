# mediation116-boot-binomial.R: mediate(boot = TRUE) with a logit mediator and an lm outcome (1.16.0), after
# mediation116-boot.R settled the index matrix (one sample(n, n * sims, TRUE), sims x n by column, replicate = row).
# Matches all replicates at once over: the order of the M(1) and M(0) rbinom draws, the original data's draws first /
# last / absent, and the mediator probabilities predicted on the resample or on the original data.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages(library(mediation))
out <- list(R = R.version.string, arch = R.version$arch)
set.seed(20261125)
n <- 60
C <- rnorm(n); X <- rnorm(n, 5, 2); Xb <- rbinom(n, 1, 0.5)
Mb <- 0.8 * Xb + 0.3 * C + rnorm(n)
Yb <- 0.4 * Mb + 0.5 * Xb - 0.2 * C + rnorm(n)
Mbin <- rbinom(n, 1, plogis(-1 + 0.9 * Xb + 0.4 * C))
Ycont2 <- 0.9 * Mbin + 0.4 * Xb + rnorm(n)
d <- data.frame(C, X, Xb, Mb, Yb, Mbin, Ycont2)
assign("d", d, envir = globalenv())
sims <- 30
fm2 <- glm(Mbin ~ Xb + C, family = binomial, data = d); fy2 <- lm(Ycont2 ~ Xb + Mbin + C, data = d)
set.seed(1234); r2 <- mediate(fm2, fy2, treat = "Xb", mediator = "Mbin", boot = TRUE, sims = sims)
st_after <- .Random.seed
got <- as.vector(r2$d0.sims)
out$got <- list(d0 = r2$d0, d0.sims = got, z0.sims = as.vector(r2$z0.sims))
fit2 <- function(dd) list(mm = glm(Mbin ~ Xb + C, family = binomial, data = dd), y = lm(Ycont2 ~ Xb + Mbin + C, data = dd))
eff <- function(f, nd, m1_first) {
  p1 <- predict(f$mm, newdata = transform(nd, Xb = 1), type = "response")
  p0 <- predict(f$mm, newdata = transform(nd, Xb = 0), type = "response")
  if (m1_first) { m1 <- rbinom(nrow(nd), 1, p1); m0 <- rbinom(nrow(nd), 1, p0) } else { m0 <- rbinom(nrow(nd), 1, p0); m1 <- rbinom(nrow(nd), 1, p1) }
  unname(coef(f$y)["Mbin"] * mean(m1 - m0))
}
res <- list()
for (m1_first in c(TRUE, FALSE)) for (orig in c("first", "last", "none")) for (pred in c("resample", "original")) {
  set.seed(1234); I <- matrix(sample(n, n * sims, replace = TRUE), sims, n)
  o <- NA; if (orig == "first") o <- eff(fit2(d), d, m1_first)
  reps <- sapply(seq_len(sims), function(j) { dd <- d[I[j, ], ]; eff(fit2(dd), if (pred == "resample") dd else d, m1_first) })
  if (orig == "last") o <- eff(fit2(d), d, m1_first)
  res[[paste(if (m1_first) "M1_first" else "M0_first", orig, pred)]] <- list(
    reps = max(abs(reps - got)), matched = sum(abs(reps - got) < 1e-12), orig = o, state = identical(.Random.seed, st_after))
}
out$candidates <- res

# added after the first run: the matched structure (original data's draws first, rbinom for M(1) then M(0), replicates
# evaluated on the original data), then the point estimate: one more original-data draw after the replicates, the mean
# or median of the replicates, or the first original draw; and the generator's state
set.seed(1234); I <- matrix(sample(n, n * sims, replace = TRUE), sims, n)
o_first <- eff(fit2(d), d, TRUE)
reps <- sapply(seq_len(sims), function(j) eff(fit2(d[I[j, ], ]), d, TRUE))
st_reps <- .Random.seed
o_last <- eff(fit2(d), d, TRUE)
out$point <- list(got = r2$d0, first = o_first, last_extra = o_last, mean_reps = mean(reps), median_reps = median(reps),
  state_after_reps = identical(st_reps, st_after), state_after_extra = identical(.Random.seed, st_after),
  got_z0 = r2$z0, z0_original = unname(coef(fit2(d)$y)["Xb"]), got_tau = r2$tau.coef, got_n0 = r2$n0)
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "string", pretty = TRUE))
