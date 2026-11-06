# 性能

[English](../performance.md) | 日本語

rStats.js は精度を最優先にしています。分布関数は遠い裾でも真の値との差を 1e-14 以内に保っています ([accuracy.md](accuracy.md)
を参照)。その分 R より遅く、分布関数で 4〜30 倍 (d/p 関数の多くは 10 倍ほど)、線形代数で 3〜25 倍かかります。それでも 1 回の
呼び出しは 1 µs 程度 (分位点関数は数〜15 µs)、ふつうの標本の検定なら 1 ms を大きく下回ります。

## 分布

1 回あたりの µs (1 回ずつ呼び出し)。R の列は、同じマシンの R 4.5.2 で、同じ種類の入力をまとめて 1 回の呼び出しで計算し、
件数で割った値です。

| 関数 | rStats.js | R |
|---|---|---|
| `pbeta` | 1.6 | 0.16 |
| `dbeta` | 0.94 | 0.11 |
| `pt` | 1.2 | 0.12 |
| `pgamma` | 0.66 | 0.17 |
| `pf` | 1.5 | |
| `pchisq` | 0.52 | |
| `dt` / `dgamma` | 0.62 / 0.47 | |
| `dbinom` / `pbinom` | 0.54 / 1.4 | |
| `pnbinom` | 12.2 | |

| 分位点関数 | rStats.js、典型 | rStats.js、裾 | R、典型 | R、裾 |
|---|---|---|---|---|
| `qbeta` | 15.2 | 14.9 | 0.91 | 2.7 |
| `qt` | 8.8 | 9.8 | 0.33 | |
| `qgamma` | 4.8 | 4.0 | | |
| `qchisq` | 4.3 | | | |
| `qf` | 11.4 | | | |

「典型」の入力は、形状パラメータが 0.5〜50 の対数一様、p が 0〜1 の一様です。「裾」の入力は、形状パラメータが 0.1〜1e4、p が
1e-5〜1e-300 です。結果は R と同じです ([accuracy.md](accuracy.md) を参照)。差は double-double 演算の分です (下の参考情報を
参照)。

**パラメータが大きくても時間は一定です。** `pbeta(0.5, a, a)` は a が 1000〜1e6 のどれでも 1.0 µs (a = 10 では 2.4 µs)、
`pbinom(n/2, n, 0.5)` は n が 1e3〜1e6 で 1.0〜1.1 µs、自由度 1e6 の `pt` は 1.1〜1.3 µs、分母の自由度 1e5 の `pf` は 1.2〜2.0
µs です。自由度 1e6 の `qt` は 4.0 µs、`qf(p, 5, 1e5)` は 7.5 µs、`qbeta(p, 1e6, 2.5)` は 17.1 µs、`qbinom(p, 1e6, 1e-5)`
は 3.0 µs です。

**検定:** `tTest` (Welch、30 個と 25 個) は 17.3 µs です。大半は信頼区間のための `qt` です。

## 線形代数

標準正規の値の行列 (`chol` は AᵀA + nI、対称の `eigen` は (A + Aᵀ)/2)。1 回あたりの ms。R は 4 スレッドの OpenBLAS 0.3.26
(ブロック化した LAPACK と SIMD) を使います。rStats.js はブロック化しない素直なループです。

| 操作 | n = 100: rStats.js | R | n = 300: rStats.js | R |
|---|---|---|---|---|
| `qr` | 0.76 | 0.25 | 18.4 | 4.9 |
| `solve` (右辺 1 本) | 0.48 | 0.10 | 11.0 | 1.0 |
| `chol` | 0.22 | < 0.05 | 4.7 | 0.20 |
| `svd` | 6.5 | 1.3 | 162 | 15.3 |
| `eigen` (対称) | 4.0 | 0.95 | 96 | 7.7 |
| `eigen` (一般) | 10.7 | 3.5 | 263 | 32.9 |

統計でよくある大きさの行列 (列が数十まで) なら、1 回の呼び出しは 1 ms 未満から数 ms です。

## 混合モデル

`lmer` (REML) のデータからの当てはめ 1 回 (構造を作る処理を含む) の時間で、3 回の中央値です。lme4 2.0.6 は既定の
最適化で、同じデータ (`scripts/lmer-timing.mjs` の乱数の種つき生成器から書き出したもの) を当てはめた 3 回の中央値です。
どちらも疎なコレスキー分解を使います。rStats.js の推定値での基準の値が lme4 より大きくなることはありませんでした。

