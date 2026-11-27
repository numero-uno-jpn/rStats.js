# tsmeta120-hw3.R: predict.HoltWinters's intervals for the multiplicative model (1.20.0), second try (asked for by
# the user; experiment 13 found the additive form var(residuals) (1 + sum_{j<h} psi_j^2), psi_j = alpha (1 + j beta)
# + gamma (1 - alpha) [j mod p = 0], 0.28 off for the multiplicative model). Here the ratio
# r_h = half-width / sqrt(var(residuals) v_h) is printed for every h, with candidates written for this experiment:
#   C1: the additive half-width times the forecast period's seasonal coefficient s_h;
#   C2: times s_h / mean(s) ; C3: the relative residuals e_t / xhat_t, half = fit_h sqrt(var(rel) v_h);
#   C4: psi_j without the seasonal term; C5: psi_j with the seasonal term gamma (no (1 - alpha));
#   C6: the additive formula applied as if the model were additive with the same alpha, beta, gamma.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
out <- list(R = R.version.string, arch = R.version$arch)
cases <- list(list("air_given", AirPassengers, 0.3, 0.05, 0.6), list("air_opt", AirPassengers, NULL, NULL, NULL),
              list("co2_given", co2, 0.5, 0.01, 0.4), list("usacc_given", USAccDeaths, 0.7, 0.1, 0.3),
              list("air_nobeta", AirPassengers, 0.4, FALSE, 0.5))
for (cs in cases) {
  r <- HoltWinters(cs[[2]], alpha = cs[[3]], beta = cs[[4]], gamma = cs[[5]], seasonal = "multiplicative")
  H <- 25
  pr <- predict(r, n.ahead = H, prediction.interval = TRUE, level = 0.95)
  fit <- as.numeric(pr[, "fit"]); half <- as.numeric(pr[, "upr"] - pr[, "fit"]) / qnorm(0.975)
  lowhalf <- as.numeric(pr[, "fit"] - pr[, "lwr"]) / qnorm(0.975)
  res <- as.numeric(residuals(r)); xhat <- as.numeric(r$fitted[, "xhat"]); f <- frequency(cs[[2]])
  al <- r$alpha; bt <- if (isFALSE(r$beta)) 0 else r$beta; gm <- r$gamma
  cf <- r$coefficients; s <- unname(cf[grep("^s", names(cf))]); sh <- s[(0:(H - 1)) %% f + 1]
  vfun <- function(psi) sapply(1:H, function(k) 1 + sum(psi[seq_len(k - 1)]^2))
  j <- 1:(H - 1)
  vA <- vfun(al * (1 + j * bt) + gm * (1 - al) * (j %% f == 0))
  vN <- vfun(al * (1 + j * bt))
  vG <- vfun(al * (1 + j * bt) + gm * (j %% f == 0))
  base <- sqrt(var(res) * vA)
  rel <- (as.numeric(cs[[2]])[length(cs[[2]]) - length(res) + seq_along(res)] - xhat) / xhat
  out[[cs[[1]]]] <- list(alpha = al, beta = bt, gamma = gm, s = s, fit = fit, half = half,
    symmetric = max(abs(half - lowhalf)), ratio = half / base,
    C1 = max(abs(half / (base * sh) - 1)), C2 = max(abs(half / (base * sh / mean(s)) - 1)),
    C3 = max(abs(half / (fit * sqrt(var(rel) * vA)) - 1)), C4 = max(abs(half / sqrt(var(res) * vN) - 1)),
    C5 = max(abs(half / sqrt(var(res) * vG) - 1)),
    ratio_over_C4 = half / sqrt(var(res) * vN), ratio_over_C5 = half / sqrt(var(res) * vG))
  # second run, after reading the first run's numbers by hand (log item 16): candidate C7, var_h = var(res)
  # sum_{j=0}^{h-1} (psi_j s_h / s_{h-j})^2 with psi_0 = alpha + gamma (1 - alpha) (j = 0 counts as a seasonal lag);
  # the seasonal index of period k either cyclic ((k - 1) mod f + 1, C7a) or k mod f with 0 read as ... (C7b: s_f,
  # C7c: dropped from the products, i.e. the factor taken as 1)
  psi0 <- function(jj) al * (1 + jj * bt) + gm * (1 - al) * (jj %% f == 0)
  idxA <- function(k) (k - 1) %% f + 1
  sB <- function(k) { i <- k %% f; if (i == 0) s[f] else s[i] }
  sC <- function(k) { i <- k %% f; if (i == 0) NA else s[i] }
  c7 <- function(sf) sapply(1:H, function(h) sum(sapply(0:(h - 1), function(jj) {
    r <- sf(h) / sf(h - jj); if (is.na(r)) r <- 1; (psi0(jj) * r)^2 })))
  w7a <- c7(function(k) s[idxA(k)]); w7b <- c7(sB); w7c <- c7(sC)
  out[[cs[[1]]]]$C7a <- half / sqrt(var(res) * w7a)
  out[[cs[[1]]]]$C7b <- half / sqrt(var(res) * w7b)
  out[[cs[[1]]]]$C7c <- half / sqrt(var(res) * w7c)
  # third run (log item 16): C7a agrees for h < f and fails from h = f on, exactly where (h - j) mod f = 0 first
  # occurs in the denominator. Candidate C8: the denominator's seasonal factor read from the coefficient vector
  # (a, b, s1, ..., sf) at position 2 + ((h - j) mod f), so that a zero index reads the coefficient before s1 (b, or
  # a when there is no trend); the numerator cyclic as in C7a.
  cfv <- unname(r$coefficients); off <- length(cfv) - f
  sD <- function(k) cfv[off + k %% f]
  w8 <- sapply(1:H, function(h) sum(sapply(0:(h - 1), function(jj) (psi0(jj) * s[idxA(h)] / sD(h - jj))^2)))
  out[[cs[[1]]]]$coef <- cfv
  out[[cs[[1]]]]$C8 <- half / sqrt(var(res) * w8)
  # fourth run (log item 16): without a trend (beta = FALSE) C8 fails from h = 2 and R itself gives NA at h = 12.
  # Candidate C9: both factors read from the coefficient vector at fixed positions as if b were always present:
  # numerator cf[2 + ((h - 1) mod f + 1)], denominator cf[2 + ((h - j) mod f)] (beyond the vector: NA).
  w9 <- sapply(1:H, function(h) sum(sapply(0:(h - 1), function(jj) (psi0(jj) * cfv[2 + idxA(h)] / cfv[2 + (h - jj) %% f])^2)))
  out[[cs[[1]]]]$C9 <- half / sqrt(var(res) * w9)
  out[[cs[[1]]]]$na_R <- which(is.na(half)); out[[cs[[1]]]]$na_C9 <- which(is.na(w9))
}
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, na = "string", pretty = TRUE))
