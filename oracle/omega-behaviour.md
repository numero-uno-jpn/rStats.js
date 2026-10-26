# McDonald's omega (psych::omega): the behaviour to reproduce

What psych 2.6.9's `omega` computes with its defaults (`fm = "minres"`, `rotate = "oblimin"` from GPArotation
2026.8-2, `option = "equal"`, `flip = TRUE`), in words, for an implementation that must not read the source of R,
psych or GPArotation. Fixture `omega` (`oracle/omega.R`; format in its header). It needs this library's `cor`, `eigen`
(symmetric), `svd`, `solve`, `optim` (L-BFGS-B) and the varimax rotation of `factanal` (`oracle/factanal-behaviour.md`,
step 5). Where this file and a fixture seem to disagree, report it.

## Easy to get wrong

1. The first-order factors are **minres** factors (least squares on the off-diagonal correlations), rotated by
   **varimax**, then rotated obliquely by **oblimin** (quartimin); the oblimin loadings are **not** re-signed or
   re-sorted.
2. The general factor's loadings on the first-order factors come from a one-factor minres analysis of their
   correlation matrix (three or more factors), from `sqrt(|φ12|)` for both (two factors), or are 1 (one factor).
3. Items with a negative general loading are **flipped** (the correlation matrix and the first k + 1 columns of the
   Schmid-Leiman matrix), and every statistic is computed after the flip.
