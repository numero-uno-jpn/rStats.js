# issue: 560
# isomds111-bfgs-details.R (2026-11-24): distinguish line-search constants, failed-search behavior,
# iteration counting and tol using only public MASS outputs. No source inspection.
suppressPackageStartupMessages(library(MASS))
SG <- function(y, d, grad = TRUE, p = 2) {
  n <- nrow(y); k <- ncol(y); r <- as.vector(dist(y, method = "minkowski", p = p)); o <- order(d)
  f <- r; f[o] <- isoreg(r[o])$yf
  sr <- sum((r - f)^2); tt <- sum(r^2); s <- 100 * sqrt(sr / tt)
  if (!grad || sr == 0) return(if (grad) list(s=s,g=matrix(0,n,k)) else s)
  w <- 100 / (2 * sqrt(sr / tt)) * (2 * (r - f) * tt - sr * 2 * r) / tt^2 / r
  W <- matrix(0,n,n); W[lower.tri(W)] <- w; W <- W + t(W)
  # p=2 analytic gradient; general p is computed below by coordinate differentiation
  if (p == 2) return(list(s=s,g=rowSums(W)*y-W%*%y))
  g <- matrix(0,n,k); h <- 1e-6 * max(abs(y))
  for (i in seq_len(n)) for (j in seq_len(k)) {
    a <- b <- y; a[i,j] <- a[i,j]+h; b[i,j] <- b[i,j]-h
    g[i,j] <- (SG(a,d,FALSE,p)-SG(b,d,FALSE,p))/(2*h)
  }
  list(s=s,g=g)
}
bfgs <- function(y0,d,iters,red=0.2,c1=1e-4,p=2) {
  x <- as.vector(y0); k <- ncol(y0); m <- length(x); H <- diag(m)
  e <- SG(matrix(x,ncol=k),d,p=p); out <- list(); backs <- integer()
  for (it in seq_len(iters)) {
    g <- as.vector(e$g); t <- -H%*%g; gp <- sum(t*g)
    if (gp >= 0) { H <- diag(m); t <- -g; gp <- sum(t*g) }
    st <- 1; nback <- 0L; acc <- FALSE
    repeat {
      xn <- x+st*as.vector(t)
      if (all(xn==x)) break
      fn <- SG(matrix(xn,ncol=k),d,FALSE,p)
      if (fn <= e$s+c1*st*gp) { acc <- TRUE; break }
      st <- st*red; nback <- nback+1L
      if (nback>100) break
    }
    backs[it] <- nback
    if (!acc) { out[[it]] <- list(y=matrix(x,ncol=k),stress=e$s,failed=TRUE); break }
    en <- SG(matrix(xn,ncol=k),d,p=p); s <- xn-x; yy <- as.vector(en$g)-g; sy <- sum(s*yy)
    if (sy>0) { Hy <- H%*%yy; H <- H+((sy+sum(yy*Hy))/sy^2)*(s%*%t(s))-(Hy%*%t(s)+s%*%t(Hy))/sy }
    else H <- diag(m)
    x <- xn; e <- en; out[[it]] <- list(y=matrix(x,ncol=k),stress=e$s,failed=FALSE)
  }
  attr(out,"backtracks") <- backs; out
}
check_case <- function(nm,d,y,p=2) {
  cat("\nCASE",nm,"p",p,"\n")
  invisible(capture.output(z <- isoMDS(d,y=y,p=p,maxit=30,tol=1e-30)))
  cat("R final stress",sprintf("%.12g",z$stress),"printed",paste(z$printed,collapse=" | "),"\n")
  for (red in c(0.1,0.2,0.5,0.8)) for (c1 in c(1e-4,1e-3,1e-2,1e-1)) {
    b <- bfgs(y,as.vector(d),min(20,29),red,c1,p)
    errs <- sapply(seq_along(b),function(i) {
      invisible(capture.output(rr <- isoMDS(d,y=y,p=p,maxit=i+1,tol=1e-30)))
      max(abs(rr$points-b[[i]]$y))/max(abs(rr$points))
    })
    cat("red",red,"c1",c1,"maxerr",sprintf("%.3g",max(errs)),"last",sprintf("%.3g",tail(errs,1)),
        "backs",paste(attr(b,"backtracks"),collapse=","),"failed",any(vapply(b,function(v)isTRUE(v$failed),logical(1))),"\n")
  }
}
check_case("swiss_raw",dist(swiss),as.matrix(swiss[,c(2,3)]))
check_case("swiss_sin",dist(swiss),cbind(sin(seq_len(nrow(swiss))*1.7),cos(seq_len(nrow(swiss))*0.9)))
check_case("euro_random",eurodist,cbind(sin(seq_len(attr(eurodist,"Size"))*1.7),cos(seq_len(attr(eurodist,"Size"))*0.9)))
cat("\nTOL SWISS default start\n")
for (tv in c(1e-1,1e-2,1e-3,1e-4,1e-5,1e-6,1e-8,1e-10,1e-12)) {
  invisible(capture.output(z <- isoMDS(dist(swiss),tol=tv,maxit=500)))
  cat("tol",tv,"stress",sprintf("%.12g",z$stress),"printed",paste(z$printed,collapse=" | "),"\n")
}
cat("\nP1/P3 and K3\n")
for (pp in c(1,2,3)) for (kk in c(1,2,3)) {
  if (kk>=nrow(swiss)) next
  dd <- dist(swiss); yy <- cmdscale(dd,k=kk)
  invisible(capture.output(z <- isoMDS(dd,y=yy,p=pp,k=kk,maxit=40,tol=1e-30)))
  cat("p",pp,"k",kk,"stress",sprintf("%.12g",z$stress),"printed",paste(z$printed,collapse=" | "),"\n")
}

# rerun public-output probes after the optimizer implementation pass
