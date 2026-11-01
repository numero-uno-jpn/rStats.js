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
| `src/api-reference.ts` | 未監査 | — | `—` | — | — | — |
| `src/data/grouping.ts` | 未監査 | — | `—` | — | — | — |
| `src/descriptive/basic.ts` | 未監査 | — | `—` | — | — | — |
| `src/descriptive/cov.ts` | 未監査 | — | `—` | — | — | — |
| `src/descriptive/dataFrames.ts` | 未監査 | — | `—` | — | — | — |
| `src/descriptive/factanal.ts` | 未監査 | — | `—` | — | — | — |
| `src/descriptive/hist.ts` | 未監査 | — | `—` | — | — | — |
| `src/descriptive/missing.ts` | 未監査 | — | `—` | — | — | — |
| `src/descriptive/moments.ts` | 未監査 | — | `—` | — | — | — |
| `src/descriptive/omega.ts` | 未監査 | — | `—` | — | — | — |
| `src/descriptive/pivot.ts` | 未監査 | — | `—` | — | — | — |
| `src/descriptive/quantile.ts` | 未監査 | — | `—` | — | — | — |
| `src/descriptive/rank.ts` | 未監査 | — | `—` | — | — | — |
| `src/descriptive/table.ts` | 未監査 | — | `—` | — | — | — |
| `src/distributions/arcsine.ts` | 問題未検出 | #95 | `058fff6bf6d780aec1f369ca7520bbc50ef11471` | — | Rでは未確認（base R・extraDistrに対応関数なし） | 密度・CDF・分位点の解析式と mpmath 1.4.1 の領域別fixtureを照合対象として確認。実行未確認。 |
| `src/distributions/beta.ts` | 問題未検出 | #99 | `9cb145a85e8153ea0712e2fd38b65885e5a016e5` | — | Rと同じ（通常 fixture は R 4.5.2 由来。今回R実行なし） | `dbeta1`/`pbeta1`/`qbeta1` の支持域端点、shape=0/∞の点質量、shape=1、上下尾・logP、巨大shape・極小shape・subnormal x、分位点の左右反転と極集中分布への経路をソース追跡。`test/beta.test.ts` と CHANGELOG の具体例（例: `pbeta(1.5e-236, 9220.5, 2.6e301)`、`qbeta(3.8e-277, 27.9, 1.5e299)`）を確認。fixture/テストは閲覧のみで実行せず、独立runtime harness・全Vitest・R比較なし。 |
| `src/distributions/binomial.ts` | 問題未検出 | #101 | `8e360c3fb4481da28f2e8eba5fb8d9918af3263f` | — | Rでは未確認 | `dbinom1`/`pbinom1`/`qbinom1` の入力検証、支持域端点、prob=0/1、非整数qの `floor(q + 1e-7)`、2^53超の補正経路、上下尾・logP、離散分位点探索をソース追跡。mpmath由来の `audit_pbinom` fixtureと既存 `qbinom` fixtureを閲覧。fixture/Vitest/package runtime/R実行なし。
| `src/distributions/bvnorm.ts` | 問題あり | #94 | `05e52efbc8f54e505da82fb10555834a02666e46` | [#23](https://github.com/numero-uno-jpn/rStats.js/issues/23) | Rでは未確認 | 完全負相関の恒等式 `Y=-X` による解析値。独立CDF計算。 |
| `src/distributions/cauchy.ts` | 問題あり | #98 | `6a3eedcc2d465be8e7bbb614884e1a95ea22180d` | [#25](https://github.com/numero-uno-jpn/rStats.js/issues/25) | Rでは未確認 | `dcauchy(1.1e308, { location: 0, scale: 1e308 })`。Cauchy密度の閉形式を安全な演算順序で評価した値は約 `1.44031622707598e-309`。現行の `y / (Math.PI * scale)` は `Math.PI * scale` がInfinityとなり0。log密度経路のexp値でも照合。JS式の独立ハーネスで再現、Vitest/R未実行。 |
| `src/distributions/chisq.ts` | 問題あり | #100 | `94e98787221087403c05cdb46f69f55c0760823b` | [#26](https://github.com/numero-uno-jpn/rStats.js/issues/26) | Rと同じ（負の自由度は無効。今回R実行なし） | `df=-Number.MIN_VALUE`（-5e-324）は `df<0` だが `df/2` が `-0` に丸められる。`chisq.ts` が先に `df/2` を渡し、gamma側では `shape<0` が偽・`shape===0` が真となり、`dchisq(0,df)=Infinity`、`dchisq(1,df)=0`、`pchisq(1,df)=1`、`qchisq(0.5,df)=0` 相当のshape=0経路に入る。IEEE-754の丸めと `gamma.ts` の分岐をソース追跡。package/Vitest/R未実行。 |
| `src/distributions/exponential.ts` | 問題あり | #102 | `1aaef113968bfa70a39ed2c501e3b65238763409` | [#27](https://github.com/numero-uno-jpn/rStats.js/issues/27) | Rも誤り | `pexp(1e-20, { rate: 1e-300, logP: true })`。現行値 -736.8272408909739、数学的期待値 ln(1e-320) = -736.8272297580946。`mulDD`/`twoProd` の subnormal 積で残差が失われ、`logOneMinusExpNeg` が丸め済み積を対数化する。既存 known-violation が同じR値を記録。高精度Decimal計算とソース追跡。実行/Vitest/今回のR照合なし。
| `src/distributions/f.ts` | 未監査 | — | `—` | — | — | — |
| `src/distributions/gamma.ts` | 未監査 | — | `—` | — | — | — |
| `src/distributions/geometric.ts` | 問題未検出 | #103 | `fe88f1b31ddb3a69cef524aeb9aa5dd08509e0a8` | — | Rと同じ（通常 fixture は R 4.5.2 由来。今回R実行なし） | `dgeom1`/`pgeom1`/`qgeom1`、`probPair`/`qPow` の通常・subnormal・巨大整数経路、支持域・入力検証、上下尾・logP、離散分位点の境界補正をソース追跡。R 4.5.2由来の d/p/qgeom fixture（計6112ケース）を閲覧。CHANGELOGの `pgeom(1e290, 5e-324)` と `pgeom(8.7e299, 1.1e-300)` の修正記録も照合。fixture/Vitest/package runtime/R実行なし。 |
| `src/distributions/hypergeometric.ts` | 未監査 | — | `—` | — | — | — |
| `src/distributions/invgamma.ts` | 未監査 | — | `—` | — | — | — |
| `src/distributions/kumaraswamy.ts` | 未監査 | — | `—` | — | — | — |
| `src/distributions/laplace.ts` | 未監査 | — | `—` | — | — | — |
| `src/distributions/logistic.ts` | 未監査 | — | `—` | — | — | — |
| `src/distributions/lognormal.ts` | 未監査 | — | `—` | — | — | — |
| `src/distributions/multinomial.ts` | 問題あり | #96 | `ac5d64a614debaa2922754bd257f2b8286619518` | [#24](https://github.com/numero-uno-jpn/rStats.js/issues/24) | Rでは未確認 | 中央二項確率の解析式と Stirling 漸近、IEEE-754 中間積の独立計算。実パッケージ実行・R比較なし。 |
| `src/distributions/nbeta.ts` | 未監査 | — | `—` | — | — | — |
| `src/distributions/nchisq.ts` | 未監査 | — | `—` | — | — | — |
| `src/distributions/negbinomial.ts` | 未監査 | — | `—` | — | — | — |
| `src/distributions/normal.ts` | 未監査 | — | `—` | — | — | — |
| `src/distributions/nt.ts` | 未監査 | — | `—` | — | — | — |
| `src/distributions/pareto.ts` | 未監査 | — | `—` | — | — | — |
| `src/distributions/poisson.ts` | 問題未検出 | #104 | `1dfe5fed11b61ba734bbf1b6b99df58c2ede61bb` | — | Rと同じ（R 4.5.2由来fixture・mpmath独立fixtureあり。今回R実行なし） | `dpois1`/`ppois1`/`qpois1`、`dpoisRaw`・`gammaInc`・`discreteQuantile` の連携を追跡。lambda=0/∞、q・xの支持域端点、NaN/Inf、非整数q、上下尾・logP、2^53超の補正、巨大lambda/subnormal tail、分位点境界と探索停止を確認。R fixture dpois 1,448件・ppois 2,896件・qpois 1,696件、および mpmath ppois 1,474件・qpois 250件を閲覧。CHANGELOGの `ppois(1e16,1e16)` の2^53超補正、lambda>1e6の5〜40σ tail精度改善、`qpois` lambda≈1e20の非終了修正を照合。fixture/Vitest/package runtime/R実行なし。 |
| `src/distributions/signrank.ts` | 未監査 | — | `—` | — | — | — |
| `src/distributions/summary.ts` | 未監査 | — | `—` | — | — | — |
| `src/distributions/t.ts` | 未監査 | — | `—` | — | — | — |
| `src/distributions/triangular.ts` | 問題未検出 | #97 | `6077b7d90cf06effb6e9ba4d08e6414b64c790a2` | — | Rと同じ（通常ケースは extraDistr の比較fixtureあり。今回R実行なし） | 三角分布の解析式、固定数値の既存extraDistr/mpmath fixture、端点モード・幅overflow/underflowの既存テストをソース照合。Vitest・Rは未実行。 |
| `src/distributions/tukey.ts` | 未監査 | — | `—` | — | — | — |
| `src/distributions/uniform.ts` | 未監査 | — | `—` | — | — | — |
| `src/distributions/weibull.ts` | 未監査 | — | `—` | — | — | — |
| `src/distributions/wilcox.ts` | 未監査 | — | `—` | — | — | — |
| `src/entries/descriptive.ts` | 未監査 | — | `—` | — | — | — |
| `src/entries/distributions.ts` | 未監査 | — | `—` | — | — | — |
| `src/entries/linalg.ts` | 未監査 | — | `—` | — | — | — |
| `src/entries/mixed.ts` | 未監査 | — | `—` | — | — | — |
| `src/entries/numerics.ts` | 未監査 | — | `—` | — | — | — |
| `src/entries/special.ts` | 未監査 | — | `—` | — | — | — |
| `src/entries/tests.ts` | 未監査 | — | `—` | — | — | — |
| `src/htest/agreement.ts` | 未監査 | — | `—` | — | — | — |
| `src/htest/ansariTest.ts` | 未監査 | — | `—` | — | — | — |
| `src/htest/aov.ts` | 未監査 | — | `—` | — | — | — |
| `src/htest/binomTest.ts` | 未監査 | — | `—` | — | — | — |
| `src/htest/brunnerMunzelTest.ts` | 未監査 | — | `—` | — | — | — |
| `src/htest/chisqTest.ts` | 未監査 | — | `—` | — | — | — |
| `src/htest/cor.ts` | 未監査 | — | `—` | — | — | — |
| `src/htest/core/ansari.ts` | 未監査 | — | `—` | — | — | — |
| `src/htest/core/kolmogorov.ts` | 未監査 | — | `—` | — | — | — |
| `src/htest/core/mantelhaen.ts` | 未監査 | — | `—` | — | — | — |
| `src/htest/core/shapiro.ts` | 未監査 | — | `—` | — | — | — |
| `src/htest/core/simulate.ts` | 未監査 | — | `—` | — | — | — |
| `src/htest/core/smirnov.ts` | 未監査 | — | `—` | — | — | — |
| `src/htest/dunnett.ts` | 未監査 | — | `—` | — | — | — |
| `src/htest/effectSize.ts` | 未監査 | — | `—` | — | — | — |
| `src/htest/fisherTest.ts` | 未監査 | — | `—` | — | — | — |
| `src/htest/groups.ts` | 未監査 | — | `—` | — | — | — |
| `src/htest/ksTest.ts` | 未監査 | — | `—` | — | — | — |
| `src/htest/leveneTest.ts` | 未監査 | — | `—` | — | — | — |
| `src/htest/mantelhaenTest.ts` | 未監査 | — | `—` | — | — | — |
| `src/htest/mcnemarTest.ts` | 未監査 | — | `—` | — | — | — |
| `src/htest/multipleComparisons.ts` | 未監査 | — | `—` | — | — | — |
| `src/htest/normalityTests.ts` | 未監査 | — | `—` | — | — | — |
| `src/htest/onewayTest.ts` | 未監査 | — | `—` | — | — | — |
| `src/htest/pAdjust.ts` | 未監査 | — | `—` | — | — | — |
| `src/htest/pairwise.ts` | 未監査 | — | `—` | — | — | — |
| `src/htest/poissonTest.ts` | 未監査 | — | `—` | — | — | — |
| `src/htest/polycor.ts` | 未監査 | — | `—` | — | — | — |
| `src/htest/power.ts` | 未監査 | — | `—` | — | — | — |
| `src/htest/propTest.ts` | 未監査 | — | `—` | — | — | — |
| `src/htest/pwr.ts` | 未監査 | — | `—` | — | — | — |
| `src/htest/rankTests.ts` | 未監査 | — | `—` | — | — | — |
| `src/htest/tTest.ts` | 未監査 | — | `—` | — | — | — |
| `src/htest/testFormula.ts` | 未監査 | — | `—` | — | — | — |
| `src/htest/trendTests.ts` | 未監査 | — | `—` | — | — | — |
| `src/htest/types.ts` | 未監査 | — | `—` | — | — | — |
| `src/htest/varTest.ts` | 未監査 | — | `—` | — | — | — |
| `src/htest/wilcoxTest.ts` | 未監査 | — | `—` | — | — | — |
| `src/index.ts` | 未監査 | — | `—` | — | — | — |
| `src/integrate/quadpack.ts` | 未監査 | — | `—` | — | — | — |
| `src/internal/covmat.ts` | 未監査 | — | `—` | — | — | — |
| `src/internal/ddexp.ts` | 未監査 | — | `—` | — | — | — |
| `src/internal/discrete.ts` | 問題あり | #106 | `a8ed86222a9c91b7dfea90b990244a81c1170194` | — | Rでは未確認 | `firstTrue()` の指数探索で `lo + step` が Infinity にオーバーフローすると、`Number.MAX_VALUE` を評価せず Infinity を返す。再現: `firstTrue(x => x >= 1.6e308, 1e308, Infinity)`。期待: `1.6e308`（有限かつ述語成立する最小の表現可能整数値）。実測: `Infinity`。Node.jsでソース関数を同一転記して実行、評価回数1024。原因: stepが 8.98846567431158e307 の時点で `lo+step` が Infinity となり、その後の二分探索も Infinity で停止。`discreteQuantile()` には同様の overflow 時 `Number.MAX_VALUE` を試すガードがあるが、`firstTrue()` にはない。修正案: step/j のオーバーフロー時に `Number.MAX_VALUE` を上限候補として評価し、述語成立なら有限区間を二分探索する。 |
| `src/internal/dpq.ts` | 問題未検出 | #105 | `c9000fd10b357980c675d98bc3a851446fff48ba` | — | Rと同じ（Rの `lower.tail` / `log.p` / `log` の端点・尾部変換仕様に対応。今回R実行なし） | `dt0`/`dt1` の lowerTail×logP 4組、`d0` の log/非log、`quantileBoundaries` の線形p/logP両形式の端点・範囲外値、`smallerTail` の0.5境界・上側変換・極小確率をソース追跡。具体値: p={0,1,0.25,0.5,0.75,1e-300}; logP値={0,-Infinity,-0.25,-1,-1000,1}; lowerTail={true,false}; 期待値は確率の補数・対数恒等式から導出。CHANGELOG Unreleased と 0.15.3 の数値安定性修正を確認。実行/Vitest/package runtime/R実行なし。 |
| `src/internal/extremes.ts` | 未監査 | — | `—` | — | — | — |
| `src/internal/fround.ts` | 未監査 | — | `—` | — | — | — |
| `src/internal/integer.ts` | 未監査 | — | `—` | — | — | — |
| `src/internal/invert.ts` | 未監査 | — | `—` | — | — | — |
| `src/internal/levels.ts` | 未監査 | — | `—` | — | — | — |
| `src/internal/noncentral.ts` | 未監査 | — | `—` | — | — | — |
| `src/internal/poissonMixture.ts` | 未監査 | — | `—` | — | — | — |
| `src/internal/scaledInverse.ts` | 未監査 | — | `—` | — | — | — |
| `src/internal/seq.ts` | 未監査 | — | `—` | — | — | — |
| `src/internal/summary.ts` | 未監査 | — | `—` | — | — | — |
| `src/internal/uniroot.ts` | 未監査 | — | `—` | — | — | — |
| `src/internal/vectorize.ts` | 未監査 | — | `—` | — | — | — |
| `src/linalg/balance.ts` | 未監査 | — | `—` | — | — | — |
| `src/linalg/basic.ts` | 未監査 | — | `—` | — | — | — |
| `src/linalg/chol.ts` | 未監査 | — | `—` | — | — | — |
| `src/linalg/eigen.ts` | 問題未検出 | #108 | `f71ec0729230db3d5e20c5ab746325ec77345a9a` | — | Rと同じ（Rの `eigen()` 契約、既存のR由来fixture・比較基準を確認。今回R実行なし） | 対称行列の自動判定（相対差・絶対差フォールバック）、下三角採用、Householder三重対角化、implicit QL、固有値降順・固有ベクトル列の対応、非対称行列のbalancing/Hessenberg/Francis double-shift QR、複素共役ペアの並び・位相正規化、onlyValues、NaN/Inf拒否、2の冪スケーリングと逆スケーリングを追跡。固定例: `[[2,1],[1,2]]`（固有値 `[3,1]`）、`[[0,-1],[1,0]]`（固有値 `±i`）、`[[1e308,1e308],[1e308,-1e308]]`（中間演算のスケーリング）、`[[1e-60,2e-60],[3e-60,4e-60]]`（R `isSymmetric` の絶対差フォールバック）。既存 `test/eigen.test.ts` の対称/非対称fixture比較、固有値・固有ベクトル許容差と列整列のテスト構造を閲覧。fixture/Vitest/package runtime/R実行なし。 |
| `src/linalg/expm.ts` | 未監査 | — | `—` | — | — | — |
| `src/linalg/kappa.ts` | 未監査 | — | `—` | — | — | — |
| `src/linalg/lu.ts` | 未監査 | — | `—` | — | — | — |
| `src/linalg/matrix.ts` | 未監査 | — | `—` | — | — | — |
| `src/linalg/norm.ts` | 未監査 | — | `—` | — | — | — |
| `src/linalg/ops.ts` | 未監査 | — | `—` | — | — | — |
| `src/linalg/qr.ts` | 未監査 | — | `—` | — | — | — |
| `src/linalg/schur.ts` | 未監査 | — | `—` | — | — | — |
| `src/linalg/solve.ts` | 問題未検出 | #109 | `6b9fabe470c0a994e48cd612bcd3e30aaa580aa1` | — | Rでは未確認（R実行・新規照合なし） | LU partial pivoting、exact singular判定、`gecon()` の1-norm reciprocal condition estimate、既定tol=`Number.EPSILON`、極端な大きさのpower-of-two scaling、NaN/Inf時のcondition check skipを追跡。`pseudoQuadratic()` との判定基準不整合を確認するための関連監査。`solve()` 単体の不具合は今回確定せず。Vitest/package runtime/R実行なし。 |
| `src/linalg/svd.ts` | 未監査 | — | `—` | — | — | — |
| `src/models/anovaSequential.ts` | 未監査 | — | `—` | — | — | — |
| `src/models/aovEz.ts` | 未監査 | — | `—` | — | — | — |
| `src/models/aovStrata.ts` | 未監査 | — | `—` | — | — | — |
| `src/models/carAnova.ts` | 未監査 | — | `—` | — | — | — |
| `src/models/coxph.ts` | 問題未検出 | #107 | `206adeeae033f983cc1e2c17b3ba568bd40f3667` | — | Rと同じ（`survival` 3.8系の `coxph` の仕様記述・R由来fixtureを照合。今回R実行なし） | `coxph()` の欠損除外、status/weight/strata、重み付き中心化・スケーリング、Efron/Breslow ties、層別リスク集合、Newton-Raphsonのstep halving・収束判定、一般化Cholesky・共線性、係数/SE/CI/Wald/LR/score統計をソース追跡。具体例: `time=[5,3,8,1,9,4]`, `status=[1,1,0,1,0,1]`, `x=[[1.2],[0.3],[-0.5],[2],[0.7],[0.1]]`; tiesは`efron`/`breslow`、weightsは正整数のみ。`test/coxph.test.ts` と `oracle/coxph-behaviour.md`、R生成スクリプトの重いties・weights・strata・aliased列・単一event・monotone likelihoodケースを閲覧。実行/Vitest/package runtime/R実行なし。 |
| `src/models/ddLeastSquares.ts` | 未監査 | — | `—` | — | — | — |
| `src/models/ddMatrix.ts` | 未監査 | — | `—` | — | — | — |
| `src/models/estimable.ts` | 未監査 | — | `—` | — | — | — |
| `src/models/formula.ts` | 未監査 | — | `—` | — | — | — |
| `src/models/glm.ts` | 未監査 | — | `—` | — | — | — |
| `src/models/glmAnova.ts` | 未監査 | — | `—` | — | — | — |
| `src/models/glmConfint.ts` | 未監査 | — | `—` | — | — | — |
| `src/models/glmFamily.ts` | 未監査 | — | `—` | — | — | — |
| `src/models/lm.ts` | 未監査 | — | `—` | — | — | — |
| `src/models/lmer.ts` | 未監査 | — | `—` | — | — | — |
| `src/models/lmerAnova.ts` | 未監査 | — | `—` | — | — | — |
| `src/models/lmerHypotheses.ts` | 未監査 | — | `—` | — | — | — |
| `src/models/lmerTest.ts` | 未監査 | — | `—` | — | — | — |
| `src/models/mauchly.ts` | 未監査 | — | `—` | — | — | — |
| `src/models/mixedDerivatives.ts` | 未監査 | — | `—` | — | — | — |
| `src/models/mixedDeviance.ts` | 未監査 | — | `—` | — | — | — |
| `src/models/mixedStructure.ts` | 未監査 | — | `—` | — | — | — |
| `src/models/modelFrame.ts` | 未監査 | — | `—` | — | — | — |
| `src/models/modelMatrix.ts` | 未監査 | — | `—` | — | — | — |
| `src/models/scaledTables.ts` | 未監査 | — | `—` | — | — | — |
| `src/models/survival.ts` | 問題あり | #109 | `6b9fabe470c0a994e48cd612bcd3e30aaa580aa1` | [#28](https://github.com/numero-uno-jpn/rStats.js/issues/28) | Rでは未確認（R実行なし。既存fixture/testを閲覧） | `pseudoQuadratic()` の固有値採用基準 `lambda > 1e-10 * max(lambda)` が `solve()` の既定特異判定 `rcond < Number.EPSILON` より著しく粗く、fallbackで正の固有方向を過剰に捨てうることを確認。固定再現: `V=[[1,0,0],[0,1e-12,0],[0,0,1e-17]]`, `u=[0,1e-6,1e-8]`。閾値1e-10では `chisq=0, df=1`、数値的に解像可能な固有値1と1e-12を残す一般化逆行列なら `chisq=1, df=2`。ただし、このスペクトルを実際に生成する `survdiff(time,status,group)` データは未構成。ソース/数式の検討と対角行列の算術確認のみ。Vitest/package runtime/R実行なし。 |
| `src/models/tiedTimes.ts` | 問題未検出 | #107 | `206adeeae033f983cc1e2c17b3ba568bd40f3667` | — | Rと同じ（R `survival::aeqSurv()` の既定規則と一致。今回R実行なし） | `mergeTiedTimes()` の有限時刻抽出、distinct sort、`sqrt(2^-52)` の絶対差または平均絶対時刻で規格化した相対差によるtie判定、最小cut pointへの写像、Infinity保持を確認。入力例: `[1,1+1e-9,1+1e-7]`。最初のgapは絶対許容差以下でmerge、次のgapは許容差を超えて別時刻を維持する。絶対差基準は小さい時刻での過剰mergeに見えるが、R `aeqSurv.R` の `dy <= tolerance || dy/mean(abs(y)) <= tolerance` と一致するため仕様上の不具合ではない。R公式説明・ソースおよび oracle の記述を照合。実行/Vitest/package runtime/R実行なし。 |
| `src/numerics/deriv.ts` | 未監査 | — | `—` | — | — | — |
| `src/numerics/integrate.ts` | 未監査 | — | `—` | — | — | — |
| `src/numerics/interp.ts` | 未監査 | — | `—` | — | — | — |
| `src/numerics/ode.ts` | 未監査 | — | `—` | — | — | — |
| `src/optim/lbfgsb.ts` | 未監査 | — | `—` | — | — | — |
| `src/optim/localmin.ts` | 未監査 | — | `—` | — | — | — |
| `src/optim/optim.ts` | 未監査 | — | `—` | — | — | — |
| `src/random/as241.ts` | 未監査 | — | `—` | — | — | — |
| `src/random/beta.ts` | 未監査 | — | `—` | — | — | — |
| `src/random/binomial.ts` | 未監査 | — | `—` | — | — | — |
| `src/random/common.ts` | 未監査 | — | `—` | — | — | — |
| `src/random/continuous.ts` | 未監査 | — | `—` | — | — | — |
| `src/random/extra.ts` | 未監査 | — | `—` | — | — | — |
| `src/random/gamma.ts` | 未監査 | — | `—` | — | — | — |
| `src/random/hyper.ts` | 未監査 | — | `—` | — | — | — |
| `src/random/lecuyer.ts` | 未監査 | — | `—` | — | — | — |
| `src/random/mt.ts` | 未監査 | — | `—` | — | — | — |
| `src/random/poisson.ts` | 未監査 | — | `—` | — | — | — |
| `src/random/r2dtable.ts` | 未監査 | — | `—` | — | — | — |
| `src/random/rank.ts` | 未監査 | — | `—` | — | — | — |
| `src/random/rng.ts` | 未監査 | — | `—` | — | — | — |
| `src/random/sample.ts` | 未監査 | — | `—` | — | — | — |
| `src/random/streams.ts` | 未監査 | — | `—` | — | — | — |
| `src/special/besselIK.ts` | 未監査 | — | `—` | — | — | — |
| `src/special/besselJY.ts` | 未監査 | — | `—` | — | — | — |
| `src/special/besselSeries.ts` | 未監査 | — | `—` | — | — | — |
| `src/special/beta.ts` | 未監査 | — | `—` | — | — | — |
| `src/special/choose.ts` | 未監査 | — | `—` | — | — | — |
| `src/special/constants.ts` | 未監査 | — | `—` | — | — | — |
| `src/special/dd.ts` | 未監査 | — | `—` | — | — | — |
| `src/special/erf.ts` | 未監査 | — | `—` | — | — | — |
| `src/special/extra.ts` | 未監査 | — | `—` | — | — | — |
| `src/special/gamma.ts` | 未監査 | — | `—` | — | — | — |
| `src/special/igam.ts` | 未監査 | — | `—` | — | — | — |
| `src/special/igamAsympCoeff.ts` | 未監査 | — | `—` | — | — | — |
| `src/special/igami.ts` | 未監査 | — | `—` | — | — | — |
| `src/special/incbet.ts` | 未監査 | — | `—` | — | — | — |
| `src/special/incbetLargeA.ts` | 未監査 | — | `—` | — | — | — |
| `src/special/incbetPrefactor.ts` | 未監査 | — | `—` | — | — | — |
| `src/special/incbetTemme.ts` | 未監査 | — | `—` | — | — | — |
| `src/special/lgammaDiff.ts` | 未監査 | — | `—` | — | — | — |
| `src/special/loader.ts` | 問題あり | #96 | `ac5d64a614debaa2922754bd257f2b8286619518` | [#24](https://github.com/numero-uno-jpn/rStats.js/issues/24) | Rでは未確認 | 中央二項確率の解析式と Stirling 漸近、IEEE-754 中間積の独立計算。実パッケージ実行・R比較なし。 |
| `src/special/log1p.ts` | 未監査 | — | `—` | — | — | — |
| `src/special/log1pmx.ts` | 未監査 | — | `—` | — | — | — |
| `src/special/ndtri.ts` | 未監査 | — | `—` | — | — | — |
| `src/special/polevl.ts` | 未監査 | — | `—` | — | — | — |
| `src/special/psigamma.ts` | 未監査 | — | `—` | — | — | — |
| `src/special/rCompatible.ts` | 未監査 | — | `—` | — | — | — |

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

