# issue: 527
# Combined public-function probes for the four pinned reference packages; no source inspection.
suppressPackageStartupMessages(library(epiR))
suppressPackageStartupMessages(library(exact2x2))
suppressPackageStartupMessages(library(clinfun))
suppressPackageStartupMessages(library(powerSurvEpi))
suppressPackageStartupMessages(library(survival))
suppressPackageStartupMessages(library(jsonlite))

probe <- function(id, f) {
  w <- character()
  value <- tryCatch(withCallingHandlers(f(), warning=function(x) {
    w <<- c(w, conditionMessage(x)); invokeRestart("muffleWarning")
  }), error=function(x) list(error=conditionMessage(x)))
  cat(jsonlite::toJSON(list(id=id,value=value,warnings=unique(w)),
    auto_unbox=TRUE,digits=NA,null="null",na="string",force=TRUE),"\n",sep="")
}
cat("versions: epiR=",as.character(packageVersion("epiR")),
    "; exact2x2=",as.character(packageVersion("exact2x2")),
    "; clinfun=",as.character(packageVersion("clinfun")),
    "; powerSurvEpi=",as.character(packageVersion("powerSurvEpi")),"\n",sep="")

# epiR: equivalence / equality, non-inferiority and superiority.
probe("epi-binary-equivalence-n-fractional",function() epi.ssequb(treat=.5,control=.45,delta=.1,n=NA,power=.8,r=1.5,type="equivalence",nfractional=TRUE,alpha=.05))
probe("epi-binary-equivalence-n-integer",function() epi.ssequb(treat=.5,control=.45,delta=.1,n=NA,power=.8,r=1.5,type="equivalence",nfractional=FALSE,alpha=.05))
probe("epi-binary-equivalence-power",function() epi.ssequb(treat=.5,control=.45,delta=.1,n=120,power=NA,r=1.5,type="equivalence",nfractional=TRUE,alpha=.05))
probe("epi-binary-equality-r1",function() epi.ssequb(treat=.5,control=.4,delta=NA,n=NA,power=.8,r=1,type="equality",nfractional=TRUE,alpha=.05))
probe("epi-binary-equality-r2",function() epi.ssequb(treat=.5,control=.4,delta=NA,n=NA,power=.8,r=2,type="equality",nfractional=TRUE,alpha=.05))
probe("epi-binary-equality-power-r2",function() epi.ssequb(treat=.5,control=.4,delta=NA,n=120,power=NA,r=2,type="equality",nfractional=TRUE,alpha=.05))
probe("epi-cont-equivalence-n-fractional",function() epi.ssequc(treat=20,control=21,sigma=10,delta=5,n=NA,power=.8,r=1.5,type="equivalence",nfractional=TRUE,alpha=.05))
probe("epi-cont-equivalence-n-integer",function() epi.ssequc(treat=20,control=21,sigma=10,delta=5,n=NA,power=.8,r=1.5,type="equivalence",nfractional=FALSE,alpha=.05))
probe("epi-cont-equivalence-power",function() epi.ssequc(treat=20,control=21,sigma=10,delta=5,n=120,power=NA,r=1.5,type="equivalence",nfractional=TRUE,alpha=.05))
probe("epi-cont-equality-r1",function() epi.ssequc(treat=.7,control=.65,sigma=.06,delta=NA,n=NA,power=.8,r=1,type="equality",nfractional=TRUE,alpha=.05))
probe("epi-cont-equality-r2",function() epi.ssequc(treat=.7,control=.65,sigma=.06,delta=NA,n=NA,power=.8,r=2,type="equality",nfractional=TRUE,alpha=.05))
probe("epi-cont-equality-power",function() epi.ssequc(treat=.7,control=.65,sigma=.06,delta=NA,n=120,power=NA,r=2,type="equality",nfractional=TRUE,alpha=.05))
probe("epi-noninferiority-binary-n",function() epi.ssninfb(treat=.85,control=.65,delta=.1,n=NA,power=.8,r=2,nfractional=TRUE,alpha=.05))
probe("epi-noninferiority-binary-power",function() epi.ssninfb(treat=.85,control=.65,delta=.1,n=120,power=NA,r=2,nfractional=TRUE,alpha=.05))
probe("epi-noninferiority-cont-n",function() epi.ssninfc(treat=.22,control=.2,sigma=.1,delta=.05,n=NA,power=.8,r=2,nfractional=TRUE,alpha=.05))
probe("epi-noninferiority-cont-power",function() epi.ssninfc(treat=.22,control=.2,sigma=.1,delta=.05,n=120,power=NA,r=2,nfractional=TRUE,alpha=.05))
probe("epi-superiority-binary-one-sided",function() epi.sssupb(treat=.85,control=.65,delta=.05,n=NA,power=.8,r=1,sided.test=1,nfractional=TRUE,alpha=.05))
probe("epi-superiority-binary-two-sided",function() epi.sssupb(treat=.85,control=.65,delta=.05,n=NA,power=.8,r=1,sided.test=2,nfractional=TRUE,alpha=.05))
probe("epi-superiority-binary-power",function() epi.sssupb(treat=.85,control=.65,delta=.05,n=120,power=NA,r=1.5,sided.test=2,nfractional=TRUE,alpha=.05))
probe("epi-superiority-cont-one-sided",function() epi.sssupc(treat=20,control=20,sigma=10,delta=5,n=NA,power=.8,r=1,sided.test=1,nfractional=TRUE,alpha=.05))
probe("epi-superiority-cont-two-sided",function() epi.sssupc(treat=20,control=20,sigma=10,delta=5,n=NA,power=.8,r=1,sided.test=2,nfractional=TRUE,alpha=.05))
probe("epi-superiority-cont-power",function() epi.sssupc(treat=20,control=20,sigma=10,delta=5,n=120,power=NA,r=1.5,sided.test=2,nfractional=TRUE,alpha=.05))
probe("epi-boundary-zero-proportions",function() epi.ssninfb(treat=0,control=0,delta=.1,n=NA,power=.8,r=1,nfractional=TRUE,alpha=.05))
probe("epi-boundary-zero-effect",function() epi.sssupc(treat=20,control=20,sigma=10,delta=0,n=NA,power=.8,r=1,sided.test=1,nfractional=TRUE,alpha=.05))
probe("epi-unreachable-noninferiority",function() epi.ssninfc(treat=.1,control=.2,sigma=.1,delta=.05,n=NA,power=.8,r=1,nfractional=TRUE,alpha=.05))
probe("epi-power-zero",function() epi.ssninfc(treat=.22,control=.2,sigma=.1,delta=.05,n=120,power=0,r=1,nfractional=TRUE,alpha=.05))
probe("epi-power-one",function() epi.ssninfc(treat=.22,control=.2,sigma=.1,delta=.05,n=120,power=1,r=1,nfractional=TRUE,alpha=.05))

