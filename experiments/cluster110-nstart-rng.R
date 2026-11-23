# cluster110-nstart-rng.R: the random state after kmeans with nstart = 1..5 on data with repeated rows (Claude, 1.10.0)
library(jsonlite)
dupx <- rbind(c(1, 1), c(1, 1), c(1, 1), c(2, 2))
res <- list()
for (s in 1:8) for (ns in 1:5) {
  set.seed(s); f <- kmeans(dupx, 2, nstart = ns)
  res[[paste0("s", s, "_n", ns)]] <- list(u = runif(1), centers = unname(f$centers[, 1]))
}
cat(toJSON(res, digits = I(17), auto_unbox = TRUE))
