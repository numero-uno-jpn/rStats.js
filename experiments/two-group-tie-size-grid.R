# issue: 525
# V(x) coefficients for one early event followed by a two-subject tied event.
score17 <- function(nA, nB, rho) {
  time <- c(1, 2, rep(4, nA - 2), 2, rep(4, nB - 1))
  status <- c(1, 1, rep(0, nA - 2), 1, rep(0, nB - 1))
  group <- c(rep("A", nA), rep("B", nB))
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
  x <- ((nA + nB - 1) / (nA + nB))^rho
  c(z1 = unname(z[1]), z2 = unname(z[2]), x = x,
    stat = stat, V = unname(z[1])^2 / stat)
}

for (sizes in list(c(2,2), c(2,3), c(3,2), c(3,3),
                   c(3,4), c(4,3), c(4,5), c(5,4))) {
  nA <- sizes[1]
  nB <- sizes[2]
  for (rho in c(-2, -1, 0, 0.5, 1, 2, 3)) {
    v <- score17(nA, nB, rho)
    cat("nA=", nA, " nB=", nB,
        " rho=", sprintf("%.17g", rho),
        " x=", sprintf("%.17g", v[["x"]]),
        " z1=", sprintf("%.17g", v[["z1"]]),
        " z2=", sprintf("%.17g", v[["z2"]]),
        " stat=", sprintf("%.17g", v[["stat"]]),
        " V=", sprintf("%.17g", v[["V"]]), "\n", sep = "")
  }
}