| モデル | n | q | rStats.js | lme4 |
|---|---|---|---|---|
| `y ~ x + (1 \| s) + (1 \| i)`、被験者 200 × 項目 100 の交差 | 20000 | 300 | 0.59 秒 | 0.20 秒 |
| 同じモデル、500 × 200 | 100000 | 700 | 4.13 秒 | 1.51 秒 |
| `y ~ x + (x \| s)`、被験者 1000 人 × 10 | 10000 | 2000 | 0.20 秒 | 0.07 秒 |
| 同じモデル、被験者 5000 人 × 10 | 50000 | 10000 | 0.87 秒 | 0.35 秒 |

変量効果の項が 2 つ以上あると、当てはめの時間は局所的な最小化だけのときのおよそ 2 倍です (0.14.0 では交差のモデルで
0.32 秒と 2.09 秒)。最小化の後で、項を 1 つ外した境界の点からそれぞれ最小化し直して比べるためです
([differences-from-r.md](differences-from-r.md) の「局所解」を参照)。小さいモデル (fixture の例: 数百行まで) は 0.1〜7 ミリ秒です。`node scripts/lmer-timing.mjs` で、当てはめと基準の
1 回の評価の時間を測れます。

`lmerSummary` (Satterthwaite の自由度。逸脱度の解析的なヘッセ行列と、固定効果の共分散のヤコビアン) は、当てはめの
後に 0.03 秒 (交差 200 × 100)、0.25 秒 (500 × 200)、0.01 秒 (被験者 1000 人)、0.04 秒 (被験者 5000 人) を要します
(Node 24、arm64)。

`glmer` の当てはめ 1 回の時間です (断らなければラプラス近似。乱数の種つき生成器のデータで、群の切片の標準偏差 0.5、
一様分布の説明変数 1 つ)。Apple M1 (Mac mini)、Node.js 24、2026-11-05 のコード (0.17.0 の後) で測りました。逸脱度の
勾配は解析的に求めるため、時間はおよそ行数に比例します。lme4 は最適化と罰則つき IRLS を早めに止めるので、これらを
1 秒よりずっと短く当てはめます (rStats.js の推定値は厳密な最適点です)。大きさの上限はありません。100000 行で約 13 秒です。

| モデル | n | rStats.js |
|---|---|---|
| poisson `y ~ x + (1 \| g)`、100 群 | 20000 | 2.2 秒 |
| binomial `y ~ x + (1 \| g)`、200 群 | 20000 | 2.4 秒 |
| binomial `y ~ x + (1 \| g)`、500 群、`nAGQ = 100` | 5000 | 4.7 秒 |
| poisson `y ~ x + (1 \| g) + (1 \| h)`、200 × 37 の交差 | 4000 | 1.6 秒 |
| poisson `y ~ x + (x \| g)`、200 群 | 4000 | 1.6 秒 |
| poisson で説明変数 9 つ `+ (1 \| g)`、200 群 | 4000 | 1.5 秒 |
| poisson `y ~ x + (1 \| g)`、1000 群 | 100000 | 12.9 秒 |

## バンドルサイズ

`npm run size` (`scripts/size.mjs`) は、ビルドした `dist/` からの各 import を esbuild でバンドルし、minify して gzip で
圧縮します。tree-shaking により、import した関数とその依存だけが残ります。

| import | minify 後 | gzip |
|---|---|---|
| `pnorm` | 3.1 KB | 1.6 KB |
| `setSeed`、`rnorm` | 4.0 KB | 2.0 KB |
| `solve` / `svd` / `eigen` | 5.6 / 5.2 / 12.7 KB | 2.4 / 2.4 / 5.1 KB |
| `wilcoxTest` | 46.7 KB | 18.9 KB |
| `fisherTest` | 61.8 KB | 27.7 KB |
| `tTest` | 70.9 KB | 31.0 KB |
| `qbeta` | 97.8 KB | 43.5 KB |
| `pt`、`qt` | 89.0 KB | 40.0 KB |
| `glm`、`glmSummary` / `glm` とすべてのメソッド | 85.0 / 121.4 KB | 35.0 / 51.0 KB |
| すべて (`/mixed` を除く) | 669.6 KB | 251.5 KB |
| `@numero-uno-jpn/rstats/distributions` (全体) | 241.0 KB | 95.1 KB |
| `@numero-uno-jpn/rstats/tests` (全体) | 490.1 KB | 190.0 KB |
| `@numero-uno-jpn/rstats/linalg` (全体) | 65.6 KB | 24.1 KB |
| `@numero-uno-jpn/rstats/descriptive` (全体) | 58.8 KB | 21.7 KB |
| `@numero-uno-jpn/rstats/numerics` (全体) | 64.6 KB | 26.3 KB |
| `@numero-uno-jpn/rstats/special` (全体) | 66.8 KB | 29.9 KB |
| `@numero-uno-jpn/rstats/mixed`: `lmer` だけ / lmerTest の検定も | 50.1 / 163.9 KB | 19.4 / 69.6 KB |
| `@numero-uno-jpn/rstats/mixed`: `glmer` だけ / `glmerSummary`・`glmerAnova`・`glmerPredict` も | 116.8 / 159.6 KB | 47.2 / 65.7 KB |
| `@numero-uno-jpn/rstats/mixed` (全体) | 224.8 KB | 91.4 KB |

