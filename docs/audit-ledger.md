# Audit ledger

Repository: `numero-uno-jpn/rStats.js`

## Status definitions

| 状態 | 定義 |
|---|---|
| 未監査 | この台帳基準でまだ監査していない |
| 調査中 | 調査に着手したが結論が出ていない、または追加検証待ち |
| 問題未検出 | 調査した範囲では問題を発見していない。問題がないことを証明した意味ではない |
| 問題なし確認済 | 境界値・異常値・関連する性質など、定めた検証範囲を実行して問題がないことを確認した |
| 問題あり | 再現可能な不具合を確認した |

## Ledger policy

- 1行を1ソースファイルとする。監査対象のファイル単位で状態を管理する。
- `監査回` と `SHA` は、その行の状態を最後に判断した監査回と、その時点の repository HEAD SHA を記録する。
- `未監査` の行は監査回・SHAを `—` とする。
- `問題未検出` はソース確認だけ、または限定的な検証で問題が見つからなかった場合に使う。`問題なし確認済` は具体的な検証範囲と根拠が記録されている場合に限る。
- 同じ根本原因から生じる複数の症状は、同一 Issue にまとめる。
- Issue には領域ラベル・重要度ラベルを付け、再現入力、期待値の根拠、Rとの関係、検証範囲を記録する。
- 監査台帳にも `Rとの関係` と `期待値の根拠・検証範囲` を必須列として設ける。未監査ファイルは `—` とする。

## Bootstrap note

この台帳は監査 #94 で新規作成した。過去の監査 #69〜#93 の会話上の要約は存在するが、全ファイルへの対応付けと各回の repository SHA を裏付ける記録が現在の台帳・会話情報から復元できない。そのため、過去監査を実施済みと推定して状態を付けず、ファイル単位の再照合が済むまでは `未監査` とした。過去監査を再確認した際に、根拠と SHA が特定できた行から状態を移行する。

## Source files

