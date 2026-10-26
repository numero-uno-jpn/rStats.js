# Cox regression (coxph): the behaviour to reproduce

What survival 3.8-3's `coxph` computes for right-censored data, in words, for an implementation that must not read
its source. Fixture `coxph` (`oracle/coxph.R`; format in its header). The covariates come as a matrix (no formulas
yet). Where this file and the fixture seem to disagree, report it.

## Easy to get wrong

1. Covariates whose values all lie in `{−1, 0, 1}` are **neither centred nor scaled** (their mean is reported as 0);
   the others are centred by their weighted mean and scaled (step 2). Newton-Raphson runs on the scaled covariates,
   so its iterations, and therefore R's last bits, depend on this.
2. At a tied time, censored observations are still in the risk set; Efron's approximation adds the deaths to the
   risk set **one ndead-th at a time** (step 4).
3. Convergence is tested on the log-likelihood, `|1 − best/new| ≤ eps`, not on the coefficients; a worse step is
   **halved towards the last accepted point** with a growing weight (step 5).
4. When the iterations run out (more than one allowed), R recomputes the score and information at the last
   accepted point and then applies the inverse step of step 4 **without factorising first**; the inverse step reads
   the triangle that the accumulation of step 3 leaves at zero (the factorisation would have filled it), so the
   variance R reports is `diag(1/I_ii)` (0 where `I_ii ≤ 0`; off-diagonal entries −0). Reproduce this. The iteration count is then `iter.max + 1`.
5. A coefficient is NA when its pivot in the generalised Cholesky factorisation is below the tolerance, whether the
   column is aliased or its information has merely become tiny; the linear predictor still uses the internal value
   of that coefficient.
6. R's warning texts contain double spaces (`Loglik converged before variable  2 ; coefficient may be infinite. `).

## API

`coxph(time, status, x, options?)`: `time` the follow-up times, `status` 1 for an event and 0 for censoring, `x` the
covariate matrix (one row per observation, at least one column). Options: `ties` (`"efron"` default, `"breslow"`),
`weights` (case weights), `strata` (labels), `init` (starting coefficients, default 0), `control` `{ eps (1e-9),
iterMax (20), tolerChol (2^-39, i.e. eps^0.75 for the machine eps 2^-52), tolerInf (sqrt(control eps)) }`, `nocenter`
(default `[-1, 0, 1]`), `confLevel` (0.95). Result (fixture names in camelCase):

- `coefficients` (NaN for NA), `var` (p × p), `loglik` `[initial, final]`, `score` (the score test statistic), `wald`
  (the Wald statistic), `iter`, `means`, `n`, `nevent`, `linearPredictors`;
- the summary: `se`, `z`, `p` (`Pr(>|z|)`), `lower`, `upper` (the interval for `exp(coef)`), `logtest`, `sctest`,
  `waldtest` (each `{ statistic, df, pValue }`), `rsq` `{ rsq, maxrsq }`;
- `warnings`.

Non-integer weights make R switch to a robust (sandwich) variance by default; that is not covered yet: throw `non-integer
weights (robust variance) are not supported yet`.

## Steps

1. **Data.** Drop rows with a missing time, status, covariate, weight or stratum; `n` = rows left, `nevent` = Σ
   status (unweighted). A weight ≤ 0: error `Invalid weights, must be >0`. Times within a tolerance are merged: with
   `y` the sorted distinct finite times, `tol = sqrt(2^-52)`, the gap after `y_k` is a tie when `y_{k+1} − y_k ≤ tol`
   or `(y_{k+1} − y_k)/mean(|y|) ≤ tol`; the cut points are `y_1` and each `y_{k+1}` whose gap is not a tie, and every
   time is replaced by the largest cut point not above it. Sort the observations by stratum (the strata as sorted
   labels) and then by time, **stably** (ties keep their input order). Mark the last observation (in sorted order) of
   each stratum as a stratum end.
2. **Centring and scaling.** `W = Σ w` (all used rows, input order). For each column j not exempt by rule 1: `m_j =
   Σ w x_j / W` (sum in sorted order), `x_j ← x_j − m_j`, `s_j = W / Σ w |x_j|` (1 if that sum is 0), `x_j ← s_j x_j`;
   exempt columns `m_j = 0`, `s_j = 1`. The starting values are divided by `s_j`. (The sums run over the sorted
   observations.)
3. **Log-likelihood, score u, information I** at coefficients β (scaled), one pass from the **last** sorted
   observation to the first. At a stratum end (the first one met in each stratum), reset the risk-set sums `D = 0`,
   `a = 0`, `C = 0` (a vector, C a matrix). Each distinct time is a group: walk back through all observations with
   that time (stopping at a stratum end of the next observation, so ties do not cross strata), and for each, with `η
   = offset + Σ_i β_i x_i` (offset 0 here) and `r = exp(η) w`: if censored, `D += r`, `a_i += r x_i`, `C_ij += r x_i
   x_j`; if an event, count it (`d`), `dw += w`, `D2 += r`, `ℓ += w η`, `u_i += w x_i`, `a2_i += r x_i`, `C2_ij += r
   x_i x_j`. After the group, if `d > 0`:
   - Breslow, or `d = 1`: `D += D2`, `ℓ −= dw log D`; for each i: `a_i += a2_i`, `μ_i = a_i/D`, `u_i −= dw μ_i`, and
     for j ≤ i: `C_ij += C2_ij`, `I_ij += dw (C_ij − μ_i a_j)/D`.
   - Efron: with `wbar = dw/d`, repeat d times: `D += D2/d`, `ℓ −= wbar log D`; for each i: `a_i += a2_i/d`, `μ_i =
     a_i/D`, `u_i −= wbar μ_i`, and for j ≤ i: `C_ij += C2_ij/d`, `I_ij += wbar (C_ij − μ_i a_j)/D`.
   Then clear `a2`, `C2` (and `D2`, `d`, `dw` start at 0 for each group). I is symmetric (fill the upper triangle
   from the lower).
