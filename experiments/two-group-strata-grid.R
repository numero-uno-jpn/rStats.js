# issue: 525
# Two-group stratified tied-time experiments: move ties and unequal histories between strata.
score_stat <- function(dat, rho) {
  groups <- sort(unique(dat$group)); strata <- sort(unique(dat$strata)); z <- rep(0, length(groups))
  for (st in strata) {
    ix <- dat$strata == st
    tt <- dat$time[ix]; ss <- dat$status[ix]; gg <- dat$group[ix]
    ev <- sort(unique(tt[ss != 0]))
    S <- rep(1, length(groups)); F1 <- rep(0, length(groups)); G <- 1
    for (t in ev) {
      Y <- vapply(groups, function(g) sum(gg == g & tt >= t), 0L)
      d1 <- vapply(groups, function(g) sum(gg == g & tt == t & ss == 1), 0L)
      d2 <- vapply(groups, function(g) sum(gg == g & tt == t & ss != 0 & ss != 1), 0L)
      h <- ifelse(Y == 0, 0, Y / S); R <- ifelse(Y == 0, 0, Y * (1 - F1) / S)
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
mk <- function(st, nA, nB, p2A, p2B, tieA, tieB, otherA = 0, otherB = 0) {
  time <- c(rep(1, p2A), rep(2, tieA + otherA), rep(4, nA - p2A - tieA - otherA),
            rep(1, p2B), rep(2, tieB + otherB), rep(4, nB - p2B - tieB - otherB))
  status <- c(rep(2, p2A), rep(1, tieA), rep(2, otherA), rep(0, nA-p2A-tieA-otherA),
              rep(2, p2B), rep(1, tieB), rep(2, otherB), rep(0, nB-p2B-tieB-otherB))
  data.frame(time=time, status=status, group=c(rep("A",nA),rep("B",nB)), strata=rep(st,length(time)))
}
s1 <- mk("s1", 5,5, 1,0, 1,1)
s2 <- mk("s2", 5,5, 0,1, 1,1)
plain <- mk("s1", 5,5, 0,0, 2,2)
cases <- list(
  list(name="tie_only_stratum1", dat=rbind(plain,mk("s2",5,5,0,0,0,0))),
  list(name="tie_both_strata", dat=rbind(s1,s2)),
  list(name="tie_one_stratum_history_other", dat=rbind(s1,mk("s2",5,5,0,0,0,0))),
  list(name="unequal_history_each_stratum", dat=rbind(mk("s1",6,4,2,0,1,1),mk("s2",4,6,0,2,1,1))),
  list(name="different_tie_allocations", dat=rbind(mk("s1",6,6,0,1,2,1),mk("s2",6,6,1,0,1,2))),
  list(name="one_stratum_no_tie", dat=rbind(s1,mk("s2",5,5,0,0,0,0))),
  list(name="three_strata", dat=rbind(mk("s1",5,5,1,0,1,1),mk("s2",5,5,0,1,1,1),mk("s3",5,5,0,0,2,2))),
  list(name="imbalanced_strata_sizes", dat=rbind(mk("s1",8,3,1,0,2,1),mk("s2",3,8,0,1,1,2)))
)
for (x in cases) {
  cat("CASE ",x$name,"\n",sep="")
  for (rho in c(-2,-1,0,0.5,1,2,3)) {
    v <- score_stat(x$dat,rho)
    cat("rho=",sprintf("%.17g",rho)," z=",sprintf("%.17g",v[["z"]]),
        " stat=",sprintf("%.17g",v[["stat"]])," V=",sprintf("%.17g",v[["V"]]),"\n",sep="")
  }
}