| ファイル | 状態 | 監査回 | Repository HEAD SHA | Issue | Rとの関係 | 期待値の根拠・検証範囲 |
|---|---|---:|---|---|
| `src/api-reference.ts` | 未監査 | — | `—` | — |
| `src/data/grouping.ts` | 未監査 | — | `—` | — |
| `src/descriptive/basic.ts` | 未監査 | — | `—` | — |
| `src/descriptive/cov.ts` | 未監査 | — | `—` | — |
| `src/descriptive/dataFrames.ts` | 未監査 | — | `—` | — |
| `src/descriptive/factanal.ts` | 未監査 | — | `—` | — |
| `src/descriptive/hist.ts` | 未監査 | — | `—` | — |
| `src/descriptive/missing.ts` | 未監査 | — | `—` | — |
| `src/descriptive/moments.ts` | 未監査 | — | `—` | — |
| `src/descriptive/omega.ts` | 未監査 | — | `—` | — |
| `src/descriptive/pivot.ts` | 未監査 | — | `—` | — |
| `src/descriptive/quantile.ts` | 未監査 | — | `—` | — |
| `src/descriptive/rank.ts` | 未監査 | — | `—` | — |
| `src/descriptive/table.ts` | 未監査 | — | `—` | — |
| `src/distributions/arcsine.ts` | 問題未検出 | #95 | `058fff6bf6d780aec1f369ca7520bbc50ef11471` | — | Rでは未確認（base R・extraDistrに対応関数なし） | 密度・CDF・分位点の解析式と mpmath 1.4.1 の領域別fixtureを照合対象として確認。実行未確認。
| `src/distributions/beta.ts` | 未監査 | — | `—` | — |
| `src/distributions/binomial.ts` | 未監査 | — | `—` | — |
| `src/distributions/bvnorm.ts` | 問題あり | #94 | `05e52efbc8f54e505da82fb10555834a02666e46` | [#23](https://github.com/numero-uno-jpn/rStats.js/issues/23) | Rでは未確認 | 完全負相関の恒等式 `Y=-X` による解析値。独立CDF計算。
| `src/distributions/cauchy.ts` | 未監査 | — | `—` | — |
| `src/distributions/chisq.ts` | 未監査 | — | `—` | — |
| `src/distributions/exponential.ts` | 未監査 | — | `—` | — |
| `src/distributions/f.ts` | 未監査 | — | `—` | — |
| `src/distributions/gamma.ts` | 未監査 | — | `—` | — |
| `src/distributions/geometric.ts` | 未監査 | — | `—` | — |
| `src/distributions/hypergeometric.ts` | 未監査 | — | `—` | — |
| `src/distributions/invgamma.ts` | 未監査 | — | `—` | — |
| `src/distributions/kumaraswamy.ts` | 未監査 | — | `—` | — |
| `src/distributions/laplace.ts` | 未監査 | — | `—` | — |
| `src/distributions/logistic.ts` | 未監査 | — | `—` | — |
| `src/distributions/lognormal.ts` | 未監査 | — | `—` | — |
| `src/distributions/multinomial.ts` | 未監査 | — | `—` | — |
| `src/distributions/nbeta.ts` | 未監査 | — | `—` | — |
| `src/distributions/nchisq.ts` | 未監査 | — | `—` | — |
| `src/distributions/negbinomial.ts` | 未監査 | — | `—` | — |
| `src/distributions/normal.ts` | 未監査 | — | `—` | — |
| `src/distributions/nt.ts` | 未監査 | — | `—` | — |
| `src/distributions/pareto.ts` | 未監査 | — | `—` | — |
| `src/distributions/poisson.ts` | 未監査 | — | `—` | — |
| `src/distributions/signrank.ts` | 未監査 | — | `—` | — |
| `src/distributions/summary.ts` | 未監査 | — | `—` | — |
| `src/distributions/t.ts` | 未監査 | — | `—` | — |
| `src/distributions/triangular.ts` | 未監査 | — | `—` | — |
| `src/distributions/tukey.ts` | 未監査 | — | `—` | — |
| `src/distributions/uniform.ts` | 未監査 | — | `—` | — |
| `src/distributions/weibull.ts` | 未監査 | — | `—` | — |
| `src/distributions/wilcox.ts` | 未監査 | — | `—` | — |
| `src/entries/descriptive.ts` | 未監査 | — | `—` | — |
| `src/entries/distributions.ts` | 未監査 | — | `—` | — |
| `src/entries/linalg.ts` | 未監査 | — | `—` | — |
| `src/entries/mixed.ts` | 未監査 | — | `—` | — |
| `src/entries/numerics.ts` | 未監査 | — | `—` | — |
| `src/entries/special.ts` | 未監査 | — | `—` | — |
| `src/entries/tests.ts` | 未監査 | — | `—` | — |
| `src/htest/agreement.ts` | 未監査 | — | `—` | — |
| `src/htest/ansariTest.ts` | 未監査 | — | `—` | — |
| `src/htest/aov.ts` | 未監査 | — | `—` | — |
| `src/htest/binomTest.ts` | 未監査 | — | `—` | — |
| `src/htest/brunnerMunzelTest.ts` | 未監査 | — | `—` | — |
| `src/htest/chisqTest.ts` | 未監査 | — | `—` | — |
| `src/htest/cor.ts` | 未監査 | — | `—` | — |
| `src/htest/core/ansari.ts` | 未監査 | — | `—` | — |
| `src/htest/core/kolmogorov.ts` | 未監査 | — | `—` | — |
| `src/htest/core/mantelhaen.ts` | 未監査 | — | `—` | — |
| `src/htest/core/shapiro.ts` | 未監査 | — | `—` | — |
| `src/htest/core/simulate.ts` | 未監査 | — | `—` | — |
| `src/htest/core/smirnov.ts` | 未監査 | — | `—` | — |
| `src/htest/dunnett.ts` | 未監査 | — | `—` | — |
| `src/htest/effectSize.ts` | 未監査 | — | `—` | — |
| `src/htest/fisherTest.ts` | 未監査 | — | `—` | — |
| `src/htest/groups.ts` | 未監査 | — | `—` | — |
| `src/htest/ksTest.ts` | 未監査 | — | `—` | — |
| `src/htest/leveneTest.ts` | 未監査 | — | `—` | — |
| `src/htest/mantelhaenTest.ts` | 未監査 | — | `—` | — |
| `src/htest/mcnemarTest.ts` | 未監査 | — | `—` | — |
| `src/htest/multipleComparisons.ts` | 未監査 | — | `—` | — |
| `src/htest/normalityTests.ts` | 未監査 | — | `—` | — |
| `src/htest/onewayTest.ts` | 未監査 | — | `—` | — |
| `src/htest/pAdjust.ts` | 未監査 | — | `—` | — |
| `src/htest/pairwise.ts` | 未監査 | — | `—` | — |
| `src/htest/poissonTest.ts` | 未監査 | — | `—` | — |
| `src/htest/polycor.ts` | 未監査 | — | `—` | — |
| `src/htest/power.ts` | 未監査 | — | `—` | — |
| `src/htest/propTest.ts` | 未監査 | — | `—` | — |
| `src/htest/pwr.ts` | 未監査 | — | `—` | — |
| `src/htest/rankTests.ts` | 未監査 | — | `—` | — |
| `src/htest/tTest.ts` | 未監査 | — | `—` | — |
| `src/htest/testFormula.ts` | 未監査 | — | `—` | — |
| `src/htest/trendTests.ts` | 未監査 | — | `—` | — |
| `src/htest/types.ts` | 未監査 | — | `—` | — |
| `src/htest/varTest.ts` | 未監査 | — | `—` | — |
| `src/htest/wilcoxTest.ts` | 未監査 | — | `—` | — |
| `src/index.ts` | 未監査 | — | `—` | — |
| `src/integrate/quadpack.ts` | 未監査 | — | `—` | — |
| `src/internal/covmat.ts` | 未監査 | — | `—` | — |
| `src/internal/ddexp.ts` | 未監査 | — | `—` | — |
| `src/internal/discrete.ts` | 未監査 | — | `—` | — |
| `src/internal/dpq.ts` | 未監査 | — | `—` | — |
| `src/internal/extremes.ts` | 未監査 | — | `—` | — |
| `src/internal/fround.ts` | 未監査 | — | `—` | — |
| `src/internal/integer.ts` | 未監査 | — | `—` | — |
| `src/internal/invert.ts` | 未監査 | — | `—` | — |
| `src/internal/levels.ts` | 未監査 | — | `—` | — |
| `src/internal/noncentral.ts` | 未監査 | — | `—` | — |
| `src/internal/poissonMixture.ts` | 未監査 | — | `—` | — |
| `src/internal/scaledInverse.ts` | 未監査 | — | `—` | — |
| `src/internal/seq.ts` | 未監査 | — | `—` | — |
| `src/internal/summary.ts` | 未監査 | — | `—` | — |
| `src/internal/uniroot.ts` | 未監査 | — | `—` | — |
| `src/internal/vectorize.ts` | 未監査 | — | `—` | — |
| `src/linalg/balance.ts` | 未監査 | — | `—` | — |
| `src/linalg/basic.ts` | 未監査 | — | `—` | — |
| `src/linalg/chol.ts` | 未監査 | — | `—` | — |
| `src/linalg/eigen.ts` | 未監査 | — | `—` | — |
| `src/linalg/expm.ts` | 未監査 | — | `—` | — |
| `src/linalg/kappa.ts` | 未監査 | — | `—` | — |
| `src/linalg/lu.ts` | 未監査 | — | `—` | — |
| `src/linalg/matrix.ts` | 未監査 | — | `—` | — |
| `src/linalg/norm.ts` | 未監査 | — | `—` | — |
| `src/linalg/ops.ts` | 未監査 | — | `—` | — |
| `src/linalg/qr.ts` | 未監査 | — | `—` | — |
| `src/linalg/schur.ts` | 未監査 | — | `—` | — |
| `src/linalg/solve.ts` | 未監査 | — | `—` | — |
| `src/linalg/svd.ts` | 未監査 | — | `—` | — |
| `src/models/anovaSequential.ts` | 未監査 | — | `—` | — |
| `src/models/aovEz.ts` | 未監査 | — | `—` | — |
| `src/models/aovStrata.ts` | 未監査 | — | `—` | — |
| `src/models/carAnova.ts` | 未監査 | — | `—` | — |
| `src/models/coxph.ts` | 未監査 | — | `—` | — |
| `src/models/ddLeastSquares.ts` | 未監査 | — | `—` | — |
| `src/models/ddMatrix.ts` | 未監査 | — | `—` | — |
| `src/models/estimable.ts` | 未監査 | — | `—` | — |
| `src/models/formula.ts` | 未監査 | — | `—` | — |
| `src/models/glm.ts` | 未監査 | — | `—` | — |
| `src/models/glmAnova.ts` | 未監査 | — | `—` | — |
| `src/models/glmConfint.ts` | 未監査 | — | `—` | — |
| `src/models/glmFamily.ts` | 未監査 | — | `—` | — |
| `src/models/lm.ts` | 未監査 | — | `—` | — |
| `src/models/lmer.ts` | 未監査 | — | `—` | — |
| `src/models/lmerAnova.ts` | 未監査 | — | `—` | — |
| `src/models/lmerHypotheses.ts` | 未監査 | — | `—` | — |
| `src/models/lmerTest.ts` | 未監査 | — | `—` | — |
| `src/models/mauchly.ts` | 未監査 | — | `—` | — |
| `src/models/mixedDerivatives.ts` | 未監査 | — | `—` | — |
| `src/models/mixedDeviance.ts` | 未監査 | — | `—` | — |
| `src/models/mixedStructure.ts` | 未監査 | — | `—` | — |
| `src/models/modelFrame.ts` | 未監査 | — | `—` | — |
| `src/models/modelMatrix.ts` | 未監査 | — | `—` | — |
| `src/models/scaledTables.ts` | 未監査 | — | `—` | — |
| `src/models/survival.ts` | 未監査 | — | `—` | — |
| `src/models/tiedTimes.ts` | 未監査 | — | `—` | — |
| `src/numerics/deriv.ts` | 未監査 | — | `—` | — |
| `src/numerics/integrate.ts` | 未監査 | — | `—` | — |
| `src/numerics/interp.ts` | 未監査 | — | `—` | — |
| `src/numerics/ode.ts` | 未監査 | — | `—` | — |
| `src/optim/lbfgsb.ts` | 未監査 | — | `—` | — |
| `src/optim/localmin.ts` | 未監査 | — | `—` | — |
| `src/optim/optim.ts` | 未監査 | — | `—` | — |
| `src/random/as241.ts` | 未監査 | — | `—` | — |
| `src/random/beta.ts` | 未監査 | — | `—` | — |
| `src/random/binomial.ts` | 未監査 | — | `—` | — |
| `src/random/common.ts` | 未監査 | — | `—` | — |
| `src/random/continuous.ts` | 未監査 | — | `—` | — |
| `src/random/extra.ts` | 未監査 | — | `—` | — |
| `src/random/gamma.ts` | 未監査 | — | `—` | — |
| `src/random/hyper.ts` | 未監査 | — | `—` | — |
| `src/random/lecuyer.ts` | 未監査 | — | `—` | — |
| `src/random/mt.ts` | 未監査 | — | `—` | — |
| `src/random/poisson.ts` | 未監査 | — | `—` | — |
| `src/random/r2dtable.ts` | 未監査 | — | `—` | — |
| `src/random/rank.ts` | 未監査 | — | `—` | — |
| `src/random/rng.ts` | 未監査 | — | `—` | — |
| `src/random/sample.ts` | 未監査 | — | `—` | — |
| `src/random/streams.ts` | 未監査 | — | `—` | — |
| `src/special/besselIK.ts` | 未監査 | — | `—` | — |
| `src/special/besselJY.ts` | 未監査 | — | `—` | — |
| `src/special/besselSeries.ts` | 未監査 | — | `—` | — |
| `src/special/beta.ts` | 未監査 | — | `—` | — |
| `src/special/choose.ts` | 未監査 | — | `—` | — |
| `src/special/constants.ts` | 未監査 | — | `—` | — |
| `src/special/dd.ts` | 未監査 | — | `—` | — |
| `src/special/erf.ts` | 未監査 | — | `—` | — |
| `src/special/extra.ts` | 未監査 | — | `—` | — |
| `src/special/gamma.ts` | 未監査 | — | `—` | — |
| `src/special/igam.ts` | 未監査 | — | `—` | — |
| `src/special/igamAsympCoeff.ts` | 未監査 | — | `—` | — |
| `src/special/igami.ts` | 未監査 | — | `—` | — |
| `src/special/incbet.ts` | 未監査 | — | `—` | — |
| `src/special/incbetLargeA.ts` | 未監査 | — | `—` | — |
| `src/special/incbetPrefactor.ts` | 未監査 | — | `—` | — |
| `src/special/incbetTemme.ts` | 未監査 | — | `—` | — |
| `src/special/lgammaDiff.ts` | 未監査 | — | `—` | — |
| `src/special/loader.ts` | 未監査 | — | `—` | — |
| `src/special/log1p.ts` | 未監査 | — | `—` | — |
| `src/special/log1pmx.ts` | 未監査 | — | `—` | — |
| `src/special/ndtri.ts` | 未監査 | — | `—` | — |
| `src/special/polevl.ts` | 未監査 | — | `—` | — |
| `src/special/psigamma.ts` | 未監査 | — | `—` | — |
| `src/special/rCompatible.ts` | 未監査 | — | `—` | — |