## Audit #97

- Target: `src/distributions/triangular.ts`
- Repository HEAD: `6077b7d90cf06effb6e9ba4d08e6414b64c790a2`
- File blob SHA: `1cfca6585cf8bad66c282af3b6973fbb8086f288`
- Result: `問題未検出` (source and existing test/fixture review; not a proof of absence).
- Scope: density/CDF/quantile; endpoint modes `c=a` and `c=b`; interval-width overflow and subnormal width; tail/log-probability branches; inverse-transform branches around the mode.
- Reproduction/test inputs inspected: `wide={a:-1e308,b:1e308,c:0}`; `narrow={a:0,b:2.362486118430361e-229,c:2.362486118430361e-229}`; `qtriang(2.5e-182,{a:0,b:141,c:0})`; and fixed `near1={a:51.80896011403241,b:54.36503630721428,c:52.30157068741966}` with `q=54.365036307212875`.
- Expected-value basis: triangular closed forms; the existing test explicitly checks scale invariance, endpoint-mode inverse CDF, finite probabilities and density scaling. `ptriang`/`qtriang` fixtures generated from R 4.5.2 / extraDistr, density fixtures additionally include mpmath. Fixture contents were reviewed, not executed.
- R relationship: `Rと同じ` for ordinary fixture cases by fixture provenance; no fresh R execution in this audit.
- Verification limits: source-level formula/path inspection and existing test/fixture review only. No isolated runtime harness, full Vitest run, or fresh R comparison.

