# regression-rlm-lts-h.R: which h MASS 7.3-66's LTS objective (lqs(method = "lts")$crit) uses when n is even and p
# is odd (n = 20, p = 3), where floor(n/2) + floor((p+1)/2) = 12 and floor((n+p)/2) = 11; public functions only
suppressMessages(library(MASS))
d <- stackloss[-1, ]
f <- lqs(stack.loss ~ Air.Flow + Water.Temp, data = d, method = "lts", nsamp = "exact")
r <- sort(residuals(f)^2)
cat(sprintf("n = %d, p = %d, crit = %.15g\n", nrow(d), 3L, f$crit))
for (h in 10:13) cat(sprintf("sum of the %d smallest squared residuals = %.15g\n", h, sum(r[1:h])))
