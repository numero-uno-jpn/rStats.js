# 計画: jStat の全機能をカバーする (クラウドのセッションへの作業指示)

2026-10-24 作成 (Mac mini のセッション)。リリースに含めない一時文書。完了したら削除する。

関連する文書:
- [jstat-r-reference.md](jstat-r-reference.md): 照合に使う R の結果 (fixture) の一覧と、R の挙動の要点
- [jstat-inventory.md](jstat-inventory.md): jStat 1.9.6 の全関数の洗い出し (引数・既定値・バグ)

## Context

ReactiveStat は手軽さから jStat を使っているが、jStat は精度が低く、バグもある。例:
- `percentile` は k が 1 に近いと誤る
- `pareto.mean` と `uniform.median` が誤る
- `cubic_spline` は呼ぶと壊れる
- 不完全ベータの収束判定が 3e-7

rStats.js は分布・特殊関数・t 検定・行列分解なら置き換えられる。しかし、記述統計・行列演算・ANOVA などの検定・回帰・数値計算・R にない分布が抜けている。

目標は、jStat の各機能に対応するものを rStats.js に用意し、移行の手引き 1 枚で置き換えられるようにすること。関数名と引数は jStat に合わせず、R の名前と既定値にする (rStats.js の方針どおり)。

ユーザーが決めたこと (2026-10-24)
- jStat の網羅を ROADMAP の最優先にする。残りの仮説検定はその後に回す (クラウド側がすでに作ったものは R との照合を進める)
- R にない機能は R のパッケージ (extraDistr・e1071・DescTools・pracma・deSolve・numDeriv・BSDA) と照合する。パッケージに無いものだけ mpmath か定義式と照合する
- 分布の平均・分散・最頻値・中央値・歪度・尖度を返す関数を用意する
- ReactiveStat のコードは見ない。jStat の全機能を同じ重みで扱う
- R のソースは、挙動を確かめるために読んでよい (むしろ読むべき)。写すのは不可。移植元は今までどおり BSD/BSL/MIT/パブリックドメインに限る
- 実装はクラウドのセッションが行う。Mac mini は R の結果をそろえて渡し、照合を手伝う

## jStat → rStats.js の対応 (全体像)

○ = すでにある、◎ = この計画で追加する。細目は jstat-inventory.md。

| jStat | rStats.js |
|---|---|
| 分布 17 種 (normal, studentt, centralF, chisquare, beta, gamma, lognormal, exponential, uniform, cauchy, weibull, binomial, negbin, hypgeom, poisson, tukey, noncentralt) の pdf/cdf/inv/sample | ○ d/p/q/r |
| invgamma, kumaraswamy, pareto, triangular, laplace, arcsine | ◎ d/p/q/r (extraDistr の名前と母数。arcsine は尺度を変えたベータ分布) |
| 分布の mean/median/mode/variance | ◎ `distSummary(distribution, params)` (+ sd, skewness, kurtosis) |
| gammaln, gammafn, factorial(ln), combination(ln), betafn, betaln, erf, erfc, lowRegGamma, gammapinv, ibeta, ibetainv | ○ (lgamma, gamma, factorial, lfactorial, choose, lchoose, beta, lbeta, erf, erfc, pgamma, qgamma, pbeta, qbeta) |
| gammap (正規化しない), erfcinv, permutation | ◎ `gammainc`、`erfinv`/`erfcinv`、`perm` |
| randn, randg, setRandom | ○ rnorm, rgamma, setSeed |
| sum, product, mean, median, min/max, range, variance/stdev (flag), cumsum/cumprod, diff, rank, quantiles (α,β), percentile (exclusive), quartiles, covariance, corrcoeff, spearmancoeff | ◎ 記述統計 (Phase 1) |
| mode, geomean, meandev, meddev, coeffvar, skewness, kurtosis, histogram, percentileOfScore, unique, sumsqerr, pooledvariance | ◎ (R とパッケージで照合。sumsqerr = var × (n − 1)、pooledvariance は aov の残差平均平方で代える) |
| add/subtract/multiply/divide/dot/outer/pow/exp/log/abs/transpose/aug/diag/zeros/ones/identity/seq/arange | ◎ 行列演算とユーティリティ (Phase 2)。pow/exp/log/abs は配列の map で書ける (手引きに例) |
| inv, det, cholesky, QR, lstsq, jacobi (固有値) | ○ solve, det, chol, qr/qrSolve, eigen |
| lu, gauss_elimination/gauss_jordan/反復解法 (jacobi, seidel, SOR), householder, PCA | ◎ `lu`、`prcomp`。解法は solve、三重対角化は eigen で代える (手引きに書く) |
| anovafscore/anovaftest, tukeyhsd, qscore/qtest, difference of proportions, ztest/zscore, normalci, tci, ftest | ◎ `aov` の一元配置の表・`TukeyHSD`・`zTest`、作成済みの `onewayTest`・`propTest`。tci は tTest、ftest は pf (○) |
| models.ols, regress, regresst | ◎ `lm` (行列のインターフェース) + summary 相当 |
| simpson, romberg, gauss_quadrature | ◎ `integrate` (QUADPACK のコアは作成済み) |
| lagrange, hermite, cubic_spline | ◎ `approx`/`spline`/`splinefun`/`splinefunH`、Lagrange (pracma::barylag)、導関数つきの Hermite 補間 |
| rungekutta | ◎ `ode` (固定刻みの euler/rk2/rk4。deSolve と照合) |
| richardson (数値微分) | ◎ `grad`/`hessian`/`jacobian` (numDeriv) |
| jStat オブジェクト・チェーン・slice など | 対応しない。JS の配列操作で書ける例を手引きに載せる |

