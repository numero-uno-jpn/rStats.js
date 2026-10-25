#!/bin/sh
# Regenerate fixtures (test/fixtures/<function>.json) from R's output.
#
#   npm run oracle -- pnorm qnorm   only the named functions
#   npm run oracle                  every oracle/*.R
#
# R runs in a throwaway container from the image rstats-oracle (R 4.5.2 with the
# packages listed in oracle/Dockerfile); override with RSTATS_ORACLE_IMAGE.
# The random-number oracles use the x86_64 build of the same image instead (see below):
#   docker build -t rstats-oracle oracle
#   docker build --platform linux/amd64 -t rstats-oracle-amd64 oracle
# --network none keeps the container offline. demo/ is mounted read-write as /demo because
# oracle/demo.R reads demo/examples.R and writes demo/r-results.json there.
set -eu

cd "$(dirname "$0")/.."
IMAGE="${RSTATS_ORACLE_IMAGE:-rstats-oracle}"
# x86_64 R (for the random-number fixtures); runs under emulation on arm64 hosts
AMD64_IMAGE="${RSTATS_ORACLE_AMD64_IMAGE:-rstats-oracle-amd64}"
MEMORY="${RSTATS_ORACLE_MEMORY:-1536m}"

if [ "$#" -eq 0 ]; then
  set -- $(ls oracle/*.R | xargs -n1 basename | sed 's/\.R$//' | grep -v '^_')
fi

for name in "$@"; do
  if [ ! -f "oracle/$name.R" ]; then
    echo "oracle/$name.R not found" >&2
    exit 1
  fi
  # The container's memory is capped (RSTATS_ORACLE_MEMORY, default 1536m) so that a runaway high-precision
  # computation is killed alone instead of exhausting the Docker VM, which other containers may share
  # Oracles starting with "# oracle-platform: amd64" run on x86_64 R
  # (random-number fixtures: arm64 R differs from x86_64 R in the last digit
  # because of FMA contraction; see oracle/_random.R)
  if grep -q '^# oracle-platform: amd64' "oracle/$name.R"; then
    docker run --rm --network none --memory "$MEMORY" --memory-swap "$MEMORY" --platform linux/amd64 --entrypoint Rscript \
      -e LANGUAGE=en -e LC_ALL=C.UTF-8 \
      -v "$PWD/oracle:/oracle:ro" \
      -v "$PWD/test/fixtures:/out" \
      -v "$PWD/demo:/demo" \
      "$AMD64_IMAGE" --vanilla "/oracle/$name.R"
  else
    docker run --rm --network none --memory "$MEMORY" --memory-swap "$MEMORY" --entrypoint Rscript \
      -e LANGUAGE=en -e LC_ALL=C.UTF-8 \
      -v "$PWD/oracle:/oracle:ro" \
      -v "$PWD/test/fixtures:/out" \
      -v "$PWD/demo:/demo" \
      "$IMAGE" --vanilla "/oracle/$name.R"
  fi
done
