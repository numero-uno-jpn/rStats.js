# oracle-platform: amd64
# Random-number (set.seed compatible) fixtures. Generated with x86_64 R (see oracle/_random.R).
source("/oracle/_random.R")

SEEDS <- c(1, 42, 2024, -7, 123456789)
# Long sequences are written as summaries (sum, index-weighted sum, last 5 values) rather than the values themselves,
# to exercise rare branches (repeated rejections etc.)
summ <- function(v) { v <- as.numeric(v); c(sum(v), sum(v * seq_along(v)), tail(v, 5)) }

# ---- Uniform, normal, exponential ----
for (s in SEEDS) {
  rcase(s, list(fn = "runif", n = 10), function() runif(10))
  rcase(s, list(fn = "rnorm", n = 20), function() rnorm(20))
  rcase(s, list(fn = "rexp", n = 20), function() rexp(20))
}
for (mm in list(c(0, 1), c(-3, 5), c(2, 2), c(1, 0), c(0, Inf), c(NaN, 1)))
  rcase(1, list(fn = "runif", n = 5, min = mm[1], max = mm[2]), function() runif(5, mm[1], mm[2]))
for (ms in list(c(0, 1), c(10, 3), c(0, 0), c(5, Inf), c(Inf, 1), c(NaN, 1), c(0, -1)))
  rcase(2, list(fn = "rnorm", n = 5, mean = ms[1], sd = ms[2]), function() rnorm(5, ms[1], ms[2]))
for (rate in c(1, 0.5, 20, Inf, 0, -1))
  rcase(3, list(fn = "rexp", n = 5, rate = rate), function() rexp(5, rate))
rcase(99, list(fn = "rnorm", n = 20000), function() summ(rnorm(20000)))
rcase(99, list(fn = "rexp", n = 20000), function() summ(rexp(20000)))
write_random_fixture("rbasic")

# ---- Gamma, χ², t, F, beta ----
shapes <- c(1e-3, 0.1, 0.5, 0.9, 1, 1.5, 2, 3, 3.686, 3.7, 5, 10, 13.022, 13.1, 20, 100, 1e5)
for (a in shapes) for (s in SEEDS[1:3])
  rcase(s, list(fn = "rgamma", n = 30, shape = a, scale = 1), function() rgamma(30, a))
for (sc in c(2.5, 0.01, 0, Inf, -1)) rcase(4, list(fn = "rgamma", n = 5, shape = 2, scale = sc), function() rgamma(5, 2, scale = sc))
for (a in c(0, Inf, NaN, -1)) rcase(4, list(fn = "rgamma", n = 5, shape = a, scale = 1), function() rgamma(5, a))
for (a in c(0.3, 1, 2.5, 7, 50)) rcase(7, list(fn = "rgamma", n = 20000, shape = a, scale = 1), function() summ(rgamma(20000, a)))
write_random_fixture("rgamma")

for (df in c(0, 0.5, 1, 2, 5, 30, 1000, Inf, -1)) rcase(5, list(fn = "rchisq", n = 10, df = df), function() rchisq(10, df))
for (df in c(0, 1, 5)) for (ncp in c(0, 0.5, 3, 40))
  rcase(6, list(fn = "rchisq", n = 10, df = df, ncp = ncp), function() rchisq(10, df, ncp = ncp))
for (df in c(0.5, 1, 3, 30, Inf, 0)) rcase(8, list(fn = "rt", n = 10, df = df), function() rt(10, df))
for (ncp in c(0, 1, -2.5)) rcase(9, list(fn = "rt", n = 10, df = 4, ncp = ncp), function() rt(10, 4, ncp = ncp))
for (d in list(c(1, 1), c(3, 7), c(10, Inf), c(Inf, 5), c(Inf, Inf), c(0, 2)))
  rcase(10, list(fn = "rf", n = 10, df1 = d[1], df2 = d[2]), function() rf(10, d[1], d[2]))