## 担当するファイル

| | クラウド側 | Mac mini |
|---|---|---|
| 実装 | `src/` の新しいモジュールと既存ファイルの変更、`src/index.ts` | (触らない) |
| テスト | `test/` (helpers を含む) | (触らない) |
| fixture | `test/fixtures/*.mpmath.json`、`*.scipy.json`、`*.ref.json` (mpmath で作るもの) | `test/fixtures/<R の名前>.json` (oracle が書くもの) |
| oracle | `oracle/*.R` の新規作成も可 (実行は Mac に頼む) | `oracle/`、`scripts/oracle.sh`、`oracle/Dockerfile` |
| 文書 | README・ROADMAP・CHANGELOG・CONTRIBUTING・docs (移行の手引きを含む) | `docs/plans/` |

`oracle/*.R` を直したい・足したいときは、ファイル名を伝えてから書く。実行は Mac が行う (R のイメージは Mac にしか無い)。

## 進め方 (フェーズ順)

フェーズごとにコミットする。テストは Mac が作った fixture と照合する。fixture の一覧と R の挙動の要点は jstat-r-reference.md にある。

### Phase 0: 準備
1. ~~oracle のイメージ~~ (Mac が作成済み。`oracle/Dockerfile`)
2. **ビルドの分割**: この計画で gzip 100 KB を確実に超えるので先にやる。
   - `scripts/bundle.mjs` を esbuild の code splitting にする
   - 分割の単位: `dist/distributions.js`・`tests.js`・`linalg.js`・`descriptive.js`・`numerics.js`・`special.js`
   - `dist/rstats.js` (全部入り) は残す
   - package.json の exports にサブパスを足す
   - `scripts/size.mjs` で分野ごとの大きさを報告する
3. **方針の文書**: CONTRIBUTING (英・日) と ROADMAP にある「R のソースは読まない」を直す。挙動を確かめるために読むのはよく、写すのは不可。
4. **移行の手引き**: `docs/migrating-from-jstat.md` (英・日) を作る。jStat の全関数 → rStats.js の対応、既定値の違い、jStat のバグを載せる。
   - 既定値の違いの例: jStat の variance は母分散が既定、quantiles は R の type 9、percentile は type 7 (exclusive なら 6)、gamma は scale、weibull は (scale, shape) の順、negbin は失敗の数
   - `test/fixtures/jstat-api.json`: jstat-inventory.md から jStat の全関数名を機械的に読める形にしたもの
   - `test/jstat-coverage.test.ts`: jStat の全関数名が手引きの表に載っていることを確かめる。未実装は「planned」と書き、計画の終わりに 0 件にする。これを網羅の完了条件にする

### Phase 1: 記述統計 (`src/descriptive/`)
- R と同名で作るもの:
  - `sum`、`prod`、`mean` (`trim`)、`weightedMean`、`var`、`sd`
  - `median`、`quantile` (`type` 1〜9、既定 7)、`IQR`、`mad`、`fivenum`、`range`
  - `cumsum`、`cumprod`、`cummax`、`cummin`、`diff`
  - `rank` (`tiesMethod`、`naLast`)
  - `cov`・`cor` の行列版 (今の `cor` を広げる)
  - `scale`、`tabulate`・`table`、`unique`、`cut`・`findInterval`、`hist`、`ecdf`
- R にないもの: `skewness`・`kurtosis` (e1071 の type)、`geometricMean`・`modes`・`meanAD` (DescTools)、`cv` (DescTools::CoefVar)
- 共通の引数: `naRm` (NaN を NA とみなす今の方針どおり)
- 使い回すもの:
  - `src/internal/summary.ts` の `meanDD`・`variance`・`covariance`・`sum`・`rank`・`tieCounts`
  - `src/htest/wilcoxTest.ts` の `sortedMedian`・`signif2` (`src/internal/` へ移す)
  - `src/htest/cor.ts` の `pearsonDD`・`ddSqrt`・`scaledDeviations`
