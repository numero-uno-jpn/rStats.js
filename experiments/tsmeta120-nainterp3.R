# tsmeta120-nainterp3.R: forecast's na.interp for seasonal series, third try (1.20.0, asked for by the user after
# experiments 30-31 left it open), now with designed inputs instead of candidates on real data:
#   (1) is the seasonal path linear in the observed values? na.interp(a y1 + b y2) against a na.interp(y1) +
#       b na.interp(y2), and against constants added (a robust STL would not be linear; non-robust STL, Fourier
#       regression and linear interpolation are);
#   (2) if it is, the weights: with the missing positions fixed, y = base + e_j for each observed j gives column j of
#       the linear map (the output at the missing positions minus that of base); done from two different bases to
#       see that the map does not depend on the data;
#   (3) simple shapes: a pure seasonal spike pattern, a quadratic trend, their sum (one missing value) — whether
#       they come back exactly.
# n = 48 (frequency 12), missing positions 5, 17, 30.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages(library(forecast))
out <- list(R = R.version.string, arch = R.version$arch, forecast = as.character(packageVersion("forecast")))
n <- 48; f <- 12; miss <- c(5, 17, 30); obs <- setdiff(1:n, miss)
ni <- function(v) { v[miss] <- NA; as.numeric(na.interp(ts(v, frequency = f)))[miss] }
set.seed(41)
y1 <- 10 + 0.3 * (1:n) + 3 * sin(2 * pi * (1:n) / f) + rnorm(n); y2 <- 5 + rnorm(n, sd = 2) + 2 * cos(2 * pi * (1:n) / f)
out$linearity <- c(additive = max(abs(ni(y1 + y2) - (ni(y1) + ni(y2)))), scale = max(abs(ni(3.7 * y1) - 3.7 * ni(y1))),
                   shift = max(abs(ni(y1 + 100) - (ni(y1) + 100))), combo = max(abs(ni(2 * y1 - 0.5 * y2) - (2 * ni(y1) - 0.5 * ni(y2)))))
W <- function(base) { b0 <- ni(base); sapply(obs, function(j) { v <- base; v[j] <- v[j] + 1; ni(v) - b0 }) }
W1 <- W(y1); W2 <- W(y2)
out$weights <- list(obs = obs, W1 = W1, W2 = W2, same = max(abs(W1 - W2)), row_sums = rowSums(W1))
sp <- rep(c(5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -5), 4); q <- ((1:n) - 24)^2 / 50
out$shapes <- list(spike = ni(sp), spike_true = sp[miss], quad = ni(q), quad_true = q[miss], both = ni(sp + q), both_true = (sp + q)[miss])
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, na = "string", pretty = TRUE))
