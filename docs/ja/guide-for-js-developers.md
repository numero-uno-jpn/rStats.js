# JavaScript の開発者のための rStats.js

rStats.js は R に合わせて作っています。関数の名前も引数も、出てくる数値も R と同じです。統計の専門家が R で書いた
分析を、ブラウザや Node に移しても同じ結果になります。その代わり、JavaScript の開発者には見慣れない書き方がいくつか
あります。このページでは、それを 1 つの小さな例 (薬の群とプラセボの群がある試験) で説明します。

(ここの例は `test/guide.test.ts` で実際に動かしているので、コメントに書いた値はライブラリが返す値です。R の値とも
一致します。)

## 1. データフレーム: 行ではなく列

JavaScript のデータは、ふつう行のオブジェクトの配列で届きます。JSON や、CSV を読み込んだ結果の形です。

```js
import { fromRows, toRows } from "@numero-uno-jpn/rstats";

const rows = [
  { id: 1, arm: "drug", sex: "F", age: 34, score: 7.1, improved: "yes" },
  { id: 2, arm: "drug", sex: "M", age: 51, score: 6.4, improved: "yes" },
  { id: 3, arm: "drug", sex: "F", age: 17, score: 8.2, improved: "yes" },
  { id: 4, arm: "drug", sex: "M", age: 45, score: null, improved: "no" },
  { id: 5, arm: "drug", sex: "F", age: 29, score: 7.8, improved: "yes" },
  { id: 6, arm: "drug", sex: "M", age: 62, score: 6.9, improved: "no" },
  { id: 7, arm: "placebo", sex: "F", age: 38, score: 5.2, improved: "no" },
  { id: 8, arm: "placebo", sex: "M", age: 44, score: 6.0, improved: "yes" },
  { id: 9, arm: "placebo", sex: "F", age: 57, score: 4.9, improved: "no" },
  { id: 10, arm: "placebo", sex: "M", age: 23, score: 5.6, improved: "no" },
  { id: 11, arm: "placebo", sex: "F", age: 41, score: 6.3, improved: "yes" },
  { id: 12, arm: "placebo", sex: "M", age: 36, score: 5.1, improved: "no" },
];
```

統計の計算は列 (すべての score、すべての arm) を単位にするので、R は表を「データフレーム」、つまり列ごとの配列の
集まりとして持ちます。rStats.js のデータフレームは、同じ長さの配列を並べた普通のオブジェクトです。`fromRows` で
変換し、`toRows` で元に戻せます。

```js
const d = fromRows(rows);
// d = { id: [1, 2, ...], arm: ["drug", "drug", ...], ..., score: [7.1, 6.4, 8.2, null, ...], ... }
d.score;          // 列。普通の配列
toRows(d)[0];     // { id: 1, arm: "drug", sex: "F", age: 34, score: 7.1, improved: "yes" }
```

行にないキーは `null` になります。行のオブジェクトを返す CSV のパーサーを使えば `rows` が得られます。数は文字列で
なく数として、空のセルは `null` (またはキーなし) として届くようにしてください。

## 2. 欠測値: `null` (または `NaN`)

R は欠測値を `NA` で表します。ここでは `null`、数値の列では `NaN` も欠測値です。関数は R と同じに扱います。
`naOmit` は欠測値のある行を落とし、`completeCases` はどの行がそろっているかを返します。

```js
import { completeCases, naOmit } from "@numero-uno-jpn/rstats";

completeCases(d);   // [true, true, true, false, true, ...]: 4 行目は score がない
naOmit(d);          // 4 行目を除いたデータフレーム
```

## 3. 群: 文字列の列は因子

文字列の列は、R の言葉では「因子」です。群を表す変数で、異なる値が「水準」になります。水準は並べ替えた順 (文字列は
コードポイント順、数は数の順) で、結果もその順に並びます。ここでは "drug" が "placebo" より先です。最初の水準が、
R と同じく基準の群 (ほかの群と比べられる群) になります。

## 4. formula: 「何を何で比べるか」を書く小さな言語

R は分析を formula で書きます。ここでは文字列で渡します。

| formula | 読み方 | 使う関数 |
|---|---|---|
| `"score ~ arm"` | score を arm の群の間で比べる | `tTest`、`wilcoxTest`、`kruskalTest`、`aov`、`lm`、`aggregate` |
| `"score ~ 1"` | score だけ (1 標本) | `tTest`、`wilcoxTest` |
| `"Pair(before, after) ~ 1"` | 対応のある測定 | `tTest`、`wilcoxTest` |
| `"score ~ arm + sex"` | arm ごと、sex ごと | `lm`、`aov`、`aggregate`、`onewayTest` |
| `"score ~ arm * sex"` | arm、sex とその交互作用 | `lm`、`aov` |
| `"y ~ week \| subject"` | 被験者ごと (ブロック) の week | `friedmanTest`、`quadeTest` |
| `"y ~ week + Error(subject/week)"` | 反復測定 | `aov` |
| `"~ age + score"` | 2 つの変数 (応答なし) | `corTest` |

変数はデータフレームの列の名前です。`log(x)` のような計算した項は書けないので、先に列を作ってください。

## 5. 一連の流れ

