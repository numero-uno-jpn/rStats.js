# issue: 549
# Oracle fixture extraction using public PMCMRplus calls only; only scalars, strings and numeric matrices are serialized.
suppressMessages(library(PMCMRplus)); library(jsonlite)
tab <- function(x) list(rows=rownames(x), cols=colnames(x), values=unname(x))
pw <- function(r) list(method=r$method, statistic=tab(r$statistic), p.value=tab(r$p.value),
                       p.adjust.method=r$p.adjust.method, dist=r$dist, alternative=r$alternative)
out <- list(T2=pw(tamhaneT2Test(PlantGrowth$weight, PlantGrowth$group, welch=TRUE)),
            T2prime=pw(tamhaneT2Test(PlantGrowth$weight, PlantGrowth$group, welch=FALSE)),
            singleton=pw(tamhaneT2Test(c(1,2,3,10,11,12,5), c(1,1,1,2,2,2,3))),
            formula=pw(tamhaneT2Test(Ozone ~ factor(Month), data=airquality)))
cat(toJSON(out, digits=NA, auto_unbox=TRUE, na="string"))
