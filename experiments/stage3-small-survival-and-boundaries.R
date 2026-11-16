# issue: 525
# Stage 3: small pre-event survival and zero-denominator boundaries.
n <- 2000L
time <- rep(seq_len(n), 2)
group <- rep(c("A", "B"), each = n)
status <- rep(2, 2 * n)
status[c(n, 2 * n)] <- 1
fit <- cmprsk::cuminc(time, status, group)
cat(sprintf("near_zero_S n_per_group=%d S_before_final=%.17g target_ties=2\n",
            n, 1 / n))
for (i in seq_len(nrow(fit$Tests))) {
  cat(sprintf("cause%s_stat=%.17g cause%s_p=%.17g\n",
              rownames(fit$Tests)[i], fit$Tests[i, "stat"],
              rownames(fit$Tests)[i], fit$Tests[i, "pv"]))
}
# At the target-cause time only one group has one subject at risk. Thus H = q_r
# and the Delta^(1) denominator H - q_r is exactly zero; d1 is one, so no
# target-cause tie correction should be evaluated.
time2 <- c(10, 1, 2, 3)
status2 <- c(1, 2, 2, 2)
group2 <- c("A", "B", "B", "B")
fit2 <- cmprsk::cuminc(time2, status2, group2)
cat(sprintf("zero_H_minus_q groupA_at_risk=1 groupB_at_risk=0 stat=%.17g p=%.17g\n",
            fit2$Tests[1, "stat"], fit2$Tests[1, "pv"]))
