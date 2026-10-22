# 性能

> この文書は [英語版](../performance.md) の訳です。内容が食い違うときは英語版が正です。

rStats.js は精度を最優先にしています。分布関数は遠い裾でも真の値との差を 1e-14 以内に保っています ([accuracy.md](accuracy.md) を参照)。その代わりに速度を犠牲にしています。この文書では、時間がどこにかかっているか、それに対して何をしてきたか、現時点での測定結果を説明します。

## 設計

### double-double 演算

double-double 数は、2 つの double の評価しない和 hi + lo で、有効桁数は約 32 桁です。部品は `src/special/dd.ts` にあります。誤差のない変換 `twoSum`、`quickTwoSum`、`twoProd` (Dekker/Knuth。JavaScript には FMA がないので Veltkamp の分割を使う) と、その上に組んだ `ddAdd`、`ddSub`、`ddMul`、`ddDiv`、`ddLog` などです。`ddExp` は `src/internal/ddexp.ts` にあります。

double の精度だけでは 1e-14 に届かないところで使っています。

- 非常に小さい確率の指数部分。Loader の鞍点法による逸脱度 `bd0` (`src/special/loader.ts` の `bd0dd`) と、指数分布、Weibull 分布、ロジスティック分布、対数正規分布での exp(−t) の引数
- 不完全ベータ関数に渡す x と 1 − x の組や n/(n + t²) のような量、および不完全ベータ関数の連分数 (`src/special/incbet.ts`)
- 非心分布のポアソン混合の和 (`src/internal/poissonMixture.ts`)
- 仮説検定での平方和と積和 (`src/internal/summary.ts`)
- Wilcoxon 順位和分布の q 二項積と、スチューデント化された範囲の積分 (`src/distributions/wilcox.ts`、`tukey.ts`。これらは誤差のない変換を手で書いている)

double-double の経路は、double の精度で足りるふつうの入力も含めて、すべての入力で通ります。

### 展開した式 (`scripts/ddgen.py`)

`[hi, lo]` の配列を返す部品は演算のたびにメモリを確保するので、ホットスポットでは時間の大半がメモリ確保と関数呼び出しに使われていました。そのため、ホットなコードはローカル変数だけで書いています。

- `dd.ts` の `ddAdd`、`ddNeg`、`ddSub`、`ddMul`、`ddMulNum`、`ddDiv`、`ddDivNum` が確保するのは結果の配列だけ
- `ddLog` と `bd0dd` の級数は配列をまったく使わない

これらの展開は `scripts/ddgen.py` で生成しています。

```sh
python3 scripts/ddgen.py ops     # dd.ts の演算
python3 scripts/ddgen.py bd0dd   # loader.ts の bd0dd のうち d = x − M と級数の部分
python3 scripts/ddgen.py ddlog   # ddLog のうち表引きより後の部分
```

このスクリプトは部品と同じ演算を同じ順序で出力するので、展開したコードの結果はビット単位で同じになります。式を変えるときは、スクリプトを編集して生成し直し、出力をその場所に貼り付けます。

### `ddLog`

`ddLog` は x = m 2^k と分解し、m を最も近い表の点 c = i/128 で割って、log m = log c + 2 atanh((m − c)/(m + c)) を 5 次の固定した Horner 多項式で計算します。log c の表 (double-double) と係数は Rmpfr を使って 400 ビットで計算しました。最大相対誤差は正規化数で 4.4e-32 です。非正規化数の入力は、先に 2^600 倍します。atanh の級数を 1e-34 まで項ごとに足すより約 2.6 倍速くなっています。`Math.log` から Newton 法で補正する方法は、`ddExp` の精度が足りないため十分な精度が出ませんでした。

### 分位点関数

連続分布の分位点関数は、共通のソルバー (`src/internal/invert.ts`) を使います。

- 各ステップで分布関数を 1 回だけ評価し、そこから線形の値と対数の値の両方を得る (`cdfBoth`)。2 回計算することはしない
- 対数密度の導関数 (`dlogPdf`、閉じた式) を使って u = log x で Halley 法のステップを取る。ステップが Newton 法のステップの 1/2 倍から 2 倍の間にあるときだけ採用する
- 初期値は、`qbeta` (a, b > 1) では Abramowitz と Stegun の 26.5.22、`qf` ではそれを F = (n/m) Y/(1 − Y) で写したもの、`qt` では Cornish–Fisher 展開 (A&S 26.7.5、n ≥ 3)、`qgamma` では xsf の逆ガンマ関数
- ソルバーは収束後にもう一度評価するのではなく、評価した点のうち残差が最小のものを返す。x での最後の仕上げは |log x| > 2 のときだけ行う

典型的な `qbeta` の呼び出しでは、現在、分布関数の評価が約 4.4 回、密度の評価が 3.9 回、反復が 3.5 回です。

