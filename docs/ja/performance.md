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

## バンドルサイズ

`npm run size` (`scripts/size.mjs`) は、ビルドした `dist/` からの各 import を esbuild でバンドルし、minify して gzip で
圧縮します。tree-shaking により、import した関数とその依存だけが残ります。

| import | minify 後 | gzip |
|---|---|---|
| `pnorm` | 2.3 KB | 1.2 KB |
| `setSeed`、`rnorm` | 3.4 KB | 1.7 KB |
| `solve` / `svd` / `eigen` | 3.8 / 4.5 / 9.6 KB | 1.7 / 2.0 / 3.7 KB |
| `wilcoxTest` | 28.5 KB | 12.1 KB |
| `fisherTest` | 32.2 KB | 15.6 KB |
| `tTest` | 54.3 KB | 24.9 KB |
| `qbeta` | 49.7 KB | 23.2 KB |
| `pt`、`qt` | 63.8 KB | 30.3 KB |
| `glm`、`glmSummary` / `glm` とすべてのメソッド | 62.7 / 88.7 KB | 27.2 / 39.2 KB |
| すべて | 491.5 KB | 185.8 KB |
| `@numero-uno-jpn/rstats/distributions` (全体) | 171.4 KB | 67.8 KB |
| `@numero-uno-jpn/rstats/tests` (全体) | 358.6 KB | 140.9 KB |
| `@numero-uno-jpn/rstats/linalg` (全体) | 48.9 KB | 18.1 KB |
| `@numero-uno-jpn/rstats/descriptive` (全体) | 40.9 KB | 15.4 KB |
| `@numero-uno-jpn/rstats/numerics` (全体) | 47.8 KB | 20.7 KB |
| `@numero-uno-jpn/rstats/special` (全体) | 57.9 KB | 26.8 KB |

サブパスの行は、その分野だけをバンドルした大きさです。CDN 向けの分野ごとのファイル (`dist/<area>.js`) は分野の間でコードを
`dist/chunks/` で共有するため、そこから 1 分野を読み込むと転送量はこれより多くなります。chunk を含めて gzip で 29 KB
(`numerics`) から 153 KB (`tests`) です。`pt` が大きいのは、非心 t と double-double の部品が一緒に入るためです。formula 版の
ある検定には、formula とモデルフレームのコードが入ります。

## 測り方

Apple M1 (Mac mini)、Node.js 24、`tsc` によるビルド、2026-10-26 (版 0.11.0)。分布関数と `tTest` は `npm run bench`
(`scripts/bench.mjs`) で、1 回ずつ呼び出し、5 回の実行の最小値です。入力はライブラリ自身の `setSeed`/`runif` で生成するので、
どのビルドにも同じ入力が渡ります。線形代数は、20 回 (n = 300 では 3 回) の呼び出しの平均の、5 回の実行の最小値です。R 4.5.2
(arm64) は同じマシンのコンテナで、同じ種類の入力を R 自身の乱数で作って測りました。

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
