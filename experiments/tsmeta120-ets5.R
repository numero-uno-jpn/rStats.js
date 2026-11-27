# tsmeta120-ets5.R: forecast.ets, fifth ets experiment (1.20.0): ANA's and MNA's intervals. tsmeta120-ets3's numbers
# showed ANA's half-width equal to the class 1 formula except at h = m and 2m (ratios 1.000247, 1.000132), which a
# seasonal term gamma (gamma + 2 alpha) counted one horizon early explains. Candidates: the class 1 / class 2 formulas
# with the seasonal term of c_j at (j + 1) mod m = 0 instead of j mod m = 0 (equivalently, for class 1,
# k = floor(h / m) seasonal cycles in sigma2 (1 + (h - 1) alpha^2 + k gamma (2 alpha + gamma)) instead of
# floor((h - 1) / m)), for ANA and MNA on two series, and the correct formula beside it.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages(library(forecast))
out <- list(R = R.version.string, arch = R.version$arch, forecast = as.character(packageVersion("forecast")))
for (cs in list(list("ANA_usacc", USAccDeaths, "ANA"), list("MNA_usacc", USAccDeaths, "MNA"), list("ANA_nottem", nottem, "ANA"),
                list("MNA_nottem", nottem, "MNA"), list("ANA_q", UKgas, "ANA"))) {
  fit <- ets(cs[[2]], model = cs[[3]]); h <- 3 * frequency(fit$x) + 2; m <- frequency(fit$x)
  fc <- forecast(fit, h = h, level = 95); half <- (as.numeric(fc$upper) - as.numeric(fc$mean)) / qnorm(0.975)
  al <- unname(fit$par["alpha"]); ga <- unname(fit$par["gamma"]); s2 <- fit$sigma2; mu <- as.numeric(fc$mean)
  vfor <- function(shift) {
    cj <- function(j) al + ga * (((j + shift) %% m) == 0)   # vectorised over j (sapply on an empty vector gives a list)
    if (substr(cs[[3]], 1, 1) == "A") return(s2 * sapply(1:h, function(k) 1 + sum(cj(seq_len(k - 1))^2)))
    th <- numeric(h); th[1] <- mu[1]^2
    for (k in 2:h) th[k] <- mu[k]^2 + s2 * sum(cj(1:(k - 1))^2 * th[k - (1:(k - 1))])
    (1 + s2) * th - mu^2
  }
  out[[cs[[1]]]] <- list(correct = max(abs(half / sqrt(vfor(0)) - 1)), shifted = max(abs(half / sqrt(vfor(1)) - 1)))
}
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, na = "string", pretty = TRUE))
