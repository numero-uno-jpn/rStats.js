# issue: 560
# Greenacre adjusted total inertia and JCA iteration diagnostics.
library(ca)
library(jsonlite)
dat <- wg93[,1:4]
Q <- ncol(dat)
getfit <- function(m,...) {
  f <- mjca(dat,lambda="JCA",maxit=m,...)
  list(sv=as.numeric(f$sv), inertia.e=as.numeric(f$inertia.e),
       inertia.t=as.numeric(f$inertia.t), inertia.et=as.numeric(f$inertia.et),
       colcoord=as.matrix(f$colcoord), colpcoord=as.matrix(f$colpcoord))
}
adj <- mjca(dat,lambda="adjusted")
burt <- mjca(dat,lambda="Burt")
J <- sum(vapply(dat,function(x)nlevels(x),integer(1)))
adjusted_formula <- Q/(Q-1)*(as.numeric(burt$inertia.t)-(J-Q)/Q^2)
jca <- lapply(c(0,1,2,3,4,5,6,8,10,20,50,100,500),function(m)
  tryCatch(getfit(m),error=function(e) list(error=conditionMessage(e))))
names(jca) <- c("0","1","2","3","4","5","6","8","10","20","50","100","500")
jca_eps <- tryCatch(getfit(500,epsilon=1e-10),error=function(e)list(error=conditionMessage(e)))
out <- list(Q=Q,J=J,burt_inertia_t=as.numeric(burt$inertia.t),
 adjusted_inertia_t=as.numeric(adj$inertia.t),adjusted_formula=adjusted_formula,
 adjusted_inertia_e=as.numeric(adj$inertia.e),adjusted_inertia_et=as.numeric(adj$inertia.et),
 adjusted_percent_formula=100*as.numeric(adj$inertia.e)/as.numeric(adj$inertia.t),
 jca_iterations=jca,jca_epsilon_1e10=jca_eps)
cat(as.character(toJSON(out,digits=I(17),auto_unbox=TRUE,null="null")))
