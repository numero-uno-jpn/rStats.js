# The R used by scripts/oracle.sh to write the fixtures (image name rstats-oracle):
#
#   docker build -t rstats-oracle oracle
#
# R 4.5.2 with the packages the oracles load. Packages come from a dated Posit Package Manager snapshot,
# so the same Dockerfile always builds the same versions. rocker/r-ver writes the repository into
# Rprofile.site, which takes precedence over the CRAN environment variable, so the date is replaced there.
# Building needs network access; running the oracles does not (scripts/oracle.sh uses --network none).
#
# The snapshot 2026-10-23 is the one the fixtures up to 0.5.x were generated with (Rmpfr 1.1-3, gmp 0.7-5.1,
# jsonlite 2.0.0, MASS 7.3-65, Matrix 1.7-4).

ARG R_VERSION=4.5.2
FROM rocker/r-ver:${R_VERSION}

ARG CRAN_SNAPSHOT=2026-10-23
RUN set -e; \
    PROFILE=/usr/local/lib/R/etc/Rprofile.site; \
    sed -i "s|/cran/__linux__/noble/[0-9-]\{10\}|/cran/__linux__/noble/${CRAN_SNAPSHOT}|g" "$PROFILE"; \
    ACTUAL=$(Rscript -e 'cat(getOption("repos")[["CRAN"]])'); \
    case "$ACTUAL" in \
      *"${CRAN_SNAPSHOT}") echo "CRAN repository: $ACTUAL" ;; \
      *) echo "failed to set the snapshot (expected ${CRAN_SNAPSHOT}, got $ACTUAL)"; exit 1 ;; \
    esac
ENV CRAN=https://p3m.dev/cran/__linux__/noble/${CRAN_SNAPSHOT}

# The binary packages expect the system libraries they link to; install.packages does not install them
# (libmpfr for Rmpfr, libgmp for gmp, libuv for fs, which DescTools loads)
RUN apt-get update && apt-get install -y --no-install-recommends libmpfr6 libgmp10 libuv1t64 \
    && rm -rf /var/lib/apt/lists/*

# jsonlite: fixture output. Rmpfr, gmp: high-precision references. MASS, Matrix: ginv, lu.
# For functions that R itself lacks: extraDistr (distributions), e1071 (skewness, kurtosis),
# DescTools (Gmean, Mode, MeanAD), pracma (interpolation, gammainc, erfinv), deSolve (ode),
# numDeriv (grad, hessian), BSDA (z.test).
RUN install2.r --error --skipinstalled \
        jsonlite Rmpfr gmp MASS Matrix extraDistr e1071 DescTools pracma deSolve numDeriv BSDA \
    && Rscript -e 'pk <- c("jsonlite", "Rmpfr", "gmp", "MASS", "Matrix", "extraDistr", "e1071", "DescTools", \
                         "pracma", "deSolve", "numDeriv", "BSDA"); \
                   for (p in pk) suppressPackageStartupMessages(library(p, character.only = TRUE)); \
                   cat(sprintf("%s %s\n", pk, sapply(pk, function(p) as.character(packageVersion(p)))), sep = "")'

# lawstat (brunner.munzel.test), added for 0.8.0 in a layer of its own, so that the packages above stay the cached
# ones the earlier fixtures were generated with
RUN install2.r --error --skipinstalled lawstat \
    && Rscript -e 'suppressPackageStartupMessages(library(lawstat)); cat("lawstat", as.character(packageVersion("lawstat")), "\n")'

# car (Anova, types II and III) and afex (aov_ez: repeated measures with the Greenhouse-Geisser and Huynh-Feldt
# corrections), added for the analysis of variance in a layer of their own, so that the layers above stay cached
RUN install2.r --error --skipinstalled car afex \
    && Rscript -e 'pk <- c("car", "afex", "lme4"); \
                   for (p in pk) suppressPackageStartupMessages(library(p, character.only = TRUE)); \
                   cat(sprintf("%s %s\n", pk, sapply(pk, function(p) as.character(packageVersion(p)))), sep = "")'

# effectsize (Cohen's d, Hedges' g, eta and omega squared with their intervals) and pwr (power calculations), added
# for the effect sizes in a layer of their own
RUN install2.r --error --skipinstalled effectsize pwr \
    && Rscript -e 'pk <- c("effectsize", "pwr", "insight", "bayestestR", "parameters", "datawizard"); \
                   for (p in pk) suppressPackageStartupMessages(library(p, character.only = TRUE)); \
                   cat(sprintf("%s %s\n", pk, sapply(pk, function(p) as.character(packageVersion(p)))), sep = "")'