# exact2x2: exact McNemar power, error bound, strictness, and exact-test method.
probe("mcnemar-default",function() powerPaired2x2(pb=.5,pc=.3,npairs=40))
probe("mcnemar-strict",function() powerPaired2x2(pb=.5,pc=.3,npairs=40,strict=TRUE))
probe("mcnemar-one-sided",function() powerPaired2x2(pb=.5,pc=.3,npairs=40,alternative="one.sided"))
probe("mcnemar-one-sided-reversed",function() powerPaired2x2(pb=.3,pc=.5,npairs=40,alternative="one.sided"))
probe("mcnemar-central",function() powerPaired2x2(pb=.5,pc=.3,npairs=40,tsmethod="central"))
probe("mcnemar-minlike",function() powerPaired2x2(pb=.5,pc=.3,npairs=40,tsmethod="minlike"))
probe("mcnemar-blaker",function() powerPaired2x2(pb=.5,pc=.3,npairs=40,tsmethod="blaker"))
probe("mcnemar-errbound-zero",function() powerPaired2x2(pb=.5,pc=.3,npairs=40,errbound=0))
probe("mcnemar-errbound-small",function() powerPaired2x2(pb=.5,pc=.3,npairs=40,errbound=1e-8))
probe("mcnemar-errbound-large",function() powerPaired2x2(pb=.5,pc=.3,npairs=40,errbound=.01))
probe("mcnemar-null-odds-ratio-two",function() powerPaired2x2(pb=.5,pc=.3,npairs=40,nullOddsRatio=2))
probe("mcnemar-alpha-small",function() powerPaired2x2(pb=.5,pc=.3,npairs=40,sig.level=1e-6))
probe("mcnemar-alpha-zero",function() powerPaired2x2(pb=.5,pc=.3,npairs=40,sig.level=0))
probe("mcnemar-alpha-one",function() powerPaired2x2(pb=.5,pc=.3,npairs=40,sig.level=1))
probe("mcnemar-zero-pairs",function() powerPaired2x2(pb=.5,pc=.3,npairs=0))
probe("mcnemar-zero-discordance",function() powerPaired2x2(pb=0,pc=0,npairs=40))
probe("mcnemar-probability-sum-over-one",function() powerPaired2x2(pb=.7,pc=.6,npairs=40))
probe("mcnemar-large-pairs",function() powerPaired2x2(pb=.5,pc=.3,npairs=100000))