欠測値を落とし、一部を取り出し、群ごとに要約して、検定します。

```js
import { aggregate, mean, naOmit, sd, subset, tTest, wilcoxTest } from "@numero-uno-jpn/rstats";

const adults = naOmit(subset(d, (r) => r.age >= 18));   // id 1, 2, 5, ..., 12

aggregate("score ~ arm", adults, mean);
// { arm: ["drug", "placebo"], score: [7.05, 5.516666666666667] }

aggregate("score ~ arm + sex", adults, (v) => ({ mean: mean(v), sd: sd(v) }));
// { arm: ["drug", "placebo", "drug", "placebo"], sex: ["F", "F", "M", "M"],
//   "score.mean": [7.45, 5.4667, 6.65, 5.5667], "score.sd": [0.495, 0.7371, 0.3536, 0.4509] }   (丸めた値)

const t = tTest("score ~ arm", adults);
t.method;        // "Welch Two Sample t-test"
t.statistic;     // 4.1818   (t)
t.parameter;     // 6.3048   (自由度)
t.pValue;        // 0.0052
t.confInt;       // [0.6465, 2.4201]   差の 95% 信頼区間
t.estimate;      // [7.05, 5.5167]     ("mean in group drug", "mean in group placebo")

wilcoxTest("score ~ arm", adults).pValue;   // 0.0095 (正確な p 値)
```

R で書くと `t.test(score ~ arm, data = na.omit(subset(d, age >= 18)))` です。

## 6. 検定の結果の読み方

どの検定も、R の欄を camelCase にした普通のオブジェクトを返します。

| 欄 | 意味 |
|---|---|
| `statistic`、`statisticName` | 検定統計量とその名前 (`"t"`、`"W"`、`"X-squared"` など) |
| `parameter`、`parameterName` | 自由度など |
| `pValue` | p 値 |
| `confInt`、`confLevel` | 信頼区間とその水準 |
| `estimate`、`estimateNames` | 推定した量 (平均、差、相関など) |
| `nullValue`、`alternative` | 帰無仮説の値と `"two.sided"`・`"less"`・`"greater"` |
| `method` | 検定の名前 (R の表示と同じ) |

オプションは、R の引数名を camelCase にした 1 つのオブジェクトで渡します。`t.test(..., var.equal = TRUE,
conf.level = 0.99)` は `tTest(..., { varEqual: true, confLevel: 0.99 })` です。

## 7. やりたいことと関数

| やりたいこと | 関数 |
|---|---|
| 2 群を比べる | `tTest("y ~ g", d)` (平均)、`wilcoxTest("y ~ g", d)` (順位)、`brunnerMunzelTest` |
| 対応のある測定を比べる | `tTest("Pair(before, after) ~ 1", d)`、`wilcoxTest(...)` |
| 3 群以上を比べる | `aov("y ~ g", d)` と `aovSummary`、`kruskalTest("y ~ g", d)`、`onewayTest` (Welch) |
| どの群の間に差があるか | `TukeyHSD`、`pairwiseTTest`、`dunnTest`、`dscfAllPairsTest`、`dunnettTest`、`manyOneUTest` (Steel) |
| 反復測定 | `aov("y ~ w + Error(id/w)", d)`、`aovEz`、`friedmanTest("y ~ w \| id", d)` |
| 2 つのカテゴリ変数の関係 | `chisqTest(d.arm, d.improved)`、`fisherTest(table)` |
| 2 つの測定値の相関 | `corTest("~ x + y", d)` (`method: "spearman"` または `"kendall"`) |
| 回帰 | `lm("y ~ x + g", d)`、`glm(x, y, { family: "binomial" })` |
| 生存時間 | `survfit`、`survdiff` (log-rank)、`coxph` |
| 一致度や信頼性 | `kappa2`、`kappamFleiss`、`icc`、`cronbachAlpha`、`omega` |
| 標本サイズの設計 | `powerTTest({ delta: 0.5, power: 0.8 })`、`pwrTTest` など |
| 群ごとの要約 | `aggregate`、`tapply`、`split` |
| 表の結合 | `merge(a, b, { by: "id" })`、`rbind`、`cbind` |

同じデータでほかの検定も:

```js
import { chisqTest, corTest, kruskalTest } from "@numero-uno-jpn/rstats";

const all = naOmit(d);
kruskalTest("score ~ sex", all).pValue;                               // 0.4652
chisqTest(all.arm, all.improved);                                     // X-squared 0.8831、p 0.3474
corTest("~ age + score", all, { method: "spearman" }).estimate;      // -0.3636 (rho)、p 0.2732
```

## 8. R から来たそのほかの習慣

- **位置を返す関数の添字は 0 始まり**です (JavaScript のふつう)。R は 1 始まりです。
- **乱数**は R と同じです。`setSeed(42)` の後の `rnorm(5)` は、R の `set.seed(42)` の後と同じ値になります。
- **群は `Map`**: `split(d.score, d.arm)` は `Map` を返します (`groups.get("drug")`)。並びは R の水準の順です。
- すべての関数の一覧は [README](../../README.ja.md#含まれるもの) に、rStats.js が R と意図的に違うところは
  [differences-from-r.md](differences-from-r.md) にあります。