4. The minres objective and its gradient do not match (the gradient is not the objective's derivative); use them
   as given, since the L-BFGS-B iterations must be R's.
5. GPArotation's oblimin uses a Barzilai-Borwein step with a non-monotone line search; the stopping rule is on the
   projected gradient (`s < 1e-5`).

## API

`omega(x, { nfactors (3), covmat? })`: `x` the data (rows observations), or `covmat` a correlation matrix. Result
(fixture names in camelCase): `omegaH`, `omegaLim`, `alpha`, `omegaTot`, `G6`, `ECV`, `sl` (with `slNames`),
`orthog`, `oblique`, `phi` (absent for one factor), `gloading`, `key`, `omegaGroup` (rows g, F1*, ...; columns
total, general, group; NaN for a group with no items), `warnings`, `messages`.

## Steps

1. **Correlations.** R = the correlation matrix of x (pairwise complete observations), or the given matrix scaled
   to unit diagonal (`r_ij / sqrt(r_ii r_jj)`, diagonal set to 1). p variables. (R's `cor` may leave a diagonal entry a unit
   in the last place below 1; the factor analyses and the SMC rescale to unit diagonal, the sums of step 9 do not.
   The difference is far below the tolerance.)
2. **SMC.** `smc_i = 1 − 1/(R⁺)_ii` with `R⁺` the pseudo-inverse from the SVD `R = U D V'`: keep the singular values
   `d_i > sqrt(2^-52) d_1`, `R⁺ = V_kept diag(1/d) U_kept'`. Then values above 1 become 1 (message `In smc, smcs > 1
   were set to 1.0`) and below 0 become 0 (`In smc, smcs < 0 were set to .0`).
3. **Minres factor analysis** of a correlation matrix S with q factors (used for the first order, q = nfactors, and
   for the second order, q = 1): minimise over the uniquenesses ψ with `optim` L-BFGS-B, start `ψ_i = 1 − smc_i`,
   bounds `0.005 ≤ ψ_i ≤ max(max_i smc_i, 1)`, `parscale` 0.01 for each, `fnscale` 1 (other controls default):
   - objective: S* = S with its diagonal replaced by `1 − ψ`; its eigenvalues `e` (decreasing) and eigenvectors V
     (symmetric); eigenvalues below 2^-52 replaced by `100 × 2^-52`; `Λ = V_q diag(sqrt(e_1..q))`; the objective is
     the sum over i > j of `(S_ij − (ΛΛ')_ij)²`;
   - gradient: the eigen decomposition of `S − diag(ψ)` (the same matrix), `Λ = V_q diag(sqrt(max(e_1..q, 0)))`,
     `g_i = (ΛΛ')_ii + ψ_i − S_ii`.
   Loadings from the optimum ψ: the eigen decomposition of S with diagonal `S_ii − ψ_i`, `Λ = V_q diag(sqrt(max(e,
   0)))`. Signs: q > 1, multiply each column by the sign of its sum (+1 for 0); q = 1, negate Λ if its sum is
   negative. Loadings exactly 0 become 1e-15. If some `(ΛΛ')_ii > 1`: warning `An ultra-Heywood case was detected.
   Examine the results carefully` (two spaces before Examine). For q > 1 rotate (varimax, as in factanal: normalised,
   eps 1e-5), then multiply each column by the sign of its sum (+1 for 0) and order the columns by decreasing sum of
   squares (ties keep their order). For q = 1 only the sign rule (again).
4. **First order.** `orthog` = the minres loadings of R with q = nfactors (step 3, varimax).
5. **Oblimin** (q ≥ 2) of `A = orthog` (p × q). For a loading matrix L: `X_ij = Σ_m L_im² − L_ij²`, `Gq = L ∘ X`, `f
   = Σ (L² ∘ X)/4`. Start `T = I`, `α = 1`, no previous point; `L = A (T⁻¹)'`, f and Gq from L, `G = −(L' Gq T⁻¹)'`
   (T⁻¹ by an LU solve). For iter = 0, 1, ..., 2000:
   - `Gp = G − T diag(colSums(T ∘ G))`, `s = sqrt(Σ Gp²)`; append f to the list of values; stop if `s < 1e-5`;
   - with a previous point: `dT = T − T_prev`, `dG = Gp − Gp_prev`; if `Σ dG² > 0`, `α = Σ dT² / |Σ dT ∘ dG|`, then `α
     = max(1e-10, min(α, 20))` (otherwise α stays); without one (iter 0): `α = 2α`;
   - target = the largest of the last 10 values of the list (fewer at the start);
   - up to 11 times: `X = T − α Gp`, `T_t = X diag(1/sqrt(colSums(X²)))`, `L = A (T_t⁻¹)'`, f_t and Gq_t from L; stop
     trying if `target − f_t > 0.5 s² α`, else `α = α/2` (after 11 failures the last trial is taken anyway);
   - `T_prev = T`, `Gp_prev = Gp`, `T = T_t`, `f = f_t`, `G = −(L' Gq_t T_t⁻¹)'`.
   Result: `oblique` = the last L, `phi = T'T`. If iter reaches 2000 without `s < 1e-5`, GPArotation warns (not in
   the fixtures).
6. **General factor.** q ≥ 3: `gloading` = the minres loadings (step 3, q = 1) of phi scaled to unit diagonal (as in
   step 1). q = 2: `gloading = [sqrt(|φ12|), sign(φ12) sqrt(|φ12|)]` and the message in the fixture. q = 1: no
   oblimin (`oblique = orthog`, no phi), `gloading = [1]`, message `Omega_h for 1 factor is not meaningful, just
   omega_t\n` and warning `Omega_h and Omega_asymptotic are not meaningful with one factor`.
7. **Schmid-Leiman.** `g = oblique · gloading` (p-vector); `h2_i = Σ_k orthog_ik²`; `u2_i = R_ii − h2_i`; for each
   item i and factor k: `v = R_ii − (R_ii − oblique_ik²) − (oblique_ik gloading_k)²`, set to 0 if negative, `F_ik* =
   sign(oblique_ik) sqrt(v)` (for one factor, v = 0 exactly: gloading is 1, and R's formula leaves only a rounding residue
   of about 1e-16, whose square root R reports, e.g. 2^-27; the exact 0 is the reference); `p2_i = g_i²/h2_i`; with the row `F = (g_i, F_i1*, ..., F_iq*)`: `com_i = (Σ F²)²/Σ F⁴`. `sl`
   = the columns g, F1*, ..., Fq*, h2, u2, p2, com.
8. **Flip.** `key_i = sign(g_i)` (+1 for 0). If some key is −1: `R ← diag(key) R diag(key)` and the first q + 1
   columns of sl are multiplied row-wise by key.
9. **Statistics** (with the flipped R and sl): `Vt = Σ_ij R_ij`, `Vitem = Σ_i R_ii`, `gsq = (Σ g)²`, `U = Σ u2`;
   `omegaH = gsq/Vt`, `omegaTot = (Vt − U)/Vt`, `omegaLim = gsq/(Vt − U)`, `alpha = ((Vt − Vitem)/Vt) p/(p − 1)`, `G6 =
   (Vt + Σ smc(R) − Vitem)/Vt` (smc of the flipped R, step 2), `ECV = ev_1/Σ ev` with `ev` the column sums of squares
   of the first q + 1 columns of sl.
10. **omegaGroup.** Each item's group is the first k with the largest `|F_ik*|`. For each group k with items G_k:
    `V_k = Σ_{i,j∈G_k} R_ij`, `a_k = Σ_{i∈G_k} F_ik*`, `b_k = Σ_{i∈G_k} g_i`; row `Fk*`: total `(a_k² + b_k²)/V_k`, general
    `b_k²/V_k`, group `a_k²/V_k`. Row g: total = omegaTot, general = `(Σ g)²/Vt`, group = `Σ_k a_k²/Vt`.

## Accuracy

Within a relative 1e-12 of R value by value (the L-BFGS-B and oblimin iterations must be R's). A loading may instead
be within 1e-12 times the largest absolute value of its column, for the reason given in `factanal-behaviour.md`
(R's symmetric eigensolver and this library's agree only to rounding). The one-factor F1* column and the group
column of omegaGroup are compared with their exact value 0 (known differences from R's rounding residues). The
fixture keeps only cases where R's own results move by at most a few 1e-12 when the data change by one unit in
the last place (a uniqueness at its lower bound, or zero degrees of freedom, makes the minres iterations
amplify rounding to 1e-6, so such cases are left out). With four group factors R's results move by 6e-12 to 4e-11 under
such a change (the uniquenesses u2 = 1 − h2 lose another digit to cancellation), so the fixture has no four-factor
case; the implementation handles any number of factors. No other loosening; if a case does not
follow R's iterations, report it with the case rather than adjusting.