離散分布の分位点関数は、分布関数を平均で約 2 回しか呼びません。遅くなるのは 1 回の評価が遅いとき (たとえば n が大きい `pbinom`) だけです。

### 精度と速度の兼ね合いを測る

`src/special/dd.ts` には内部用の切り替え (`setDoubleDouble`。公開 API ではない) があり、`ddExp` を含むすべての double-double の部品を、ふつうの double の演算に置き換えます。これで double-double によって何が得られ、何を失うかが分かります。

- `npm run bench` (`scripts/bench.mjs`) は、パッケージをビルドし、決まった一連の呼び出しを両方のモードで計測する。1 回ずつ呼び出し、5 回の実行の最小値を 1 回あたりの µs で示す。モードごとに別のプロセスで実行する。1 つのプロセスでモードを切り替えると、最初のモードでの V8 の型フィードバックが残り、2 番目のモードが最大 2 倍遅くなるため。`node scripts/bench.mjs <dir>` で別のビルドを測れる (そのビルドに切り替えがなければ double-double モードだけ)。入力はライブラリ自身の `setSeed`/`runif` で生成するので、どのビルドにも同じ入力が渡る
- `npm run precision-report` (`scripts/precision.sh`) は、`RSTATS_PRECISION=dd` と `RSTATS_PRECISION=double` でテストスイート全体を 2 回実行する。このモードではテストは失敗せず、代わりに各フィクスチャの誤差を `reports/precision/<mode>/` にまとめる。`scripts/precision-report.mjs` が両者を並べた表を `reports/precision/report.md` に書き出す (コミットはしない。約 7 分かかる)

すべてを double の精度で計算すると、次のようになります。

- d/p 関数は、現在の double-double のコードより 2〜4 倍速くなる (下の表を参照。`dbeta` は 2.0 → 0.51 µs)。double 精度モードでも配列の確保と関数呼び出しは残るので、この高速化は、double 精度で書き直したコードに対する控えめな下限である
- フィクスチャの約半分は、依然として許容誤差 1e-14 で合格する。閉じた式で書ける連続分布、`lgamma`、符号付き順位と順位和、`ptukey`、`chisqTest`、`tTest`、`wilcoxTest`、すべての乱数
- 主要な d/p 関数のほとんど (`dbeta`、`dbinom`、`dgamma`、`dt`、`pbeta`、`pbinom`、`pgamma`、`pchisq`、`pnbeta`、`pnchisq`、`pnt` など) と `qbeta`、`qf` は不合格になるが、誤差は 1e-10 以内に収まる (最大の誤差は 1e-13〜4e-12)
- 14 個は大幅に悪くなる。`beta` (3.1e-5)、`lbeta` (5.8e-7)、`pt` (6.2e-7)、`pnf` (1.0e-7)、`pf`、`dnf`、`pnbinom_mu`、離散分布の分位点 `qnbinom`、`qnbinom_mu`、`qpois`、`qbinom` (異なる整数を返すものがある)、`qt`、`qlogis`、`corTest` (r が ±1 に近いときの Pearson。最大 0.41)
- 遅くなるものもある。反復の打ち切り条件は double-double の精度を前提にしているので、double 精度では収束が悪くなる (`qnbinom` のテストは 9.3 秒ではなく 260 秒かかる)

したがって、主要な d/p 関数については、速い double 精度の経路を用意し、必要な入力だけ double-double を使う方法が有望です。ただし、打ち切り条件は別に選び直す必要があります。

## 測定結果

Apple M1 (Mac mini)、Node.js 24、`tsc` によるビルド、1 回ずつの呼び出し、5 回の実行の最小値です。「典型」の入力は、形状パラメータが 0.5〜50 の対数一様、p が 0〜1 の一様です。「裾」の入力は、形状パラメータが 0.1〜1e4、p が 1e-5〜1e-300 です。

### 分布 (1 回あたりの µs)

| 関数 | rStats.js | double 精度モード |
|---|---|---|
| `pbeta` | 2.6 | 0.98 |
| `dbeta` | 2.0 | 0.51 |
| `pt` | 2.9 | 1.1 |
| `pgamma` | 0.79 | 0.43 |
| `pnbinom` | 15.3 | 6.9 |

| 分位点関数 | 典型 | 裾 |
|---|---|---|
| `qbeta` | 27.1 | 19.8 |
| `qgamma` | 6.4 | 4.4 |
| `qchisq` | 5.7 | |
| `qt` | 11.6 | 11.3 |
| `qf` | 22.2 | |

`tTest` (Welch、観測値 30 個と 25 個) は 45.8 µs でした。これは分位点ソルバーの最後の変更より前に測った値です (`tTest` は `qt` を呼びます)。

