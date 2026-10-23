# ロードマップ

[English](ROADMAP.md) | 日本語

> この文書は [英語版](ROADMAP.md) の訳です。内容が食い違うときは英語版が正です。

## 目標

R の `stats` パッケージ (と `base` の関連部分) の数値計算の中核を、R と同じ関数名・既定値・数値
結果のまま、素の TypeScript でカバーすること。対象は分布、仮説検定、特殊関数、線形代数の基本です。
R を oracle とし、すべての関数を R の出力と照合します。R 自身が不正確な箇所では高精度の参照値と
照合します ([docs/ja/accuracy.md](docs/ja/accuracy.md) を参照)。

狙いは空白を埋めることです。JavaScript には分布と特殊関数のライブラリ (正確で範囲も広い
[stdlib-js](https://github.com/stdlib-js/stdlib) など) や記述統計のライブラリがあり、R 自体も
WebAssembly (webR) でブラウザ上で動きますが、その代わりに数十 MB のダウンロードが要ります。
欠けているのは、分布から仮説検定まで、R の `set.seed()` の乱数列も含めて、結果が R と一致すると
信頼できる軽いライブラリです。

SciPy (`scipy.stats`、`scipy.special`、`scipy.linalg`) は移植元のコードであり、何が役に立つかの
手がかりでもありますが、目標ではありません。R に対応するもののない関数は R と照合できないので、
優先しません。

## 完了したこと

| 分野 | 状況 |
|---|---|
| 特殊関数 | `gamma`、`lgamma`、`beta`、`lbeta`、`choose`、`lchoose`、`factorial`、`lfactorial`、`digamma`、`trigamma`、`psigamma`、`besselI`、`besselK`、`besselJ`、`besselY` を export。不完全ガンマ関数・不完全ベータ関数、erf/erfc、log1p 系の関数は内部で実装済み |
| 分布 | R の `stats` にある 20 の分布すべて (スチューデント化された範囲を含む) と、非心カイ二乗・t・F・ベータ分布の d/p/q (`lowerTail` と `logP` 付き) |
| 乱数 | R の既定の Mersenne-Twister と `set.seed()` 互換の乱数列、20 の `r*` 関数、`rmultinom`、`sample`、`sampleInt` |
| 仮説検定 | `tTest`、`chisqTest`、`fisherTest` (r × c を含む)、`wilcoxTest` (正確法と近似法、信頼区間付き)、`cor`、`corTest`、`pAdjust`。R の `htest` のフィールドをすべて返す |
| 線形代数 | R の `base` の行列関数と `MASS::ginv`: `crossprod`、`norm`、`backsolve`、`chol`、`qr` (R のピボット選択と LAPACK)、`solve`、`det`、`rcond`、`kappa`、`svd`、`eigen` (対称と一般)、`ginv` |

一覧は [README](README.ja.md#含まれるもの) に、R との既知の違いは
[docs/ja/differences-from-r.md](docs/ja/differences-from-r.md) にあります。

## 残っていること

優先度の高い順です。

1. **仮説検定:** R の `stats` にある残りの検定。JavaScript で最も空白が大きいのはここです:
   `binom.test`、`prop.test`、`poisson.test`、`mcnemar.test`、`mantelhaen.test`、`ks.test`、
   `shapiro.test`、`kruskal.test`、`friedman.test`、`quade.test`、`var.test`、`bartlett.test`、
   `fligner.test`、`ansari.test`、`mood.test`、`oneway.test` と `pairwise.*` の補助関数。
   `chisqTest` と `fisherTest` の `simulate.p.value`、`chisqTest` に 2 つの因子ベクトルを渡す
   使い方も。
2. **特殊関数:** R のない環境で追加した特殊関数 (`choose`、`lchoose`、`factorial`、
   `lfactorial`、`digamma`、`trigamma`、`psigamma`、ベッセル関数) の R のフィクスチャ (今は
   mpmath でのみ照合。oracle は作成済み)。R にはないが rStats.js が内部で実装済みの関数 (erf/erfc、log1p 系の関数) は、
   おまけとして export してもよい。
3. **分布:** 分布のパラメータをベクトルとして与えたときのリサイクル。`dmultinom`。
4. **速度:** 必要な箇所だけ double-double に切り替える高速な倍精度の経路と、パラメータが大きい
   ときの不完全ベータ関数の漸近展開 ([docs/ja/performance.md](docs/ja/performance.md) を参照)。
5. **乱数:** R の既定以外の RNG の種類。

いずれ取り組むかもしれないもの (どれもそれ自体が大きなプロジェクト):

- **線形モデル:** 行列インターフェースの `lm` と `glm` (JavaScript には式もデータフレームも
  ないため)。
- **`base` を超える線形代数:** LU 分解、Schur 分解、行列指数関数。推奨パッケージ `Matrix` と
  `expm` パッケージで照合する。
- **最適化:** `optim`、`optimize`、`uniroot`、`integrate`。

対象外: SciPy のうち R に対応するもののない部分 (`scipy.special` の大部分と、`scipy.stats` にしか
ない分布)。

## サイズ

バンドラを使う利用者には import した関数だけが入るので (`pnorm` だけなら gzip 後 1.2 KB)、関数を
増やしても利用者の負担にはなりません。単一ファイルの CDN 用ビルド `dist/rstats.js` にはすべてが
入っています (0.5.0 で gzip 後 72 KB)。これが gzip 後 100 KB ほどを超えたら、esbuild のコード分割を
使って分野ごとのエントリファイル (`dist/distributions.js`、`dist/tests.js`、`dist/linalg.js` など) を
追加し、共通のコードが重複しないようにします。`dist/rstats.js` はすべてを含むビルドとして残します。
npm に公開した後は、export 単位でバンドルする CDN (`?exports=` を付けた esm.sh など) も選択肢に
なります。

## 移植するコードの出典

- 寛容なライセンスの出典からのみ移植する: SciPy と xsf (BSD-3)、Boost.Math (BSL-1.0)、
  statsmodels (BSD-3)、lifelines (MIT)、LAPACK のリファレンス実装 (修正 BSD)、パブリック
  ドメインのコード (LINPACK、EISPACK、xsf とともに配布されている Cephes)、公表された論文。
- R は、何を返すかを観察するための oracle としてのみ使う。rStats.js が MIT ライセンスのままで
  いられるよう、R のソースコードと GPL のパッケージは読まず、コピーも翻訳もしない。
- 移植したファイルにはそれぞれ出典を書き、その出典を
  [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) に載せる。
  [CONTRIBUTING.ja.md](CONTRIBUTING.ja.md) も参照してください。
