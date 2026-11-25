# qccbt118-mqcc.R: the multivariate charts of qcc (mqcc, T2 and T2.single; 1.18.0).
# Candidates written for this experiment (Montgomery, Mason and Young; the help of mqcc names them):
#   T2 (m groups of size n, p variables): center = grand mean, S = mean of the within-group covariance matrices,
#     T2_i = n (xbar_i - center)' S^-1 (xbar_i - center); phase I UCL = p (m - 1) (n - 1) / (m n - m - p + 1) F(conf; p,
#     m n - m - p + 1), phase II (prediction) UCL = p (m + 1) (n - 1) / (m n - m - p + 1) F(...)
#   T2.single (m observations): center = colMeans, S = cov(X), T2_i = (x_i - center)' S^-1 (x_i - center);
#     phase I UCL = (m - 1)^2 / m qbeta(conf, p / 2, (m - p - 1) / 2), phase II = p (m + 1) (m - 1) / (m (m - p)) F(conf;
#     p, m - p); LCL 0; conf = (1 - 0.0027)^p by default.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages(library(qcc))
out <- list(R = R.version.string, arch = R.version$arch, qcc = as.character(packageVersion("qcc")))
set.seed(20261130)
try1 <- function(expr) tryCatch(expr, error = function(e) list(error = conditionMessage(e)))
take <- function(q) list(class = class(q), names = names(q), type = q$type, statistics = unname(q$statistics),
                         center = unname(q$center), cov = unname(q$cov), sizes = unname(q$sizes),
                         limits = unname(q$limits), pred.limits = unname(q$pred.limits),
                         confidence.level = q$confidence.level, violations = lapply(q$violations, unname),
                         newstats = unname(q$newstats))
m <- 20; n <- 4; p <- 3
X <- lapply(1:p, function(j) matrix(rnorm(m * n, 10 * j, j), m, n))
X[[2]] <- X[[2]] + 0.5 * X[[1]]
X[[1]][5, ] <- X[[1]][5, ] + 3
names(X) <- c("a", "b", "c")
q1 <- mqcc(X, type = "T2", plot = FALSE)
q1p <- mqcc(X, type = "T2", pred.limits = TRUE, plot = FALSE)
q1c <- mqcc(X, type = "T2", confidence.level = 0.99, pred.limits = TRUE, plot = FALSE)
xm <- sapply(X, rowMeans)
ctr <- colMeans(xm)
Sw <- Reduce(`+`, lapply(1:m, function(i) cov(sapply(X, function(M) M[i, ])))) / m
t2 <- apply(xm, 1, function(v) n * t(v - ctr) %*% solve(Sw) %*% (v - ctr))
cl <- (1 - 0.0027)^p
fq <- function(conf) qf(conf, p, m * n - m - p + 1)
out$T2 <- list(q1 = take(q1), q1p = take(q1p), q1c = take(q1c),
               cand = list(center = ctr, S = Sw, t2 = t2, conf = cl,
                           ucl1 = p * (m - 1) * (n - 1) / (m * n - m - p + 1) * fq(cl),
                           ucl2 = p * (m + 1) * (n - 1) / (m * n - m - p + 1) * fq(cl),
                           ucl1_99 = p * (m - 1) * (n - 1) / (m * n - m - p + 1) * fq(0.99),
                           ucl2_99 = p * (m + 1) * (n - 1) / (m * n - m - p + 1) * fq(0.99),
                           chi = qchisq(cl, p)))
Xs <- sapply(X, function(M) M[, 1])
Xs <- rbind(Xs, matrix(rnorm(10 * p, c(10, 25, 30), c(1, 2, 3)), 10, p, byrow = TRUE))
ms <- nrow(Xs)
q2 <- mqcc(Xs, type = "T2.single", plot = FALSE)
q2p <- mqcc(Xs, type = "T2.single", pred.limits = TRUE, plot = FALSE)
q2l <- try1(take(mqcc(list(a = Xs[, 1, drop = FALSE], b = Xs[, 2, drop = FALSE], c = Xs[, 3, drop = FALSE]),
                      type = "T2.single", plot = FALSE)))
S2 <- cov(Xs); c2 <- colMeans(Xs)
t2s <- apply(Xs, 1, function(v) t(v - c2) %*% solve(S2) %*% (v - c2))
out$T2s <- list(q2 = take(q2), q2p = take(q2p), q2l = q2l,
                cand = list(center = c2, t2 = t2s,
                            ucl1 = (ms - 1)^2 / ms * qbeta(cl, p / 2, (ms - p - 1) / 2),
                            ucl2 = p * (ms + 1) * (ms - 1) / (ms * (ms - p)) * qf(cl, p, ms - p)))
# given center and cov, newdata
q3 <- mqcc(Xs[1:20, ], type = "T2.single", center = c(10, 25, 30), cov = diag(c(1, 4, 9)), newdata = Xs[21:30, ],
           pred.limits = TRUE, plot = FALSE)
out$given <- list(q3 = take(q3), t2_given = apply(Xs, 1, function(v) sum((v - c(10, 25, 30))^2 / c(1, 4, 9))))
q4 <- mqcc(Xs[1:20, ], type = "T2.single", newdata = Xs[21:30, ], pred.limits = TRUE, plot = FALSE)
S4 <- cov(Xs[1:20, ]); c4v <- colMeans(Xs[1:20, ])
out$newdata <- list(q4 = take(q4), t2 = apply(Xs, 1, function(v) t(v - c4v) %*% solve(S4) %*% (v - c4v)))
q5 <- mqcc(X, type = "T2", limits = c(0, 15), plot = FALSE)
out$limits_given <- take(q5)
out$summary_T2 <- capture.output(summary(q1p))
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "null"))