for (ncp in c(0, 2)) rcase(11, list(fn = "rf", n = 10, df1 = 3, df2 = 8, ncp = ncp), function() rf(10, 3, 8, ncp = ncp))
write_random_fixture("rchisq")

bsh <- c(0.1, 0.5, 1, 2, 5, 50)
for (a in bsh) for (b in bsh) rcase(12, list(fn = "rbeta", n = 20, shape1 = a, shape2 = b), function() rbeta(20, a, b))
for (ab in list(c(0, 0), c(0, 2), c(2, 0), c(Inf, 2), c(2, Inf), c(Inf, Inf), c(-1, 2)))
  rcase(13, list(fn = "rbeta", n = 6, shape1 = ab[1], shape2 = ab[2]), function() rbeta(6, ab[1], ab[2]))
rcase(14, list(fn = "rbeta", n = 10, shape1 = 2, shape2 = 3, ncp = 1.5), function() rbeta(10, 2, 3, ncp = 1.5))
for (ab in list(c(0.3, 0.7), c(2, 5), c(30, 0.8))) rcase(15, list(fn = "rbeta", n = 20000, shape1 = ab[1], shape2 = ab[2]), function() summ(rbeta(20000, ab[1], ab[2])))
write_random_fixture("rbeta")

# ---- Discrete distributions ----
for (lam in c(0, 0.1, 1, 5, 9.99, 10, 15, 50, 100, 1e4, 1e7, Inf, -1, NaN))
  for (s in SEEDS[1:2]) rcase(s, list(fn = "rpois", n = 30, lambda = lam), function() rpois(30, lam))
for (lam in c(3, 12, 40, 1000)) rcase(16, list(fn = "rpois", n = 20000, lambda = lam), function() summ(rpois(20000, lam)))
write_random_fixture("rpois")

for (size in c(0, 1, 5, 10, 50, 100, 1000, 1e6)) for (p in c(0, 0.01, 0.1, 0.3, 0.5, 0.7, 0.99, 1))
  rcase(17, list(fn = "rbinom", n = 20, size = size, prob = p), function() rbinom(20, size, p))
for (sp in list(c(2.5, 0.5), c(-1, 0.5), c(10, 1.5), c(Inf, 0.5), c(3e9, 0.3), c(2^31, 0.999)))
  rcase(18, list(fn = "rbinom", n = 5, size = sp[1], prob = sp[2]), function() rbinom(5, sp[1], sp[2]))
for (sp in list(c(20, 0.3), c(100, 0.5), c(1000, 0.3), c(1e5, 0.02), c(5000, 0.9)))
  rcase(19, list(fn = "rbinom", n = 20000, size = sp[1], prob = sp[2]), function() summ(rbinom(20000, sp[1], sp[2])))
write_random_fixture("rbinom")

for (p in c(1, 0.9, 0.5, 0.1, 0.001, 0, 1.5)) rcase(20, list(fn = "rgeom", n = 20, prob = p), function() rgeom(20, p))
for (sz in c(0.5, 1, 3, 50, Inf)) for (p in c(0.2, 0.7, 1))
  rcase(21, list(fn = "rnbinom", n = 20, size = sz, prob = p), function() rnbinom(20, sz, prob = p))
for (sz in c(0.5, 3, 50)) for (mu in c(0, 0.5, 10, 300))
  rcase(22, list(fn = "rnbinom", n = 20, size = sz, mu = mu), function() rnbinom(20, sz, mu = mu))
write_random_fixture("rnbinom")

