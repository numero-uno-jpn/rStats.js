source("/oracle/_common.R")

p <- c(0, 1e-320, 1e-300, 1e-200, 1e-100, 1e-50, 1e-20, 1e-16, 1e-10, 1e-5,
       0.001, 0.01, 0.025, 0.05, 0.1, 0.135, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7,
       0.8, 0.865, 0.9, 0.95, 0.975, 0.99, 0.999, 1 - 1e-10, 1 - 1e-15, 1,
       -0.1, 1.1, Inf, NaN, NA)
logp <- c(-Inf, -1.7e308, -1e300, -1e100, -1e10, -1e5, -3000, -2049, -2047, -1000, -745, -700, -100, -32, -10, -2, -1, -0.5,
          -0.1, -1e-5, -1e-10, -1e-300, 0, 0.5, NaN)

params <- data.frame(
  mean = c(0, 5, -3, 1e10, 0, 0,  Inf, 0,   NaN),
  sd   = c(1, 2, 0.1, 1e5, 0, -1, 1,   Inf, 1)
)

grid <- rbind(
  subset(expand_cases("p", p, params), !logP),
  subset(expand_cases("p", logp, params), logP)
)
write_fixture("qnorm", grid, function(r)
  qnorm(r$p, r$mean, r$sd, lower.tail = r$lowerTail, log.p = r$logP))
