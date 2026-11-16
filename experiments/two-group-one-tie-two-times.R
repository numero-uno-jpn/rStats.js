# issue: 525
# Two groups, two event times; the second time has a cause-1 tie and unequal group KM.
time <- c(1,2,2,4,5, 2,2,3,4,5)
status <- c(1,1,0,0,0, 1,0,0,0,0)
group <- rep(c("A","B"), each = 5)

score17 <- function(rho) {
  gr <- sort(unique(group))
  ev <- sort(unique(time[status != 0]))
  S <- rep(1, length(gr))
  F1 <- rep(0, length(gr))
  G <- 1
  z <- rep(0, length(gr))
  for (t in ev) {
    Y <- vapply(gr, function(g) sum(group == g & time >= t), 0L)
    d1 <- vapply(gr, function(g) sum(group == g & time == t & status == 1), 0L)
    d2 <- vapply(gr, function(g) sum(group == g & time == t & status != 0 & status != 1), 0L)
    h <- ifelse(Y == 0, 0, Y / S)
    R <- ifelse(Y == 0, 0, Y * (1 - F1) / S)
    d <- sum(d1)
    ht <- sum(h)
    rt <- sum(R)
    if (rt > 0) z <- z + G^rho * (d1 - R * d / rt)
    df0 <- if (ht > 0) d / ht else 0
    F1 <- F1 + ifelse(Y == 0, 0, S * d1 / Y)
    S <- ifelse(Y == 0, 0, S * (1 - (d1 + d2) / Y))
    G <- G - df0
  }
  fit <- cmprsk::cuminc(time, status, group, rho = rho)
  stat <- unname(fit$Tests["1", "stat"])
  c(z1 = unname(z[1]), z2 = unname(z[2]), stat = stat,
    V = unname(z[1])^2 / stat)
}

for (rho in c(-3, -2, -1, 0, 0.25, 0.5, 1, 2, 3, 5)) {
  v <- score17(rho)
  cat("rho=", sprintf("%.17g", rho),
      " z1=", sprintf("%.17g", v[["z1"]]),
      " z2=", sprintf("%.17g", v[["z2"]]),
      " stat=", sprintf("%.17g", v[["stat"]]),
      " V=", sprintf("%.17g", v[["V"]]), "\n", sep = "")
}
