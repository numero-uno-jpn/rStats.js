# issue: 525
# Re-query the tied Gray fixture cases and the published demo through the public cmprsk API.
fixture <- jsonlite::fromJSON(paste(readLines("test/fixtures/cuminc.json"), collapse = ""), simplifyVector = FALSE)
wanted <- c(17,18,19,20,21,22,32)
for (i in wanted) {
  a <- fixture$cases[[i]]$args
  tt <- as.numeric(unlist(a$ftime))
  ss <- as.numeric(unlist(a$fstatus))
  gg <- as.character(unlist(a$group))
  st <- if (is.null(a$strata)) NULL else as.character(unlist(a$strata))
  rho <- if (is.null(a$rho)) 0 else as.numeric(a$rho)
  fit <- cmprsk::cuminc(tt, ss, gg, strata = st, rho = rho)
  cat("FIXTURE case=",i," rho=",sprintf("%.17g",rho),"\n",sep="")
  for (j in seq_len(nrow(fit$Tests))) {
    cat("cause=",rownames(fit$Tests)[j]," stat=",sprintf("%.17g",fit$Tests[j,"stat"]),
        " pv=",sprintf("%.17g",fit$Tests[j,"pv"])," df=",sprintf("%.17g",fit$Tests[j,"df"]),"\n",sep="")
  }
}
time <- c(1,2,3,4,5,6, 2,3,4,5,6,7)
status <- c(1,0,2,1,0,1, 0,1,2,0,1,0)
group <- rep(c("A","B"),each=6)
for (rho in c(-2,-1,0,0.5,1,2,3)) {
  fit <- cmprsk::cuminc(time,status,group,rho=rho)
  cat("DEMO rho=",sprintf("%.17g",rho),
      " cause1_stat=",sprintf("%.17g",fit$Tests["1","stat"]),
      " cause2_stat=",sprintf("%.17g",fit$Tests["2","stat"]),"\n",sep="")
}
