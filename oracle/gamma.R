source("/oracle/_common.R")

shapes <- c(0, 1e-10, 0.001, 0.1, 0.5, 0.9, 1, 1.5, 2, 3, 5, 10, 19.5, 20.5, 50,
            100, 199, 201, 500, 1000, 1e4, 1e5, 1e6)
xs <- c(0, 1e-300, 1e-100, 1e-20, 1e-10, 1e-5, 0.001, 0.01, 0.1, 0.3, 0.5, 0.9,
        1, 1.1, 1.5, 2, 2.5, 3, 5, 7.5, 10, 15, 20, 30, 50, 75, 100, 150, 200,
        300, 500, 1000, 1e4, 1e5, 1e6, 1e10, Inf, -1, NaN)

# General grid + points near x ≈ shape for each shape (the region of Temme's asymptotic expansion)
near <- do.call(rbind, lapply(shapes[shapes > 0], function(a)
  data.frame(x = a * c(0.5, 0.9, 0.99, 1, 1.01, 1.1, 1.5, 2), shape = a)))
base <- rbind(grid_of(x = xs, shape = shapes), near)
base$scale <- 1
extra <- grid_of(x = c(0.5, 3, 20), shape = c(0.5, 3, 100), scale = c(0.01, 2.5, 1e5))
bad <- data.frame(x = 1, shape = c(-1, 2, 2, NaN), scale = c(1, 0, -1, 1))
dgrid <- rbind(base, extra, bad)

# High-precision reference: f(x) = x^(a-1) e^(-x/s) / (Gamma(a) s^a)
ref_dgamma <- function(x, a, s, log) {
  if (!(is.finite(x) && x > 0 && is.finite(a) && a > 0 && is.finite(s) && s > 0)) return(NA)
  lx <- log(mp(x)); ls <- log(mp(s))
  ld <- (mp(a) - 1) * lx - mp(x) / mp(s) - lgamma(mp(a)) - mp(a) * ls
  if (log) ld else exp(ld)
}
write_fixture("dgamma", with_log(dgrid), function(r)
  dgamma(r$x, r$shape, scale = r$scale, log = r$log),
  function(r) ref_dgamma(r$x, r$shape, r$scale, r$log))

pgrid <- dgrid
names(pgrid)[names(pgrid) == "x"] <- "q"
write_fixture("pgamma", with_tails(pgrid), function(r)
  pgamma(r$q, r$shape, scale = r$scale, lower.tail = r$lowerTail, log.p = r$logP),
  function(r) ref_gammainc(r$shape, r$q / r$scale, r$lowerTail, r$logP))

qparams <- rbind(data.frame(shape = shapes, scale = 1),
                 data.frame(shape = c(0.5, 3, 100), scale = c(0.01, 2.5, 1e5)),
                 data.frame(shape = c(-1, 2, NaN), scale = c(1, -1, 1)))
write_fixture("qgamma", quantile_grid(qparams), function(r)
  qgamma(r$p, r$shape, scale = r$scale, lower.tail = r$lowerTail, log.p = r$logP))

# χ²
dfs <- c(0, 0.5, 1, 2, 3, 5, 10, 50, 100, 1000, 1e5, -1, NaN)
cx <- c(0, 1e-300, 1e-10, 0.001, 0.1, 0.5, 1, 2, 3.84, 5, 10, 20, 50, 100, 200,
        1000, 1e4, 1e6, Inf, -1, NaN)
cgrid <- grid_of(x = cx, df = dfs)
write_fixture("dchisq", with_log(cgrid), function(r) dchisq(r$x, r$df, log = r$log))
names(cgrid)[1] <- "q"
write_fixture("pchisq", with_tails(cgrid), function(r)
  pchisq(r$q, r$df, lower.tail = r$lowerTail, log.p = r$logP),
  function(r) ref_gammainc(r$df / 2, r$q / 2, r$lowerTail, r$logP))
write_fixture("qchisq", quantile_grid(data.frame(df = dfs)), function(r)
  qchisq(r$p, r$df, lower.tail = r$lowerTail, log.p = r$logP))

# Poisson
lambdas <- c(0, 1e-10, 0.01, 0.5, 1, 2.5, 10, 30, 100, 1000, 1e5, 1e6, 1e10, -1, Inf, NaN)
px <- c(0:30, 50, 100, 300, 1000, 3000, 1e4, 1e5, 1e6, 1e7, 1e10, 2.5, -1, Inf, NaN)
pg <- grid_of(x = px, lambda = lambdas)
# Threshold for the integer check (R uses relative 1e-9)
pg <- rbind(pg, data.frame(x = c(2 + 1e-8, 2 + 9e-10, 1e6 + 2e-3, 1e6 + 5e-4), lambda = c(2, 2, 1e6, 1e6)))
write_fixture("dpois", with_log(pg), function(r) dpois(r$x, r$lambda, log = r$log))
names(pg)[1] <- "q"
# P[X <= x] = Q(floor(x) + 1, lambda)
write_fixture("ppois", with_tails(pg), function(r)
  ppois(r$q, r$lambda, lower.tail = r$lowerTail, log.p = r$logP),
  function(r) if (is.finite(r$q) && r$q >= 0 && r$q <= 1e7)
    ref_gammainc(floor(r$q + 1e-7) + 1, r$lambda, !r$lowerTail, r$logP) else NA)
write_fixture("qpois", quantile_grid(data.frame(lambda = lambdas)), function(r)
  qpois(r$p, r$lambda, lower.tail = r$lowerTail, log.p = r$logP))
