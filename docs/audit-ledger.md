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
| `src/distributions/gamma.ts` | 一部監査・問題未検出 | #120 | `e9ba1c35ef88e77e84a392562bb7f62378fcbf7f` | — | R 4.5.2 qgamma fixtureを閲覧（未実行） | #120でqgammaの初期値選択、tiny quantileの対数計算、Wilson–Hilferty/DiDonato–Morris分岐、invertContinuousとの接続を確認。3286件のqgamma fixtureを閲覧、未実行。 |
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
| `src/internal/dpq.ts` | 問題未検出 | #120 | `543eb6ceb3de7627a7562b035a931a88da424aa7` | — | Rと同じ（lower.tail/log.pの仕様） | #120でsmallerTailのp>1/2時の尾部反転、linearTarget保持、logP時のexpm1補数を再確認。qgamma 3286件のR 4.5.2 fixtureを閲覧、未実行。 |
| `src/internal/extremes.ts` | 未監査 | — | `—` | — | — | — |
| `src/internal/fround.ts` | 未監査 | — | `—` | — | — | — |
| `src/internal/integer.ts` | 未監査 | — | `—` | — | — | — |
| `src/internal/invert.ts` | 一部監査・問題未検出 | #120 | `54aeaa15ec93053e2dd5fd19fc640a9fbf243a76` | — | R 4.5.2 qgamma fixtureを閲覧（未実行） | 正値領域log変換、上下尾残差の符号、bracket付きNewton/Halley、収束・stuck判定、polish/bisectXをgamma quantile呼出し条件でソース追跡。実行・高精度比較なし。 |
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
| `src/models/survival.ts` | 条件付き問題あり（実データ未再現） | #109–110 | `6b9fabe470c0a994e48cd612bcd3e30aaa580aa1` | [#28](https://github.com/numero-uno-jpn/rStats.js/issues/28) | Rでは未確認（R実行なし） | #109で `pseudoQuadratic()` の固定固有値閾値 `1e-10 * max(lambda)` と `solve()` の既定tol=`Number.EPSILON` の不整合を指摘。#110で `survdiff()` のリスク集合構造を解析：正の期待イベント数を持つ各群は最初のイベント時点で必ずリスク集合に属する。最初のイベント数 d がリスク集合総数 N 未満なら、その時点の分散寄与 `w²*d*(N-d)/(N*(N-1)) * (diag(r)-r*r'/N)` は、使用群のうち1群を除いた部分行列上で正定値。最初の時点で d=N なら全リスク対象が同時イベントとなり、以後のイベントはなく、V=0かつO-E=0。従って通常の入力では `pseudoQuadratic()` が準特異行列の正の小固有値を切り捨てる経路は実証できず、実際のtime/status/group再現なし。Issue #28は補助関数の閾値方針上の懸念として保持し、survdiffの実害は未確定。Vitest/package runtime/R実行なし。 |
| `src/models/tiedTimes.ts` | 問題未検出 | #113 | `6222eb058ce9759e37c852a30a56582b57e18009` | — | Rと同じ（`survival::aeqSurv()` の tie判定・cut point写像と一致。今回R実行なし） | `mergeTiedTimes()` 全体、呼出元 `coxph.ts`/`survival.ts`、`summary.ts` の overflow-safe `mean()`、`test/survival.test.ts`・`test/coxph.test.ts`、`oracle/survival-behaviour.md` を確認。R `aeqSurv.R` の `dy <= tolerance || dy/mean(abs(y)) <= tolerance`、`cuts <- y[c(1,!tied)]`、`findInterval` による写像と実装のロジックは一致。固定例 `[0,1e-8,2e-8]` は隣接差が各 `1e-8` で閾値 `sqrt(2^-52)≈1.4901161193847656e-8` 以下のため全て最小値0へ統合され、両端差 `2e-8` が閾値を超えても連鎖統合される。これはRと同じ仕様。極端値 `[1e308,1.1e308]` はgap `1e307`、平均絶対値 `1.05e308`、相対差約0.095で統合されない。`[-Number.MAX_VALUE,Number.MAX_VALUE]` の差分overflowはInfinityとなり誤統合しない。subnormal・負値・±0・NaN/±Infinityの経路もソース確認。専用 `test/tiedTimes.test.ts` は存在せず、関連テストは閲覧のみ。実行/Vitest/package runtime/R実行なし。 |
| `src/numerics/deriv.ts` | 未監査 | — | `—` | — | — | — |
| `src/numerics/integrate.ts` | 未監査 | — | `—` | — | — | — |
| `src/numerics/interp.ts` | 未監査 | — | `—` | — | — | — |
| `src/numerics/ode.ts` | 未監査 | — | `—` | — | — | — |
| `src/optim/lbfgsb.ts` | 未監査 | — | `—` | — | — | — |
| `src/optim/localmin.ts` | 未監査 | — | `—` | — | — | — |
| `src/optim/optim.ts` | 未監査 | — | `—` | — | — | — |
| `src/random/as241.ts` | 一部監査・問題未検出 | #135 | `77d0da9eaa12609d445d0433e4d3ac0d84f50600` | — | AS241係数とnorm fixtureをソース照合（未実行） | Wichura AS241の中心域/裾域分岐、係数順序、Horner評価、符号反転を確認。RのnormRandが生成するp範囲との整合を確認。独立数値実験・Vitest未実行。
| `src/random/beta.ts` | 問題あり | #122 | `10357380b3019e5ea6089224e3a0d4152702e639` | [#30](https://github.com/numero-uno-jpn/rStats.js/issues/30) | RのCheng BB/BC法を参照。極端な片側巨大shapeでRとの一致より分布の正しさに問題 | `rbeta(5,1.1,1e308)` はオーバーフロー分岐で全値を平均約1.1e-308に固定。理論CV≈0.953。ソースと分布式による確認。Vitest・R・simulation未実行。 |
| `src/random/binomial.ts` | 問題あり | #124 | `92437f63fa655aa541de9ba9b6ae51c0bad0af5b` | — | Inversion/BTPE source review; tiny-p q^n cancellation defect confirmed by binary64 arithmetic | `n=2_000_000_000, p=1e-17`: q rounds to 1, qn=1, every inversion draw returns 0 although P(X≥1)≈2e-8. Issue #31. BTPE formula compared with current R source; fixtures R 4.5.2 inspected only. No Vitest/runtime/R execution. |
| `src/random/common.ts` | 一部監査・問題未検出 | #136 | `77d0da9eaa12609d445d0433e4d3ac0d84f50600` | — | random fixture群と呼出し側の契約をソース確認（未実行） | generateのn有限/非負・小数切捨て・0件時の乱数非消費、powIntの負指数/NaN/Infinity/二乗法を確認。powIntは32-bit bitwise shiftを使うため2^31以上の指数で安全でない可能性があるが、実呼出し箇所と到達可能性を確定できず不具合認定せず。Vitest未実行。
| `src/random/continuous.ts` | 既知差異あり・追加問題未検出 | #134 | `77d0da9eaa12609d445d0433e4d3ac0d84f50600` | — | R 4.5.2 rbasic/rother fixtureを閲覧（未実行） | runif/rnorm/rexp/rlnorm/rlogis/rcauchy/rweibullの変換式、無効値・0/Inf時の乱数消費、overflow幅の補間を確認。rlogis(scale<0)は実装NaNに対しR fixtureは符号反転値を返す既知差異。Vitest未実行。
| `src/random/extra.ts` | 一部監査・問題未検出 | #130 | `75095a2c450c18de77f8ceacc259b90bd246a288` | — | extraDistr R 4.5.2 fixture を閲覧（未実行） | inverse-gamma/gamma変換、Kumaraswamy・Pareto逆関数、三角分布の2様本順序統計量法、Laplace指数・符号、arcsine逆関数、無効引数時の乱数消費と極端な有限端点をソース確認。R 4.5.2 fixture 20ケースを閲覧。Vitest・package runtime・R実行なし。 |
| `src/random/gamma.ts` | 問題あり | #121 | `9a6b479fa51c0e16a8313c9c2518c75130c84004` | [#29](https://github.com/numero-uno-jpn/rStats.js/issues/29) | R本体 `src/nmath/rgamma.c` と不一致 | `rgamma(1,-1,{scale:0})` と `rgamma(1,0,{scale:-1})`。Rは両方0、現行はNaN。負値判定がゼロ判定より先。ソース照合で確定。Vitest・package runtime・今回のR実行なし。 |
| `src/random/hyper.ts` | 一部監査・問題未検出 | #126 | `df63732522e39556a07f79edbb5a287f7348fa87` | — | — | — |
| `src/random/lecuyer.ts` | 一部監査・問題未検出 | #132 | `ff8994e573a5d1731aaf1e26d633ee907cc1bdcf` | — | R 4.5.2 L'Ecuyer fixtureを閲覧（未実行） | MRG32k3aのseed expansion・2つのmodular recurrence・uniform mapping・signed/unsigned seed復元と範囲検証を確認。fixture内の複数seed・RNG state・後続uniformを閲覧。Vitest・package runtime・R実行なし。 |
| `src/random/mt.ts` | 一部監査・問題未検出 | #133 | `77d0da9eaa12609d445d0433e4d3ac0d84f50600` | — | R 4.5.2 rbasic fixtureを閲覧（未実行） | MT19937 twist/tempering、R set.seedの50回LCG初期化、32-bit unsigned演算、[0,1)から(0,1)へのfixup、626要素stateの復元と境界を確認。seed=1/42/-7/123456789のrunif/rnorm/rexp値を閲覧。Vitest未実行。
| `src/random/poisson.ts` | 一部監査・問題未検出 | #123 | `cf352aaf46ae22782a09d7c054fd3716a370d7a6` | — | R本体 `src/nmath/rpois.c` のAhrens–Dieter法と主要分岐・定数を照合 | λ=0, 0.1, 1, 5, 9.99, 10, 15, 50, 100, 1e4, 1e7, Inf, -1, NaN。32 fixture cases (R 4.5.2) inspected only. No new reproducible defect; source review only, no Vitest/runtime/R/simulation. Extreme λ beyond fixture and precision/overflow behavior not exhaustively validated. |
| `src/random/r2dtable.ts` | 一部監査・問題未検出 | #127 | `8ccc84fc49823aa54db9eb23da7d7b3df00033f0` | — | — | — |
| `src/random/rank.ts` | 一部監査・問題未検出 | #129 | `6f8c6930b3c84d99f07d6fe7c0bc0622569ae526` | — | R 4.5.2 rsignrank/rwilcox fixture を閲覧（未実行） | 符号付き順位和の独立Bernoulli符号化、順位和の部分Fisher–Yates抽出、half-even整数化、0/負値/NaN/Inf/上限、R RNG stream消費をソース照合。R 4.5.2 fixture 10ケースを閲覧。Vitest・package runtime・R実行なし。 |
| `src/random/rng.ts` | 既知差異あり・追加問題未検出 | #137 | `77d0da9eaa12609d445d0433e4d3ac0d84f50600` | — | R 4.5.2 rngRounding/rngLecuyer/rngStreams/rbasic fixtureと既存テストを閲覧（未実行） | RNGkind切替時のseed消費、sampleKind維持、state kind code、rbits/unifIndexの棄却抽出、normRandの2-uniform精度、expRand SA法を確認。既知差異：rbinom BTPEのstream差、rlogis負scale、Rの無効状態時の再seed動作。独立実行なし。
| `src/random/sample.ts` | 一部監査・問題未検出 | #128 | `b2a2a714b624fdd7f8e422e7a5210000a759d710` | — | — | — |
| `src/random/streams.ts` | 一部監査・問題未検出 | #131 | `b6d645d063aee7a2793eaec9e8e78fad80d2acd9` | — | R 4.5.2 parallel stream fixture・行列冪のテスト定義を閲覧（未実行） | L'Ecuyer-CMRGの2^76/2^127 jump行列、modular multiplication、signed seed layout、state validationを確認。BigIntで遷移行列を再計算する既存テストとR 4.5.2 fixtureを閲覧。Vitest・独立実行なし。 |
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
| `src/special/igam.ts` | 一部監査・問題未検出 | #119 | `b06dd71a2f60ebe59d92e8759b0b6af7aebc2620` | — | R 4.5.2由来pgamma fixtureを閲覧（未実行） | #119で下側級数、上側連分数/Lentz、Temme漸近、巨大x・極小shapeの特別経路をソース追跡。境界と分岐点の固定入力を整理。fixture/Vitest/独立数値計算は未実行。全域精度は未認証。 |
| `src/special/igamAsympCoeff.ts` | 未監査 | — | `—` | — | — | — |
| `src/special/igami.ts` | 一部監査・問題未検出 | #120 | `008fc2b262eaa649093211a40e9d7fdd83facdcf` | — | R 4.5.2 qgamma fixtureを閲覧（未実行） | DiDonato–Morris Eq. 21–36のshape<1/≥1分岐、p/q反転、近似初期値の補正、級数補助を確認。初期値を最終解と誤認せずNewton反復へ渡す構成。実行なし。 |
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



