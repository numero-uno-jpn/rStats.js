source("/oracle/_common.R")

# Uniform, exponential, lognormal, logistic, Cauchy, Weibull (continuous distributions with closed forms)

smp <- function(x) Rmpfr::mpfr(x, MPFR_BITS)
okf <- function(...) all(is.finite(c(...)))
outp <- function(v, log) if (log) log(v) else v
# Build the lower / log combinations from one tail probability (mpfr) (the side close to 1 is 1 - other side)
tail_val <- function(lowerp, upperp, lower, log) {
  v <- if (lower) lowerp else upperp
  if (log) log(v) else v
}

# ---- Uniform distribution ----
ux <- c(-1, 0, 1e-300, 0.1, 0.3, 0.5, 0.7, 0.9, 0.999, 1, 1.5, 2, 2.5, 3, 7, 10, 1e10, Inf, -Inf, NaN)
up <- data.frame(min = c(0, -1, 0.1, 1, -1e10, 1e-300, 0, 1, 1, -Inf, 0, -1e308, NaN, 2.5, 0, 3),
                 max = c(1, 1, 0.4, 3, 1e10, 2e-300, 1e-320, 1, 0, 1, Inf, 1e308, 1, 7.25, NaN, 3.5))
ug <- merge(data.frame(x = ux), up, by = NULL)
write_fixture("dunif", with_log(ug), function(r) dunif(r$x, r$min, r$max, log = r$log))
names(ug)[1] <- "q"
write_fixture("punif", with_tails(ug), function(r)
  punif(r$q, r$min, r$max, lower.tail = r$lowerTail, log.p = r$logP),
  function(r) {
    if (!(okf(r$q, r$min, r$max) && r$min < r$q && r$q < r$max)) return(NA)
    a <- smp(r$min); b <- smp(r$max); q <- smp(r$q)
    tail_val((q - a) / (b - a), (b - q) / (b - a), r$lowerTail, r$logP)
  })
write_fixture("qunif", quantile_grid(up), function(r)
  qunif(r$p, r$min, r$max, lower.tail = r$lowerTail, log.p = r$logP))

# ---- Exponential distribution ----
ex <- c(0, 1e-300, 1e-20, 1e-10, 1e-5, 0.001, 0.1, 0.5, 1, 2, 3, 5, 10, 20, 50, 100, 300,
        700, 745, 750, 1000, 1e5, 1e300, Inf, -1, -Inf, NaN)
rates <- c(1, 0.1, 1/3, 2.5, 3, 7.3, 1e-10, 1e-300, 1e10, 1e300, 0, Inf, -1, NaN)
eg <- grid_of(x = ex, rate = rates)
write_fixture("dexp", with_log(eg), function(r) dexp(r$x, r$rate, log = r$log),
  function(r) {
    if (!(okf(r$x, r$rate) && r$x >= 0 && r$rate > 0)) return(NA)
    R <- smp(r$rate)
    if (r$log) log(R) - R * r$x else R * exp(-R * r$x)
  })
names(eg)[1] <- "q"
write_fixture("pexp", with_tails(eg), function(r)
  pexp(r$q, r$rate, lower.tail = r$lowerTail, log.p = r$logP),
  function(r) {
    if (!(okf(r$q, r$rate) && r$q > 0 && r$rate > 0)) return(NA)
    t <- smp(r$rate) * r$q
    if (!r$lowerTail) return(if (r$logP) -t else exp(-t))
    # Log of values close to 1 via log1p (at 300 bits, 1 - 1e-108 is rounded away)
    if (r$logP) log1p(-exp(-t)) else -expm1(-t)
  })
write_fixture("qexp", quantile_grid(data.frame(rate = rates)), function(r)
  qexp(r$p, r$rate, lower.tail = r$lowerTail, log.p = r$logP))

# ---- Lognormal distribution ----
lx <- c(0, 1e-300, 1e-100, 1e-20, 1e-10, 1e-5, 0.001, 0.1, 0.5, 1, 1.5, 2, 5, 10, 100, 1e5,
        1e10, 1e20, 1e100, 1e300, Inf, -1, NaN)
