# regression-rlm-mm-nsamp.R: whether rlm(method = "MM") uses nsamp = "exact" (it does not: the result follows the
# random seed), public functions only (1.7.0)
suppressMessages(library(MASS))
f <- stack.loss ~ Air.Flow + Water.Temp + Acid.Conc.
a <- rlm(f, data = stackloss, method = "MM", nsamp = "exact")
cat("direct:", sprintf("%.12g", a$s), "\n")
set.seed(1); c1 <- rlm(f, data = stackloss, method = "MM", nsamp = "exact")
cat("direct after set.seed(1):", sprintf("%.12g", c1$s), "\n")
set.seed(1); d <- rlm(f, data = stackloss, method = "MM")
cat("random seed 1:", sprintf("%.12g", d$s), "\n")
set.seed(5); e <- rlm(f, data = stackloss, method = "MM", nsamp = "exact")
cat("exact after set.seed(5):", sprintf("%.12g", e$s), "\n")
