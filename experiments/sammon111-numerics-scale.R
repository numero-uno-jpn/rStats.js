# issue: 560
# Public-output scale probes and requested MASS Sammon/isoMDS large-input timings.
suppressPackageStartupMessages(library(MASS))
coords <- cbind(sin(seq_len(6)*0.17),cos(seq_len(6)*0.13),sin(seq_len(6)*0.07)*cos(seq_len(6)*0.11))
d <- dist(coords)
for (e in c(-1000,-500,500,1000)) {
  dd <- d*2^e
  invisible(capture.output(sm <- sammon(dd,niter=12)))
  invisible(capture.output(im <- isoMDS(dd,maxit=12)))
  cat("scale",e,"sammonStress",format(sm$stress,digits=12),"isoStress",format(im$stress,digits=12),
      "sammonCoordScale",format(max(abs(sm$points))/2^e,digits=8),"isoCoordScale",format(max(abs(im$points))/2^e,digits=8),"\n")
}
large <- cbind(sin(seq_len(500)*0.17),cos(seq_len(500)*0.13),sin(seq_len(500)*0.07)*cos(seq_len(500)*0.11))
dd <- dist(large)
print(system.time(invisible(capture.output(sm <- sammon(dd,niter=10)))))
print(system.time(invisible(capture.output(im <- isoMDS(dd,maxit=10)))))