# ---- Other continuous distributions ----
for (ls in list(c(0, 1), c(3, 0.5), c(0, 0), c(Inf, 1), c(0, -1))) {
  rcase(23, list(fn = "rcauchy", n = 10, location = ls[1], scale = ls[2]), function() rcauchy(10, ls[1], ls[2]))
  rcase(24, list(fn = "rlogis", n = 10, location = ls[1], scale = ls[2]), function() rlogis(10, ls[1], ls[2]))
  rcase(25, list(fn = "rlnorm", n = 10, meanlog = ls[1], sdlog = ls[2]), function() rlnorm(10, ls[1], ls[2]))
}
for (ss in list(c(1, 1), c(0.5, 2), c(3, 10), c(2, 0), c(0, 1)))
  rcase(26, list(fn = "rweibull", n = 10, shape = ss[1], scale = ss[2]), function() rweibull(10, ss[1], ss[2]))
write_random_fixture("rother")

# ---- Rank statistics ----
for (n in c(0, 1, 5, 20, 100)) rcase(27, list(fn = "rsignrank", nn = 10, n = n), function() rsignrank(10, n))
for (mn in list(c(1, 1), c(3, 4), c(10, 10), c(30, 5), c(0, 5))) rcase(28, list(fn = "rwilcox", nn = 10, m = mn[1], n = mn[2]), function() rwilcox(10, mn[1], mn[2]))
write_random_fixture("rrank")

# ---- sample ----
for (s in SEEDS) {
  rcase(s, list(fn = "sample.int", n = 10), function() sample.int(10))
  rcase(s, list(fn = "sample.int", n = 100, size = 5), function() sample.int(100, 5))
  rcase(s, list(fn = "sample.int", n = 6, size = 20, replace = TRUE), function() sample.int(6, 20, replace = TRUE))
}
rcase(29, list(fn = "sample.int", n = 2^31 - 1, size = 5), function() sample.int(2^31 - 1, 5))
rcase(29, list(fn = "sample.int", n = 1e8, size = 5), function() sample.int(1e8, 5))
rcase(29, list(fn = "sample.int", n = 3e6, size = 5), function() sample.int(3e6, 5))
rcase(29, list(fn = "sample.int", n = 1, size = 3, replace = TRUE), function() sample.int(1, 3, replace = TRUE))
pr <- c(0.1, 0.2, 0.3, 0.2, 0.2)
rcase(30, list(fn = "sample.int", n = 5, size = 20, replace = TRUE, prob = pr), function() sample.int(5, 20, TRUE, pr))
rcase(30, list(fn = "sample.int", n = 5, size = 5, replace = FALSE, prob = pr), function() sample.int(5, 5, FALSE, pr))
rcase(31, list(fn = "sample.int", n = 5, size = 3, replace = FALSE, prob = c(3, 0, 1, 1, 5)), function() sample.int(5, 3, FALSE, c(3, 0, 1, 1, 5)))
set.seed(0); wp <- runif(300)
rcase(32, list(fn = "sample.int", n = 300, size = 50, replace = TRUE, prob = wp), function() sample.int(300, 50, TRUE, wp))
rcase(32, list(fn = "sample.int", n = 300, size = 50, replace = FALSE, prob = wp), function() sample.int(300, 50, FALSE, wp))
ep <- rep(1, 250)
rcase(33, list(fn = "sample.int", n = 250, size = 30, replace = TRUE, prob = ep), function() sample.int(250, 30, TRUE, ep))
write_random_fixture("rsample")

# ---- Multinomial ----
rcase(34, list(fn = "rmultinom", n = 3, size = 10, prob = c(0.2, 0.5, 0.3)), function() rmultinom(3, 10, c(0.2, 0.5, 0.3)))
rcase(34, list(fn = "rmultinom", n = 2, size = 100, prob = c(1, 0, 3, 6)), function() rmultinom(2, 100, c(1, 0, 3, 6)))
write_random_fixture("rmultinom")

# ---- State carry-over (calls with changing parameters) ----
rcase(35, list(script = "mixed"), function() c(rbinom(5, 10, 0.3), rbinom(5, 100, 0.5), rbinom(5, 10, 0.3),
  rpois(5, 3), rpois(5, 30), rpois(5, 3), rgamma(3, 2), rgamma(3, 0.5), rgamma(3, 2),
  rbeta(3, 2, 3), rbeta(3, 0.5, 0.5), rbeta(3, 2, 3), rbinom(5, 100, 0.7), rbinom(5, 100, 0.3)))