lp <- data.frame(meanlog = c(0, 0, 0, 1, -3, 10, 100, -100, 0, 0, 0, 0, Inf, -Inf, 0, NaN, 0, 700),
                 sdlog = c(1, 0.1, 5, 2, 0.5, 0.01, 10, 3, 1e-10, 100, 0, Inf, 1, 1, -1, 1, NaN, 20))
lg <- merge(data.frame(x = lx), lp, by = NULL)
# Φ(z) = erfc(-z/√2)/2
# The log of the side close to 1 is built from the other (smaller) side with log1p
ref_pnorm <- function(z, lower, log) {
  own <- if (lower) Rmpfr::erfc(-z / sqrt(smp(2))) / 2 else Rmpfr::erfc(z / sqrt(smp(2))) / 2
  other <- if (lower) Rmpfr::erfc(z / sqrt(smp(2))) / 2 else Rmpfr::erfc(-z / sqrt(smp(2))) / 2
  if (!log) return(own)
  if (asNumeric(other) < 0.5) log1p(-other) else log(own)
}
write_fixture("dlnorm", with_log(lg), function(r) dlnorm(r$x, r$meanlog, r$sdlog, log = r$log),
  function(r) {
    if (!(okf(r$x, r$meanlog, r$sdlog) && r$x > 0 && r$sdlog > 0)) return(NA)
    z <- (log(smp(r$x)) - r$meanlog) / r$sdlog
    ld <- -z^2 / 2 - log(smp(r$sdlog) * r$x) - log(2 * Rmpfr::Const("pi", MPFR_BITS)) / 2
    if (r$log) ld else exp(ld)
  })
names(lg)[1] <- "q"
write_fixture("plnorm", with_tails(lg), function(r)
  plnorm(r$q, r$meanlog, r$sdlog, lower.tail = r$lowerTail, log.p = r$logP),
  function(r) {
    if (!(okf(r$q, r$meanlog, r$sdlog) && r$q > 0 && r$sdlog > 0)) return(NA)
    ref_pnorm((log(smp(r$q)) - r$meanlog) / r$sdlog, r$lowerTail, r$logP)
  })
write_fixture("qlnorm", quantile_grid(lp), function(r)
  qlnorm(r$p, r$meanlog, r$sdlog, lower.tail = r$lowerTail, log.p = r$logP))

# ---- Logistic and Cauchy distributions ----
sx <- c(-Inf, -1e300, -1e200, -1e154, -1e20, -1e5, -1000, -745, -700, -100, -40, -20, -10, -5,
        -2, -1, -0.5, -1e-5, -1e-300, 0, 1e-10, 0.5, 1, 2, 3, 10, 20, 40, 100, 700, 745, 800,
        1e5, 1e20, 1e154, 1e300, Inf, NaN)
sp <- data.frame(location = c(0, 0, 3, -2, 100, 0, 1e10, 0, 0, 0, Inf, NaN, 0, 0.1),
                 scale = c(1, 2.5, 0.1, 7, 1e-3, 1e-300, 1e5, 0, -1, Inf, 1, 1, NaN, 1e300))
sg <- merge(data.frame(x = sx), sp, by = NULL)
zmp <- function(x, m, s) (smp(x) - m) / s
write_fixture("dlogis", with_log(sg), function(r) dlogis(r$x, r$location, r$scale, log = r$log),
  function(r) {
    if (!(okf(r$x, r$location, r$scale) && r$scale > 0)) return(NA)
    z <- zmp(r$x, r$location, r$scale); e <- exp(-abs(z))
    v <- e / (r$scale * (1 + e)^2)
    if (r$log) -abs(z) - log(smp(r$scale)) - 2 * log1p(e) else v
  })
write_fixture("dcauchy", with_log(sg), function(r) dcauchy(r$x, r$location, r$scale, log = r$log),
  function(r) {
    if (!(okf(r$x, r$location, r$scale) && r$scale > 0)) return(NA)
    z <- zmp(r$x, r$location, r$scale)
    v <- 1 / (Rmpfr::Const("pi", MPFR_BITS) * r$scale * (1 + z^2))
    if (r$log) log(v) else v
  })