## Audit #110

- Repository HEAD: `550b7110092eb4be63f8076b9a1e8a831bbca22c`
- Source: `src/models/survival.ts` blob `03183bdcb6437634a6ddfae1e1f3d98ff2cbc4de`; related `src/linalg/solve.ts` and `src/linalg/eigen.ts` were considered from audits #108–109.
- Result: no integrated `survdiff(time,status,group)` reproduction of the #109 near-singular positive-eigenvalue cutoff issue was established. The concern remains a helper-level numerical-rank policy issue (Issue [#28](https://github.com/numero-uno-jpn/rStats.js/issues/28)); actual impact on ordinary `survdiff()` inputs is unconfirmed.
- Structural argument:
  1. Let `t1` be the earliest event time. Any group with positive expected event count has at least one subject who experiences an event at some time `tj >= t1`; that subject is therefore in the risk set at `t1`. Thus every group included in the contrast calculation has a positive risk count `r_g` at the first event time.
  2. If the first event count `d < N` (where `N` is the total risk set), its variance contribution has positive scalar `d*(N-d)/(N*(N-1))` because `rho` weight at the first event is `KM^rho = 1`. The matrix `diag(r)-r*r'/N` is positive definite on the reduced contrast coordinates after dropping one group, since all used groups have positive risk counts. Later event-time contributions are positive semidefinite, so the accumulated reduced covariance matrix is positive definite in exact arithmetic.
  3. If `d = N` at the first event time, all subjects still at risk fail at that time. No later event is possible; groups censored before that time have zero expected count and are excluded. For the included groups, `O=E`, `V=0`, and the pseudo-quadratic form has rank 0 and statistic 0. The eigenvalue cutoff does not alter this result.
- Exact fixed input already used in #107 and reviewed again: `time=[1,2,3,4,5,6]`, `status=[1,1,0,1,1,1]`, `group=["a","b","a","b","a","b"]`. No package execution was performed, so no numeric result is claimed for this round.
- Consequence: the near-singular spectrum in #109 (`V=diag(1,1e-12,1e-17)`) is a valid helper-level counterexample to the fixed cutoff, but has not been shown to be realizable by `survdiff()` risk-set accumulation. A finite dataset with an extreme condition number sufficient to trigger the `solve()` fallback was not found. The fallback appears to serve principally the all-fail-at-once zero-variance case for ordinary data.
- Verification limits: source/formula proof review only. No generated-data search, package runtime, Vitest, fixture execution, or fresh R execution. The result is not a claim that the complete survival implementation has no defects.

## Audit #111

- Repository HEAD: `4ae0b199fd45855b11011fdb2fb9260e7a7525d5`
- Source: `src/models/coxph.ts` blob `2e3bc2355f92336b7433ae8c4e812c6d0441faba`.
- Related material inspected: `test/coxph.test.ts`, `oracle/coxph-behaviour.md`, `oracle/coxph.R`.
- Result: `問題未検出`; this targeted pass did not establish a new reproducible defect.
- Scope: Efron/Breslow tied-event log-likelihood, score and information contributions; integer case weights; weighted centring/scaling; stratum-specific risk sets; generalized Cholesky rank handling and aliased columns; Newton-Raphson, step halving, non-convergence and infinite-coefficient warnings; output-scale restoration and Wald/likelihood-ratio/score summaries.
- Literal fixed inputs reviewed (not executed): tied-event example `time=[1,1,2,2,3,3]`, `status=[1,1,0,1,1,0]`, `x=[[0],[1],[2],[3],[4],[5]]`; integer weights `[2,1,1,3,1,2]`; strata `["a","b","a","b","a","b"]`; collinear matrix `[[1,2,3],[2,1,3],[3,1,4],[1,3,4],[2,3,5],[3,2,5]]` where column 3 is column 1 plus column 2.
- Expected-value basis: the repository's `oracle/coxph-behaviour.md` (describing survival 3.8-3 behavior), the R-generated `oracle/coxph.R` fixture generator, analytic partial-likelihood formulas, and the existing fixture comparison test. The oracle specifies the weighted Efron steps as `d` row-level substeps with `dw/d` and `D2/d`; the implementation follows that convention.
- Tests: inspected `test/coxph.test.ts` and the fixture generator. They were not executed. No package runtime, Vitest, isolated harness, or fresh R execution.
- Limitations: extreme-magnitude weight and covariate examples were reviewed algebraically only; no numeric runtime verification was performed. Status is `問題未検出`, not `問題なし確認済`.

## Audit #112

- Repository HEAD before ledger update: `879c6876c14b28baab9c51adced6a5c44dbf7e7b`
- Source: `src/models/coxph.ts` blob `2e3bc2355f92336b7433ae8c4e812c6d0441faba`; focused on `evaluate()` weighted Efron/Breslow tied-event accumulation.
- Related material: `oracle/coxph-behaviour.md`, `oracle/coxph.R`, `test/coxph.test.ts), and the official survival `coxph` documentation (case weights and Efron ties).
- Initial concern: the Efron step count is the number of tied event rows (`deaths`), not the sum of their integer case weights. This initially looked inconsistent with replication weights.
- Resolution: `問題未検出`. The official `survival::coxph` documentation explicitly notes that with Efron ties, fitting weighted data does not give exactly the same coefficients as physically replicating each row by its case weight; the weighted fit is a distinct weighted Efron approximation. The repository oracle's weighted formula also defines `d` as the number of event rows, `dw` as their total weight, then performs `d` substeps each weighted `dw/d`. The implementation uses exactly this convention: `steps = deaths`, `stepWeight = deathWeight / steps`, and adds `deathRisk / deaths` per Efron substep.
- Literal fixed example (formula inspection only, not executed): `time=[1,1,2]`, `status=[1,1,0]`, `x=[[0],[1],[2]]), `weights=[2,1,1]`, `beta=[0]`. At the tied event time, total risk weight is 4 and tied-death risk weight is 3. The weighted Efron calculation uses two substeps, each with event weight 1.5 and risk denominator increments of 1.5, not three replication substeps. This difference is expected under the documented weighted Efron approximation.
- Tests/fixtures: inspected the R fixture generator's integer-weight Efron and Breslow cases and the test comparison code; neither the fixture test nor Vitest was executed. No package runtime or fresh R execution.
- Conclusion: no issue filed; the apparent discrepancy is a false positive resolved by the documented R semantics. This is a narrow audit of weighted tied-event evaluation, not a claim that all of `coxph()` is defect-free.


