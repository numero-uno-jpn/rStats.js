# rStats.js

[English](README.md) | 日本語

> この文書は [英語版](README.md) の訳です。内容が食い違うときは英語版が正です。

JavaScript とブラウザで使える、R と互換の統計関数のライブラリです。TypeScript で書いています。
[ブラウザで試す](https://numero-uno-jpn.github.io/rStats.js/demo/) (すべての関数を、R が出す値と並べて試せます)。

- **R と同じ数値を返します。** 関数名・既定値・結果は R に合わせています。すべての関数を R 4.5.2 と
  比べてテストしています (分布関数は相対誤差 1e-14)。R 自身が不正確なところでは、高精度の参照値と
  比べています。
- **JavaScript らしい呼び出し方です。** 必須の引数は位置で渡し、省略できる引数は camelCase のキーを
  持つオブジェクトで渡します。`pt(q, df, { lowerTail: false })` は R の `pt(q, df, lower.tail = FALSE)` に
  当たります。結果は素のオブジェクトなので、そのまま `JSON.stringify` できます。
- **どこでも動きます。** ESM のみで、依存パッケージはなく、Node 専用の API も使っていません。
  tree-shaking が効きます (`pnorm` だけなら gzip で 1.2 KB)。

状態: **0.15.2。** R の stats パッケージの数値計算の中心
(分布・記述統計・検定・線形モデル・特殊関数・数値計算・線形代数の基本) を、R と同じ結果でカバーすることを目指しています。残っている作業は
[ROADMAP.ja.md](ROADMAP.ja.md)、変更履歴は [CHANGELOG.md](CHANGELOG.md) (英語) にあります。

## インストール

```sh
npm install @numero-uno-jpn/rstats
```

ES2022 の環境が必要です (現行のブラウザ、Node.js 22 以降、Deno、Bun)。

## 使い方の例

### 分布

```ts
import { pnorm, qnorm, pt, qbeta, dbinom } from "@numero-uno-jpn/rstats";

pnorm(1.96);                                  // 0.9750021048517795
qnorm([0.025, 0.975]);                        // [-1.9599639845400545, 1.959963984540054]
pt(-40, 3);                                   // 1.7190340394579263e-5
pt(2, 10, { lowerTail: false, logP: true });  // -3.3051415512324533 (log of the upper tail)
qbeta(1e-10, 2, 3);                           // 4.082494015808333e-6
dbinom(3, 10, 0.2);                           // 0.20132659200000003
```

最初の引数には数値・配列・`Float64Array` を渡せます。結果は同じ形で返ります。分布の母数はスカラーです。

### `set.seed()` と同じ乱数

```ts
import { setSeed, rnorm, RNGkind, getRandomSeed, setRandomSeed, nextRNGStream, runif } from "@numero-uno-jpn/rstats";

setSeed(42);
rnorm(3);  // [1.3709584471466685, -0.5646981713960887, 0.3631284113373392]
           // R: set.seed(42); rnorm(3) gives the same numbers (up to the last bit)

// R の既定以外の設定: RNGkind("L'Ecuyer-CMRG") と parallel::nextRNGStream、sample.kind = "Rounding"
RNGkind({ kind: "L'Ecuyer-CMRG" });
setSeed(1);                                   // R: set.seed(1, kind = "L'Ecuyer-CMRG")
setRandomSeed(nextRNGStream(getRandomSeed())); // R: .Random.seed <- nextRNGStream(.Random.seed)
runif(2);  // [0.31369782407981056, 0.9280126525616814]
```

R で `set.seed(42); rnorm(3)` とすると、最後のビットまで同じ数値になります。

### 検定

```ts
import { tTest, fisherTest, pAdjust } from "@numero-uno-jpn/rstats";

const r = tTest([5.1, 4.9, 6.2, 5.8, 6.0, 5.5], [4.1, 4.5, 5.0, 4.8, 4.3]);
r.pValue;    // 0.0035365308877675647 (Welch, the default in R)
r.confInt;   // [0.4423253334608047, 1.6443413332058612]
r.method;    // "Welch Two Sample t-test"

fisherTest([[3, 1], [1, 3]]).pValue;                     // 0.4857142857142857
pAdjust([0.01, 0.02, 0.03, 0.04], { method: "BH" });    // ≈ [0.04, 0.04, 0.04, 0.04]
```

`tTest` の既定は、R と同じ Welch の検定です。

### 一般化線形モデル

説明変数は `lm` と同じく行列 (行の配列) かベクトルで渡します。二項分布の応答は (成功数, 失敗数) の行でも渡せます。

```ts
import { glm, glmSummary, glmPredict, glmConfint, glmAnova } from "@numero-uno-jpn/rstats";

const dose = [1, 2, 3, 4, 5, 6];
const counts = [[1, 19], [4, 16], [9, 11], [13, 7], [18, 2], [19, 1]];
const fit = glm(dose, counts, { family: "binomial" });   // R: glm(cbind(s, f) ~ dose, binomial)
fit.coefficients;                                  // ≈ [-3.77413, 1.14807]
glmSummary(fit).pValue;                            // ≈ [5.357e-8, 3.579e-9] (z tests)
glmPredict(fit, { newdata: [3.5], type: "response" }); // { fit: ≈ [0.56073], seFit: ≈ [0.06140] }
glmConfint(fit).lower;                             // ≈ [-5.27166, 0.80033] (profile likelihood)
glmAnova(fit).table[1];                            // ≈ [1, 62.978, 4, 0.5196, 2.09e-15]
fit.warnings;                                      // [] (R's warnings, such as non-convergence)
```

### formula による分散分析

`lm` と `aov` は、R の formula とデータフレーム (列のオブジェクト。文字列の列は因子) でも呼べます。`anova` は R の
逐次の表、`Anova` は car の Type II と III の検定、`aovEz` は afex の反復測定の分散分析 (Greenhouse-Geisser の補正と
一般化 η² つき) です。

```ts
import { lm, anova, Anova, aovEz } from "@numero-uno-jpn/rstats";

const d = { y: [12.1, 14.3, 13.8, 17.2, 19.5, 22.4, 11.6, 13.9, 15.7, 18.8, 21.1, 25.3],
            A: ["a", "a", "b", "b", "c", "c", "a", "a", "b", "b", "c", "c"],
            B: ["p", "q", "p", "q", "p", "q", "p", "q", "p", "q", "p", "q"] };
const fit = lm("y ~ A * B", d, { contrasts: { A: "contr.sum", B: "contr.sum" } });
anova(fit).rowNames;                   // ["A", "B", "A:B", "Residuals"]
anova(fit).table[0];                   // ≈ [2, 169.147, 84.573, 57.828, 0.00011997] (Df, Sum Sq, Mean Sq, F, p)
Anova(fit, { type: 3 }).table[1];      // ≈ [169.147, 2, 57.828, 0.00011997] (car::Anova(fit, type = 3))

// 反復測定 (R: afex::aov_ez("id", "y", long, within = "W"))
const long = { id: ["s1", "s1", "s1", "s2", "s2", "s2", "s3", "s3", "s3", "s4", "s4", "s4", "s5", "s5", "s5"],
               W: ["pre", "mid", "post", "pre", "mid", "post", "pre", "mid", "post", "pre", "mid", "post", "pre", "mid", "post"],
               y: [5.1, 6.3, 7.2, 4.8, 5.9, 7.5, 6.0, 6.1, 8.3, 5.5, 6.8, 7.1, 4.9, 6.6, 7.8] };
aovEz(long, { id: "id", dv: "y", within: "W" }).anova.table[0];
// ≈ [1.735, 6.940, 0.21653, 35.876, 0.84607, 0.00026363] (num Df, den Df, MSE, F, ges, p。GG で補正)
```

### 線形混合モデル

`lmer` は、lme4 の線形混合モデルを REML または最尤法で当てはめます。独立した分野
`@numero-uno-jpn/rstats/mixed` (CDN では `dist/mixed.js`) にあり、1 ファイルにまとめたビルドには含めていません。

```ts
import { lmer, lmerSummary, lmerAnova } from "@numero-uno-jpn/rstats/mixed";

const d = { subj: ["s1", "s2", "s3", "s4", "s5", "s6"].flatMap((s) => [s, s, s, s]),
            day: [0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3],
            rt: [251, 262, 280, 293, 230, 251, 265, 282, 270, 275, 290, 318,
                 242, 263, 270, 296, 260, 284, 309, 330, 238, 245, 262, 268] };
const fit = lmer("rt ~ day + (day | subj)", d);   // R: lme4::lmer(rt ~ day + (day | subj), d)
fit.fixef;                       // [247.65, 16.4]
fit.coefTable.stdError;          // ≈ [5.3177, 1.7104]
fit.varCorr[0].sd;               // ≈ [12.485, 3.6894] (subj の切片と傾き。VarCorr)
fit.varCorr[0].corr[0][1];       // ≈ 0.6737
fit.sigma;                       // ≈ 4.4385
fit.ranef[0].values[1];          // ≈ [-13.118, -1.0038] (s2 の ranef)
fit.REMLcrit;                    // ≈ 158.563

// lmerTest の検定 (Satterthwaite の自由度)
const s = lmerSummary(fit);      // R: summary(lmerTest::lmer(rt ~ day + (day | subj), d))
s.df;                            // ≈ [5, 5]
s.pValue;                        // ≈ [8.6215e-8, 0.00020903]
lmerAnova(fit).F;                // ≈ [91.942] (Type III。R: anova(fit))
```

推定値は REML 基準の厳密な最適点です。lme4 の最適化はその手前で止まるので、分散成分は lme4 と
有効数字 5〜9 桁程度まで、固定効果と対数尤度はそれ以上の桁まで一致します。
`lmerSummary`、`lmerContest`、`lmerAnova` は、lmerTest の Satterthwaite の自由度による t 検定と F 検定、
Type I・II・III の分散分析表を返します (自由度はその最適点で厳密な導関数から求めます。lmerTest は lme4 の
最適点で数値微分します)。`lmerAnova([fit1, fit2])` は、lme4 の `anova()` と同じく当てはめを尤度比検定で比べます。

### 効果量と検出力

```ts
import { cohensD, etaSquared, Anova, powerTTest, pwrAnovaTest } from "@numero-uno-jpn/rstats";

cohensD([5.1, 4.9, 6.2, 5.8, 6.0, 5.5], [4.1, 4.5, 5.0, 4.8, 4.3]);
// ≈ { name: "Cohens_d", value: 2.30726, ci: 0.95, ciLow: 0.68824, ciHigh: 3.85666 } (effectsize::cohens_d)
etaSquared(Anova(fit, { type: 3 })).table[0];   // ≈ [0.95068, 0.95, 0.82023, 1] (fit は上の例のもの。偏 η²、片側の信頼区間)
powerTTest({ delta: 0.5, power: 0.8 }).n;       // ≈ 63.766 (1 群あたり、power.t.test)
pwrAnovaTest({ k: 3, f: 0.25, power: 0.8 }).n;  // ≈ 52.397 (pwr::pwr.anova.test)
```

信頼区間の限界は厳密な解です。effectsize は最適化で求めるので、1e-9 程度 (ときに 3e-3) ずれます。

### 線形代数

行列は行の配列で表します。

```ts
import { solve, qr, qrCoef, svd, eigen } from "@numero-uno-jpn/rstats";

solve([[2, 1], [1, 3]]);            // [[0.6, -0.2], [-0.2, 0.4]]
const q = qr([[1, 1], [1, 2], [1, 3]]);
qrCoef(q, [1, 3, 4]);               // ≈ [-0.333, 1.5] (least squares)
svd([[1, 4], [2, 5], [3, 6]]).d;    // [9.50803200069572, 0.7728696356734838]
eigen([[2, 1], [1, 3]]).values;     // [3.618033988749895, 1.381966011250105]
```

## 含まれるもの

| 分野 | 関数 (R と名前が違うものは括弧内が R の名前) |
|---|---|
| 特殊関数 | `gamma`, `lgamma`, `beta`, `lbeta`, `choose`, `lchoose`, `factorial`, `lfactorial`, `digamma`, `trigamma`, `psigamma`, `besselI`, `besselK`, `besselJ`, `besselY`。R にはない `erf`, `erfc`, `erfinv`, `erfcinv`, `gammainc`, `perm` と、R の C API (Rmath.h) の `log1pmx`, `lgamma1p`, `log1mexp`, `log1pexp` も |
| 分布 (d/p/q) | 正規、t、カイ二乗、F、ベータ、ガンマ、二項、ポアソン、一様、指数、対数正規、ロジスティック、コーシー、ワイブル、幾何、負の二項、超幾何、Wilcoxon の符号付き順位と順位和、スチューデント化された範囲 (`ptukey`, `qtukey`)、非心カイ二乗・t・F・ベータ (`ncp`)。多項分布の確率 (`dmultinom`)。逆ガンマ、Kumaraswamy、Pareto、三角、Laplace (extraDistr) と逆正弦。`distSummary` (平均・分散・標準偏差・中央値・最頻値・歪度・尖度) |
| 乱数 | `setSeed` (`set.seed`), `RNGkind` (Mersenne-Twister と L'Ecuyer-CMRG、`sample.kind` の Rejection と Rounding), `getRandomSeed`/`setRandomSeed` (`.Random.seed`), `nextRNGStream`/`nextRNGSubStream` (`parallel`), 26 個の `r*` 関数, `sample`, `sampleInt` (`sample.int`), `r2dtable` |
| 記述統計 | `sum`, `prod`, `mean`, `weightedMean` (`weighted.mean`), `variance` (`var`), `sd`, `median`, `range`, `cumsum`, `cumprod`, `cummax`, `cummin`, `diff`, `quantile`, `IQR`, `fivenum`, `mad`, `rank`, `cov`, `cor`, `tabulate`, `table`, `unique`, `cut`, `findInterval`, `pretty`, `hist`, `ecdf`, `scale`, `skewness`, `kurtosis`, `geometricMean`, `modes`, `meanAD`, `cv` |
| 検定 | `tTest`, `chisqTest`, `fisherTest`, `wilcoxTest`, `corTest`, `binomTest`, `poissonTest`, `propTest`, `mcnemarTest`, `varTest`, `bartlettTest`, `kruskalTest`, `friedmanTest`, `quadeTest`, `flignerTest`, `moodTest`, `onewayTest`, `shapiroTest`, `mantelhaenTest`, `ansariTest`, `ksTest`, `pairwiseTTest`, `pairwiseWilcoxTest`, `pairwisePropTest`, `aov` (一元配置), `TukeyHSD`, `zTest`, `brunnerMunzelTest`, `pAdjust` (`p.adjust`) |
| 分散分析 | formula で呼ぶ `aov` と `aovSummary` (多元、交互作用、共変量、`Error()` の層), `anova` (`anova.lm`。逐次の表とモデルの比較), `Anova` (car の Type II と III), `aovEz` (afex。反復測定と混合計画、Greenhouse-Geisser と Huynh-Feldt の補正、一般化 η² と偏 η²), `mauchlyTest` (`mauchly.test`) |
| 効果量と検出力 | `cohensD`, `hedgesG` (effectsize。信頼区間は厳密な限界), `etaSquared`, `omegaSquared`, `epsilonSquared` (偏・一般化。`anova` と `Anova` の表から), `powerTTest`, `powerPropTest`, `powerAnovaTest` (`power.*.test`), `pwrTTest`, `pwrT2nTest`, `pwr2pTest`, `pwr2p2nTest`, `pwrPTest`, `pwrNormTest`, `pwrRTest`, `pwrChisqTest`, `pwrAnovaTest`, `pwrF2Test`, `esH`, `esW1`, `esW2`, `cohenES` (pwr) |
| 線形モデル | `lm` (formula とデータフレーム、または行列で渡す。`summary` の値も返す), `modelMatrix` (`model.matrix`), `confint`, `predict`。`glm` (行列で渡す形。R の `stats` のすべての族とリンク) と `glmSummary` (`summary.glm`)、`glmResiduals` (4 種類)、`glmHatvalues`、`glmRstandard`、`glmCooksDistance`、`glmPredict` (標準誤差つき)、`glmConfint` (プロファイル尤度、厳密な限界)、`glmAnova` (`anova.glm`) |
| 混合モデル | `lmer` (lme4: REML と最尤法、相関のある変量効果と相関のない変量効果、交差と入れ子の群。`fixef`、`vcov`、`VarCorr`、`ranef`、`logLik`、`AIC`、`BIC`、`REMLcrit`、`isSingular`)、`lmerSummary`・`lmerContest`・`lmerAnova` (lmerTest: Satterthwaite の t 検定と F 検定、Type I/II/III の分散分析表。当てはめどうしの尤度比検定)。`@numero-uno-jpn/rstats/mixed` から import する |
| ほかの検定 | `leveneTest`、`propTrendTest` (`prop.trend.test`)、`jonckheereTest`、`cochranQTest`、`adTest`、`lillieTest`、`cvmTest`、`sfTest`、`pearsonTest` (car、DescTools、clinfun、nortest) |
| 多重比較 | `dscfAllPairsTest` (Steel-Dwass)、`kwAllPairsDunnTest`、`kwManyOneDunnTest`、`manyOneUTest` (Steel の多対一の順位検定)、`dunnettTest`、`gamesHowellTest`、`tukeyTest` (PMCMRplus)、`dunnTest` (dunn.test)、`glhtDunnett` (multcomp) |
| 生存時間解析 | `survdiff` (log-rank)、`survfit` (Kaplan-Meier。信頼区間と中央値)、`coxph` (Cox 回帰。Efron と Breslow のタイの扱い、ケースの重み、層、Wald・尤度比・スコア検定) |
| 一致度と信頼性 | `kappa2`、`kappamFleiss`、`icc` (irr)、`cronbachAlpha`、`partialR` (psych)、`polychor`、`polyserial` (polycor)、`pbvnorm`、`factanal`、`omega` (McDonald の ω。psych) |
| データの扱い | `completeCases` (`complete.cases`)、`naOmit` (`na.omit`)、`subset`、`merge`、データフレームの `rbind`・`cbind`、`tapply`、`split`、`aggregate`、`pivotLonger` と `pivotWider` (tidyr)。検定の formula 版 (`tTest("y ~ g", data)`、`kruskalTest`、`friedmanTest("y ~ w \| b", data)`、`corTest("~ x + y", data)` など) |
| 線形代数 | `matMul` (`%*%`), `add`, `subtract`, `multiply`, `divide`, `outer`, `t`, `diag`, `cbind`, `rbind`, `matrix`, `kronecker`, `seq`, `crossprod`, `tcrossprod`, `norm`, `backsolve`, `forwardsolve`, `chol`, `chol2inv`, `qr` と `qrQ`, `qrR`, `qrX`, `qrCoef`, `qrQy`, `qrQty`, `qrResid`, `qrFitted`, `qrSolve` (`qr.Q` …), `solve`, `det`, `determinant`, `rcond`, `kappa`, `svd`, `eigen`, `lu`, `prcomp`, `ginv` (MASS)、`schur`、`expm` |
| 数値計算 | `integrate`, `optimize`, `optim`, `optimHess`, `uniroot`, `approx`, `spline`, `splinefun`, `splinefunH`, `barylag`, `hermiteInterp`, `ode`, `grad`, `jacobian`, `hessian` |

R の分析の書き方 (データフレーム、formula、因子) に慣れていない場合は、[docs/ja/guide-for-js-developers.md](docs/ja/guide-for-js-developers.md) が JavaScript の開発者の立場から例を使って説明しています。

jStat から移るときは [docs/ja/migrating-from-jstat.md](docs/ja/migrating-from-jstat.md) に jStat の全関数の置き換えがあります。

[API リファレンス](https://numero-uno-jpn.github.io/rStats.js/api/) (英語) に、すべての関数の説明と使用例があります (使用例はテストで実行しています)。
R の関数から rStats.js の関数を引くには [docs/ja/r-functions.md](docs/ja/r-functions.md) を見てください。(`npm run docs` で手元でもリファレンスを作れます。)

AI のコーディング支援向けに、R のコードを rStats.js の呼び出しに書き換える方法を [llms.txt](llms.txt)
にまとめています (英語。npm のパッケージにも入っていて、<https://numero-uno-jpn.github.io/rStats.js/llms.txt>
でも読めます)。

## 精度

正解の値は [`oracle/`](oracle) の R のスクリプトで作り、[`test/fixtures/`](test/fixtures) に
保存してあります。そのため、テストは R がなくても動きます。各ケースは、R と一致するか、R が
間違っているところでは Rmpfr や gmp で計算した高精度の値と一致すれば合格です。分布の裾の深い
ところや母数の大きいところでは、rStats.js のほうが R より正確なことがよくあります。指数部を
double-double 演算で計算しているためです。詳しくは [docs/ja/accuracy.md](docs/ja/accuracy.md) を
見てください。

## R との違い

違いの多くは、R の精度が落ちるか、R が失敗するケースです。ふだんの使い方に関わる意図的な違いは
次のとおりです。

- 添字は 0 から始まります。`sampleInt(n)` は `0..n-1` を返します (R の `sample.int()` から 1 を
  引いた値で、乱数の列は同じ)。`qr` と `chol` のピボットも 0 から始まります。
- 固有ベクトルと特異ベクトルの符号が R と違うことがあります (どちらも正しい答えです)。
- 検定は R の警告を出しません。数値の欄と手法の名前はすべて一致します。`glm` は R の警告を結果の
  `warnings` で返します。
- 分布の母数は、ベクトルとして使い回されません (リサイクルしない)。
- `lmer` は基準の厳密な最適点を返します。lme4 の最適化はそこへ許容誤差の範囲でしか近づきません。
  また、lme4 の収束の警告は出しません。

すべての違いは [docs/ja/differences-from-r.md](docs/ja/differences-from-r.md) にあります。

## ブラウザで使う

バンドラ (Vite、esbuild、webpack、Rollup) を使う場合は、関数を名前で import してください。
使わない関数は取り除かれます。minify と gzip をした後のおおよその大きさは次のとおりです。

| import するもの | gzip |
|---|---|
| `pnorm` | 1.2 KB |
| `setSeed`, `rnorm` | 1.7 KB |
| `solve` / `svd` / `eigen` | 1.7 / 2.0 / 4.5 KB |
| `wilcoxTest` / `fisherTest` / `tTest` | 12.8 / 15.8 / 26.7 KB |
| `qbeta` / `pt` と `qt` | 40.4 / 33.0 KB |
| `glm` と `glmSummary` / `glm` とそのすべての関数 | 29.1 / 41.5 KB |
| `lmer` (`/mixed` から) / `lmerSummary`・`lmerContest`・`lmerAnova` も | 16.5 / 61.0 KB |
| すべて (`/mixed` を除く) | 198.6 KB |

(`npm run size` で測れます。)

分野ごとにサブパスからも export しているので、1 つの分野だけを import することもできます。
`@numero-uno-jpn/rstats/distributions`、`/tests` (検定、`lm`・`confint`・`predict`、`glm` とその関数)、`/linalg`、
`/descriptive`、`/numerics`、`/special`、`/mixed` です (`/mixed` の `lmer` と lmerTest の検定は、この方法でしか import
できません。メインの入口には含めていません)。

バンドラを使わない場合は、1 ファイルにまとめたビルド `dist/rstats.js` (`/mixed` 以外のすべての関数を含む
minify 済みの ES モジュール、gzip で 199 KB) を jsDelivr から読み込めます。jsDelivr は、npm のリリースを
そのまま配信します。

```html
<script type="module">
  import { pnorm } from "https://cdn.jsdelivr.net/npm/@numero-uno-jpn/rstats@0.15.2/dist/rstats.js";
  console.log(pnorm(1.96)); // 0.9750021048517795
</script>
```

関数は R と同じ名前の named export で、`jStat.` や `_.` のような接頭辞はありません。他の名前と区別
したいときは、名前空間として import してください (上の URL から `import * as rs from` で読み込む)。
`rs.pnorm(1.96)`、`rs.tTest(x, y)` のように呼べます。バンドラを使う場合
(`import * as rs from "@numero-uno-jpn/rstats"`) も、使わない関数は取り除かれます。CDN から読み込む
場合は、どちらの書き方でもファイル全体が読み込まれます。`window` には何も追加しません。他のスクリプトや
ブラウザのコンソールから使うときは、自分で `window.rs = rs` としてください。

一部の分野だけを使うページでは、代わりに分野ごとのバンドルを読み込めます。`dist/distributions.js`、
`dist/tests.js`、`dist/linalg.js`、`dist/descriptive.js`、`dist/numerics.js`、`dist/special.js`、
`dist/mixed.js` は上のサブパスと同じ関数を export し、共通のコードを `dist/chunks/` で共有します。そのため、
2 つの分野を読み込んでも共通部分は 1 回しか読み込まれません。chunk を含めた 1 分野の転送量は、gzip で
30 KB (`special`) から 159 KB (`tests`) です。

npm を元にしたほかの CDN も使えます。たとえば `https://esm.sh/@numero-uno-jpn/rstats` です。ビルド結果
(`dist/`) は main ブランチにはなく、リリースのタグにも入っていますが、jsDelivr の GitHub 経由の配信
(`cdn.jsdelivr.net/gh/...`) は、0.12.0 以降のタグを配信しません。テストの fixture を含めると、リポジトリが
その上限の 50 MB を超えるためです。上の npm 経由の URL を使ってください。

ブラウザ向けのビルドは、headless Chromium でテストしています。バンドラでまとめた場合と、
`dist/rstats.js` を ES モジュールとして読み込んだ場合の両方です (`npm run test:browser`)。

**デモ:** <https://numero-uno-jpn.github.io/rStats.js/demo/>。[`demo/`](demo) は、`dist/rstats.js` を jsDelivr から読み込んで、すべての関数を試せる
静的なページです。確率分布 (グラフ付き)・特殊関数・乱数・検定・線形代数を扱います。各フォームには、
入力に対応する R と JavaScript のコードが表示されます。「R との比較」のタブでは、例題の値を R が
出力した値と照らし合わせます (`source("examples.R")` で、すべての例題を R で実行できます)。CDN の
代わりに手元のビルドを使うには、`npm run build` をしてから、リポジトリのルートを静的サーバー
(たとえば `npx serve .`) で配信し、`/demo/?src=local` を開いてください。

## 版の番号

版が 0.x の間は、minor の版で互換性のない変更が入ることがあります。その場合は変更履歴に
書きます。1.0.0 からは Semantic Versioning に従います。

## 貢献

R との答え合わせの仕組みと、ライセンスの決まり (R や GPL のパッケージのコードは使わない) は
[CONTRIBUTING.ja.md](CONTRIBUTING.ja.md) にあります。速さと double-double 演算については
[docs/ja/performance.md](docs/ja/performance.md) にあります。

## ライセンス

MIT です。数値計算の部品は、SciPy の xsf・scipy.stats・QUADPACK の C 訳 (BSD-3)、Boost.Math
(BSL-1.0)、statsmodels (BSD-3)、LAPACK の参照実装 (修正 BSD) から移植しています。パブリックドメインの
LINPACK・EISPACK・Cephes・QUADPACK・netlib のコードも使っています。詳しくは
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) (英語) を見てください。