サブパスの行は、その分野だけをバンドルした大きさです。CDN 向けの分野ごとのファイル (`dist/<area>.js`) は分野の間でコードを
`dist/chunks/` で共有するため、そこから 1 分野を読み込むと転送量はこれより多くなります。chunk を含めて gzip で 38 KB
(`special`) から 206 KB (`tests`) です。`pt` が大きいのは、非心 t と double-double の部品が一緒に入るためです。formula 版の
ある検定には、formula とモデルフレームのコードが入ります。

## 上限

1 本の配列に 2^24 個を超える値を確保する呼び出しや、開発機で 10 秒ほどを超えて走る呼び出しは、確保や計算の前に
RangeError を投げます。正確な検定では、メッセージで回避の方法 (`use exact: false`) を示します。R はその多くを、時間が
かかっても計算するか、メモリが足りなくなります。値と乱数の列を変えずに確保をなくせるものは、なくしました (m + n が 2^24
を超える `rwilcox`、`chisqTest` の適合度のシミュレーション)。

| 関数 | RangeError になる条件 |
|---|---|
| `fisherTest` (2 × 2)、`mantelhaenTest(exact: true)` | 度数の台が 2^24 個を超える。`mantelhaenTest` は合計が 2^53 以上のときも |
| `oddsRatio` | `"midp"` と `"fisher"`: 度数の台が 2^23 個を超える (約 6 秒)、`"fisher"` は 2^31 - 1 を超える度数があるときも。すべての方法: 超幾何分布の p 値に `phyper` の項が 2^26 個より多く要る (度数が 1e13 ほど) |
| `boschlooTest` | (n1 + 1)(n2 + 1) が 2^24 を超える、または局外母数の格子での計算が 2^32 手順を超える (約 8 秒。格子点 max(1000, 32 sqrt(n1 + n2)) 個 × (n1 + 3 n2)。小さい群と 150000 の群など) |
| `ksTest(exact: true)` (1 標本) | 行列のべきに 2^33 回を超える積和が要る |
| `ansariTest(exact: true)`、`jonckheereTest(exact: true)` | 分布に 2^24 個を超える値か 2^32 を超える手順が要る |
| `corTest(method: "kendall", exact: true)` | n が 1290 を超える |
| `pAdjust(method: "hommel")` | n が 65536 を超える |
| `r2dtable`、`chisqTest` (分割表) と `fisherTest` のシミュレーションの p 値 | 総数が 2^24 を超える |
| `chisqTest` の適合度のシミュレーション | `B` と総数の積が 2^27 を超える |
| `dwilcox`、`pwilcox`、`qwilcox` (と 2 標本の正確な `wilcoxTest`) | 表の作成が 2^29 手順を超える |
| 同順位やゼロ差のある `wilcoxTest(exact: true)` (条件付き検定) | 分布 (p 値に 1 回、区間の探索ではスコアの多重集合ごとに作り直す) の作成が 5e9 手順 (約 8 秒) を超えるか、1 つの配列が 2^24 個を超える |
| `phyper` / `qhyper` | 和が 2^26 項を超える / 標準偏差が 2^21 を超える |
| `besselJ`、`besselY`、`besselI`、`besselK` | 級数や漸化式が 2^25 から 2^31 の手順を超える、または double で分解できない位相 |
| `rwilcox` / `rsignrank` | n が 2^24 を超える / n が 2^27 以上 |
| 重み付きの `sample`、`sampleInt` | size が 2^31 以上 (R と同じ) |
| `tapply`、`split`、`aggregate` | 分類のセルが 2^31 個以上 (R の上限と同じ) |
| `expm` (Taylor と Padé の方法) | order × (n^3 + 64) が 2^31 を超える |
| `grad`、`jacobian`、`hessian` (Richardson) | `r` が 512 を超える |

時間と R の動作を含めた詳細は [R との違い](differences-from-r.md) (「意図的な違い」の仮説検定と乱数) にあります。
呼び出し側が求める出力の長さ (`seq`、`approx`、`spline`、`sampleInt`、`r*` 関数) や、`optim` の `maxit` のような反復の
回数には上限がありません。時間はそれに比例して増えます。

## 測り方