## Audit #113

- Repository HEAD before ledger update: `6222eb058ce9759e37c852a30a56582b57e18009`
- Source: `src/models/tiedTimes.ts` blob `229af071501c8dbc7bdcc0c03d503346ed227713`.
- Related source inspected: `src/models/coxph.ts` (caller), `src/models/survival.ts` (survfit/survdiff caller), `src/internal/summary.ts` (`meanDD/mean`), `oracle/survival-behaviour.md`, `oracle/survival.R`, `test/survival.test.ts`, and `test/coxph.test.ts`.
- Result: `問題未検出`. No new defect established in the inspected tie-merging logic.
- R comparison: official `survival::aeqSurv()` source uses sorted unique finite times, computes adjacent differences `dy`, marks ties by `dy <= tolerance || dy/mean(abs(y)) <= tolerance`, forms cuts from the first time and every non-tied next time, then maps each time to its interval's cut. The TypeScript implementation follows the same decision rule and minimum-cut mapping. Official documentation describes the default tolerance as `sqrt(.Machine$double.eps)` and says near-equal pairs are replaced by the smaller value. Sources: rdrr.io source and R-devel documentation (web references cited in the audit report).
- Chain/tie-boundary example (fixed values, arithmetic review only): `time=[0,1e-8,2e-8]`; `sqrt(2^-52) ≈ 1.4901161193847656e-8`. Each adjacent gap is `1e-8`, so both are tied and all three values map to `0`, even though the endpoint gap `2e-8` exceeds tolerance. This is not a TypeScript-specific transitivity bug: the R source's adjacent-gap cut construction does the same.
- Extreme-value examples (source and IEEE-754 reasoning, not executed): `time=[1e308,1.1e308]` has gap `1e307`, mean absolute time `1.05e308`, and relative gap about `0.0952`, so it is not tied. `time=[-Number.MAX_VALUE,Number.MAX_VALUE]` makes the subtraction overflow to positive Infinity; the relative gap remains Infinity and does not cause a false merge. The imported `mean()` uses double-double/power-of-two scaling, avoiding the naive sum overflow that would otherwise make the relative gap spuriously zero. Subnormal values, negative times, signed zero, and nonfinite pass-through were inspected at source level.
- Callers: `coxph()` applies merging to its non-missing observations before its stable stratum/time ordering; `survfit()` and `survdiff()` share the same helper before time grouping. The helper retains original row order in its returned array and does not mutate its readonly input.
- Tests: no `test/tiedTimes.test.ts` exists. The relevant survival and Cox fixture-comparison tests and oracle generators were inspected, not executed. No package runtime, Vitest, standalone harness, or fresh R execution.
- Limitations: exact last-bit behavior for inputs engineered precisely at the relative-tolerance boundary was not independently compared between JavaScript and R. The audit establishes source-level equivalence of the rule, not a runtime proof of all IEEE-754 boundary cases. No Issue filed.


## Audit #114

