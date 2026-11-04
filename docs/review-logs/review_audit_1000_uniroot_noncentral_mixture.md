# Audit #1000 — Root finding / noncentral distributions / Poisson mixtures

- Target: src/internal/uniroot.ts, src/internal/dpq.ts, src/internal/noncentral.ts, src/internal/poissonMixture.ts, src/numerics/integrate.ts
- HEAD: f4d4a9597586cc0ea289f231626170aa9aaa281c
- Source blobs: 2a7713e09a25bf1330a6ee2a9366aaf630396e37, 543eb6ceb3de7627a7562b035a931a88da424aa7, 0a7c75dcdcc9bcf9a4b3bbd75ed613e5c6046ad7, f0c6a1cf85875cf87f5174c0fcc5575e31db5746, a10fea2f0f0488d49349f0a56653a99058657fa2
- Result: no new independently reproducible defect established.

## Scope

- Internal uniroot wrapper: bracket direction, endpoint value reuse, log-scale odds-ratio root, exponential overflow/underflow boundaries, Brent tolerance.
- Public uniroot core: finite/infinite bounds, endpoint roots, sign-change expansion, fLower/fUpper reuse, maxiter truncation, tolerance validation, overflow-safe interval handling and Brent stopping.
- dpq helpers: probability endpoints under lowerTail/logP, invalid log probabilities, smaller-tail switch without cancellation and exact linear target preservation.
- Noncentral helpers: ordered-double key mapping, adjacent-double search, narrow quantile, adaptive GK15 quadrature, negligible noncentrality approximation.
- Poisson mixture: scaled double-double representation, exponent alignment, Poisson start indices, peak search, log-concavity tail bounds, upward/downward recurrences, direct refresh of approximate terms, tail complement and density summation.

## Candidate rejection

- Internal odds-ratio root uses a log parameter to avoid poor absolute tolerance near zero/large odds ratios. Its representable-endpoint behavior is documented; no concrete caller input causing an incorrect finite answer was established in this static pass.
- searchDoubles is used with finite, ordered brackets from the noncentral quantile callers; no evidence of NaN/Infinity endpoint use was found.
- Poisson mixture's 20,000,000-term limit is an explicit safety valve; large-mean start search avoids a linear walk and tail truncation is bounded using log-concavity.
- No new Issue filed.

## Verification limits

Reviewed existing nchisq/nbeta/fisher/wilcox test file availability and uniroot implementation statically. Vitest/Node/R not executed. No source changes.
