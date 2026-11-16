# issue: 525
# Stage 3: thousands of tied events in a single event time.
n <- 3000L
group <- rep(c("A", "B"), each = n)
status <- c(
  rep(1, 1200), rep(2, 400), rep(0, n - 1600),
  rep(1, 800), rep(2, 600), rep(0, n - 1400)
)
time <- ifelse(status == 0, 2, 1)
fit <- cmprsk::cuminc(time, status, group)
cat(sprintf("n=%d total_tied_events=%d target_ties=%d competing_ties=%d\n",
            length(time), sum(time == 1), sum(status == 1), sum(status == 2)))
for (i in seq_len(nrow(fit$Tests))) {
  cat(sprintf("cause%s_stat=%.17g cause%s_p=%.17g\n",
              rownames(fit$Tests)[i], fit$Tests[i, "stat"],
              rownames(fit$Tests)[i], fit$Tests[i, "pv"]))
}