names(sg)[1] <- "q"
write_fixture("plogis", with_tails(sg), function(r)
  plogis(r$q, r$location, r$scale, lower.tail = r$lowerTail, log.p = r$logP),
  function(r) {
    if (!(okf(r$q, r$location, r$scale) && r$scale > 0)) return(NA)
    z <- zmp(r$q, r$location, r$scale)
    t <- if (r$lowerTail) z else -z
    # P = 1/(1 + exp(-t)), log P = -log1p(exp(-t))
    if (r$logP) -log1p(exp(-t)) else 1 / (1 + exp(-t))
  })
write_fixture("pcauchy", with_tails(sg), function(r)
  pcauchy(r$q, r$location, r$scale, lower.tail = r$lowerTail, log.p = r$logP),
  function(r) {
    if (!(okf(r$q, r$location, r$scale) && r$scale > 0)) return(NA)
    z <- zmp(r$q, r$location, r$scale)
    t <- if (r$lowerTail) z else -z
    pi <- Rmpfr::Const("pi", MPFR_BITS)
    # For t < 0, atan(1/|t|)/π (no subtraction from 1/2). The log of the side close to 1 via log1p
    if (t < 0) { v <- atan(-1 / t) / pi; return(if (r$logP) log(v) else v) }
    if (t == 0) return(if (r$logP) log(smp(0.5)) else smp(0.5))
    w <- atan(1 / t) / pi
    if (r$logP) log1p(-w) else 1 - w
  })
qsp <- sp
write_fixture("qlogis", quantile_grid(qsp), function(r)
  qlogis(r$p, r$location, r$scale, lower.tail = r$lowerTail, log.p = r$logP))
write_fixture("qcauchy", quantile_grid(qsp), function(r)
  qcauchy(r$p, r$location, r$scale, lower.tail = r$lowerTail, log.p = r$logP))

# ---- Weibull distribution ----
wx <- c(0, 1e-300, 1e-100, 1e-20, 1e-10, 1e-5, 0.001, 0.1, 0.5, 0.9, 1, 1.1, 1.5, 2, 3, 5, 10,
        20, 30, 100, 700, 1e4, 1e10, 1e100, Inf, -1, NaN)
wp <- rbind(grid_of(shape = c(0.01, 0.1, 0.5, 1, 1.5, 2, 3, 5, 10, 50), scale = c(1, 2.5)),
            data.frame(shape = c(2, 0.5, 2, 0, -1, Inf, 2, 0.5, Inf, NaN, 2, 1e-10, 1000),
                       scale = c(1e-5, 1e5, 0, 1, 1, 1, Inf, Inf, 2, 1, NaN, 1, 1)))
wg <- merge(data.frame(x = wx), wp, by = NULL)
write_fixture("dweibull", with_log(wg), function(r) dweibull(r$x, r$shape, r$scale, log = r$log),
  function(r) {
    if (!(okf(r$x, r$shape, r$scale) && r$x > 0 && r$shape > 0 && r$scale > 0)) return(NA)
    lu <- log(smp(r$x) / r$scale); k <- smp(r$shape)
    ld <- log(k / r$scale) + (k - 1) * lu - exp(k * lu)
    if (r$log) ld else exp(ld)
  })
names(wg)[1] <- "q"
write_fixture("pweibull", with_tails(wg), function(r)
  pweibull(r$q, r$shape, r$scale, lower.tail = r$lowerTail, log.p = r$logP),
  function(r) {
    if (!(okf(r$q, r$shape, r$scale) && r$q > 0 && r$shape > 0 && r$scale > 0)) return(NA)
    t <- exp(smp(r$shape) * log(smp(r$q) / r$scale))
    if (!r$lowerTail) return(if (r$logP) -t else exp(-t))
    # Log of values close to 1 via log1p (at 300 bits, 1 - 1e-108 is rounded away)
    if (r$logP) log1p(-exp(-t)) else -expm1(-t)
  })
write_fixture("qweibull", quantile_grid(wp), function(r)
  qweibull(r$p, r$shape, r$scale, lower.tail = r$lowerTail, log.p = r$logP))
