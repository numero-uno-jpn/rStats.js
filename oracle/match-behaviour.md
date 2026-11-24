# Propensity score matching: Match, balance statistics, clogit (draft, 1.12.0)

Reference basis: the documentation of Matching 4.10-15 (`Match`), cobalt 5.0.0 (`bal.tab`, `col_w_smd`), tableone 0.13.2
(`CreateTableOne`, `ExtractSmd`) and survival 3.8-12 (`clogit`); Austin (2011), "An introduction to propensity score
methods", Multivariate Behavioral Research 46, 399-424; Gail, Lubin & Rubinstein (1981), "Likelihood calculations for
matched case-control studies and survival studies with tied death times", Biometrika 68, 703-707. R 4.6.2 public-call
results (x86_64) in `experiments/psm112.R`, `experiments/psm112-ties.R` and `experiments/psm112-sample.R`, recorded on
Issue #562. No R or package source was consulted.

The call followed is ReactiveStat's: `ps <- fitted(glm(tr ~ ..., family = binomial()))`, `X = log(ps / (1 - ps))`,
`set.seed(1234)`, `Match(Tr = tr, X = X, estimand = ..., M = ..., caliper = ..., ties = FALSE, replace = FALSE)`.

## Settled

- **Caliper unit.** `ecaliper = caliper * sqrt(mean((X - mean(X))^2))`: the SD of X over all units with divisor n (not
  n - 1, not within a group). `psm112`: 0.2 and 0.5 times the divisor-n SD to the last digit.
- **Random numbers.** Without ties, `Match(ties = FALSE)` draws no uniform (the state after the call equals the state
  before). Distances within `distance.tolerance` (default 1e-5) count as ties: in `psm112`'s first data one tie inside the
  tolerance cost one draw. `tol_inside` (difference 5e-6) and `tol_outside` (5e-5) both chose the nearer control without
  a draw, so the tolerance compares something other than the raw distance difference — open (below).
- **Order, replace = FALSE.** ATT: the treated units are processed in data order; `index.treated` lists each treated unit
  M times in a row, `weights` = 1/M. A treated unit whose M controls are not available is dropped (`ndrops`,
  `index.dropped`); with M = 2 and few controls R drops treated units rather than giving them fewer controls.
  ATC mirrors ATT. ATE returns both halves (treated matched to controls and controls matched to treated) in an order
  that is not plain data order — open.
- **bal.tab** (`binary = "std"`, `disp.v.ratio = TRUE`, the Match object): `Diff.Un` and `Diff.Adj` are
  (weighted mean treated - weighted mean control) / SD of the treated group **in the unmatched sample** (estimand ATT;
  for binary variables sqrt(p(1 - p)) of the unmatched treated). The weights are `get.w(m)`. `V.Ratio.Adj` is the ratio of
  weighted variances treated / control with divisor sum(w) - sum(w^2) / sum(w). Default `binary` is the raw difference
  in proportions. (`psm112-ties` balCaliper reproduces all four numbers.)
- **tableone** `ExtractSmd`: (mean1 - mean0) / sqrt((s1^2 + s0^2) / 2) with the groups' own SDs (n - 1) in the data
  given (the matched rows for "after"). A two-level factor uses (p1 - p0) / sqrt((p1(1 - p1) + p0(1 - p0)) / 2), with no
  n / (n - 1) correction; the same 0/1 variable given as numeric uses the n - 1 SDs (`psm112`: 0.33504045369882820 and
  0.32935685137756043, both reproduced to the last digit).
- **clogit.** The default method is `"exact"` (the exact conditional likelihood); `"approximate"` is `"breslow"`.
  ReactiveStat uses the default. The exact likelihood per stratum is the Gail-Lubin-Rubinstein recursion.

## Open (not chased further, for a decision)

1. **How ties = FALSE chooses among k tied controls.** k = 2: one draw u; the second tied control (in data order) when
   u < 0.5, else the first (12 seeds). k >= 3: the number of draws varies with the seed (k = 3: mostly 2, sometimes 3 or
   5; k = 4: 3 to 9; k = 5: 5 to 9) and does not equal that of `sample(k, 1)`, `sample(k, k - 1)` or `sample(k)`
   (`psm112-sample.txt`), nor the cumulative draws of 1 to 6 calls of `rnorm`, `rexp`, `rbinom`, `rpois`, `rgamma` or
   `sample(2|3|4, 1)` (`psm112-rng.txt`). An outside analysis of the numbers alone (ChatGPT, no source) confirmed the
   k = 2 rule and found M = 2 to take its candidates as every control within the M-th smallest distance (`m2_k4` and
   `m2_near_then_k3` agree in all 12 seeds), but no rule for k >= 3.
   **Decision (the user, 2026-11-24):** ties among k >= 3 candidates are broken by rStats.js's own documented rule,
   reproducible with `setSeed`, and listed as a known difference from R. Without ties the pairs are R's.
2. The quantity compared with `distance.tolerance`.
3. The order of the ATE output.
4. clogit `method = "efron"` gives the same coefficients as `"breslow"` but a different log-likelihood (not needed for
   ReactiveStat's call).
