# issue: 560
# Public-output scale probes and requested ca/mjca large-input timings.
suppressPackageStartupMessages(library(ca))
tab <- matrix(c(3,2,5,4,1,6,4,3,7,2,3,8,4,5,2,6),nrow=4,byrow=TRUE)
base <- ca(tab)
for (e in c(-1000,-500,500,1000)) {
  z <- ca(tab*2^e)
  cat("scale",e,"svMaxDiff",max(abs(base$sv-z$sv)),"rowMassMaxDiff",max(abs(base$rowmass-z$rowmass)),
      "colMassMaxDiff",max(abs(base$colmass-z$colmass)),"\n")
}
large <- outer(seq_len(1000),seq_len(50),function(i,j)1+((i*17+j*31)%%97))
print(system.time(ca(large)))
levels <- as.data.frame(lapply(seq_len(10),function(j)factor(paste0("L",((seq_len(10000)*7+j*3+seq_len(10000)*j)%%5)+1))))
print(system.time(mjca(levels)))
