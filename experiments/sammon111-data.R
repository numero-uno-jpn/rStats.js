# issue: 560
# Export public dissimilarity inputs and cmdscale starts for Sammon comparisons.
library(MASS)
library(jsonlite)
dsw <- dist(swiss)
deu <- eurodist
dua <- dist(USArrests)
out <- list(
  swiss = list(size=attr(dsw,"Size"),labels=attr(dsw,"Labels"),values=as.vector(dsw),
               start2=cmdscale(dsw,k=2),start1=cmdscale(dsw,k=1),start3=cmdscale(dsw,k=3),
               raw2=as.matrix(swiss[,c(2,3)]),raw1=as.matrix(swiss[,1,drop=FALSE]),
               raw3=as.matrix(swiss[,1:3]),raw10=as.matrix(swiss[1:10,1:2])),
  eurodist = list(size=attr(deu,"Size"),labels=attr(deu,"Labels"),values=as.vector(deu),
                  start2=cmdscale(deu,k=2),start1=cmdscale(deu,k=1),start3=cmdscale(deu,k=3)),
  usarrests = list(size=attr(dua,"Size"),labels=attr(dua,"Labels"),values=as.vector(dua),
                   start2=cmdscale(dua,k=2),start1=cmdscale(dua,k=1),start3=cmdscale(dua,k=3))
)
cat(toJSON(out, digits=I(12), auto_unbox=TRUE, null="null", na="string", pretty=FALSE))