Apple M1 (Mac mini)、Node.js 24、`tsc` によるビルド、2026-10-26 (版 0.11.0)。分布関数と `tTest` は `npm run bench`
(`scripts/bench.mjs`) で、1 回ずつ呼び出し、5 回の実行の最小値です。入力はライブラリ自身の `setSeed`/`runif` で生成するので、
どのビルドにも同じ入力が渡ります。線形代数は、20 回 (n = 300 では 3 回) の呼び出しの平均の、5 回の実行の最小値です。R 4.5.2
(arm64) は同じマシンのコンテナで、同じ種類の入力を R 自身の乱数で作って測りました。バンドルサイズは
2026-11-05 に 1.0.0 のコードで測りました (Node.js 24。サイズはマシンによりません)。混合モデルは 2026-10-27 (0.12.0 のコード。`lmer` と `lmerSummary` の当てはめは 0.15.0 のコードで測り直しました) に測りました。混合モデルの lme4 2.0.6 も同じコンテナです。

## 参考情報

コードを変えるときの背景です。ライブラリを使うだけなら要りません。

**遅い理由。** double の精度では 1e-14 に届かないところは、double-double 演算 (2 つの double の評価しない和、約 32 桁。
`src/special/dd.ts`、`src/internal/ddexp.ts`) で計算しています。小さな確率の指数 (Loader の鞍点逸脱度 `bd0`)、不完全ベータ
関数の x と 1 − x の組と連分数、非心分布の Poisson 混合の和、検定の平方和、Wilcoxon とスチューデント化範囲の積分です。誤差の
上界から double で足りると分かるところは double-double の処理を省いています (|x v³| <= 0.12 のときの Loader の級数の残り、`bd0`
の遠い分岐の対数 1 つ、線形スケールの `dbeta`)。連分数は double-double のままです。double にすると、係数の丸めのために誤差が
a + b が 10 未満で 7e-15、1000 付近で 1.5e-13 に達します。

**速さを保っている工夫。**

- 両方のパラメータが大きい不完全ベータ関数 (ab/(a + b) >= 25、x が平均から |τ| <= 1 の範囲) は、長さ √(a + b) の連分数の代わりに
  Temme の一様漸近展開 (`src/special/incbetTemme.ts`) を使います。一方が大きく他方が小さいとき (自由度の大きい `pt`・`pf`、0 や
  n に近い `pbinom`) は DiDonato と Morris の展開 (TOMS 708 の式 9。`src/special/incbetLargeA.ts`) です。どちらも mpmath
  (`scripts/mpmath/largebeta.py`、`smallb.py`) と照合して 1e-15 程度に収まっています。
- よく通る double-double のコードは、`[hi, lo]` の配列を使わないスカラーのコードとして生成しています (`python3 scripts/ddgen.py
  ops | bd0dd | ddlog | scalar | cf`)。同じ演算を同じ順に行うので、結果はビット単位で同じです。
- `ddLog` は 128 点の表と 5 次の多項式を使います (最大の相対誤差 4.4e-32)。
- 連続分布の分位点関数は共通の解法 (`src/internal/invert.ts`) を使います。log x での Halley 法 (対数密度の導関数は閉じた式)、
  1 回の分布関数の計算で線形と対数の両方の値、初期値は Abramowitz と Stegun (`qbeta`、`qf`)、Cornish–Fisher (`qt`)、xsf
  (`qgamma`) です。典型的な `qbeta` は 3.5 回ほどの反復で終わります。

**倍精度モード。** 内部の切替 (`src/special/dd.ts` の `setDoubleDouble`。公開 API ではない) で、double-double の部品をすべて
ふつうの double の演算に置き換えられます。`npm run bench` は両方のモードを (別のプロセスで) 測ります。既定のモードは倍精度
モードの 1.0〜2.3 倍の時間で、倍精度では反復の収束が悪くなる分位点では、既定のモードのほうが速いこともあります。`npm run
precision-report` はテスト全体を両方のモードで流し、誤差を表にします (`reports/precision/report.md`。コミットしない)。倍精度
では fixture の約半分が 1e-14 を満たし、主な d/p 関数の多くは 1e-10 以内に収まりますが、大きく悪化するものもあります (`beta`
3e-5、`pt` 6e-7、離散分布の分位点、±1 に近い Pearson の相関の検定)。

**採用しなかった方法。**

- WebAssembly: `ddLog` を Wasm にしても 1.2 倍しか速くなりませんでした (relaxed-SIMD の積和を使うと 1.6 倍。ただし積和が融合
  されるかはエンジンしだい)。非同期の読み込み、関数ごとの tree-shaking ができないこと、2 つのコードの検証が必要になります。
- 1 <= n <= 15 の、より正確な `stirlerr` (絶対誤差 8e-16 → 1.8e-16): R 自身が 1e-14 ずれている fixture の 2 例が許容の外に
  出ます。速度もほとんど変わりません。
- パラメータだけで決まる項のキャッシュ (`lbeta`、`lgamma`、`stirlerr`): 時間の 1〜6% で、目に見える効果はありませんでした。
