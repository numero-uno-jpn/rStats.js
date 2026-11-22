# issue: 549
# Oracle fixture extraction using public outliers calls only; no package tables are embedded.
library(outliers); library(jsonlite)
x <- c(199.31,199.53,200.19,200.82,201.92,201.95,202.18,245.57)
gettest <- function(type, opposite=FALSE, two.sided=FALSE) {
 r <- grubbs.test(x, type=type, opposite=opposite, two.sided=two.sided)
 list(method=r$method, statistic=r$statistic, statisticNames=names(r$statistic),
      p.value=r$p.value, alternative=r$alternative)
}
each <- function(v, f) lapply(v, function(a) f(a))
ps <- c(.001,.01,.05,.1,.5,.9,.95,.99)
qs <- c(.05,.1,.3,.5,.7,.9,.99)
out <- list(type10=gettest(10), type11=gettest(11), type20=gettest(20),
            p10=each(qs,function(q) pgrubbs(q,8,type=10)),
            p11=each(qs,function(q) pgrubbs(q,8,type=11)),
            p20=each(qs,function(q) pgrubbs(q,8,type=20)),
            q10=each(ps,function(p) qgrubbs(p,8,type=10)),
            q11=each(ps,function(p) qgrubbs(p,8,type=11)),
            q20=each(ps,function(p) qgrubbs(p,8,type=20)))
cat(toJSON(out, digits=NA, auto_unbox=TRUE, na="string"))
