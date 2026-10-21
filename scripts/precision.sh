#!/bin/sh
# Compare accuracy between double-double and plain double precision (docs/performance.md).
#
#   npm run precision-report
#
# Runs the whole test suite twice: RSTATS_PRECISION=dd (as is) and RSTATS_PRECISION=double
# (switches the building blocks in src/special/dd.ts to double precision). Neither run fails
# on test results; each writes per-fixture error summaries to reports/precision/<mode>/.
# Finally a side-by-side table of the two is written to reports/precision/report.md.
set -u

cd "$(dirname "$0")/.."
rm -rf reports/precision
for mode in dd double; do
  echo "== RSTATS_PRECISION=$mode"
  # Individual non-fixture checks (expect) may fail, so the exit code is ignored
  RSTATS_PRECISION=$mode npx vitest run --silent >/dev/null 2>&1
done
node scripts/precision-report.mjs
