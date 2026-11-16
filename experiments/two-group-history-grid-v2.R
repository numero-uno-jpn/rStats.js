# issue: 525
# Two-group tied-time experiments: vary pre-tie cause history, tie allocation, and risk-set sizes.
score_stat <- function(dat, rho) {
  groups <- sort(unique(dat$group))
  strata <- sort(unique(dat$strata))
  z <- rep(0, length(groups))
  for (st in strata) {
    ix <- dat$strata == st
    tt <- dat$time[ix]; ss <- dat$status[ix]; gg <- dat$group[ix]
    ev <- sort(unique(tt[ss != 0]))
    S <- rep(1, length(groups)); F1 <- rep(0, length(groups)); G <- 1
    for (t in ev) {
      Y <- vapply(groups, function(g) sum(gg == g & tt >= t), 0L)
      d1 <- vapply(groups, function(g) sum(gg == g & tt == t & ss == 1), 0L)
      d2 <- vapply(groups, function(g) sum(gg == g & tt == t & ss != 0 & ss != 1), 0L)
      h <- ifelse(Y == 0, 0, Y / S)
      R <- ifelse(Y == 0, 0, Y * (1 - F1) / S)
      d <- sum(d1); ht <- sum(h); rt <- sum(R)
      if (rt > 0) z <- z + G^rho * (d1 - R * d / rt)
      F1 <- F1 + ifelse(Y == 0, 0, S * d1 / Y)
      S <- ifelse(Y == 0, 0, S * (1 - (d1 + d2) / Y))
      G <- G - if (ht > 0) d / ht else 0
    }
  }
  fit <- cmprsk::cuminc(dat$time, dat$status, dat$group, strata = dat$strata, rho = rho)
  stat <- unname(fit$Tests["1", "stat"])
  c(z = unname(z[1]), stat = stat, V = unname(z[1])^2 / stat)
}
make_case <- function(name, nA, nB, p1A, p2A, p1B, p2B, tie1A, tie1B, tie2A = 0, tie2B = 0) {
  time <- c(rep(1, p1A + p2A), rep(2, tie1A + tie2A), rep(4, nA - p1A - p2A - tie1A - tie2A),
            rep(1, p1B + p2B), rep(2, tie1B + tie2B), rep(4, nB - p1B - p2B - tie1B - tie2B))
  status <- c(rep(1, p1A), rep(2, p2A), rep(1, tie1A), rep(2, tie2A), rep(0, nA - p1A - p2A - tie1A - tie2A),
              rep(1, p1B), rep(2, p2B), rep(1, tie1B), rep(2, tie2B), rep(0, nB - p1B - p2B - tie1B - tie2B))
  group <- c(rep("A", nA), rep("B", nB))
  data.frame(name = name, time = time, status = status, group = group, strata = rep("s", length(time)))
}
cases <- list(
  make_case("tie_equal_no_history", 5, 5, 0,0,0,0, 2,2),
  make_case("prior_cause2_A", 5,5, 0,1,0,0, 1,1),
  make_case("prior_cause2_B", 5,5, 0,0,0,1, 1,1),
  make_case("prior_cause1_A", 5,5, 1,0,0,0, 1,1),
  make_case("prior_cause1_B", 5,5, 0,0,1,0, 1,1),
  make_case("prior_cause1_A_cause2_B", 5,5, 1,0,0,1, 1,1),
  make_case("prior_cause2_A_cause1_B", 5,5, 0,1,1,0, 1,1),
  make_case("tie_2A_1B", 6,6, 0,1,0,0, 2,1),
  make_case("tie_1A_2B", 6,6, 0,0,0,1, 1,2),
  make_case("tie_2A_2B", 7,7, 0,1,0,1, 2,2),
  make_case("tie_3A_1B", 7,6, 0,1,0,0, 3,1),
  make_case("tie_1A_3B", 6,7, 0,0,0,1, 1,3),
  make_case("tie_with_other_A", 6,6, 0,1,0,0, 1,1, 1,0),
  make_case("tie_with_other_B", 6,6, 0,0,0,1, 1,1, 0,1),
  make_case("unequal_sizes_3_6", 3,6, 0,1,0,0, 1,1),
  make_case("unequal_sizes_6_3", 6,3, 0,0,0,1, 1,1)
)
rhos <- c(-2, -1, 0, 0.5, 1, 2, 3)
for (dat in cases) {
  cat("CASE ", unique(dat$name), "\n", sep = "")
  for (rho in rhos) {
    v <- score_stat(dat, rho)
    cat("rho=", sprintf("%.17g", rho), " z=", sprintf("%.17g", v[["z"]]),
        " stat=", sprintf("%.17g", v[["stat"]]), " V=", sprintf("%.17g", v[["V"]]), "\n", sep = "")
  }
}
