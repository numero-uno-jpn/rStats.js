# oracle-platform: amd64
# r2dtable(n, r, c): random 2-way tables with given marginals (Patefield's algorithm), set.seed compatible
# (fixture r2dtable). Generated with x86_64 R (see oracle/_random.R).
# expected: the n tables concatenated, each flattened column by column (as.vector of the matrix);
# next: the runif(1) drawn afterwards, to check how many uniforms were consumed.
source("/oracle/_random.R")

margins <- list(
  list(r = c(3, 2), c = c(2, 3)),
  list(r = c(10, 10), c = c(5, 15)),
  list(r = c(1, 1, 1), c = c(1, 2)),
  list(r = c(12, 5, 7, 7), c = c(9, 11, 11)),
  list(r = c(0, 6, 4), c = c(5, 0, 5)),          # zero row and zero column
  list(r = c(0, 0), c = c(0, 0)),                # empty table
  list(r = c(100, 200, 300), c = c(150, 150, 300)),
  list(r = c(762, 327, 468), c = c(484, 239, 477, 357)),
  list(r = c(5000, 3000, 2000, 1000), c = c(2500, 2500, 2500, 2500, 1000)),
  list(r = c(1e5, 2e5), c = c(1.5e5, 1.5e5)),
  list(r = rep(1, 8), c = rep(2, 4)),
  list(r = c(50, 1, 1, 1), c = c(1, 1, 1, 50))
)
for (m in margins) for (s in c(1, 42, 2024)) for (n in c(1, 5))
  rcase(s, list(n = n, r = m$r, c = m$c), function() unlist(lapply(r2dtable(n, m$r, m$c), as.vector)))
# Many tables from the same stream
rcase(7, list(n = 200, r = c(12, 5, 7, 7), c = c(9, 11, 11)),
      function() unlist(lapply(r2dtable(200, c(12, 5, 7, 7), c(9, 11, 11)), as.vector)))
write_random_fixture("r2dtable")