- `hist` の既定の区切りには R の `pretty` が要る (C の R_pretty。jstat-r-reference.md を参照)
- デモに記述統計のタブを足す

### Phase 2: 行列演算とユーティリティ (`src/linalg/`)
- 作るもの:
  - `matMul` (R の `%*%`)
  - 要素ごとの `add`・`subtract`・`multiply`・`divide` (スカラーとの演算、R の再利用規則)
  - `outer`、`t`、`diag` (R の 3 つの意味)、`cbind`・`rbind`、`matrix`、`kronecker`、`seq`
  - `lu` (Matrix::lu)、`prcomp`
- 使い回すもの: `src/linalg/matrix.ts` の `Mat`・`toMat`・`fromMat`・`toMatOrColumn`。行列の受け渡しは今の形 (行の配列) にそろえる。

### Phase 3: jStat と重なる検定 (`src/htest/`)
- 作るもの: `aov` の一元配置の表、`TukeyHSD`、`zTest` (BSDA::z.test)
- クラウド側が作成済みの検定は、R の fixture との照合で残った不一致を片づける (jstat-r-reference.md の「作成済みの検定」)。そのあと export して文書に載せる。

### Phase 4: 回帰 (`src/models/lm.ts`)
- `lm(x, y, { intercept, weights })` を作る。x は行列で、式は使わない。
- 返すもの: coefficients (別名の列は NaN)・residuals・fittedValues・rank・dfResidual
- summary 相当で返すもの: 係数の表・sigma・R²・adjR²・F と p
- ほかに `confint` と `predict` (`interval`) を作る。
- R の lm は LINPACK の dqrdc2 (ピボットの規則が LAPACK と違う、許容値 1e-7) を使う。ランク落ちの列の選び方は R の出力で確かめる。

### Phase 5: 数値計算 (`src/numerics/`)
- `integrate`: 作成済みの `src/integrate/quadpack.ts` の dqagse・dqagie を使う。
- `optimize`: 作成済みの `src/optim/localmin.ts` を使う。
- `uniroot`: `src/internal/uniroot.ts` を公開する (`extendInt` を足す)。
- 補間: `approx`、`spline`・`splinefun`・`splinefunH`、Lagrange 補間 (pracma::barylag)、導関数つきの Hermite 補間。
- `ode`: 固定刻みの euler・rk2・rk4。
- `grad`・`hessian`・`jacobian`: numDeriv の Richardson 法 (と simple・complex)。

### Phase 6: R にない分布と分布の要約 (`src/distributions/`)
- invgamma・kumar・pareto・triang・laplace の d/p/q/r (extraDistr と同じ名前と母数)、arcsine の d/p/q/r
- r 関数は extraDistr と同じ乱数の使い方にする (jstat-r-reference.md)。arcsine の r は R の参照が無い
- `distSummary`: 既存と新しい全分布の mean・variance・sd・median・mode・skewness・kurtosis
- R が不正確な点の参照値は mpmath で作る (閉じた形がある)

### Phase 7: 特殊関数の残りと仕上げ
- 作るもの: `gammainc` (正規化しない lower/upper とその対数)、`erfinv`・`erfcinv`、`perm`
- 仕上げ:
  - 移行の手引きの「planned」を 0 にする
  - デモの全タブ、README・CHANGELOG・ROADMAP (英・日) を更新する
  - `NOT_IN_DEMO_YET` を空にして、リリースする (タグの push で release.yml が npm に公開する。タグを打つ前にユーザーに確認)

## Mac に頼むこと
- fixture の追加・作り直し (ケースを足したい、R の挙動を確かめたい)。依頼には oracle のファイル名と、足したいケースを書く。
- R が不正確な点の Rmpfr の参照値 (`npm run refresh-references`)。mpmath で作れるものはクラウド側で作ってよい。
- `npm run demo:r` (デモの例の R の値)。

## 確かめ方
- フェーズごと: `npm run typecheck`、`npm test`、`npm run build`、`npm run size` (分野ごとの大きさ)
- 合わない点は Rmpfr か mpmath の参照値で、どちらが正しいか判定する。わざと R と違う点は `knownDifference` にし、`docs/differences-from-r.md` に書く
- 網羅: `test/jstat-coverage.test.ts` で、jStat の全関数が手引きに載り、「planned」が 0 件であること
- 置き換えの確認: 手引きの例 (jStat の呼び出しと rStats.js の呼び出し) をテストとして実行し、jStat の値 (正しいもの) と rStats.js の値が一致することを確かめる。jStat のバグの箇所は除き、そのことを手引きに書く (jStat は照合のためだけに devDependency として入れる)
