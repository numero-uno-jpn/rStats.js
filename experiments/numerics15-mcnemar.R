# issue: 531
# Public exact2x2 calls only; high-precision references are computed independently.
suppressPackageStartupMessages(library(exact2x2))
emit <- function(label, x) cat(label, ": ", paste(sprintf("%.17g", as.numeric(x)), collapse=","), "\n", sep="")
probe <- function(label, f) {
  x <- tryCatch(f(), error=function(e) conditionMessage(e))
  if (is.character(x)) cat(label, " ERROR: ", x, "\n", sep="")
  else emit(label, c(x$power, x$npairs, x$pb, x$pc))
}
probe("symmetric_default", function() powerPaired2x2(pb=1e-10,pc=1e-10,npairs=1000,errbound=0))
probe("symmetric_strict", function() powerPaired2x2(pb=1e-10,pc=1e-10,npairs=1000,strict=TRUE,errbound=0))
probe("symmetric_central", function() powerPaired2x2(pb=1e-10,pc=1e-10,npairs=1000,tsmethod="central",errbound=0))
probe("symmetric_minlike", function() powerPaired2x2(pb=1e-10,pc=1e-10,npairs=1000,tsmethod="minlike",errbound=0))
probe("symmetric_greater", function() powerPaired2x2(pb=1e-10,pc=1e-10,npairs=1000,alternative="greater",errbound=0))
probe("asymmetric_default", function() powerPaired2x2(pb=1e-10,pc=2e-10,npairs=1000,errbound=0))
