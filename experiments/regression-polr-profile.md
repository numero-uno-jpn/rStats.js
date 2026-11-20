# polr performance profile (Stage 3)

This experiment isolates one evaluation of the likelihood derivatives from the full optimizer and also times the two end-to-end cases. It does not run R and does not modify fixtures.

The pre-suffix-sum implementation is commit `6dacafa79df1ee981d23608a81e4efc55a6f4581`; it still contains the dense four-loop transformation of the natural Hessian. Compare it with the current `work/regression` head using the same Node version and machine.

From the repository root:

```sh
git worktree add /tmp/rstats-polr-before 6dacafa79df1ee981d23608a81e4efc55a6f4581
cp experiments/regression-polr-profile.mjs /tmp/rstats-polr-before/experiments/
(cd /tmp/rstats-polr-before && npm ci && npx esbuild src/entries/regression.ts --bundle --format=esm --platform=node --outfile=/tmp/rstats-polr-before/reg.mjs && npx esbuild src/models/polr.ts --bundle --format=esm --platform=node --outfile=/tmp/rstats-polr-before/polr-internal.mjs)
node experiments/regression-polr-profile.mjs /tmp/rstats-polr-before

npx esbuild src/entries/regression.ts --bundle --format=esm --platform=node --outfile=/tmp/reg.mjs
npx esbuild src/models/polr.ts --bundle --format=esm --platform=node --outfile=/tmp/polr-internal.mjs
node experiments/regression-polr-profile.mjs /tmp
```

Record the median of the five isolated derivative evaluations, the median full-fit time for 200 response levels at n=1000, and the median full-fit time for 150 predictor levels at n=300. The 200-level data construction follows `regression-stage3-edge.mjs`; the 150-predictor case also reports the derivative-only cost. This separates time in the derivative kernel from optimizer iterations and model-matrix work.

Do not infer a speedup from a single noisy run. Use the same machine, warm up both versions, and compare the medians. The prior user-observed full-fit time was 342 seconds; the pre-change baseline reported earlier was 284 seconds.