**R・SciPy との比較。** 同じ入力での `qbeta` は、R 4.5.2 (arm64、ベクトル化した 1 回の呼び出し) で 1 個あたり典型の入力で約 1 µs、裾の入力で 2.9 µs です。SciPy 1.13 の `betaincinv` は 1.7 µs と 4.3 µs です。したがって rStats.js は、典型の入力で R より約 27 倍遅いことになります。R の `pbeta` と `dbeta` は約 0.2 µs と 0.1 µs です。答えは一致しています (典型の入力で、rStats.js と R の相対差の中央値は 1.5e-16、最大は 1.0e-14)。この差は double-double 演算の代償であり、結果が違うからではありません。

**大きなパラメータ。** 不完全ベータ関数の連分数は、中心付近ではパラメータの平方根にほぼ比例する回数の反復を必要とします。そのため `pbeta(0.5, a, a)` は、a = 10 で 4.1 µs、a = 1000 で 17.7 µs、a = 1e5 で 77.8 µs、a = 1e6 で 173 µs かかります。実際に問題になるのは、両方のパラメータが大きい二項分布だけです。`pbinom(n/2, n, 0.5)` は n = 1e3、1e4、1e5、1e6 で 14、30、62、133 µs かかりますが、`pt` と `pf` は約 15 µs にとどまります。一様漸近展開 (Temme) を使えば定数時間になりますが、実装していません。

### 線形代数

標準正規分布の値を並べた行列を使います (`chol`: crossprod + nI、対称 `eigen`: (A + Aᵀ)/2)。R 4.5.2 (arm64) は 4 スレッドの OpenBLAS 0.3.26 を使います。R の時間は、20 回の平均を 5 回測ったうちの最小値です。

| 演算 | n = 100: rStats.js | R | n = 300: rStats.js | R |
|---|---|---|---|---|
| `qr` | 1.0 ms | 0.30 ms | 21.6 ms | 4.9 ms |
| `solve` (右辺 1 本) | 0.6 ms | 0.10 ms | 11.3 ms | 1.0 ms |
| `chol` | 0.2 ms | < 0.05 ms | 5.6 ms | 0.20 ms |
| `svd` | 7.1 ms | 1.2 ms | 162 ms | 15.0 ms |
| `eigen` (対称) | 4.7 ms | 0.90 ms | 97 ms | 7.4 ms |
| `eigen` (一般) | 16.5 ms | 3.5 ms | 371 ms | 32.9 ms |

rStats.js は R より 3〜28 倍遅くなっています。R はブロック化した LAPACK と、SIMD と FMA を使う最適化されたマルチスレッドの BLAS を使いますが、rStats.js はブロック化していない素直なループを使っているためです。統計でよくある大きさの行列 (列数が数十まで) なら、1 回の呼び出しは 1 ms から数十 ms です。

### バンドルサイズ

`npm run size` (`scripts/size.mjs`) は、ビルドした `dist/` からの各 import を esbuild でバンドルし、minify して gzip で圧縮します。tree-shaking により、import した関数とその依存だけが残ります。

| import | minify 後 | gzip |
|---|---|---|
| `pnorm` | 2.1 KB | 1.2 KB |
| `setSeed`、`rnorm` | 3.4 KB | 1.7 KB |
| `solve` / `svd` / `eigen` | 3.8 / 4.5 / 9.6 KB | 1.7 / 2.0 / 3.7 KB |
| `wilcoxTest` | 18.2 KB | 7.9 KB |
| `fisherTest` | 26.6 KB | 13.2 KB |
| `tTest` | 34.5 KB | 16.3 KB |
| `qbeta` | 37.2 KB | 17.3 KB |
| `pt`、`qt` | 53.4 KB | 25.0 KB |
| すべて | 190.4 KB | 72.2 KB |

`pt` が大きいのは、非心 t の経路 (`src/distributions/nt.ts`) と double-double の部品が一緒に入るためです。中心分布だけの関数を分ければ小さくなります。

## 採用しなかった方法

- **WebAssembly。** 同じ `ddLog` を C から Wasm にコンパイルしたものは、JavaScript 版より 1.2 倍速く、relaxed-SIMD の融合積和を使うと 1.6 倍速くなりました。ただし、融合されるかどうかはエンジン次第です (融合されないと、誤差項が黙って 0 になります)。また、Wasm には非同期の初期化が必要で、関数ごとの tree-shaking ができず、検証すべきコードの経路が 2 つになります。そのため、重い行列計算や反復計算を置き換える候補として残すにとどめています。採用する場合は同じ API の裏に置き、同じフィクスチャでテストします。
- **パラメータだけで決まる項のキャッシュ** (`lbeta`、`lgamma`、`stirlerr`)。これらが占める時間は 1〜6% で、メモ化しても測定できるほどの差はありませんでした。
