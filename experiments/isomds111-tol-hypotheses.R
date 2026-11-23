# issue: 560
# isomds111-tol-hypotheses.R (2026-11-24): identify the extra step after tol using public R outputs only.
# Compare candidate BFGS directions/step lengths with R's returned configuration and stress.
suppressPackageStartupMessages(library(MASS))

SG <- function(y, d, grad = TRUE) {
  n <- nrow(y); r <- as.vector(dist(y)); o <- order(d); f <- r; f[o] <- isoreg(r[o])$yf
  sr <- sum((r - f)^2); tt <- sum(r^2); s <- 100 * sqrt(sr / tt)
  if (!grad || sr == 0) return(if (grad) list(s=s,g=matrix(0,n,ncol(y))) else s)
  w <- 100 / (2 * sqrt(sr / tt)) * (2 * (r - f) * tt - sr * 2 * r) / tt^2 / r
  W <- matrix(0,n,n); W[lower.tri(W)] <- w; W <- W + t(W)
  list(s=s,g=rowSums(W)*y-W%*%y)
}

run_bfgs <- function(y0, d, iters) {
  x <- as.vector(y0); k <- ncol(y0); m <- length(x); H <- diag(m)
  e <- SG(matrix(x,ncol=k),d); out <- list(); last_s <- NULL; last_alpha <- 1; previous_gradient <- NULL
  for (it in seq_len(iters)) {
    g <- as.vector(e$g); direction <- -as.vector(H %*% g); slope <- sum(g*direction)
    if (slope >= 0) { H <- diag(m); direction <- -g; slope <- sum(g*direction) }
    alpha <- 1; accepted <- FALSE
    for (back in 0:100) {
      xn <- x + alpha*direction
      if (all(xn == x)) break
      fn <- SG(matrix(xn,ncol=k),d,FALSE)
      if (fn <= e$s + 1e-4*alpha*slope) { accepted <- TRUE; break }
      alpha <- alpha*0.2
    }
    if (!accepted) break
    en <- SG(matrix(xn,ncol=k),d); step <- xn-x; change <- as.vector(en$g)-g; sy <- sum(step*change)
    if (sy > 0) {
      Hy <- H %*% change
      H <- H + ((sy+sum(change*Hy))/sy^2)*(step%*%t(step)) -
        (Hy%*%t(step)+step%*%t(Hy))/sy
    } else H <- diag(m)
    out[[it]] <- list(x=xn, y=matrix(xn,ncol=k), stress=en$s, H=H, g=as.vector(en$g),
                      alpha=alpha, direction=direction, previous_step=last_s,
                      previous_gradient=previous_gradient, previous_alpha=last_alpha)
    x <- xn; e <- en; last_s <- step; last_alpha <- alpha; previous_gradient <- g
  }
  out
}

candidate <- function(state, d, k, direction, alpha) {
  y <- matrix(state$x + alpha*direction,ncol=k)
  SG(y,d,FALSE)
}
armijo <- function(state, d, k, direction, slope, c1) {
  alpha <- 1
  for (back in 0:100) {
    value <- candidate(state,d,k,direction,alpha)
    if (value <= state$stress + c1*alpha*slope) return(c(value,alpha))
    alpha <- alpha*0.2
  }
  c(NA_real_,alpha)
}

check_data <- function(nm, d, y0, tols) {
  cat("\\nDATA",nm,"\\n")
  B <- run_bfgs(y0,d,30); k <- ncol(y0)
  for (tl in tols) {
    invisible(capture.output(r <- isoMDS(d,tol=tl,maxit=500)))
    cat("tol",format(tl,scientific=TRUE),"R stress",sprintf("%.12g",r$stress),
        "printed",paste(trimws(capture.output(isoMDS(d,tol=tl,maxit=500))),collapse=" | "),"\\n")
  }
  for (i in seq_along(B)) {
    state <- B[[i]]
    previous <- if (i==1) SG(y0,d,FALSE) else B[[i-1]]$stress
    decrease <- (previous-state$stress)/abs(previous)
    if (i==1 || any(decrease < tols)) {
      cat("BFGS",i,"stress",sprintf("%.12g",state$stress),"relative decrease",sprintf("%.8g",decrease),
          "accepted alpha",state$alpha,"previous alpha",state$previous_alpha,"\\n")
      for (a in c(1,0.99,0.5,0.2,0.1,0.04,0.02,0.01)) {
        cat("  BFGS direction alpha",a,sprintf("%.12g",candidate(state,d,k,state$direction,a)),
            "identity direction alpha",a,sprintf("%.12g",candidate(state,d,k,-state$g,a)),"\\n")
      }
      if (!is.null(state$previous_step)) {
        cat("  previous displacement alpha=1",sprintf("%.12g",candidate(state,d,k,state$previous_step,1)),"\\n")
      }
      if (!is.null(state$previous_gradient)) {
        cat("  previous-point gradient alpha=1",
            sprintf("%.12g",candidate(state,d,k,-state$previous_gradient,1)),"\\n")
      }
      id <- armijo(state,d,k,-state$g,sum(state$g*(-state$g)),1e-4)
      cat("  reset-I Armijo c1=1e-4 stress",sprintf("%.12g",id[1]),"alpha",id[2],"\\n")
      for (tl in tols) {
        idt <- armijo(state,d,k,-state$g,sum(state$g*(-state$g)),tl)
        cat("  reset-I Armijo c1=tol",format(tl,scientific=TRUE),"stress",sprintf("%.12g",idt[1]),"alpha",idt[2],"\\n")
      }
    }
  }
}

check_data("swiss",dist(swiss),cmdscale(dist(swiss),2),c(1e-1,1e-2,5e-3,1e-3,5e-4,1e-4,1e-5,1e-8))
check_data("eurodist",eurodist,cmdscale(eurodist,2),c(1e-2,1e-3,1e-4,1e-5))
check_data("USArrests",dist(scale(USArrests)),cmdscale(dist(scale(USArrests)),2),c(1e-2,1e-3,1e-4))
