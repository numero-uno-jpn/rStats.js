#!/bin/sh
# Attach Rmpfr reference values to the cases where the tests disagreed with R.
#
#   RSTATS_WRITE_MISMATCH=1 npm test          write out the disagreeing cases
#   npm run reference -- beta pbeta pt         compute them with the reference functions in oracle/beta.R
#
# Results go to test/fixtures/<fixture>.ref.json (committed to the repository).
# The image defaults to rstats-oracle (R 4.5.2 with the packages jsonlite, Rmpfr,
# gmp and MASS); override with RSTATS_ORACLE_IMAGE.
set -eu
cd "$(dirname "$0")/.."
IMAGE="${RSTATS_ORACLE_IMAGE:-rstats-oracle}"
docker run --rm --network none --entrypoint Rscript \
  -e LANGUAGE=en -e LC_ALL=C.UTF-8 \
  -v "$PWD/oracle:/oracle:ro" \
  -v "$PWD/test/fixtures:/out" \
  "$IMAGE" --vanilla /oracle/_reference.R "$@"