- Repository HEAD before ledger update: `701c2632c295f1d44381267bf2d304f58c5632bd`
- Source: `src/models/survival.ts` blob `03183bdcb6437634a6ddfae1e1f3d98ff2cbc4de`; related `src/models/tiedTimes.ts` blob `229af071501c8dbc7bdcc0c03d503346ed227713`.
- Related material inspected: `test/survival.test.ts`, `oracle/survival.R`, `oracle/survival-behaviour.md), and the R `survival::Surv()` source.
- Result: `問題未検出` for this focused pass; no new defect established in row filtering, sorting, tie-grouping, and risk-set decrement.
- Input validation: lengths are checked before row iteration; rows with NaN time/status or missing group are omitted; status values remaining in the analysis must be exactly 0 or 1. The R `Surv()` implementation converts invalid numeric status values to NA with a warning, whereas this API deliberately rejects them with RangeError (and the existing test asserts rejection for status 2). This is a documented/API-level strictness difference, not silently labelled an implementation bug. Missing rows are filtered before status validation, consistent with complete-case omission for the actual analysis.
- Infinite times: `-Infinity` and event-at-`+Infinity` are rejected; right-censored `+Infinity` is intentionally accepted as a subject remaining at risk through all finite times. This is an extension beyond the comment's stated R behavior (R's default `timefix` path rejects infinite survival times); it does not corrupt finite-time risk sets in the inspected code. At `+Infinity`, the row contributes no event and is removed only after the final time group.
- Ordering and risk sets: merged times are attached to their original rows; observations are sorted by merged time; all event and censor rows at the same merged time are counted together; risk counts are decremented only after processing the entire time block. `survfit()` filters this globally sorted list per stratum, preserving within-stratum order. `survdiff()` decrements per-group and pooled risk sets by the complete leaving count after the block. Opposite-sign extreme finite time subtraction can overflow to ±Infinity in the comparator but retains the correct sign; equal +Infinity comparisons return NaN, which stable sorting treats as equal.
- Exact literal cases reviewed (not executed):
  ```ts
  // Same-time event and censor: both are at risk at t=1.
  const time1 = [1, 1, 2, 3];
  const status1 = [1, 0, 1, 0];

  // A right-censored subject at +Infinity remains in every finite risk set.
  const time2 = [1, 2, Infinity];
  const status2 = [1, 0, 0];

  // Invalid status on a complete row is rejected; missing rows are omitted.
  const time3 = [1, 2, NaN, 4];
  const status3 = [1, 2, 1, NaN];
  const group3 = ["a", "a", "a", "a"];
  ```
- R comparison: the oracle documents events-before-censors at tied times and complete-case omission. The R source confirms that numeric status values outside 0/1 are converted to NA with a warning, unlike this API's explicit strict validation. No fresh R execution.
- Tests: inspected the survival fixture comparison harness, missing-row test, median edge test, and invalid-argument test; no test or fixture was executed. No package runtime, Vitest, standalone harness, or fresh R run.
- Limitations: no direct runtime comparison of +Infinity-censor handling against R; this is intentionally an extension and is noted as such. The audit is limited to right-censored single-event data handled by these APIs, not counting-process or multi-state Surv data. No Issue filed.


## Audit #115

- Repository HEAD before ledger update: `943ab43f447193a639a7ff8ecc9e23378309595a`.
- Source: `src/models/survival.ts` blob `03183bdcb6437634a6ddfae1e1f3d98ff2cbc4de`.
- Related source: `src/distributions/normal.ts` blob `9980fecf2366042da09273ba8c86de07d34dcaa3`; `src/internal/summary.ts` blob `e4fc3bd652af3a00cf05b44389ddf58e590c4830` (reviewed as a possible numerical-support dependency; no dependency defect established).
- Related material inspected: `test/survival.test.ts` blob `fb067569319a07e0c60944beab502623ab5d7be2`, `oracle/survival.R` blob `708fad768c3b0375e11cb91d47377476019148ac`, and `oracle/survival-behaviour.md` blob `20dfbfd0101928a4c9c976b1417cd827a92c58bc`. Also consulted R `survfit_confint` documentation (R-devel).
- Result: `問題未検出`; no new reproducible defect established in the inspected `survfit()` paths. This is not a full runtime certification.
- Kaplan–Meier / Greenwood: for each distinct time, all events and censors are counted while the full time block remains at risk; `S *= 1 - d/n`; Greenwood accumulates `d/[n(n-d)]` for `d<n`, and becomes `Infinity` when `d=n`. The standard error is `S*sqrt(Greenwood)`. At `d=n`, `S=0`, so `stdErr=NaN`; this agrees with the repository oracle's stated R behavior.
- Confidence intervals: `log` uses `S*exp(±z*sigma)` and returns NaN at `S=0`; `plain` uses `S ± z*S*sigma`, clips finite results to [0,1], and propagates NaN when `0*Infinity` occurs; `log-log` returns NaN at `S=0` or `S=1`, otherwise applies the log(-log(S)) transformation. These boundary behaviors agree with the repository oracle and R's documented `survfit_confint` semantics. The `confInt` validation excludes NaN, infinities, 0, and 1. The quantile calculation switches to the upper-tail form for very small alpha/2 to avoid loss of precision in `1 - alpha/2`; `qnorm` supports the upper-tail calculation.
- Median: `curveMedian()` uses the oracle's `sqrt(Number.EPSILON)` tolerance around 0.5. If the curve reaches 0.5 on a flat interval, it returns the midpoint between the time it reached 0.5 and the next event time; otherwise it returns the first crossing below 0.5. The same rule is applied independently to the lower and upper confidence curves. The existing flat-stretch test covers a censoring time within the plateau.
- Exact literal boundary cases reviewed (source/arithmetic review only; not executed):
  ```ts
  // All subjects fail at the same time: S=0, Greenwood=Infinity.
  const timeAllFail = [1, 1, 1];
  const statusAllFail = [1, 1, 1];

  // No events: S=1, Greenwood=0; log/plain intervals stay at 1,
  // while log-log limits are NaN at the boundary.
  const timeNoEvents = [1, 2, 3];
  const statusNoEvents = [0, 0, 0];

  // S reaches 0.5 at t=3, is censored at t=4, and next event is t=5.
  // Median is the midpoint (3+5)/2 = 4.
  const timeHalfPlateau = [1, 2, 3, 4, 5, 6];
  const statusHalfPlateau = [1, 1, 1, 0, 1, 1];
  ```
- Extreme-count reasoning: the risk/event counts are derived from JavaScript array lengths, so practical array-size limits are far below the integer precision limit of IEEE-754 doubles. Products such as `n*(n-d)` therefore cannot overflow for realizable JS arrays. No separate defect was found in this path.
- Tests: inspected the R-fixture comparison test, missing-row test, flat-median test, and invalid-argument test. The fixture generator covers `log`, `plain`, `log-log`, grouped and ungrouped curves, and `conf.int=0.9`; tests and fixtures were not executed.
- R relationship: the source/oracle contract was compared with official R documentation for `survfit_confint`; no fresh R execution.
- Verification limits: source and formula review only. No package runtime, Vitest, fixture execution, standalone numerical harness, or fresh R comparison. No Issue filed.


## Audit #116

- Repository HEAD before ledger update: `9fe68d7d311739d68421b3f39f5a6f360312669f`.
- Source: `src/models/survival.ts` blob `03183bdcb6437634a6ddfae1e1f3d98ff2cbc4de`.
- Related material: `test/survival.test.ts` blob `fb067569319a07e0c60944beab502623ab5d7be2`; `oracle/survival.R` blob `708fad768c3b0375e11cb91d47377476019148ac`; `oracle/survival-behaviour.md` blob `20dfbfd0101928a4c9c976b1417cd827a92c58bc`; `test/fixtures/survival.json` blob `2e3bb7b95bb567b12526c94cce94aec04513ba54` (R version 4.5.2).
- R implementation cross-check: fetched `cran/survival` tag `3.8-3`, `R/print.survfit.R` blob `1426b7dab3c4917c4b4adee27909dd7cff1809e5`. Its `minmin()` uses `keep = !is.na(y) & y < (0.5+tolerance)`; when the first retained value is within tolerance of 0.5 and a later value is lower, it returns the midpoint between the first retained time and the first lower value. This agrees with the intended midpoint behavior in `curveMedian()` for the monotone KM and confidence curves examined. The fixture's expected median for the p stratum is 2.5, with lower limit 1 and upper limit NA; for q it is 5, lower limit 2 and upper limit NA.
- Result: `問題未検出`; no new defect established in the targeted median/median-CI pass.
- Median rule: `curveMedian()` skips NaN values, finds the first value below `0.5 + sqrt(eps)`, returns the crossing time when it is clearly below 0.5, and uses the midpoint to the next event when it is within the tolerance band. The R source uses the same tolerance and midpoint convention, locating the first subsequent value below the first retained value. For the ordinary KM curve, this corresponds to the next event time; censors leave the curve unchanged.
- Exact fixture-derived input (values are literal; source/fixture inspection only, not executed in this audit):
  ```ts
  const time = [1, 2, 3, 4, 1, 2, 2, 5, 6, 6];
  const status = [1, 1, 1, 1, 1, 1, 0, 1, 1, 1];
  const group = ["p", "p", "p", "p", "q", "q", "q", "q", "q", "q"];
  // R 4.5.2 fixture, conf.type="log":
  // median rows: p=[2.5, 1, NA], q=[5, 2, NA].
  ```
- A caution during source comparison: an older rendered web mirror of `print.survfit.R` exposed stale/garbled conditional text. The repository's target release tag `3.8-3` was fetched directly and used instead. The earlier tentative claim that a signed comparison caused a mismatch was withdrawn; it was based on that stale rendering and is not an audit finding.
- Tests: inspected the test that checks the 0.5 flat-stretch midpoint and the fixture-comparison harness; neither was executed. No package runtime, Vitest, fixture execution, or fresh R execution.
- Limitations: source-level comparison only. The targeted pass did not exhaustively enumerate non-monotone confidence-bound sequences or every IEEE-754 value adjacent to 0.5. No Issue filed.


## Audit #117

- Repository HEAD before ledger update: `708721f9b62c55aa8fe1c75f4bcdc8a93ffeaea1`.
- Source: `src/models/survival.ts` blob `03183bdcb6437634a6ddfae1e1f3d98ff2cbc4de`; focused on `survdiff()` multi-group contrasts, expected-count filtering, degrees of freedom, covariance rank, rho weights, and p-value.
- Related material: `test/survival.test.ts` blob `fb067569319a07e0c60944beab502623ab5d7be2`; `oracle/survival-behaviour.md` blob `20dfbfd0101928a4c9c976b1417cd827a92c58bc`; `src/distributions/chisq.ts` blob `f9463e9674d80dc480143cc56976763288cf6559`; `src/distributions/gamma.ts` blob `e9ba1c35ef88e77e84a392562bb7f62378fcbf7f`; `src/linalg/solve.ts` blob `6e423f1c2969b896c1715f5af95864c6f59dea24`.
- Result: `問題未検出` for this focused pass. No new defect established in multi-group df selection, rho weighting, or upper-tail p-value dispatch. The previously recorded helper-level eigenvalue-threshold concern (#28) remains separately qualified; this audit does not upgrade it to a reproducible `survdiff()` defect.
- Group/df handling: labels are sorted; groups with `expected <= 0` are omitted from the contrast; the first remaining group is the reference; the contrast matrix is the corresponding `k-1` principal submatrix. The degrees of freedom are `used.length - 1` on the regular path, and the eigen-rank returned by `pseudoQuadratic()` only on the solve-failure path. This matches the repository oracle's specified first-`k-1` contrast convention. Fewer than two groups with positive expected count yields statistic 0 and df 0; p-value is intentionally NaN.
- Covariance rank reasoning: for the earliest event time, pooled KM immediately before that event is 1, hence `w=1` for every finite `rho`. If the first event count is `d < N`, its covariance contribution has positive scalar `d(N-d)/(N(N-1))` times `diag(r)-rr'/N`, where every group later having positive expected count has a positive risk count in this first risk set. After dropping one group, this contribution is positive definite; later event-time contributions are positive semidefinite. If `d=N`, all subjects still at risk fail at that time, so there can be no later events; groups with positive expected count have `O=E` and zero variance. This supports the earlier #110 structural analysis: an exactly singular nontrivial contrast matrix is not expected from ordinary finite right-censored input. Numerical ill-conditioning remains theoretically possible; no concrete input reaching the fallback was established.
- R relationship: official `survival::survdiff` documentation describes the G-rho family with event weights `S(t-)^rho`, rho=0 log-rank and rho=1 Peto–Peto; its result includes the chi-square p-value. The repository implementation uses pooled KM before the event block, squares the weight in the covariance, and passes the selected df to the upper chi-square tail. Source: R survival 3.8-3 documentation (web citation in audit report).
- Exact deterministic inputs reviewed (formula/source inspection only; not executed):
  ```ts
  // Three groups, with event/censor ties and events at multiple times.
  const time = [1, 1, 2, 3, 4, 5];
  const status = [1, 0, 1, 1, 0, 1];
  const group = ["a", "b", "b", "c", "a", "c"];
  const rhoValues = [0, 1, -1];

  // Group c is censored before the first event and therefore has exp=0;
  // it is omitted from the tested contrasts.
  const timeZeroExpected = [0, 1, 2];
  const statusZeroExpected = [0, 1, 1];
  const groupZeroExpected = ["c", "a", "b"];
  ```
- Tests: inspected the survival fixture comparison harness and existing missing-row/invalid-argument tests. The fixture includes `survdiff` comparisons for its recorded rho values; neither tests nor fixtures were executed. No package runtime, Vitest, standalone harness, or fresh R execution.
- Limitations: source/formula review only; no generated-data search for a finite-precision covariance that triggers `solve()` failure, no runtime comparison of p-values, and no fresh R execution. No Issue filed.


## Audit #118

