#!/bin/sh
# Regenerate fixtures (test/fixtures/<function>.json) from R's output.
#
#   npm run oracle -- pnorm qnorm   only the named functions
#   npm run oracle                  every oracle/*.R
#
# R runs in a throwaway container from the image rstats-oracle (R 4.5.2 with the
# packages jsonlite, Rmpfr, gmp and MASS); override with RSTATS_ORACLE_IMAGE.
# The random-number oracles use x86_64 rocker/r-ver instead (see below).
# --network none keeps the container offline.
set -eu

cd "$(dirname "$0")/.."
IMAGE="${RSTATS_ORACLE_IMAGE:-rstats-oracle}"
# x86_64 R (for the random-number fixtures); runs under emulation on arm64 hosts
AMD64_IMAGE="${RSTATS_ORACLE_AMD64_IMAGE:-rocker/r-ver:4.5.2}"

if [ "$#" -eq 0 ]; then
  set -- $(ls oracle/*.R | xargs -n1 basename | sed 's/\.R$//' | grep -v '^_')
fi

for name in "$@"; do
  if [ ! -f "oracle/$name.R" ]; then
    echo "oracle/$name.R not found" >&2
    exit 1
  fi
  # Oracles starting with "# oracle-platform: amd64" run on x86_64 R
  # (random-number fixtures: arm64 R differs from x86_64 R in the last digit
  # because of FMA contraction; see oracle/_random.R)
  if grep -q '^# oracle-platform: amd64' "oracle/$name.R"; then
    docker run --rm --network none --platform linux/amd64 --entrypoint Rscript \
      -e LANGUAGE=en -e LC_ALL=C.UTF-8 \
      -v "$PWD/oracle:/oracle:ro" \
      -v "$PWD/test/fixtures:/out" \
      "$AMD64_IMAGE" --vanilla "/oracle/$name.R"
  else
    docker run --rm --network none --entrypoint Rscript \
      -e LANGUAGE=en -e LC_ALL=C.UTF-8 \
      -v "$PWD/oracle:/oracle:ro" \
      -v "$PWD/test/fixtures:/out" \
      "$IMAGE" --vanilla "/oracle/$name.R"
  fi
done