## Audit #94

- Repository HEAD: `05e52efbc8f54e505da82fb10555834a02666e46`
- `src/distributions/bvnorm.ts` blob SHA: `3fab7f50d90262fb3295fae0ba5980f636b4ef11`
- Result: `pbvnorm()` の `rho = -1` 境界分岐で誤った上側直交象限確率を返す。
- Reproduction: `pbvnorm([-1, -0.5], [Infinity, Infinity], -1)`
- Expected: `Phi(0.5) - Phi(-1) = 0.532807207342556`（`Y = -X` という完全負相関の関係から導出）。
- Actual: `0.1498822847945298`（ソース分岐の式を代入）。
- R relationship: `Rでは未確認`（R/mvtnorm 実行環境なし）。
- Verification: ソース経路の追跡と標準正規CDFの独立計算。Vitest全体・Rとの実行比較は未実施。
- Issue: [#23](https://github.com/numero-uno-jpn/rStats.js/issues/23) (`area:distributions`, `priority:high`, `bug`).

## Audit #95

- Target: `src/distributions/arcsine.ts`
- Repository HEAD: `058fff6bf6d780aec1f369ca7520bbc50ef11471`
- File blob SHA: `907b0a4b3b55ca8f4b21325dca7de651fb8f420b`
- Result: source inspection did not identify a confirmed defect; status is `問題未検出`, not `問題なし確認済`.
- Scope: `darcsine1()`, `parcsine1()`, `qarcsine1()`; interval endpoints, finite-width overflow scaling, near-endpoint tails, log-probability branches, mirrored upper-tail handling, and density endpoint singularities.
- Expected-value basis reviewed: analytic arcsine formulas (`f(x)=1/(π√((x-a)(b-x)))`, `F(x)=(2/π)asin(√z)`, quantile via `sin²(πp/2)`), plus repository mpmath 1.4.1 region fixtures `darcsine_regions.mpmath.json`, `parcsine_regions.mpmath.json`, and `qarcsine_regions.mpmath.json`. Fixtures were inspected but not executed.
- R relationship: `Rでは未確認`; source documentation says base R and extraDistr have no corresponding arcsine distribution functions.
- Verification limits: source-level reasoning and fixture review only; no isolated runtime harness, full Vitest run, or R comparison. Therefore not marked `問題なし確認済`.

## Audit #96

- Target files: `src/distributions/multinomial.ts` (public path) and `src/special/loader.ts` (shared root cause).
- Repository HEAD: `cf1b318aae1458a9fc8d22c40a1118e7570a52f6`
- Reproduction: `dmultinom([8e307, 8e307], [0.5, 0.5])` and `dmultinom([8e307, 8e307], [0.5, 0.5], { log: true })`.
- Expected: `C(2m,m)/4^m`, `m=8e307`, approximately `6.307831305050442e-155`; log approximately `-355.0588974883506`.
- Root cause: `2 * Math.PI * x * (nmx / n)` overflows at the first intermediate product even though `nmx/n=0.5`; `expNegDD()` then divides by `sqrt(Infinity)` in its ordinary branch.
- R relationship: `Rでは未確認`.
- Evidence: source path analysis, IEEE-754 arithmetic, central-binomial Stirling approximation. Full package/Vitest/R execution not performed.
- Issue: [#24](https://github.com/numero-uno-jpn/rStats.js/issues/24) (`area:distributions`, `priority:medium`, `bug`). Both files share one root cause and are tracked by one Issue.