- Repository HEAD before ledger update: `485683a17ddfe32ba421de0f86aef69aed1fec6b`.
- Primary source: `src/distributions/gamma.ts` blob `e9ba1c35ef88e77e84a392562bb7f62378fcbf7f`.
- Related source: `src/special/loader.ts` blob `798b92185091204205e77d1e8e81e4591e7d78c3`; `src/special/igam.ts` blob `b06dd71a2f60ebe59d92e8759b0b6af7aebc2620`; `src/internal/invert.ts` blob `54aeaa15ec93053e2dd5fd19fc640a9fbf243a76`; `src/internal/dpq.ts` blob `543eb6ceb3de7627a7562b035a931a88da424aa7`; `src/special/gamma.ts` blob `f630bdd496fc204dd24b6b04603c7b511a5cb107`.
- Tests/fixtures inspected: `test/gamma.test.ts` blob `db75474bb21ad3531f9ae071cffa359023e1af37`; `test/fixtures/dgamma.json` blob `da6fa106d4b824cb620dd14b0d2b7d930c98482a`; `test/fixtures/pgamma.json` blob `bbfde310b6ca200dcbfab9cb5fa5557c0eb123f8`; `test/fixtures/qgamma.json` blob `47d054f6330d83ab05bb9d66576f229abe8cc72f`; fixture metadata identifies R 4.5.2.
- Result: `一部監査・問題未検出`. This pass focused on parameter conversion and boundary/special-value handling in `dgamma1`, `pgamma1`, and `qgamma1`, plus the handoff to incomplete-gamma and quantile inversion routines. No reproducible defect was established. This is not a full numerical certification of gamma distribution functions.
- Parameter conversion: `gammaScale()` uses default scale 1, accepts either rate or scale, and checks the combined form via `abs(rate*scale-1)<1e-15`. Zero/subnormal rate can produce infinite scale; downstream branches explicitly handle this limit. No independent defect was demonstrated in the inspected cases.
- Density boundaries: NaN propagation, negative x, shape 0, x=0 with shape below/equal/above 1, subnormal standardized x, log-density cancellation fallback, shape Infinity, and scale Infinity were traced. The Poisson-core special cases support the observed shape-Infinity limits in the R fixture, including x=Infinity.
- CDF boundaries: q=Infinity is handled before q/scale to avoid Inf/Inf; shape 0, shape Infinity, q<=0, subnormal x/scale, lower/upper tails, and log probabilities are routed explicitly. Tiny lower-tail probabilities are assembled from `log(x)-log(scale)` in double-double arithmetic; upper-tail complements use `expm1`/ `log1p` paths in the small-x branch.
- Quantile boundaries: range/endpoints are handled by `quantileBoundaries()`; shape 0, shape Infinity, and scale Infinity have explicit branches. For subnormal quantiles, `logTinyGammaQuantile()` works in log space; otherwise `invertContinuous()` uses a safeguarded bracket and log-CDF residuals. No concrete inconsistency was established from source review.
- Exact deterministic inputs reviewed (source/fixture inspection only; not executed):
  ```ts
  // Boundary density and CDF cases
  const x = [0, -1, 1e-320, 1, Infinity, NaN];
  const shapes = [0, 0.5, 1, 2, Infinity];
  const scale = 1;

  // Tiny lower-tail quantile cases from the R 4.5.2 fixture
  const p = 9.9998886718268301e-321;
  const qShapes = [0.5, 1, 1.5, 2, 3, 10, 100, 1e6];
  const qScale = 1;

  // Scale conversion at the subnormal-rate boundary
  const rates = [5e-324, 1e-308, 1, 1e308];
  ```
- Tests: inspected fixture-driven tests at tolerance `1e-14`, including log density, all tail/logP combinations, and inverse-CDF backward checks. Inspected R 4.5.2 fixture cases for shape 0/Infinity and subnormal p. Tests and fixtures were not executed. No package runtime, Vitest, standalone harness, or fresh R execution.
- Limitations: only boundary/dispatch and numerical-stability pathways were reviewed. The full incomplete-gamma series/continued-fraction/asymptotic implementations, all quantile convergence regimes, and broad random/high-precision comparisons remain for separate audits. No Issue filed.


## Audit #119

- Repository HEAD before ledger update: `71dedbac8b2db4dc3611072f69abccd748aaaf36`.
- Primary source: `src/special/igam.ts` blob `b06dd71a2f60ebe59d92e8759b0b6af7aebc2620`.
- Related source: `src/special/igamAsympCoeff.ts` blob `303c31a00d04790f242125345c8a1d6e984b0774`; `src/special/loader.ts` blob `798b92185091204205e77d1e8e81e4591e7d78c3`; `src/special/gamma.ts` blob `f630bdd496fc204dd24b6b04603c7b511a5cb107`; `src/internal/dpq.ts` blob `543eb6ceb3de7627a7562b035a931a88da424aa7`.
- Tests/fixtures inspected: `test/gamma.test.ts` blob `db75474bb21ad3531f9ae071cffa359023e1af37`; `test/fixtures/pgamma.json` blob `bbfde310b6ca200dcbfab9cb5fa5557c0eb123f8`; `test/fixtures/qgamma.json` blob `47d054f6330d83ab05bb9d66576f229abe8cc72f`. Fixtures identify R 4.5.2. No dedicated `test/igam.test.ts` file at the inspected path.
- Result: `一部監査・問題未検出`. No reproducible error was established in the inspected branch dispatch or formula structure. This is not a proof of full-domain accuracy.
- Lower-tail series: `igamSeriesSum` sums positive terms and stops on relative term size; for large a and x > 0.97a it switches to a double-double recurrence with a geometric remainder bound. The final prefactor is based on Loader's `dpoisRaw`, with log-domain fallback when the linear prefactor is subnormal.
- Upper-tail continued fraction: the ordinary convergent recurrence rescales all four recurrence values when the numerator exceeds `BIG`; for x > 1e20 it switches to modified Lentz ratios to avoid overflow. Initial denominator is positive in the dispatch region x>=a; zero intermediate denominators are guarded by `tiny`.
- Small-x complementary series: `igamcSeries` uses alternating terms and `expm1` for the leading cancellation, with `lgamma1p(a)` to retain precision for tiny a. Direct-tail selection computes the smaller side and uses `log1p` or `expm1` when constructing the complement.
- Temme asymptotics: reviewed the sign of eta, lower/upper correction sign, coefficient table dimensions (25×25), term truncation, and the separate `temmeTail` representation using `bd0dd` and `erfcx`. The region split is explicit: xsf-like central region, near-mean large-a region, and `a>1e299` far-asymptotic region. No sign or branch contradiction was found by formula inspection.
- Special branches: reviewed a=0, x=0, negative inputs, NaN/Infinity, a<1e-300 upper-tail scaling, and x > 1e15*max(a,1) large-x approximation. The large-x branch is taken before the continued fraction to avoid its initial product overflow.
- Exact deterministic inputs reviewed (source-level branch selection only; not executed):
  ```ts
  const cases = [
    { a: 10, x: 5 },           // lower series
    { a: 10, x: 20 },          // upper continued fraction
    { a: 100, x: 100 },        // central Temme region
    { a: 1000, x: 999.5 },     // large-a near-mean Temme region
    { a: 1e14, x: 0.99e14 },   // large-a series / long-tail convergence regime
    { a: 1e300, x: 1e300 },    // huge-a far asymptotic
    { a: 2, x: 1e21 },         // large-x asymptotic
    { a: 1e-310, x: 1 },       // tiny-shape upper-tail scaling
  ];
  const tails = [true, false]; // lower P and upper Q
  ```
- Tests: inspected fixture-driven gamma tests and R 4.5.2 pgamma/qgamma fixtures; neither executed. No Vitest, package runtime, standalone harness, mpmath/MPFR comparison, or fresh R execution.
- Limitations: no numerical evaluation of branch-boundary continuity, no high-precision grid around `SMALL`, `LARGE`, `SMALLRATIO`, `LARGERATIO`, `HUGE_A`, `A_SUB`, or `1e20`; no adversarial search for convergence-limit failures. No Issue filed.

## Audit #120

- Repository HEAD before ledger update: `c652319c2b1b4d474183ee24d85cc05afc1cc686`.
- Sources: `src/distributions/gamma.ts` blob `e9ba1c35ef88e77e84a392562bb7f62378fcbf7f`; `src/special/igami.ts` blob `008fc2b262eaa649093211a40e9d7fdd83facdcf`; `src/internal/invert.ts` blob `54aeaa15ec93053e2dd5fd19fc640a9fbf243a76`; `src/internal/dpq.ts` blob `543eb6ceb3de7627a7562b035a931a88da424aa7`.
- Related `src/special/igam.ts` was cross-read as the CDF evaluator (blob `b06dd71a2f60ebe59d92e8759b0b6af7aebc2620`); primary deep audit of that file is #119.
- Test/fixture: `test/gamma.test.ts` blob `db75474bb21ad3531f9ae071cffa359023e1af37`; `test/fixtures/qgamma.json` blob `47d054f6330d83ab05bb9d66576f229abe8cc72f`. Fixture metadata: R 4.5.2; 3286 cases, of which 1240 use logP, 1643 upper-tail, 186 linear p > 0.999999999999, 186 p < 1e-300, and 310 logP < -700. These were inspected, not executed.
- Result: `一部監査・問題未検出`. No new reproducible defect established in qgamma's initial approximation, tail conversion, or safeguarded inversion by source review.
- `smallerTail()`: for linear p > 1/2, uses exact representable `1-p`; for logP > log(1/2), uses `-expm1(p)`; carries the linear target where available to reduce log-target rounding error.
- `findInverseGamma()`: reviewed DiDonato–Morris Eq. 21–25 for a<1 and Eq. 31–36 for a>=1, including p/q symmetry, branch boundaries b=0.1/0.15/0.35/0.45/0.6, and the a>=500 near-mean shortcut. This is only a starting approximation; all these paths feed the safeguarded inversion except the explicit subnormal quantile formula.
- `qgammaStd()`: reviewed tiny-quantile log formula, deep-tail Wilson–Hilferty seed for shape>1 and log target<=-700, DiDonato–Morris seed above that threshold, lower/upper deep-tail asymptotic seeds, and final multiplication by scale.
- `invertContinuous()`: reviewed positive-support transformation u=log(x), signed residual/bracket updates for both tails, Newton/Halley step safeguard, 200-iteration cap, best-residual return, Newton polishing in x, and adjacent-double bisection fallback for extreme concentration.
- Exact deterministic inputs considered (branch/logic review only; not executed):
  ```ts
  const cases = [
    { p: 0.5, shape: 0.5, scale: 1, lowerTail: true, logP: false },
    { p: 1e-300, shape: 2, scale: 1, lowerTail: true, logP: false },
    { p: -1000, shape: 2, scale: 1, lowerTail: true, logP: true },
    { p: -1000, shape: 2, scale: 1, lowerTail: false, logP: true },
    { p: 1 - 2 ** -52, shape: 100, scale: 1, lowerTail: true, logP: false },
    { p: 0.25, shape: 1e-310, scale: 1, lowerTail: true, logP: false },
    { p: 0.75, shape: 1e6, scale: 1, lowerTail: false, logP: false },
  ];
  ```
