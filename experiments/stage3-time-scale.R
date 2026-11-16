# issue: 525
# Stage 3: scale invariance of Gray's test at 2^+/-1000 follow-up-time scales.
time0 <- c(1, 2, 3, 4, 5, 6, 2, 3, 4, 5, 6, 7)
status <- c(1, 0, 2, 1, 0, 1, 0, 1, 2, 0, 1, 0)
group <- rep(c("A", "B"), each = 6)
for (power in c(-1000, 0, 1000)) {
  scale <- 2^power
  fit <- cmprsk::cuminc(time0 * scale, status, group)
  cat(sprintf("power=%d scale=%.17g finite_times=%s", power, scale,
              all(is.finite(time0 * scale))))
  for (i in seq_len(nrow(fit$Tests))) {
    cat(sprintf(" cause%s_stat=%.17g cause%s_p=%.17g",
                rownames(fit$Tests)[i], fit$Tests[i, "stat"],
                rownames(fit$Tests)[i], fit$Tests[i, "pv"]))
  }
  cat("\n")
}
