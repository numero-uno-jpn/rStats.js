# issue: 556
# Tight-convergence public-output oracle for MASS::isoMDS; no package source is read.
library(MASS)
library(jsonlite)

small <- matrix(c(1,2,0, 4,0,3, -1,5,2, 2,7,0, 0,0,1), ncol=3, byrow=TRUE)
rownames(small) <- letters[1:5]
colnames(small) <- c("x","y","z")
grid <- as.matrix(expand.grid(x=0:2, y=0:2))
perturbed <- grid + cbind(0.1*sin(1:9), 0.1*cos(1:9))
nonE <- as.dist(matrix(c(0,1,1,3, 1,0,1,1, 1,1,0,1, 3,1,1,0), nrow=4, byrow=TRUE))
swissD <- dist(swiss)
euroD <- eurodist
usD <- dist(USArrests)

cases <- list(
  swiss=list(d=swissD, k=2, p=2),
  swiss_k3=list(d=swissD, k=3, p=2),
  swiss_p1=list(d=swissD, k=2, p=1),
  swiss_p3=list(d=swissD, k=2, p=3),
  swiss_y=list(d=swissD, y=swiss[,2:3], k=2, p=2),
  swiss_y_k1=list(d=swissD, y=matrix(swiss[,1], ncol=1), k=1, p=2),
  eurodist=list(d=euroD, k=2, p=2),
  usarrests=list(d=usD, k=2, p=2),
  small=list(d=dist(small), k=2, p=2),
  small_k1=list(d=dist(small), k=1, p=2),
  non_euclidean=list(d=nonE, k=2, p=2),
  grid_ties=list(d=dist(grid), y=perturbed, k=2, p=2),
  grid_ties_default=list(d=dist(grid), k=2, p=2),
  perfect=list(d=dist(small[,1:2]), k=2, p=2),
  line=list(d=dist(c(0,1,3,6,10)), k=1, p=2),
  three=list(d=dist(c(0,1,3)), k=1, p=2),
  two=list(d=dist(c(0,1)), k=1, p=2)
)

out <- lapply(cases, function(z) {
  args <- list(d=z$d, k=z$k, maxit=1000, tol=1e-10, trace=FALSE, p=z$p)
  if (!is.null(z$y)) args$y <- z$y
  fit <- do.call(MASS::isoMDS, args)
  list(stress=fit$stress, points=unname(fit$points))
})
cat(as.character(toJSON(out, auto_unbox=TRUE, digits=NA)))
