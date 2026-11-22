# issue: 549
# Oracle fixture extraction using public PMCMRplus calls only.
suppressMessages(library(PMCMRplus)); library(jsonlite)
m <- matrix(c(3.4,4.1,4.8,5.0, 2.9,3.0,3.8,4.4, 3.1,3.9,3.7,4.9,
              2.5,3.6,4.0,4.1, 3.0,2.8,4.5,4.6), nrow=5, byrow=TRUE)
mt <- matrix(c(1,2,2,3, 1,1,2,2, 2,3,3,4, 1,2,3,3, 4,4,4,4, 1,3,2,4), nrow=6, byrow=TRUE)
pick <- function(r) list(method=r$method, statistic=r$statistic, statisticNames=names(r$statistic),
                         p.value=r$p.value, alternative=r$alternative, estimate=r$estimate)
out <- list(two.sided=pick(pageTest(m)), greater=pick(pageTest(m, alternative="greater")),
            less=pick(pageTest(m, alternative="less")), ties=pick(pageTest(mt)),
            reversed=pick(pageTest(m[,4:1])))
cat(toJSON(out, digits=NA, auto_unbox=TRUE, na="string"))