# powerSurvEpi: Freedman, Schoenfeld/Latouche, and pilot-data wrappers.
probe("freedman-power",function() powerCT.default(nE=200,nC=200,pE=.3707,pC=.4890,RR=.7,alpha=.05))
probe("freedman-power-unequal",function() powerCT.default(nE=240,nC=120,pE=.3707,pC=.4890,RR=.7,alpha=.05))
probe("freedman-power-null",function() powerCT.default(nE=200,nC=200,pE=.3707,pC=.4890,RR=1,alpha=.05))
probe("freedman-size",function() ssizeCT.default(power=.8,k=1,pE=.3707,pC=.4890,RR=.7,alpha=.05))
probe("freedman-size-unequal",function() ssizeCT.default(power=.8,k=2,pE=.3707,pC=.4890,RR=.7,alpha=.05))
probe("freedman-size-near-null",function() ssizeCT.default(power=.8,k=1,pE=.5,pC=.5,RR=1.000001,alpha=.05))
probe("latouche-power",function() powerEpi.default(n=139,theta=2,p=.39,psi=.505,rho2=.132^2,alpha=.05))
probe("latouche-size",function() ssizeEpi.default(power=.8,theta=2,p=.39,psi=.505,rho2=.132^2,alpha=.05))
probe("latouche-deaths",function() numDEpi.default(power=.8,theta=2,p=.39,rho2=.132^2,alpha=.05))
probe("latouche-randomized",function() ssizeEpi.default(power=.8,theta=2,p=.5,psi=.7,rho2=0,alpha=.05))
probe("latouche-null-hr",function() ssizeEpi.default(power=.8,theta=1,p=.39,psi=.505,rho2=.132^2,alpha=.05))
probe("latouche-p-zero",function() ssizeEpi.default(power=.8,theta=2,p=0,psi=.505,rho2=0,alpha=.05))
probe("latouche-rho2-one",function() ssizeEpi.default(power=.8,theta=2,p=.39,psi=.505,rho2=1,alpha=.05))
probe("latouche-power-zero",function() ssizeEpi.default(power=0,theta=2,p=.39,psi=.505,rho2=.132^2,alpha=.05))
probe("latouche-power-one",function() ssizeEpi.default(power=1,theta=2,p=.39,psi=.505,rho2=.132^2,alpha=.05))
data(Oph,package="powerSurvEpi")
probe("freedman-pilot-power",function() powerCT(formula=survival::Surv(times,status)~group,dat=Oph,nE=200,nC=200,RR=.7,alpha=.05))
probe("freedman-pilot-size",function() ssizeCT(formula=survival::Surv(times,status)~group,dat=Oph,power=.8,k=1,RR=.7,alpha=.05))

# clinfun: Simon's two-stage design, returned candidate matrix and printed minimax/optimal/admissible choices.
probe("simon-standard",function() {
  x <- ph2simon(pu=.2,pa=.4,ep1=.05,ep2=.1,nmax=100)
  list(out=x$out,printed=utils::capture.output(print(x)))
})
probe("simon-nmax-50",function() {
  x <- ph2simon(pu=.2,pa=.4,ep1=.05,ep2=.1,nmax=50)
  list(out=x$out,printed=utils::capture.output(print(x)))
})
probe("simon-nmax-maximum",function() {
  x <- ph2simon(pu=.2,pa=.4,ep1=.05,ep2=.1,nmax=1000)
  list(rows=nrow(x$out),first=x$out[1,],last=x$out[nrow(x$out),])
})
probe("simon-nmax-over-limit",function() ph2simon(pu=.2,pa=.4,ep1=.05,ep2=.1,nmax=1001))
probe("simon-minimax-also-optimal",function() {
  x <- ph2simon(pu=.8,pa=.95,ep1=.05,ep2=.2)
  list(out=x$out,printed=utils::capture.output(print(x)))
})
probe("simon-no-feasible-design",function() ph2simon(pu=.2,pa=.21,ep1=.0001,ep2=.0001,nmax=10))
probe("simon-invalid-pa",function() ph2simon(pu=.4,pa=.2,ep1=.05,ep2=.1))
probe("simon-pu-zero",function() {
  x <- ph2simon(pu=0,pa=.2,ep1=.05,ep2=.1,nmax=100)
  list(out=x$out,printed=utils::capture.output(print(x)))
})
probe("simon-pa-one",function() {
  x <- ph2simon(pu=.2,pa=1,ep1=.05,ep2=.1,nmax=100)
  list(out=x$out,printed=utils::capture.output(print(x)))
})