write_random_fixture("rstate")

# ---- Hypergeometric ----
for (mnk in list(c(5, 5, 3), c(10, 7, 8), c(3, 20, 10), c(50, 50, 30), c(200, 300, 150), c(1000, 20, 500),
                 c(0, 5, 2), c(5, 0, 2), c(5, 5, 0), c(5, 5, 10), c(5, 5, 11), c(2.4, 5, 2), c(1e4, 1e4, 9000), c(3e9, 2e9, 7), c(3e9, 2e9, 1)))
  rcase(36, list(fn = "rhyper", nn = 20, m = mnk[1], n = mnk[2], k = mnk[3]), function() rhyper(20, mnk[1], mnk[2], mnk[3]))
for (mnk in list(c(30, 40, 20), c(500, 600, 400), c(5000, 3000, 2500), c(1e5, 2e5, 5e4)))
  rcase(37, list(fn = "rhyper", n = 20000, m = mnk[1], nb = mnk[2], k = mnk[3]), function() summ(rhyper(20000, mnk[1], mnk[2], mnk[3])))
write_random_fixture("rhyper")

# ---- Long sequences (exercising rare branches) ----
for (s in c(101, 202)) {
  for (a in c(0.05, 0.7, 1.2, 4, 13.5, 1000)) rcase(s, list(fn = "rgamma", n = 20000, shape = a, scale = 1), function() summ(rgamma(20000, a)))
  for (lam in c(9.5, 10, 10.5, 25, 300, 1e5)) rcase(s, list(fn = "rpois", n = 20000, lambda = lam), function() summ(rpois(20000, lam)))
  for (sp in list(c(60, 0.5), c(31, 0.97), c(200, 0.15), c(1e6, 0.4), c(1e4, 0.003), c(45, 0.7)))
    rcase(s, list(fn = "rbinom", n = 20000, size = sp[1], prob = sp[2]), function() summ(rbinom(20000, sp[1], sp[2])))
  for (ab in list(c(0.5, 0.5), c(1, 1), c(0.9, 3), c(2, 2), c(1.5, 40), c(1e-3, 2)))
    rcase(s, list(fn = "rbeta", n = 20000, shape1 = ab[1], shape2 = ab[2]), function() summ(rbeta(20000, ab[1], ab[2])))
  for (mnk in list(c(300, 500, 400), c(60, 70, 60), c(2000, 100, 1500), c(150, 150, 140)))
    rcase(s, list(fn = "rhyper", n = 20000, m = mnk[1], nb = mnk[2], k = mnk[3]), function() summ(rhyper(20000, mnk[1], mnk[2], mnk[3])))
  rcase(s, list(fn = "rnbinom", n = 20000, size = 2.5, prob = 0.3), function() summ(rnbinom(20000, 2.5, 0.3)))
  rcase(s, list(fn = "rnbinom", n = 20000, size = 0.4, mu = 50), function() summ(rnbinom(20000, 0.4, mu = 50)))
  rcase(s, list(fn = "rt", n = 20000, df = 3), function() summ(rt(20000, 3)))
  rcase(s, list(fn = "rf", n = 20000, df1 = 2, df2 = 9), function() summ(rf(20000, 2, 9)))
  rcase(s, list(fn = "rchisq", n = 20000, df = 3, ncp = 2), function() summ(rchisq(20000, 3, ncp = 2)))
  rcase(s, list(fn = "rwilcox", n = 20000, m = 50, nb = 60), function() summ(rwilcox(20000, 50, 60)))
  rcase(s, list(fn = "rsignrank", n = 20000, nb = 200), function() summ(rsignrank(20000, 200)))
  rcase(s, list(fn = "rgeom", n = 20000, prob = 0.02), function() summ(rgeom(20000, 0.02)))
}
write_random_fixture("rlong")
