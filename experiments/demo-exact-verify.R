# issue: 525
# Independently reproduce the exact public demo data and print cmprsk::cuminc()$Tests.
time <- c(1, 2, 3, 4, 5, 6, 2, 3, 4, 5, 6.5, 7)
status <- c(1, 0, 2, 1, 0, 1, 0, 1, 2, 0, 1, 0)
group <- rep(c("A", "B"), each = 6)
fit <- cmprsk::cuminc(time, status, group)
cat("n=",length(time)," groups=",paste(unique(group),collapse=","),"\n",sep="")
cat("Tests\n")
print(fit$Tests, digits=17)
cat("stat1=",sprintf("%.17g",unname(fit$Tests["1","stat"])),"\n",sep="")