## Audit #98

- Target: `src/distributions/cauchy.ts`, `dcauchy1()`.
- Repository HEAD: `6a3eedcc2d465be8e7bbb614884e1a95ea22180d`
- File blob SHA: `6cb203fa576c3a71798c554feef638f69f08a2c5`
- Result: confirmed defect; `|z| > 1` non-log density branch overflows `Math.PI * scale` for large finite scales, returning 0 when the true density is representable.
- Exact reproduction: `dcauchy(1.1e308, { location: 0, scale: 1e308 })`; `z ≈ 1.1`.
- Expected: approximately `1.44031622707598e-309`, from `((1 / Math.PI) / scale) / (1 + z*z)` and the closed-form Cauchy density.
- Actual: `0`, because `Math.PI * 1e308` is `Infinity` in the current non-log branch. The log branch gives `-711.1339310435451`; exponentiating gives approximately `1.440316227076037e-309`.
- R relationship: `Rでは未確認` (no fresh R runtime comparison).
- Verification: exact source expression evaluated in an isolated JavaScript arithmetic harness; existing Cauchy fixture reviewed and found not to include this large-scale case. Full package/Vitest execution not performed.
- Issue: [#25](https://github.com/numero-uno-jpn/rStats.js/issues/25) (`bug`, `area:distributions`, `priority:medium`).


## Audit #99

- Target: `src/distributions/beta.ts` (`dbeta1`, `pbeta1`, `qbeta1`, `dbetaCore`, `solveLeftHalf`, `stepQuantile`).
- Repository HEAD: `9cb145a85e8153ea0712e2fd38b65885e5a016e5`
- File blob SHA: `959f9a68947eae3813d0fa8ed001f39380677e76`
- Result: `問題未検出`; source inspection did not establish a reproducible defect.
- Scope: support endpoints and point masses (`shape = 0` / `Infinity`), `shape = 1` density, NaN/negative parameters, lower/upper and log-probability paths, tiny/subnormal x and 1-x, huge/tiny shapes, overflow-safe shape sums, concentrated distributions and quantile left/right-frame inversion.
- Exact fixed cases reviewed from the changelog and tests include `pbeta(1.5e-236, 9220.5, 2.6e301)`, `pbeta(0.998, 55.1, 6.3e307)`, `pbeta(1.5e-323, 1.4e304, 0.5)`, `qbeta(3.8e-277, 27.9, 1.5e299)`, and `qbeta(8.7e-285, 1.3e304, 5.9)`.
- Expected-value basis: beta density/CDF/quantile identities and documented comparison values in `CHANGELOG.md`; `test/beta.test.ts` uses R-generated fixtures and a backward-CDF check for quantiles. Fixture contents and branch logic were inspected, not executed.
- R relationship: `Rと同じ` for ordinary fixture cases by fixture provenance / changelog comparisons; no fresh R execution in this round.
- Verification limits: source-level control-flow and arithmetic review plus test/changelog inspection only. No runtime harness, fixture execution, full Vitest run, or fresh R comparison; therefore not `問題なし確認済`.


## Audit #100

- Target: `src/distributions/chisq.ts` (central `dchisq`, `pchisq`, `qchisq` wrappers).
- Repository HEAD: `94e98787221087403c05cdb46f69f55c0760823b`
- File blob SHA: `f9463e9674d80dc480143cc56976763288cf6559`
- Result: confirmed invalid-parameter validation bug; all three wrappers halve `df` before the gamma implementation validates the shape.
- Exact reproduction: `const df = -Number.MIN_VALUE;` (`df === -5e-324`, `df < 0` is true); `df / 2` is `-0` and `Object.is(df / 2, -0)` is true. Downstream gamma shape checks use `shape < 0` and `shape === 0`, so `-0` is treated as shape zero. Predicted central paths: `dchisq(0, df)` → `Infinity`, `dchisq(1, df)` → `0`, `pchisq(1, df)` → `1`, `qchisq(0.5, df)` → `0`, instead of NaN for invalid negative df.
- Expected-value basis: negative degrees of freedom are invalid in R's chi-square distribution contract; the local gamma/chi-square fixture code also explicitly treats negative shape/df as invalid before quantile endpoint handling. No fresh R execution.
- Root cause is wrapper validation order; one Issue covers all three functions.
- R relationship: `Rと同じ` for the negative-df invalidity contract; no runtime R comparison in this round.
- Verification limits: exact IEEE-754 underflow-to-signed-zero semantics plus source-level branch tracing. No package runtime, Vitest, or R execution.
- Issue: [#26](https://github.com/numero-uno-jpn/rStats.js/issues/26) (`bug`, `area:distributions`, `priority:medium`).


## Audit #101

- Repository HEAD SHA: `8e360c3fb4481da28f2e8eba5fb8d9918af3263f`
- Source: `src/distributions/binomial.ts` (blob `2f90ac1e001443b0704f33e76585cb2868497724`)
- Result: `問題未検出`. No reproducible defect was established in the inspected source paths.
- Scope: `dbinom1`, `pbinom1`, `pbinomRaw`, `qbinom1`, and `roundHalfEven`; invalid and infinite parameters, support endpoints, degenerate probabilities, non-integer q rounding, the >2^53 correction, lower/upper tails, log probabilities, and discrete quantile search.
- Evidence: inspected the existing mpmath 1.4.1 `test/fixtures/audit_pbinom.mpmath.json` cases and the `qbinom` fixture. The `floor(q + 1e-7)` operation was reviewed as the discrete-CDF rounding convention, not treated as a defect.
- R relationship: `Rでは未確認`; no fresh R execution or source comparison was performed.
- Verification limits: source and fixture inspection only; fixtures, Vitest, and the package runtime were not executed. No issue was created.


## Audit #102

- Repository HEAD SHA: `1aaef113968bfa70a39ed2c501e3b65238763409`
- Source: `src/distributions/exponential.ts` (blob `5370e52ae3428099245fb643c7721cbb7a748b3c`)
- Result: `問題あり`; GitHub Issue [#27](https://github.com/numero-uno-jpn/rStats.js/issues/27).
- Reproduction: `pexp(1e-20, { rate: 1e-300, logP: true })` returns `-736.8272408909739`; mathematical reference is `ln(1e-320) = -736.8272297580946188857572654989965...`.
- Root cause: `pexp1` forms `t = mulDD(rate, q)`; the product is subnormal, so `twoProd` cannot retain its residual. `logOneMinusExpNeg` then logs the rounded product, magnifying its relative rounding error. The existing `test/helpers/distributionKnown.ts` explicitly records this discrepancy as retained for R compatibility.
- Expected-value basis: exponential CDF `log(1-exp(-rate*q))`; at `rate*q = 1e-320`, this is indistinguishable from `log(1e-320)` at the shown precision. Independent high-precision Decimal calculation.
- R relationship: `Rも誤り`; the R-derived fixture/known-violation records the same inaccurate value. No fresh R execution.
- Verification limits: source and fixture/known-violation inspection plus independent high-precision calculation; no package runtime or Vitest execution.


## Audit #103

- Repository HEAD SHA: `fe88f1b31ddb3a69cef524aeb9aa5dd08509e0a8`
- Source: `src/distributions/geometric.ts` (blob `dfde963375d347292c88306f151aaa3a8a66612b`).
- Result: `問題未検出`; no reproducible defect was established in the inspected paths. No Issue created.
- Scope: `dgeom1`, `pgeom1`, `qgeom1`, `probPair`, and `qPow`; invalid/NaN/infinite probabilities, support endpoints and non-integer observations, the `floor(q + 1e-7)` convention, lower/upper and log-probability paths, discrete quantile boundaries and rounding slack, subnormal probabilities, and the (n \ge 10^{290}) scaled-log branch. The (x=0) special path through `dbinomRawDD` was also inspected, including its distinction from the interior binomial denominator path implicated in Issue #24.
- Exact high-range cases reviewed from the changelog: `pgeom(1e290, 5e-324)` (now `4.940656458412465e-34`) and `pgeom(8.7e299, 1.1e-300)` (now approximately `0.616`). Existing R 4.5.2 fixtures were reviewed: `dgeom.json` (1,472 cases), `pgeom.json` (2,944 cases), and `qgeom.json` (1,696 cases). The fixtures were inspected, not executed.
- Expected-value basis: geometric distribution identities (P(X=x)=p(1-p)^x), (P(X>q)=(1-p)^{\lfloor q\rfloor+1}), and the smallest-integer quantile (\lceil \log(u)/\log(1-p)\rceil-1), together with the repository's R-generated fixtures and documented high-range regression cases.
- R relationship: `Rと同じ` for ordinary cases by fixture provenance and changelog comparisons; no fresh R execution in this round.
- Verification limits: source-level branch/arithmetic review and fixture/changelog inspection only. No isolated runtime harness, fixture execution, full Vitest run, or fresh R comparison; therefore status remains `問題未検出`, not `問題なし確認済`.


## Audit #104

- Repository HEAD SHA: `1dfe5fed11b61ba734bbf1b6b99df58c2ede61bb`
- Source: `src/distributions/poisson.ts` (blob `8bac99d8cfb238c1d682278c145798d0c44abc0b`). Related shared paths inspected: `src/special/igam.ts` and `src/internal/discrete.ts`.
- Result: `問題未検出`; no reproducible defect established in the inspected Poisson paths. No Issue created.
- Scope: `dpois1`, `ppois1`, `qpois1`; lambda=0 and Infinity, NaN/Infinity arguments, support endpoints, non-integer q rounding, lower/upper tails and log probabilities, the (x+1) correction beyond (2^{53}), gamma incomplete-function branch selection, subnormal tail reconstruction, and discrete quantile boundary/search behavior.
- Exact regression examples reviewed from source/CHANGELOG: `ppois(1e16, 1e16)` (the old (x+1) rounding path was below 1/2; corrected via (Q(x,\lambda)+dpois(x,\lambda))); the large-λ tail case `ppois(3.28e19 + 1e11, 3.28e19)`; and the historical nontermination of `qpois` for λ around (10^{20}). The changelog records the tail accuracy improvement to about (2.7\times10^{-15}) relative for λ above (10^6), 5–40 standard deviations below the mean.
- Existing fixtures inspected: R-derived `dpois.json` (1,448), `ppois.json` (2,896), `qpois.json` (1,696); independent mpmath `audit_ppois.mpmath.json` (1,474) and `auditq_qpois.mpmath.json` (250). These were inspected, not executed.
- Expected-value basis: Poisson PMF (e^{-\lambda}\lambda^x/x!\), CDF via (Q(\lfloor q\rfloor+1,\lambda)\), the (2^{53})-safe identity (P(X\le x)=Q(x,\lambda)+P(X=x)\), and the discrete quantile definition as the smallest integer whose CDF reaches the requested probability. Existing R and independent mpmath fixtures plus documented regression cases were used as corroboration.
- R relationship: `Rと同じ` for ordinary behavior based on R 4.5.2 fixture provenance; mpmath fixtures independently support selected tail values. No fresh R execution this round.
- Verification limits: source/branch/arithmetic review and fixture/CHANGELOG inspection only. No isolated runtime harness, fixture execution, full Vitest run, or fresh R comparison; status remains `問題未検出`, not `問題なし確認済`.


## Audit #105

- Repository HEAD: `c9000fd10b357980c675d98bc3a851446fff48ba`
- `src/internal/dpq.ts` blob SHA: `543eb6ceb3de7627a7562b035a931a88da424aa7`
- Result: ソース確認範囲では問題未検出。`dt0`/`dt1` の4通りは確率0/1の lower/upper-tail・log/non-log 表現と一致。`d0` は密度0の通常値0・log値−Infinity。`quantileBoundaries` は線形確率の0/1端点、範囲外値、およびlog確率の0/−Infinity端点を lowerTail に応じて左右端へ写像する。`smallerTail` は p ≤ 1/2 では指定尾部を維持し、p > 1/2 では `1-p` または `-expm1(logP)` に切り替えるため、補数の桁落ちを避ける設計。
- Reproduction inputs (literal values): linear `p = [0, 1, 0.25, 0.5, 0.75, 1e-300]`; log `p = [0, -Infinity, -0.25, -1, -1000, 1]`; `lowerTail = [true, false]`; `logP = [true, false]`; `log = [true, false]`. `smallerTail` の期待値は `p=0.75` で補数 `0.25`、`p=0.25` で元の下側確率 `0.25`、log確率 `-0.25` の上側変換で `log(1-exp(-0.25))`。
- R relationship: `Rと同じ`（Rの `lower.tail` / `log.p` / `log` の端点・尾部変換仕様に対応。今回R実行なし）。
- Scope/limitations: `src/internal/dpq.ts` の関数本体と契約コメントを確認。CHANGELOG Unreleased と 0.15.3 の数値安定性修正を確認。独立実行ハーネス、Vitest、package runtime、R実行なし。したがって状態は `問題未検出` とし、`問題なし確認済` とはしない。


## Audit #106

- Repository HEAD: `bd1abcb7e80997ab9bf1a965a30b93a86ac24c24`
- `src/internal/discrete.ts` blob SHA: `a8ed86222a9c91b7dfea90b990244a81c1170194`
- Result: `firstTrue()` に境界値バグを1件発見。指数探索中に `lo + step` が `Infinity` へオーバーフローした場合、`Number.MAX_VALUE` を確認せず、二分探索も `Infinity` で停止する。
- Reproduction (literal): `firstTrue(x => x >= 1.6e308, 1e308, Infinity)`.
- Expected: `1.6e308`（この入力に対する最小の表現可能な整数値であり、述語を満たす）。Actual: `Infinity`。
- Execution: Node.jsで `src/internal/discrete.ts` の `firstTrue()` 本体を同一転記して実行。結果 `Infinity`、述語評価回数1024、最後に有限だった指数ステップ `8.98846567431158e307`。次の `lo + step` は `Infinity` となり、有限のしきい値を飛び越す。
- Cross-check: 同じファイルの `discreteQuantile()` は `good === Infinity && hi === Infinity` の場合に `Number.MAX_VALUE` を評価する特別処理を持つが、`firstTrue()` には同等の処理がない。
- Proposed fix: 指数ステップまたは候補点が `Infinity` に達した場合、`Number.MAX_VALUE` を評価点として試す。述語が成立すれば `[fails, Number.MAX_VALUE]` を二分探索し、成立しなければ `hi`（Infinity）を返す。実際の整数サポートの上限・契約も併せて確認する。
- R relationship: `Rでは未確認`。内部探索関数単体の境界不具合であり、R実行なし。
- Scope/limitations: `discreteQuantile()` / `firstTrue()` / `lastTrue()` のソースレビュー。`firstTrue()` の再現はNode.jsで実施。Vitest全体、呼び出し元統合、R比較は未実施。


## Audit #107

- Repository HEAD: `206adeeae033f983cc1e2c17b3ba568bd40f3667`
- Targets:
  - `src/models/coxph.ts` blob `2e3bc2355f92336b7433ae8c4e812c6d0441faba`
  - `src/models/survival.ts` blob `03183bdcb6437634a6ddfae1e1f3d98ff2cbc4de`
  - `src/models/tiedTimes.ts` blob `229af071501c8dbc7bdcc0c03d503346ed227713`
- Result: inspected paths did not establish a confirmed defect; all three files are `問題未検出`, not `問題なし確認済`.
- `tiedTimes`: the apparent absolute-tolerance concern was checked against R `survival::aeqSurv()`. R's published implementation uses exactly `dy <= tolerance || dy / mean(abs(y)) <= tolerance`, with `tolerance = sqrt(.Machine$double.eps)`; the absolute-gap behavior is intentional and the implementation follows it. Exact input considered: `[1, 1 + 1e-9, 1 + 1e-7]`; the first gap is merged by the absolute criterion and the second remains distinct.
- `survfit`: traced same-time event/censor handling (all subjects remain at risk at the event time), risk-set decrement after the time group, Kaplan–Meier product, Greenwood accumulation, log/plain/log-log intervals, and median/median-limit rule. Literal example reviewed: `time=[1,2,2,3,4]`, `status=[1,1,0,1,0]`.
- `survdiff`: traced pooled KM weight immediately before each event time, observed/expected counts, squared weights in the variance, positive-expected group selection, and singular-submatrix fallback. Literal example reviewed: `time=[1,2,3,4,5,6]`, `status=[1,1,0,1,1,1]`, `group=["a","b","a","b","a","b"]`, with `rho=0`, and the fixture's `rho=1` and `rho=0.5` cases.
- `coxph`: traced row filtering, status and weight validation, weighted centring/scaling, Efron/Breslow tie contributions, stratum-specific risk sets, Newton–Raphson step halving and convergence, generalized Cholesky handling of aliased columns, coefficient/variance and summary statistics. Literal example reviewed: `time=[5,3,8,1,9,4]`, `status=[1,1,0,1,0,1]`, `x=[[1.2],[0.3],[-0.5],[2],[0.7],[0.1]]`.
- Expected-value basis: repository `oracle/coxph-behaviour.md` and `oracle/survival-behaviour.md`, the R-generated `coxph` and `survival` fixtures, analytic Cox partial-likelihood/Kaplan–Meier/Greenwood/log-rank formulas, and R `survival::aeqSurv()` documentation/source. The fixture files and tests were inspected, not executed.
- R relationship: `Rと同じ` for the inspected contract and fixture provenance; no fresh R execution.
- Verification limits: source-level path/formula review and existing test/oracle/fixture inspection only. No isolated runtime harness, fixture execution, full Vitest run, or R comparison. No Issue created.


## Audit #108

- Repository HEAD: `f71ec0729230db3d5e20c5ab746325ec77345a9a`
- Source: `src/linalg/eigen.ts` blob `86ee78a9fd9f3edbbc35e86f3805ea910e15ff18`.
- Related source inspected: `src/linalg/balance.ts` blob `b0796b3365f4f23a7a02efdb05628380f85cf284`; `src/internal/summary.ts` (`ldexp` power-of-two scaling).
- Result: `問題未検出`; no confirmed defect established in the inspected eigenvalue/eigenvector paths.
- Scope: symmetric detection and lower-triangle semantics; Householder tridiagonalisation and implicit QL; descending eigenvalue sort with corresponding vector permutation; nonsymmetric balancing, Hessenberg reduction, Francis double-shift QR, real Schur back-substitution, complex conjugate ordering and phase normalisation; `onlyValues`; finite-input validation; power-of-two scaling and rescaling.
- Exact literal examples reviewed: `[[2,1],[1,2]]` (eigenvalues `[3,1]`); `[[0,-1],[1,0]]` (eigenvalues `0 + i` and `0 - i`); `[[1e308,1e308],[1e308,-1e308]]` (extreme-magnitude scaling); `[[1e-60,2e-60],[3e-60,4e-60]]` (automatic symmetry detection relative to R's `isSymmetric` absolute fallback).
- Downstream relevance: `survdiff()` uses `eigen(V, { symmetric: true })` for the singular-variance quadratic form fallback. The eigenvalue threshold and rank decision in `pseudoQuadratic()` remain a separate policy in `src/models/survival.ts`; this audit does not certify that threshold for every possible log-rank covariance matrix.
- Tests: inspected `test/eigen.test.ts`, including symmetric and general eigen suites, R-generated expected values, vector column alignment, eigenvalue-gap and eigenvector-condition tolerances. Tests and fixtures were not executed.
- R relationship: `Rと同じ` for documented result shape, ordering and comparison-contract review; no fresh R execution.
- Verification limits: source-level algorithm and branch review plus test-structure inspection only. No standalone numerical harness, fixture execution, full Vitest run, or R comparison. No Issue created.



## Audit #109

- Repository HEAD: `6b9fabe470c0a994e48cd612bcd3e30aaa580aa1`
- Sources:
  - `src/models/survival.ts` blob `03183bdcb6437634a6ddfae1e1f3d98ff2cbc4de`
  - `src/linalg/solve.ts` blob `6e423f1c2969b896c1715f5af95864c6f59dea24`
  - `src/linalg/eigen.ts` blob `86ee78a9fd9f3edbbc35e86f3805ea910e15ff18` (reused from #108)
- Result: `src/models/survival.ts` has a confirmed numerical-rank policy defect in `pseudoQuadratic()`; GitHub Issue [#28](https://github.com/numero-uno-jpn/rStats.js/issues/28). `src/linalg/solve.ts` was reviewed as a dependency and no independent defect was established (`問題未検出`).
- Root cause: `survdiff()` first calls `solve(Vr,u)`. With default `tol = Number.EPSILON`, `solve()` rejects matrices whose estimated reciprocal condition number is below about `2.22e-16`. The fallback `pseudoQuadratic()`, however, discards every eigenvalue not greater than `1e-10 * max(eigenvalues)`. This cutoff can throw away positive modes that remain resolvable at double precision, so the fallback's reported statistic and degrees of freedom can be too small.
- Exact deterministic helper-level input:
  ```ts
  const V = [[1, 0, 0], [0, 1e-12, 0], [0, 0, 1e-17]];
  const u = [0, 1e-6, 1e-8];
  ```
  Eigenvalues are `[1, 1e-12, 1e-17]`; reciprocal condition number is `1e-17`, below `Number.EPSILON`. The current `1e-10` cutoff retains only the first mode and gives `chisq=0, df=1`. Retaining the first two modes (and discarding only the 1e-17 mode, below machine precision relative to the maximum) gives `chisq=1, df=2`. Retaining all exact positive modes gives `chisq=11, df=3`.
- Important qualification: this is a deterministic reproduction of the fallback helper's numerical-rank policy, not yet an end-to-end `survdiff(time,status,group)` reproduction. A risk-set dataset producing this eigen-spectrum has not been constructed. The Issue explicitly records this limitation; an integrated regression case remains necessary.
- `solve.ts` review: partial-pivoting LU, exact zero-pivot detection, 1-norm reciprocal-condition estimate via `gecon/lacn2`, default `Number.EPSILON` tolerance, power-of-two scaling for extreme magnitudes, and behavior for nonfinite matrices. No independent solve defect established in this pass.
- Tests: inspected `test/survival.test.ts`, including the R fixture comparison harness and missing-data/median edge tests. The test file references fixture `survival`; neither it nor any solve/eigen test was executed. No package runtime or Vitest run.
- R relationship: `Rでは未確認`; no fresh R execution or integrated R comparison. Existing tests/oracle were inspected only.
- Verification limits: source-level control-flow review and exact arithmetic on a diagonal PSD matrix. No package runtime, Vitest, or R execution. Status for `survival.ts` is `問題あり` because the helper-level cutoff defect is deterministic; end-to-end reachability remains to be established.