- `test/gamma.test.ts` uses fixture comparison tolerance 1e-14 and a backward pgamma check for qgamma. Test definitions and fixture data inspected only; no Vitest, package runtime, standalone harness, high-precision comparison, or fresh R execution.
- Limitations: no direct numerical verification at logTarget=-700, at b branch thresholds in `igami.ts`, at subnormal quantile boundary, or around inversion iteration/adjacent-double termination. A qgamma backward check against the same local pgamma implementation would not independently certify correctness. No Issue filed.


## Audit #121

- Repository HEAD before ledger update: `9a6b479fa51c0e16a8313c9c2518c75130c84004`.
- Primary source: `src/random/gamma.ts` blob `76f1bbfcf99c0ead3efff7887131e7e142511f33`. Related sources inspected: `src/random/rng.ts` blob `f527fd7018642205ef5870df8fcab8fc9e02aff1`; `src/random/mt.ts` blob `a27a644a591ab2286227aa5db1b05b16fa149300`; `src/random/common.ts` blob `be016a36e9f09f580462d2bf93e30ed6bad527c1`; `src/random/continuous.ts` blob `5ad76e5676b4bf27c36b288f8e48ac3821bfd92a`.
- Test inspected: `test/random.test.ts` blob `f849a51e7b3c89c639641cf0a231fc9989dcff81`. It routes `rgamma` through the random fixture suite with seed/stream comparisons and continuous tolerance 1e-12; test/fixtures were not executed.
- Result: `問題あり`. Confirmed parameter-boundary mismatch in `rgamma1()`: current code returns NaN for negative shape with zero scale, and for zero shape with negative scale. R's `src/nmath/rgamma.c` checks `a <= 0 || scale <= 0`, then returns 0 when `scale == 0 || a == 0` before returning NaN for other invalid combinations. Reproductions: `rgamma(1, -1, { scale: 0 })` and `rgamma(1, 0, { scale: -1 })`; expected R output `[0]`, current branch yields `[NaN]`.
- Issue filed: [#29](https://github.com/numero-uno-jpn/rStats.js/issues/29).
- Algorithm review: GS (shape<1) and GD (shape>=1) formula/constants, squeeze and quotient acceptances, double-exponential rejection, normal/exponential/uniform dependencies, MT open-interval fixups, scale multiplication, and finite/infinite parameter early returns were compared with R's `rgamma.c`. No additional reproducible algorithm defect established by source comparison. This is not a distributional/statistical validation.
- Exact deterministic reproduction inputs are listed above; no RNG seed is needed because this defect is in the deterministic parameter-validation branch and consumes no random values.
- No Vitest, package runtime, statistical simulation, or fresh R execution was performed. R expectations were confirmed by direct comparison with the R source implementation; no fixture values were executed.


## Audit #122

- Repository HEAD before ledger update: `10357380b3019e5ea6089224e3a0d4152702e639`.
- Primary source: `src/random/beta.ts` blob `5371b478626066c291432ec2df4529953520f520`. Related sources: `src/random/gamma.ts` blob `76f1bbfcf99c0ead3efff7887131e7e142511f33`; `src/random/rng.ts` blob `f527fd7018642205ef5870df8fcab8fc9e02aff1`; `src/random/common.ts` blob `be016a36e9f09f580462d2bf93e30ed6bad527c1`.
- Test/fixture inspected: `test/random.test.ts` blob `f849a51e7b3c89c639641cf0a231fc9989dcff81`; `test/helpers/random.ts` blob `d9c9fae276354b0ed1c63a0ea6c588efe99ca8e9`; `test/fixtures/rbeta.json` blob `866acacf6513f6a0406424961fd5176c73ad1e5d`. Fixture: R 4.5.2, x86_64 Linux, 47 cases; central shape grid 0.1, 0.5, 1, 2, 5, 50; special shapes 0/Inf/negative; one ncp=1.5 case; three 20,000-draw summary cases. Inspected, not executed.
- Result: `問題あり`. The BB algorithm's large-product shortcut tests only whether `2*a*b` overflows, not whether both shape parameters are large. For `a=1.1,b=1e308`, the branch consumes two uniforms and returns the mean for every variate. Exact deterministic reproduction: `setSeed(12); rbeta(5, 1.1, 1e308)`; source-level result is five copies of approximately `1.1e-308` (seed does not affect values in this branch, only stream state).
- Mathematical check: Beta(a,b) coefficient of variation is `sqrt(b / (a*(a+b+1)))`; at a=1.1,b=1e308 it tends to `1/sqrt(1.1) ≈ 0.953462589`. Thus the distribution is not concentrated at its mean and the constant shortcut is invalid. For large b and moderate a, `b*X` tends to Gamma(a,1), suggesting a scale-aware alternative. R's central `rbeta.c` uses Cheng BB/BC too; this audit evaluates mathematical distribution fidelity, not exact R parity in this extreme region.
- R source cross-check: Fossies R 4.6.1 `src/nmath/rbeta.c` confirms the Cheng BB/BC structure and the same overflow-sensitive BB expression; see web citation in report. The local implementation adds its own mean shortcut for overflow. The R source is not treated as an independent correctness oracle for this extreme case.
- Additional review: BC and BB rejection inequalities, constants, symmetry, parameter cache, endpoint/special-value handling, and noncentral-beta construction via noncentral chi-square/gamma mixtures were source-reviewed. No second concrete defect established. R's `ncp=0` path remains separate from omitted ncp as expected by the random generator design.
- Issue filed: [#30](https://github.com/numero-uno-jpn/rStats.js/issues/30).
- No Vitest, package runtime, statistical simulation, or fresh R execution. The result is a deterministic source-level finding plus analytic distributional proof; fixture cases were only inspected.


## Audit #123

- Repository HEAD before ledger update: `cf352aaf46ae22782a09d7c054fd3716a370d7a6`.
- Primary source: `src/random/poisson.ts` blob `9f6f9657e84c2110bb08640b1f846c345bd2ff2f`. Related source: `src/random/rng.ts` blob `f527fd7018642205ef5870df8fcab8fc9e02aff1`; `src/random/common.ts` blob `be016a36e9f09f580462d2bf93e30ed6bad527c1`.
- R reference: `src/nmath/rpois.c`, Ahrens–Dieter (1982) algorithm PD; source reviewed via official/CRAN R source reference. Small-mean inversion table and large-mean normal rejection method match the TypeScript structure. Compared constants A0–A7, thresholds (10, 0.458, 35, -0.6744, 1.8, 1.1484), immediate/squeeze/quotient/hat acceptance, factorial branch, and parameter-cache update rules.
- Test/fixture inspected: `test/random.test.ts` blob `f849a51e7b3c89c639641cf0a231fc9989dcff81`; `test/helpers/random.ts` blob `d9c9fae276354b0ed1c63a0ea6c588efe99ca8e9`; `test/fixtures/rpois.json` blob `5a6e749d4a299ce6259f8cfd9d8a44d92c4be666`. Fixture metadata R 4.5.2, x86_64 Linux, 32 cases: λ=0, 0.1, 1, 5, 9.99, 10, 15, 50, 100, 1e4, 1e7, Inf, -1, NaN; includes 20,000-draw summaries at λ=3,12,40,1000 and verifies next RNG draw. Inspected, not executed.
- Result: `一部監査・問題未検出`. No reproducible defect established in the reviewed Ahrens–Dieter implementation. Boundary validation rejects nonfinite/negative λ without consuming RNG; λ=0 returns 0 without consuming RNG, matching fixture expectations. Small-mean cumulative table resets when λ changes; large-mean constants recalculate when λ changes; transitions and cached-parameter logic were source-reviewed.
- Exact fixed inputs reviewed (not executed): `setSeed(30); sampleInt(5, { size: 20, replace: true, prob: [0.1, 0.2, 0.3, 0.2, 0.2] })`; `setSeed(30); sampleInt(5, { size: 5, replace: false, prob: [0.1, 0.2, 0.3, 0.2, 0.2] })`; `setSeed(31); sampleInt(5, { size: 3, replace: false, prob: [3, 0, 1, 1, 5] })`; `setSeed(33); sampleInt(250, { size: 30, replace: true, prob: Array(250).fill(1) })`. The last literal specifies all 250 weights without elision.
- Fixture inspected: `test/fixtures/rhyper.json` blob `39ca835db17abaf839fa97848fa7fbf4eeead82c`, R 4.5.2, 19 cases. Includes support boundaries, half-integer parameter rounding, populations larger than INT_MAX, and larger simulation summaries. Fixture values and post-draw RNG states inspected, not executed.
- Current R docs describe rhyper as corrected Kachitvichyanukul–Schmeiser HIN/H2PE. R-devel July 2026 discussion records a 32-bit overflow defect when m+n exceeds INT_MAX and its fix (svn rev 90223). This TypeScript implementation uses JS numbers for N when both parameters are below INT_MAX, and routes larger individual parameters to qhyper1, so the specific signed-int overflow is not reproduced by the reviewed path.
- Result: `一部監査・問題未検出`. No new Issue filed. No Vitest, package runtime, Monte Carlo simulation, or fresh R execution.


## Audit #127

- Repository HEAD before ledger update: `cd3524756e9b5a883af0e9358e23272a8fee2cc3`.
- Target: `src/random/r2dtable.ts`, blob `8ccc84fc49823aa54db9eb23da7d7b3df00033f0`.
- Algorithm review: Patefield AS 159 conditional hypergeometric cells, mode calculation, upward/downward probability ratios, cumulative-probability restart when rounding leaves a residual, last column/last row margin completion, zero remaining subtable branch, column-major internal storage and row-array public output.
- Validation review: truncation of n and margins as R integer coercion; finite/range checks; at least two rows/columns; nonnegative margins; equal grand totals; maximum total guard; zero-total tables; n=0 behavior.
- Exact fixed inputs reviewed (not executed): `setSeed(1); r2dtable(1, [3, 2], [2, 3])`; `setSeed(42); r2dtable(5, [0, 6, 4], [5, 0, 5])`; `setSeed(2024); r2dtable(5, [12, 5, 7, 7], [9, 11, 11])`; `setSeed(1); r2dtable(1, [0, 0], [0, 0])`; coercion check `r2dtable(1, [3.9, 2.1], [2.9, 3.1])`.
- Fixture inspected: `test/fixtures/r2dtable.json` blob `c12c8b89aebf9ef0c3839070980dfbb6e49ce22e`, R 4.5.2 x86_64, 73 cases. Includes 2x2 through 8x4 tables, zero margins, zero grand total, totals up to 300,000, multiple seeds, and n=200; fixed output and next-uniform states inspected, not executed. Test registration in `test/random.test.ts` inspected, not executed.
- No independent algorithmic defect established. Resource note: the allowed maximum grand total of 2,147,483,647 would require a Float64Array with over 2 billion entries (roughly 16 GiB before other allocations); practical allocation may fail well below this guard, but it is a resource ceiling rather than a demonstrated statistical result error.
- Result: `一部監査・問題未検出`. No new Issue. No Vitest, package runtime, Monte Carlo simulation, or fresh R execution.


## Audit #128

- Repository HEAD before ledger update: `6faa7e1c6e67c99e454a7abf48e7f1dc2dc01446`.
- Target: `src/random/sample.ts`, blob `b2a2a714b624fdd7f8e422e7a5210000a759d710`.
- Dependencies inspected: `src/random/rng.ts` blob `f527fd7018642205ef5870df8fcab8fc9e02aff1` (including `unifIndex`, sample-kind selection), `src/internal/extremes.ts` blob `00fbd46179043e90fc6678a777fbd9b5540dd7c6`.
- Algorithm review: uniform sampling with and without replacement; large-n duplicate rejection; partial Fisher-Yates; weighted sampling with replacement via cumulative probabilities and Walker alias above 200 substantial weights; weighted sampling without replacement by cumulative mass; descending heapsort and permutation; probability normalization and overflow rescaling; Rounding vs Rejection sample.kind stream use; sample(array) mapping and 0-based sampleInt output.
- Validation review: n/size truncation and bounds, empty population, size > population, prob length/finite/nonnegative/positive weights, insufficient positive weights without replacement, n limit with weights, large n constraints, zero size, n=1, and arrays with zero weights.
- Exact fixed inputs reviewed (not executed): `setSeed(30); sampleInt(5, { size: 20, replace: true, prob: [0.1, 0.2, 0.3, 0.2, 0.2] })`; `setSeed(30); sampleInt(5, { size: 5, replace: false, prob: [0.1, 0.2, 0.3, 0.2, 0.2] })`; `setSeed(31); sampleInt(5, { size: 3, replace: false, prob: [3, 0, 1, 1, 5] })`; `setSeed(32); sampleInt(300, { size: 50, replace: true, prob: [0.8966972001362592, 0.26550866314209998, 0.37212389963679016, 0.57285336335189641, 0.90820778999477625, 0.2016819310374558, 0.898389684684?] })` (the full 300-element weight vector is preserved in `test/fixtures/rsample.json` and was not copied here; the first three fixed vectors above are complete reproducible inputs).
- Fixture inspected: `test/fixtures/rsample.json` blob `5dd1a59eaf2f04f054f483f76b9902b15a896521`, R 4.5.2 x86_64, 25 cases. Includes uniform permutations, large n, replacement, weighted replacement, weighted no-replacement, 300-candidate alias sampling, and 300-candidate weighted no-replacement. Fixture values and next-uniform states inspected, not executed. Test registration in `test/random-kinds.test.ts` inspected, not executed.
- No independent reproducible defect established. Extreme dynamic-range weights can normalize to zero in binary64 (e.g. `[1e308, 1e-300, 1e-300]`), an inherent precision limitation; no evidence of a separate algorithmic defect was established in this pass.
- Result: `一部監査・問題未検出`. No new Issue. No Vitest, package runtime, Monte Carlo simulation, or fresh R execution.


## Audit #129

- Repository HEAD before ledger update: `6f8c6930b3c84d99f07d6fe7c0bc0622569ae526`.
- Target: `src/random/rank.ts`, blob `4cfe69d81a9a6509c9dbac95b3000a2adfb57433`.
- Dependencies: `src/random/rng.ts` blob `f527fd7018642205ef5870df8fcab8fc9e02aff1`; `src/random/common.ts` blob `be016a36e9f09f580462d2bf93e30ed6bad527c1`; `src/internal/integer.ts` used by half-even rounding.
- Algorithm review: `rsignrank` forms the statistic as independent Bernoulli(1/2) choices of ranks 1..n; `rwilcox` uses partial Fisher–Yates to choose n ranks from 0..m+n-1, then subtracts n(n-1)/2. This matches R's `rwilcox` C implementation and its uniform-index sampling pattern. `rsignrank` matches the R definition `i * floor(unif_rand()+0.5)`.
- Validation review: nonfinite/NaN inputs, half-even rounding, negative and zero sample sizes, m+n integer allocation ceiling, zero-sized sample, and generated count validation through `generate`. No independent reproducible defect established in the supported/ordinary parameter range.
- Exact reproducible fixture inputs inspected (not executed): `setSeed(27); rsignrank(10, 5)` expected `[4,0,15,7,10,2,0,7,9,6]`; `setSeed(28); rwilcox(10, 3, 4)` expected `[9,6,5,5,5,3,10,4,2,7]`; `setSeed(28); rwilcox(10, 0, 5)` expected ten zeros. Fixture `test/fixtures/rrank.json`, blob `31fe6958bf457cfad61ee626440e0afc00f06dc4`, identifies R 4.5.2 x86_64 and contains 10 cases; values and post-draw uniform states inspected, not executed.
- Related exact rank distribution fixtures and tests were inspected for context (`test/rank.test.ts`), but the target here is random generation, not `dsignrank`/`dwilcox`.
- Result: `一部監査・問題未検出`. No new Issue filed. No Vitest, package runtime, Monte Carlo simulation, or fresh R execution.


## Audit #130

- Repository HEAD before ledger update: `75095a2c450c18de77f8ceacc259b90bd246a288`.
- Target: `src/random/extra.ts`, blob `2e5d69e49dab41d9ae05164075051c7beb8e0dd5`.
- Dependencies inspected: `src/random/gamma.ts` (`rgamma1`), `src/random/rng.ts` (`unifRand`, `expRand`), `src/internal/extremes.ts` (`midpoint`), and the quantile functions for Kumaraswamy, Pareto, and arcsine distributions.
- Algorithm review: inverse-gamma via reciprocal of Gamma(shape=alpha, scale=1/beta); Kumaraswamy/Pareto via inverse CDF at 1-U; triangular via independent minimum/maximum of two uniforms and mode-weighted interpolation; Laplace via exponential magnitude plus independent sign; arcsine via inverse CDF at U. Checked stream consumption (2 uniforms for rtriang; expRand plus sign uniform for rlaplace; invalid parameters consume none), support constraints, default arguments, finite endpoints, and wide finite triangular intervals where b-a overflows.
- Exact fixture inputs inspected (not executed): `setSeed(1); rinvgamma(10, 3, { beta: 2 })`; `setSeed(1); rkumar(10, 2, 3)`; `setSeed(1); rpareto(10, { a: 2, b: 1.5 })`; `setSeed(1); rtriang(10, { a: 0, b: 3, c: 1 })`; `setSeed(1); rlaplace(10, { mu: 1, sigma: 2 })`; invalid no-draw case `setSeed(7); rpareto(3, { a: 0, b: 1 })`.
- Fixture: `test/fixtures/rextradist.json`, blob `1b830949954493506f09f7b1d267d189a5d1aaaf`, R 4.5.2 x86_64, 20 cases. Includes seeds 1, 42, 20261024, boundary/invalid cases and post-draw RNG states; inspected, not executed.
- Result: `一部監査・問題未検出`. No reproducible algorithmic defect established. No Issue filed. No Vitest, package runtime, distributional simulation, or fresh R execution.



## Audit #131

- Repository HEAD before ledger update: `b6d645d063aee7a2793eaec9e8e78fad80d2acd9`.
- Target: `src/random/streams.ts`, blob `63359251f6081a7658ebf27e105e6a0ed7c789cb`; dependency `src/random/lecuyer.ts` blob `7bd112bb422a4e4b8dd2bbcf3badaa4da4efe4c3`.
- Algorithm review: 2^76 substream and 2^127 stream transition matrices for both MRG32k3a components; 3×3 row-major matrix application; modular multiplication by splitting the second operand into 16-bit halves; preservation of R kind code and signed 32-bit state representation; rejection of non-L'Ecuyer codes and invalid state vectors.
- Exact test inputs inspected (not executed): `RNGkind({ kind: "L'Ecuyer-CMRG" }); setSeed(1); nextRNGStream(getRandomSeed())`; corresponding `nextRNGSubStream`; repeated jump sequence `stream → stream → stream`; mixed sequence `stream → substream → stream`. Fixture `test/fixtures/rngStreams.json`, blob `1355f6e7efe30f8e1d01b6ba1843ff75b6c502ec`, R 4.5.2 x86_64, includes resulting seven-word states, first five uniforms and next uniform.
- The existing `test/random-kinds.test.ts` independently reconstructs each transition matrix by BigInt repeated squaring from the published MRG32k3a recurrence and compares the jump outputs. Test source was inspected but not executed. Arithmetic bound check: each split product and intermediate modular sum remains below 2^53, so integer arithmetic is exactly representable in binary64.
- Result: `一部監査・問題未検出`. No matrix/layout defect established by source review. No Issue filed. No Vitest, standalone harness, or fresh R execution.



## Audit #132

- Repository HEAD before ledger update: `ff8994e573a5d1731aaf1e26d633ee907cc1bdcf`.
- Target: `src/random/lecuyer.ts`, blob `7bd112bb422a4e4b8dd2bbcf3badaa4da4efe4c3`.
- Algorithm review: MRG32k3a moduli M1=4294967087 and M2=4294944443; 50-step LCG seed scrambling and rejection of seed words >=M2; component recurrences and state shift order; combined output (p1-p2 mod M1)/(M1+1); exact integer arithmetic bounds (<2^53); import/export of six state words with R's signed Int32 representation; all-zero first component and out-of-range state rejection.
- Exact inputs inspected (not executed): `RNGkind({ kind: "L'Ecuyer-CMRG" }); setSeed(1); runif(10)`; same with seeds `42`, `2024`, `2147483647`, and `-2147483647`; restoration with `setRandomSeed([10407, 1, 2, 3, 4, 5, 6]); runif(5)`. The `test/fixtures/rngLecuyer.json` fixture identifies R 4.5.2 x86_64 and records uniforms, resulting states and next-uniform values. The fixture was inspected, not executed.
- Result: `一部監査・問題未検出`. No recurrence, modulus, seed-expansion, or state-layout defect established by source review. The implementation deliberately throws for invalid states where R may reseed from the clock; this is a documented API behavior difference, not treated as a random-number algorithm defect. No Issue filed. No Vitest, standalone harness, or fresh R execution.



## Audit #133 — `src/random/mt.ts`

- Repository HEAD: `77d0da9eaa12609d445d0433e4d3ac0d84f50600`; source blob `a27a644a591ab2286227aa5db1b05b16fa149300`.
- Reviewed MT19937 state length 624, twist loop split at N-M=227, wraparound dependency, tempering shifts/masks, R's 50-step 69069 LCG seed expansion, unsigned 32-bit wrap, uniform endpoint fixup, and .Random.seed import/export.
- Exact fixture inputs inspected (not executed): `setSeed(1); runif(10)`, `setSeed(42); runif(10)`, `setSeed(-7); runif(10)`, `setSeed(123456789); runif(10)`. R 4.5.2 fixture `test/fixtures/rbasic.json` blob `fafabb128e79ef73b5c5c923a8b223f84ebe490e`; associated expected sequences and next-uniform values inspected.
- Result: `一部監査・問題未検出`. No MT recurrence or state conversion defect established. Vitest and independent execution not run.

## Audit #134 — `src/random/continuous.ts`

- Repository HEAD: `77d0da9eaa12609d445d0433e4d3ac0d84f50600`; source blob `5ad76e5676b4bf27c36b288f8e48ac3821bfd92a`.
- Reviewed `runif`, `rnorm1/rnorm`, `rexp`, `rlnorm`, `rlogis`, `rcauchy`, `rweibull`: parameter guards, transform formulas, scale/rate zero and infinity, nonfinite location/mean, overflow-width interpolation, and RNG stream consumption.
- Exact inputs inspected (not executed): `setSeed(1); runif(5,{min:0,max:1})`; `setSeed(1); runif(5,{min:-3,max:5})`; `setSeed(2); rnorm(5,{mean:5,sd:Infinity})`; `setSeed(3); rexp(5,{rate:Infinity})`; `setSeed(24); rlogis(10,{location:0,scale:-1})`; `setSeed(26); rweibull(10,0,{scale:1})`. R 4.5.2 fixtures `rbasic.json` and `rother.json` inspected.
- Known discrepancy confirmed by fixture: for `rlogis` with negative scale, the implementation returns NaN after consuming a uniform, whereas R returns the finite values with their signs reversed. The test suite explicitly classifies this as a known difference. Not filed as a new issue in this pass because it is already recorded in test behavior; it remains a compatibility gap.
- Result: `既知差異あり・追加問題未検出`. No Vitest or fresh R execution.

## Audit #135 — `src/random/as241.ts`

- Repository HEAD: `77d0da9eaa12609d445d0433e4d3ac0d84f50600`; source blob `3e7d42b5c0d867cc1bfe06f2f335d83994dbd7c3`.
- Reviewed Wichura AS 241 coefficient arrays A-F, Horner polynomial evaluation order, central region `|p-0.5| <= 0.425`, tail transformation `sqrt(-log(min(p,1-p)))`, branch boundary r=5, and sign restoration. Compared domain with `normRand` construction, whose p stays away from 0 and 1.
- Result: `一部監査・問題未検出`. No coefficient/order/branch defect established by source review. No independent high-precision computation or Vitest execution.

## Audit #136 — `src/random/common.ts`

- Repository HEAD: `77d0da9eaa12609d445d0433e4d3ac0d84f50600`; source blob `be016a36e9f09f580462d2bf93e30ed6bad527c1`.
- Reviewed `generate` finite/nonnegative n validation, truncation, zero-length behavior and lazy callback invocation; reviewed `powInt` for NaN, infinities, zero/negative exponents and exponentiation by squaring.
- Potential concern: `powInt` uses signed 32-bit bitwise operators (`n & 1`, `n >>= 1`), so exponents at or above 2^31 are not handled safely and can fail to terminate. However, repository call sites and reachable exponent bounds were not exhaustively resolved in this pass; therefore this is recorded as a review lead, not a confirmed defect. Exact probe input for a future isolated harness: `powInt(0.5, 2147483648)` (do not execute synchronously; current loop may not terminate).
- Result: `一部監査・問題未検出（powIntの巨大指数は要追跡）`. No Vitest or isolated execution.

## Audit #137 — `src/random/rng.ts`

- Repository HEAD: `77d0da9eaa12609d445d0433e4d3ac0d84f50600`; source blob `f527fd7018642205ef5870df8fcab8fc9e02aff1`.
- Reviewed global generator selection, seed initialization, kind code mapping, RNGkind's previous-kind return and seed handoff, state import/export, Rejection/Rounding index generation, 16-bit chunked rbits, two-uniform normal inversion input, and Ahrens-Dieter exponential algorithm SA.
- Exact fixture inputs inspected (not executed): `setSeed(1); runif(10)`; `RNGkind({kind:"L'Ecuyer-CMRG",sampleKind:"Rounding"}); setSeed(42); runif(3)`; `setSeed(3); sampleInt(4500000000000000,{size:5,replace:true})`; `setSeed(24); rlogis(10,{location:0,scale:-1})`. Fixtures `rngRounding.json`, `rngLecuyer.json`, `rngStreams.json`, `rbasic.json`, and existing `random-kinds.test.ts` inspected, not executed.
- Known compatibility differences: negative-scale `rlogis` output differs from R; BTPE `rbinom` can consume a different stream due to the already-documented Stirling-correction difference; invalid L'Ecuyer state handling throws rather than R's clock reseed. No additional defect established.
- Result: `既知差異あり・追加問題未検出`. No Vitest, standalone harness, or fresh R execution.