4. **Generalised Cholesky** of a symmetric p × p matrix M with tolerance `tol` (`tolerChol`): `e = max_i M_ii` over
   the positive diagonal entries (`e = tol` if none), else `e = e × tol`. For i = 1..p: the pivot `π = M_ii`; if it
   is not finite or `π < e`, set `M_ii = 0` (and remember "not non-negative definite" if `π < −8e`) and leave column
   i below the diagonal as it is; otherwise, for each j > i: `t = M_ji/π`, `M_ji = t`, `M_jj −= t² π`, and for k > j:
   `M_kj −= t M_ki`. The rank is the number of pivots kept (negated when not non-negative definite).
   **Solve** `M y = b` with the factor: forward, for i = 1..p, `y_i = b_i − Σ_{j<i} y_j M_ij`; backward, for i = p..1,
   `y_i = 0` if `M_ii = 0`, else `y_i = y_i/M_ii − Σ_{j>i} y_j M_ji`.
   **Inverse** from the factor (in place): first, for each i with `M_ii > 0`: `M_ii = 1/M_ii`, and for j > i: `M_ji =
   −M_ji`, then for k < i: `M_jk += M_ji M_ik`. Then for each i: if `M_ii = 0`, zero row i and column i; else for each
   j > i: `t = M_ji M_jj`, `M_ij = t` (j ≠ i), and for k = i..j−1: `M_ik += t M_jk`. The result is the upper triangle
   `M_ij` (i ≤ j); copy it to the lower one.
5. **Newton-Raphson.** `iter = 0`; compute ℓ, u, I at the start (step 3); `loglik[0] = loglik[1] = ℓ`. Factorise I
   (step 4), `δ = I^-1 u` (solve), `score = Σ u_i δ_i` (the score test). If `iterMax = 0` or ℓ is not finite: invert
   I and finish (below). Else `best = ℓ`, `β_new = β + δ`, `h = 0`, and for `iter = 1, ..., iterMax`:
   - compute `ℓ_new`, u, I at `β_new`; factorise I (rank `flag`); "not finite" if some `u_i`, some `I_ij` or `ℓ_new`
     is not finite;
   - if finite and `|1 − best/ℓ_new| ≤ eps`: converged; `loglik[1] = ℓ_new`, invert I, `β = β_new`, finish;
   - else if not finite or `ℓ_new < best`: `h += 1`, `β_new = (β_new + h β)/(h + 1)` (each coordinate);
   - else `h = 0`, `best = loglik[1] = ℓ_new` (best is loglik[1]), `δ = I^-1 u` (solve with the factor just made), `β = β_new`, `β_new = β_new + δ`.
   If the loop ends without converging (`iter = iterMax + 1`): when `iterMax > 1`, recompute ℓ, u, I at β and set
   `loglik[1] = ℓ` (with `iterMax = 1`, loglik[1] stays the best accepted value); the variance as in rule 4 after that
   recomputation (with `iterMax = 1`, the inverse of the factor of the last iteration); mark "ran out".
   Finish: `β_j × s_j`, `u_j / s_j`, `var_ij = (I^-1)_ij s_i s_j` (with the u and I of the last evaluation).
6. **Output.** `coefficients` = β, NaN where `var_jj = 0` (only checked when the last rank is below p; never with
   `iterMax = 0`). `linearPredictors_k = Σ_j x_kj β_j − Σ_j β_j m_j` (original x, input order, the internal β
   including NaN-marked ones). Warnings (only when `iterMax > 1`): ran out → `Ran out of iterations and did not
   converge`, and then also `one or more coefficients may be infinite` if `max(linearPredictors) > 500` or some
   `|Σ_i u_i var_ij|` is not finite; converged → with `f_j = |Σ_i u_i var_ij|`, the columns j where `u_j` is not
   finite or (`f_j > eps` and `f_j > tolerInf |β_j|`, β the internal value even where it is reported as NaN): `Loglik converged before variable  <j, 1-based, joined by "," without spaces>
   ; coefficient may be infinite. `.
7. **Tests.** With the k non-NA coefficients b (minus `init` when given) and their variance V: the Wald statistic
   `b'V^-1b`: for k = 1 `b²/V`; otherwise factorise V (step 4, `tolerChol`), solve, `Σ b_i y_i`. Summary: `se =
   sqrt(var_jj)`, `z = β/se`, `p` = upper chi-squared tail (1 df) of z²; `lower, upper = exp(β ∓ q se)` with `q` the
   normal quantile at `(1 + confLevel)/2`; `logtest = −2 (loglik[0] − loglik[1])`, `sctest = score`, `waldtest =
   wald`, each with df = k and its upper chi-squared tail; `rsq = 1 − exp(−logtest/n)`, `maxrsq = 1 − exp(2
   loglik[0]/n)`. NaN coefficients give NaN in their z, p, lower, upper (se 0).

## Accuracy

Within a relative 1e-12 of R value by value (the iterations must be R's: the same `iter`); zero entries of R exactly
(the −0 of rule 4 may be +0). No loosening; known differences only within 1e-12 of an exact reference (none here).
The fixture comes from x86_64 R (arm64 R fuses multiply-adds, which changes the last bits of the iterations). Long
runs towards an infinite coefficient are left out: the information falls exponentially along such a path, and R's
own results then differ between platforms by 1e-7; the monotone cases stop after 4 iterations.
