# issue: 527
# Follow-up public epiR probes for the two unresolved power behaviours; no source inspection.
suppressPackageStartupMessages(library(epiR))
suppressPackageStartupMessages(library(jsonlite))

emit <- function(id, value) {
  cat(jsonlite::toJSON(list(id=id, value=value), auto_unbox=TRUE,
    digits=NA, null="null", na="string", force=TRUE), "\n", sep="")
}

# Hypotheses for epi.sssupb: correct unequal-allocation variance, equal-allocation
# variance, reversed allocation, and pooled-proportion variance.
for (r in c(.5, 1, 1.5, 2, 3)) {
  n <- 101; pt <- .50; pc <- .30; delta <- .05; alpha <- .05
  nt <- n*r/(1+r); nc <- n/(1+r); d <- pt-pc-delta
  z <- qnorm(1-alpha)
  se.correct <- sqrt(pt*(1-pt)/nt + pc*(1-pc)/nc)
  se.equal <- sqrt((pt*(1-pt)+pc*(1-pc))*2/n)
  se.reversed <- sqrt(pt*(1-pt)/nc + pc*(1-pc)/nt)
  pp <- (nt*pt+nc*pc)/n
  se.pooled <- sqrt(pp*(1-pp)*(1/nt+1/nc))
  candidates <- c(
    correct=pnorm(d/se.correct-z)+pnorm(-d/se.correct-z),
    equal_allocation=pnorm(d/se.equal-z)+pnorm(-d/se.equal-z),
    reversed_ratio=pnorm(d/se.reversed-z)+pnorm(-d/se.reversed-z),
    pooled=pnorm(d/se.pooled-z)+pnorm(-d/se.pooled-z)
  )
  observed <- epi.sssupb(treat=pt,control=pc,delta=delta,n=n,power=NA,
    r=r,sided.test=1,nfractional=TRUE,alpha=alpha)
  emit(paste0("sssupb-r-",r), list(r=r, observed=observed$power,
    candidates=candidates, se=c(correct=se.correct,equal=se.equal,
    reversed=se.reversed,pooled=se.pooled)))
}

# Hypotheses for epi.ssequb: conventional TOST intersection probability,
# the brief's symmetric expression, and a swapped allocation variance.
cases <- list(
  list(t=.50,c=.45,delta=.10,n=120,r=.5),
  list(t=.50,c=.45,delta=.10,n=120,r=1),
  list(t=.50,c=.45,delta=.10,n=120,r=2),
  list(t=.70,c=.65,delta=.10,n=120,r=2),
  list(t=.30,c=.20,delta=.15,n=80,r=.5),
  list(t=.55,c=.50,delta=.05,n=200,r=3)
)
for (i in seq_along(cases)) {
  x <- cases[[i]]; d <- x$t-x$c; nt <- x$n*x$r/(1+x$r); nc <- x$n/(1+x$r)
  vt <- x$t*(1-x$t); vc <- x$c*(1-x$c); z <- qnorm(.95)
  se <- sqrt(vt/nt+vc/nc)
  se.swap <- sqrt(vt/nc+vc/nt)
  a <- (x$delta-abs(d))/se
  tost <- pnorm((x$delta-d)/se-z)-pnorm((-x$delta-d)/se+z)
  brief <- 2*(pnorm(a-z)+pnorm(-a-z))-1
  tost.swap <- pnorm((x$delta-d)/se.swap-z)-pnorm((-x$delta-d)/se.swap+z)
  observed <- epi.ssequb(treat=x$t,control=x$c,delta=x$delta,n=x$n,
    power=NA,r=x$r,type="equivalence",nfractional=TRUE,alpha=.05)
  emit(paste0("ssequb-case-",i), list(args=x, observed=observed$power,
    se=se,se_swapped=se.swap,tost_intersection=tost,
    brief_symmetric=brief,tost_swapped=tost.swap))
}
