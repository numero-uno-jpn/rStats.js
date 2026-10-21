source("/oracle/_common.R")

q <- c(-Inf, -1e5, -1000, -40, -38.5, -37.5, -30, -20, -10, -8, -5, -3, -2,
       -1.96, -1.5, -1, -0.5, -1e-10, -1e-300, 0, 1e-300, 1e-10, 0.5, 1, 1.5,
       1.96, 2, 3, 5, 8, 10, 20, 30, 37.5, 38.5, 40, 1000, 1e5, Inf, NaN, NA,
       seq(-9.9, 9.9, by = 0.37))

params <- data.frame(
  mean = c(0, 5, -3, 1e10, 0,   0,  Inf, 0,   NaN),
  sd   = c(1, 2, 0.1, 1e5, 0,  -1,  1,   Inf, 1)
)

grid <- expand_cases("q", q, params)
write_fixture("pnorm", grid, function(r)
  pnorm(r$q, r$mean, r$sd, lower.tail = r$lowerTail, log.p = r$logP))
