# issue: 525
# Stage 3: small pre-event survival with an asymmetric tied target-cause event.
n <- 2000L
time <- c(seq_len(n - 3L), n, n, n + 1L,
          seq_len(n - 2L), n, n + 1L)
status <- c(rep(2, n - 3L), 1, 1, 0,
            rep(2, n - 2L), 1, 0)
group <- c(rep("A", n), rep("B", n))
fit <- cmprsk::cuminc(time, status, group)
cat(sprintf("near_zero_S S_A_before=%.17g S_B_before=%.17g risk_A=3 risk_B=2 target_ties=3\n",
            3 / n, 2 / n))
for (i in seq_len(nrow(fit$Tests))) {
  cat(sprintf("cause%s_stat=%.17g cause%s_p=%.17g\n",
              rownames(fit$Tests)[i], fit$Tests[i, "stat"],
              rownames(fit$Tests)[i], fit$Tests[i, "pv"]))
}
# At the target-cause time only group A has one subject at risk: H = q_r and
# H - q_r is exactly zero. The one target event means Delta^(1) is not activated.
time2 <- c(10, 1, 2, 3)
status2 <- c(1, 2, 2, 2)
group2 <- c("A", "B", "B", "B")
fit2 <- cmprsk::cuminc(time2, status2, group2)
cat(sprintf("zero_H_minus_q groupA_at_risk=1 groupB_at_risk=0 stat=%.17g p=%.17g\n",
            fit2$Tests[1, "stat"], fit2$Tests[1, "pv"]))
