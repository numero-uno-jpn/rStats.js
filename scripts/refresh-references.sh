#!/bin/sh
# Write out the cases that disagreed with R and recompute their Rmpfr reference values (for development).
#
#   npm run refresh-references
#
# 1. Run the tests with RSTATS_WRITE_MISMATCH=1 to create test/fixtures/<name>.mismatch.json
# 2. Call scripts/reference.sh for each fixture that has a reference-value function
# Reference values are appended to test/fixtures/<name>.ref.json (existing values are kept).
set -u
cd "$(dirname "$0")/.."
rm -f test/fixtures/*.mismatch.json
RSTATS_WRITE_MISMATCH=1 npx vitest run > /dev/null 2>&1

# Per oracle file: the fixtures that have a reference-value function
refresh() {
  oracle="$1"; shift
  names=""
  for n in "$@"; do
    [ -f "test/fixtures/$n.mismatch.json" ] && names="$names $n"
  done
  # shellcheck disable=SC2086
  [ -n "$names" ] && sh scripts/reference.sh "$oracle" $names
}
refresh gamma dgamma pgamma pchisq ppois
refresh beta dbeta pbeta dbinom pbinom dt pt df pf
refresh special dnorm gamma lgamma beta lbeta
refresh simple dunif punif dexp pexp dlnorm plnorm dlogis plogis dcauchy pcauchy dweibull pweibull
refresh nchisq dnchisq pnchisq
refresh nbeta dnbeta pnbeta dnf pnf
# nt takes several hours to compute. Running two or more R containers at once runs out of memory
refresh nt dnt pnt
refresh hyper dhyper phyper
refresh rank dsignrank psignrank dwilcox pwilcox
# tukey takes about an hour
refresh tukey ptukey
refresh nbinom dgeom pgeom dnbinom pnbinom dnbinom_mu pnbinom_mu
rm -f test/fixtures/*.mismatch.json
