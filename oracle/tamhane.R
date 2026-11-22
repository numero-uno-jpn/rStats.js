# issue: 549
# Oracle fixture extraction using public PMCMRplus calls only.
suppressMessages(library(PMCMRplus)); library(jsonlite)
tab <- function(x) list(rows=rownames(x), cols=colnames(x), values=unname(x))
one <- function(w) {
 r <- tamhaneT2Test(PlantGrowth$weight, PlantGrowth$group, welch=w)
 list(method=r$method, statistic=tab(r$statistic), p.value=tab(r$p.value),
      p.adjust.method=r$p.adjust.method, dist=r$dist, alternative=r$alternative)
}
out <- list(T2=one(TRUE), T2prime=one(FALSE),
            singleton=tamhaneT2Test(c(1,2,3,10,11,12,5), c(1,1,1,2,2,2,3)),
            formula=tamhaneT2Test(Ozone ~ factor(Month), data=airquality))
cat(toJSON(out, digits=NA, auto_unbox=TRUE, na="string"))
