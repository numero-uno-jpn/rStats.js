# API リファレンス 日本語訳の用語集

`docs/ja/api/*.json` の英語原文 (`en`) を日本語に訳すときの用語と表記の基準です。翻訳者は、ここに無い語を訳す前に必ずこの表を確認してください。新しい語を決めた場合は、報告に書き出してこの表に追記します。

語の選び方は次の順に優先します。

1. `docs/ja/*.md` と `README.ja.md` で既に使われている訳語
2. 日本語の統計学・R の文献で標準的な訳語
3. 迷うものは「(要確認)」を付けて残す (黙って決めない)

## 表記の規則

### 1. そのまま残すもの

次は訳さず、一字も変えずに残します。

- 関数名、オプション名、プロパティ名、型名 (例: `tTest`、`TTestOptions.alternative`)
- R の関数名 (例: `t.test`、`factanal()`)
- `{@link ...}` タグ (中の名前も含めてそのまま)
- インラインコード (`` `...` ``) の中身すべて
- `⟦code1⟧`、`⟦code2⟧` などのプレースホルダー
- 引数名として使われる統計用語 (例: `shape`、`scale`、`rate`、`ncp`)
- 文字列の値 (例: `"two.sided"`、`"varimax"`)
- `NA`、`NaN`、`null`、`Infinity`、`TypeError`、`RangeError`、`Promise` などの値・クラス名
- 人名に由来する検定名 (下の 6 を参照)

### 2. R への言及

- 「R's `foo`」は「R の `foo`」とする。
- 「Equivalent to R's `foo`」は「R の `foo` と同等です。」とする。
- 「As in R」は「R と同じく」とする。
- 「R's warnings」は「R の警告」、「R's order」は「R と同じ順序」とする。
- 「R's `na.last = TRUE`」のように R の引数を示す場合は、R の書き方のまま残す。

### 3. 文体

`docs/ja` を実測した結果、文末は です・ます体 (「です」365 回、「ます」850 回、「である」11 回) が主流でした。説明文は です・ます体 で書きます。見出しや表の中の用語は名詞止めのままにしてかまいません。常体 (「〜する」「〜である」) は使いません。

### 4. 句読点

句点は「。」、読点は「、」を使います。全角のカンマやピリオド (「，」「．」) は使いません。

### 5. 括弧とコロン

- 括弧は半角の `( )` を使います。括弧の内側に空白は入れません。
- 括弧の前後には空白を入れます (例: 「`R の x (既定 1e-8)`」)。ただし文末の `)` の後に句点が続く場合は空白を入れません。
- コロンは半角の `:` を使います (`docs/ja` は全角の「：」を使っていません)。

### 6. 空白 (和文と英数字の間)

`docs/ja` は、和文と半角の英数字・インラインコードの間に半角スペースを入れています (実測で約 4,500 箇所。スペースなしは約 230 箇所)。これに従います。

- 「`fromRows` で」「R の `foo`」「p 値」「1 つ」「2 標本」

### 7. 数字と単位

数字と単位は半角です (例: `1e-8`、`95%`、`0.05`)。数字と「つ」「標本」などの助数詞の間には空白を入れます (例: 「1 つ」「2 標本」「1 標本」)。全角の数字は使いません。

### 8. 既定の値

`Default `x`` は「既定は `x`」、`Default: x` は「既定: `x`」のように「既定」と訳します。「デフォルト」は使いません (`docs/ja` で 0 回)。

### 9. オプションの説明

`Options for {@link x}` は「{@link x} のオプション」とします。

### 10. 引数とパラメータ

- JavaScript の関数の引数 (`@param`) は「引数」と訳します。
- 統計の母数や分布の形状を指す「parameter」は「パラメータ」と訳します (例: 「形状パラメータ」)。
- 同じ語でも文脈で使い分けます。迷ったら「引数」か「パラメータ」を文脈から決め、報告に書きます。

### 11. 人名に由来する検定名と分布名

`docs/ja` では、人名に由来する検定名は英字のまま使われています (Welch、Fisher、Wilcoxon、Tukey、Kruskal、Pearson、Satterthwaite、Dunnett など)。一方、分布名は カタカナ で書かれています (ポアソン、ガンマ、ベータ、ワイブル、対数正規、逆ガウス など)。この表の訳語もこれに従います。

分布名と同じく、数学で定着した人名由来の用語もカタカナにします (ヘッセ行列、ヤコビ行列、ベッセル関数)。それ以外の人名 (手法名、検定名、統計量名) は英字です。

### 12. 語の揺れ

同じ語に複数の訳がある場合は、ここで決めた訳に統一します。表に無い語を訳すときは、先に `docs/ja/*.md` を検索してください。

---

## 用語表

### 1. 検定と結果

| 英語 | 日本語 | 注記 |
|---|---|---|
| test | 検定 | |
| null hypothesis | 帰無仮説 | `docs/ja` で使用 |
| alternative hypothesis | 対立仮説 | `alternative` オプションの値 (`"two.sided"` など) は英字のまま |
| one-sided | 片側 | `docs/ja` で使用 |
| two-sided | 両側 | `docs/ja` で使用 |
| significance level | 有意水準 | `docs/ja` で使用 |
| p-value | p 値 | `docs/ja` で 72 回。「p」と「値」の間に空白 |
| test statistic | 検定統計量 | |
| confidence level | 信頼水準 | |
| confidence interval | 信頼区間 | `docs/ja` で使用 |
| estimate (noun) | 推定値 | |
| standard error | 標準誤差 | `docs/ja` で使用 |
| standard deviation | 標準偏差 | |
| variance | 分散 | |
| degrees of freedom | 自由度 | `docs/ja` で使用 |
| numerator degrees of freedom | 分子の自由度 | |
| denominator degrees of freedom | 分母の自由度 | |
| effect size | 効果量 | `docs/ja` で使用 |
| power | 検出力 | `docs/ja` で使用 |
| sample | 標本 | `docs/ja` で使用 |
| sample size | 標本サイズ | `docs/ja` で使用 |
| parameter (statistical) | 母数 | 固定の母集団の値。分布の形状などは「パラメータ」 (「10」を参照) |
| exact test | 正確検定 | `docs/ja` で「正確」を使用 |
| approximation | 近似 | `docs/ja` で使用 |
| asymptotic | 漸近 | `docs/ja` で使用 |
| continuity correction | 連続性補正 | `docs/ja` で使用 |
| one-way (ANOVA) | 一元配置 | `docs/ja` で使用 |
| contingency table | 分割表 | `docs/ja` で使用 |
| expected counts | 期待度数 | |
| goodness of fit | 適合度 | `docs/ja` で使用 |
| chi-squared test | カイ二乗検定 | `docs/ja` で「カイ二乗」を使用 (「カイ 2 乗」は使わない)。`χ²` の記号は `docs/ja` で使用 |
| Fisher's exact test | Fisher の正確検定 | 人名は英字のまま (規則 11) |
| Wilcoxon rank sum test | Wilcoxon の順位和検定 | 人名は英字 |
| rank | 順位 | `docs/ja` で使用 |
| ties | 同順位 | `docs/ja` で使用 |
| multiple comparisons | 多重比較 | `docs/ja` で使用 |
| Tukey (HSD) | Tukey (HSD) | 人名は英字 |
| equivalence test (TOST) | 同等性検定 (TOST) | `docs/ja` で「同等性」を使用 |
| odds ratio | オッズ比 | `docs/ja` で使用 |
| likelihood ratio | 尤度比 | `docs/ja` で使用 |
| score test | スコア検定 | |
| Monte Carlo | モンテカルロ | |
| bootstrap | ブートストラップ | |
| simulation | シミュレーション | |
| maximum likelihood | 最尤法 | `docs/ja` で「最尤」を使用 |

### 2. 分布

| 英語 | 日本語 | 注記 |
|---|---|---|
| distribution | 分布 | |
| probability density | 確率密度 | 「密度」「対数密度」は `docs/ja` で使用 |
| cumulative distribution function | 累積分布関数 | |
| quantile | 分位点 | `docs/ja` で使用 |
| central distribution | 中心分布 | `docs/ja` で使用 |
| noncentral distribution | 非心分布 | `docs/ja` で使用 |
| noncentrality parameter | 非心度 | `docs/ja` で使用 (`ncp` は英字のまま) |
| normal distribution | 正規分布 | `docs/ja` で使用 |
| t distribution | t 分布 | `t` は英字。空白あり |
| chi-squared distribution | カイ二乗分布 | |
| F distribution | F 分布 | 空白あり |
| beta distribution | ベータ分布 | `docs/ja` で「ベータ」を使用 |
| gamma distribution | ガンマ分布 | `docs/ja` で「ガンマ」を使用 |
| binomial distribution | 二項分布 | `docs/ja` で使用 |
| negative binomial | 負の二項分布 | `docs/ja` で使用 |
| Poisson distribution | ポアソン分布 | `docs/ja` で「ポアソン」を使用 |
| hypergeometric | 超幾何分布 | `docs/ja` で使用 |
| exponential | 指数分布 | `docs/ja` で使用 |
| Weibull | ワイブル分布 | `docs/ja` で使用 |
| log-normal | 対数正規分布 | `docs/ja` で使用 |
| inverse Gaussian | 逆ガウス分布 | `docs/ja` で使用 |
| uniform | 一様分布 | `docs/ja` で使用 |
| studentized range | スチューデント化された範囲 | `docs/ja` で使用 |
| shape (parameter) | 形状 | 引数名 `shape` は英字 |
| scale (parameter) | 尺度パラメータ | 引数名 `scale` は英字 |
| tail | 裾 | `docs/ja` で使用 |
| mean | 平均 | |
| skewness | 歪度 | `docs/ja` で使用 |
| kurtosis | 尖度 | `docs/ja` で使用 |
| log density | 対数密度 | `docs/ja` で使用 |
| random variate | 乱数 | `docs/ja` で使用 |
| seed | 乱数の種 | `docs/ja` で「乱数の種 (シード)」の形を使用 |

### 3. 回帰・分散分析・一般化線形モデル

| 英語 | 日本語 | 注記 |
|---|---|---|
| regression | 回帰 | |
| logistic regression | ロジスティック回帰 | `docs/ja` で使用 |
| linear model | 線形モデル | `docs/ja` で使用 |
| generalized linear model | 一般化線形モデル | `docs/ja` で使用 |
| predictor | 説明変数 | `docs/ja` で使用 |
| covariate | 共変量 | `docs/ja` で使用 |
| coefficient | 係数 | `docs/ja` で使用 |
| intercept | 切片 | `docs/ja` で使用 |
| slope | 傾き | `docs/ja` で使用 |
| residual | 残差 | `docs/ja` で使用 |
| fitted value | 当てはめ値 | `docs/ja` で使用 |
| fit (noun) | 当てはめ | `docs/ja` で使用。動詞は「当てはめる」 |
| factor (in ANOVA) | 因子 | `docs/ja` で使用 |
| level (of a factor) | 水準 | `docs/ja` で使用 |
| group | 群 | `docs/ja` で使用 |
| interaction | 交互作用 | `docs/ja` で使用 |
| fixed effect | 固定効果 | `docs/ja` で使用 |
| random effect | 変量効果 | `docs/ja` で使用 |
| sum of squares | 平方和 | `docs/ja` で使用 |
| deviance | 逸脱度 | `docs/ja` で使用 |
| family (GLM) | 分布族 | `docs/ja` で使用 |
| AIC | AIC | 英字のまま。`docs/ja` で使用 |
| correlation coefficient | 相関係数 | `docs/ja` で使用 |
| covariance | 共分散 | `docs/ja` で使用 |

### 4. 混合モデル

| 英語 | 日本語 | 注記 |
|---|---|---|
| mixed model | 混合モデル | `docs/ja` で使用 |
| linear mixed model | 線形混合モデル | `docs/ja` で使用 |
| variance component | 分散成分 | `docs/ja` で使用 |
| REML | REML | 英字のまま。制限付き最尤法 |
| random intercept | ランダム切片 | |
| convergence | 収束 | `docs/ja` で使用 |
| iteration | 反復 | `docs/ja` で使用 |

### 5. 生存時間解析

| 英語 | 日本語 | 注記 |
|---|---|---|
| survival | 生存 | `docs/ja` で使用 |
| survival function | 生存関数 | `docs/ja` で使用 |
| hazard | ハザード | `docs/ja` で使用 |
| hazard ratio | ハザード比 | |
| censoring | 打ち切り | `docs/ja` で使用 |
| Kaplan-Meier | Kaplan-Meier | 人名は英字 |
| Cox proportional hazards | Cox 比例ハザード | 人名は英字 |

### 6. 多変量解析・信頼性

| 英語 | 日本語 | 注記 |
|---|---|---|
| multivariate | 多変量 | |
| factor analysis | 因子分析 | `docs/ja` で使用 |
| principal component | 主成分 | `docs/ja` で使用 |
| eigenvalue | 固有値 | `docs/ja` で使用 |
| eigenvector | 固有ベクトル | `docs/ja` で使用 |
| reliability | 信頼性 | |
| intraclass correlation | 級内相関 | `docs/ja` で使用 |
| agreement | 一致 | `docs/ja` で使用 |
| correlation matrix | 相関行列 | `docs/ja` で使用 |

### 7. 線形代数・数値計算

| 英語 | 日本語 | 注記 |
|---|---|---|
| matrix | 行列 | `docs/ja` で使用 |
| square matrix | 正方行列 | `docs/ja` で使用 |
| diagonal (matrix) | 対角行列 | `docs/ja` で「対角」を使用 |
| triangular matrix | 三角行列 | `docs/ja` で使用 |
| determinant | 行列式 | `docs/ja` で使用 |
| inverse (matrix) | 逆行列 | `docs/ja` で使用 |
| transpose | 転置 | `docs/ja` で使用 |
| Cholesky decomposition | コレスキー分解 | `docs/ja` で使用 |
| singular value decomposition | 特異値分解 | `docs/ja` で使用 |
| norm | ノルム | `docs/ja` で使用 |
| tolerance | 許容誤差 | `docs/ja` で「許容」を使用 |
| accuracy | 精度 | `docs/ja` で使用 |
| significant digits | 有効数字 | `docs/ja` で使用 |
| rounding | 丸め | `docs/ja` で使用 |
| double precision | 倍精度 | `docs/ja` で使用 |
| underflow | アンダーフロー | `docs/ja` で使用 |
| overflow | オーバーフロー | `docs/ja` で使用 |
| infinity | 無限大 | |
| interpolation | 補間 | `docs/ja` で使用 |

### 8. データフレーム・欠測値

| 英語 | 日本語 | 注記 |
|---|---|---|
| data frame | データフレーム | `docs/ja` で使用 |
| column | 列 | |
| row | 行 | |
| column names | 列名 | |
| missing value | 欠測値 | `docs/ja` で「欠測値」を使用 (「欠損値」は使わない) |
| NA | NA | 英字のまま |
| dropped (rows) | 除外 | 欠測値を含む行などが除外されること |
| omitted (argument) | 省略 | 引数を省略したとき |
| count | 度数 | `docs/ja` で使用 |
| pivot | ピボット | `docs/ja` で使用 |

### 9. JavaScript 固有の用語

| 英語 | 日本語 | 注記 |
|---|---|---|
| array | 配列 | `docs/ja` で使用 |
| method | メソッド | `docs/ja` で使用 |
| function | 関数 | `docs/ja` で使用 |
| option (object) | オプション | |
| default (as a value) | 既定 | 「Default `x`」は「既定は `x`」 (規則 8) |
| parameter (JS) | 引数 | `docs/ja` で使用 |
| return value | 戻り値 | `docs/ja` は「返す」を多く使用 |
| throws | 例外を投げる | `docs/ja` で「例外」を使用 |
| error | エラー | |
| warning | 警告 | `docs/ja` で使用 |
| deprecated | 非推奨 | |
| callback | コールバック | |
| Promise | Promise | 英字のまま |
| RangeError, TypeError | RangeError, TypeError | 英字のまま |
| Node.js | Node.js | 英字のまま |

## 翻訳で追加した用語

| 英語 | 日本語 | 注記 |
|---|---|---|
| Wald (test, statistic) | Wald 検定、Wald 統計量 | 人名は英字 |
| log-rank test | ログランク検定 | |
| number at risk | リスク集合の大きさ、リスク集合の人数 | R の `n.risk` |
| baseline hazard | ベースラインハザード | |
| stratum / strata | 層 | |
| log partial likelihood | 対数部分尤度 | |
| case weights | 観測値の重み | |
| robust variance | ロバスト分散 | |
| linear predictor | 線形予測子 | |
| singular (matrix) | 特異 | |
| rank (of a matrix) | ランク | 統計量の順位は「順位」 |
| aliased (column) | 縮退した (列) | 線形従属で除かれた列 |
| centred / scaled | 中心化 / スケーリング | |
| pooled | 併合 | |
| pointwise | 各時点の | 生存曲線の文脈 |
| distinct (values, times) | 相異なる | |
| machine epsilon | 機械イプシロン | |
| Newton-Raphson | Newton-Raphson 法 | 人名は英字 |
| random number generator | 乱数生成器 | `docs/ja` で使用 |
| uniform random number | 一様乱数 | `docs/ja` で使用 |
| stream (of random numbers) | ストリーム | `docs/ja` で使用。並列処理で独立に使う乱数列 |
| substream | サブストリーム | |
| state (of a generator) | 状態 | `docs/ja` で「乱数生成器の状態」として使用 |
| kind (of a generator) | 種類 | 引数 `kind`、`sampleKind` は英字 |
| kind code | 種類コード | `.Random.seed` の先頭の整数 (新規) |
| Mersenne-Twister | Mersenne-Twister | 英字のまま (人名由来) |
| L'Ecuyer-CMRG | L'Ecuyer-CMRG | 英字のまま (人名由来) |
| rejection (sampling) | 棄却法 | 標準的な訳語 (新規)。値 `"Rejection"` は英字 |
| inversion (method) | 逆関数法 | `docs/ja` で使用 |
| sampling with replacement | 復元抽出 | `docs/ja` に該当例なし (新規) |
| sampling without replacement | 非復元抽出 | `docs/ja` に該当例なし (新規) |
| random sample (of elements) | 無作為抽出 | `docs/ja` で使用 |
| candidates (for sampling) | 候補 | (新規) |
| permutation | 順列 | `docs/ja` で使用 |
| urn | つぼ | `docs/ja` で使用。ひらがな |
| white ball, black ball | 白玉、黒玉 | `docs/ja` で使用 (超幾何分布の説明) |
| multinomial distribution | 多項分布 | `docs/ja` で使用 |
| Wilcoxon signed rank statistic | Wilcoxon の符号付き順位統計量 | 人名は英字。`docs/ja` で使用 |
| Wilcoxon rank sum statistic | Wilcoxon の順位和統計量 | 人名は英字。`docs/ja` で使用 |
| truncated (toward zero) | 切り捨て | `docs/ja` で使用 (「R と同じく切り捨て」) |
| two-way table | 2 元分割表 | `docs/ja` で使用 |
| row totals, column totals | 行和、列和 | `docs/ja` で使用 |
| grand total | 総和 | |
| dispersion parameter | 分散パラメータ | `docs/ja` で使用。分散 (variance) と区別する |
| location (parameter) | 位置パラメータ | `docs/ja` で使用 |
| rate (parameter) | 率 | 引数名 `rate` は英字。`docs/ja` で使用 |
| Student's t distribution | Student の t 分布 | `docs/ja` で使用。人名は英字 |
| arcsine distribution | 逆正弦分布 | `docs/ja` で使用 |
| triangular distribution | 三角分布 | `docs/ja` で使用 |
| geometric distribution | 幾何分布 | `docs/ja` で使用 |
| inverse gamma distribution | 逆ガンマ分布 | `docs/ja` で使用 |
| Cauchy distribution | コーシー分布 | `docs/ja` で使用 |
| Laplace distribution | ラプラス分布 | `docs/ja` で使用 |
| Pareto distribution | パレート分布 | `docs/ja` で使用 |
| logistic distribution | ロジスティック分布 | `docs/ja` で使用 |
| Kumaraswamy distribution | クマラスワミ分布 | `docs/ja` で使用 |
| Patefield's algorithm | Patefield のアルゴリズム | 人名は英字 |
| Stirling correction | Stirling 補正 | 人名は英字。`docs/ja` で使用 |
| clock (seed from the clock) | 時刻 | 種を時刻から作ること (新規) |
| break point (of a histogram or cut) | 区切り点 | 新規。`cut` と `hist` で使用 |
| interval (cut, findInterval, pretty) | 区間 | 新規 |
| cell (of a histogram) | 階級 | 新規。`hist` の階級 (階級幅、階級の中点) |
| cell (of pretty) | 区間幅 | 新規。`pretty` の最小単位 |
| bin (of tabulate) | ビン | 新規 |
| interquartile range | 四分位範囲 | 新規 |
| five-number summary | 五数要約 | 新規。Tukey の五数要約 |
| hinge | ヒンジ | 新規。Tukey の五数要約 |
| median absolute deviation | 中央絶対偏差 | 新規 |
| mean absolute deviation | 平均絶対偏差 | 新規 |
| absolute deviation | 絶対偏差 | 新規 |
| excess kurtosis | 超過尖度 | 新規 |
| coefficient of variation | 変動係数 | 新規 |
| empirical distribution function | 経験分布関数 | 新規 |
| running sum, product, maximum, minimum (cumulative) | 累積和、累積積、累積最大値、累積最小値 | 新規 |
| lag (of differences) | ラグ | 新規 |
| trimmed mean | 刈り込み平均 | 新規 |
| arithmetic mean, geometric mean | 算術平均、幾何平均 | 新規 |
| weighted mean | 重み付き平均 | 新規 |
| sum, product (of values) | 和、積 | 新規 |
| range (of values) | 範囲 | 新規 |
| mode (statistical) | 最頻値 | 新規 |
| midpoint | 中点 | 新規 |
| frequency table | 度数表 | 新規 |
| centre (noun) | 中心 | 新規。動詞・形容詞の「centred」は「中心化」 |
| scale factor | 尺度係数 | 新規 |
| non-decreasing | 非減少 | 新規 |
| lo-median, hi-median | 下側中央値、上側中央値 | 新規。引用符付きの値 |
| double-double | double-double | 英字のまま。精度の実装方式 |
| long double | long double | 英字のまま。R の型 |
| Hyndman and Fan (quantile type) | Hyndman and Fan | 人名は英字 |
| Freedman-Diaconis | Freedman-Diaconis | 人名は英字 |
| Sturges (rule, formula) | Sturges | 人名は英字 |
| Kendall's tau, Spearman's rho | Kendall の tau、Spearman の rho | 人名は英字 |
| boolean | 真偽値 | 新規 (`docs/ja` で 1 件)。`true` / `false` の値 |
| vector | ベクトル | `docs/ja/r-functions.md` で使用。欠測値を含む値の並び |
| regular expression | 正規表現 | 新規 (`docs/ja` で 1 件) |
| capture group | キャプチャグループ | 新規。正規表現の括弧で捕らえた部分 |
| suffix | 接尾辞 | 新規。`merge` の `suffixes` |
| join (of two data frames) | 結合 | `docs/ja` で使用 (「表の結合」「キー列による 2 つのデータフレームの結合」) |
| key column | キー列 | `docs/ja/r-functions.md` で使用 |
| cross join | 直積 | 新規。キー列がないときの `merge` |
| combination (of groups) | 組み合わせ | 新規。群の組み合わせ |
| column-major order | 列優先の順 | 新規。最初の因子が最も速く変わる順 |
| label (of a group) | ラベル | `docs/ja` で使用。群のラベル |
| handler | ハンドラー | 新規。`setWarningHandler` の処理関数 |
| value column (of a reshape) | 値の列 | 新規。`pivotLonger` / `pivotWider` の `valuesTo` |
| ID column | ID 列 | 新規。`pivotWider` の識別用の列 |
| wide, long (format) | 横長、縦長 | 新規。データの形 |
| match (of rows) | 対応 | 新規。`merge` で行が対応すること |
| cell (of a table, tapply, pivot) | セル | `docs/ja` で使用 (分割表の「セル」)。ヒストグラムの「階級」とは別 |
| own property | 自身のプロパティ | 新規。JavaScript の用語 |
| cast (to a type) | 型に変換 | 新規。tidyr と同じく、値の列の型へ変換すること |
| concatenate | 連結 | 新規。名前へ文字列をつなぐこと |
| split (into groups) | 群に分ける | 新規。`split` の説明 |
| summarise (verb) | 要約する | `docs/ja` で「要約」を使用 |
| row object | 行のオブジェクト | 新規。`fromRows` / `toRows` の行の形 |
| non-empty | 空でない | 新規。`docs/ja` の「空のセル」と同じ語感 |
| control (group) | 対照群 | `docs/ja` で使用 (「対照群に対する平均」) |
| contrast | 対比 | `docs/ja` で使用 |
| simultaneous (p-values, probabilities) | 同時 | `docs/ja` で使用 (「同時 p 値」「同時正規確率」)。`"single-step"` は英字のまま |
| all-pairs (test, comparisons) | 全対比較 | `docs/ja` で使用 |
| many-to-one (test, comparisons) | 多対一 | `docs/ja` で使用 |
| pairwise comparisons | ペアごとの比較 | 新規。`docs/ja` の「ペアごと」に合わせた |
| family-wise (confidence level) | 族単位 | 新規 |
| response (variable) | 応答変数 | 新規。`x` の値の説明 |
| 1-based | 1 始まり | `docs/ja` で使用 |
| step-wise adjustment | 段階的な調整 | `docs/ja` で使用 |
| randomised integration | 乱数による積分 | 新規。R が近似に使う方法 |
| tie correction | 同順位補正 | 新規。`ties` の補正 |
| midranks | 中間順位 | 新規 |
| monotonicity | 単調性 | 新規 |
| standardised (statistic) | 標準化 | `docs/ja` で使用 |
| adjusted p-value | 調整済みの p 値 | `docs/ja` で使用 |
| alias (of a property) | 別名 | `docs/ja` で「の別名です」を使用 |
| lower-triangular (table) | 下三角 | `docs/ja` で使用 |
| upper tail | 上側の裾 | 新規。「上側」は `docs/ja` で使用 |
| lower end, upper end (of an interval) | 下端、上端 | 新規 |
| number of comparisons | 比較の数 | 新規 |
| unambiguous abbreviation | 曖昧さのない省略形 | 新規 |
| number of observations | 観測数 | 新規。`docs/ja` の「観測数」と同じ語 (効果量の引数の説明) |
| total number of observations | 観測数の総数 | 新規 |
| paired samples | 対応のある標本 | `docs/ja` で「対応のある標本」を使用 |
| averaged standard deviation | 平均した標準偏差 | 新規。併合 (pooled) 標準偏差と対比 |
| eta squared | イータ二乗 | `docs/ja` で使用 |
| generalized eta squared | 一般化イータ二乗 | 新規 |
| partial (effect size) | 部分効果量 | 新規。項ごとの部分効果量 |
| epsilon squared | イプシロン二乗 | 新規 |
| omega squared | オメガ二乗 | 新規 |
| conventional (sizes, effect sizes) | 慣例的な | 新規。Cohen の「慣例的な」大きさ |
| small-sample correction | 小標本補正 | `docs/ja` で使用 |
| Cohen's d | Cohen の d | 人名は英字 |
| Hedges' g | Hedges の g | 人名は英字 |
| root finding | 求根 | 新規 |
| error stratum | 誤差層 | 新規。`stratum` の「層」を使う |
| balanced (design) | 釣り合いのとれた | 新規 |
| general linear model | 一般線形モデル | 新規 |
| arcsine transformation | 逆正弦変換 | 新規 |
| test of association | 連関の検定 | 新規 |
| Fisher's z transformation | Fisher の z 変換 | 人名は英字。新規 |
| variance between, within the groups' means | 群平均の間の分散、群内の分散 | 新規 |
| true difference in means | 真の平均の差 | 新規 |
| upper, lower confidence limit | 信頼区間の上限、下限 | 新規 |
| open (one-sided interval) | 開いた (区間) | 新規。片側区間のもう一方の側 |
| Type I, Type II, Type III | Type I, Type II, Type III | 英字のまま。`docs/ja` で「Type II と III」を使用 |
| marginality | 周辺性 | `docs/ja` で使用。car の Type II の原則 |
| sphericity | 球面性 | `docs/ja` で使用 |
| sphericity correction | 球面性の補正 | 新規。Greenhouse-Geisser と Huynh-Feldt の補正 |
| Mauchly test | Mauchly 検定 | 人名は英字。`docs/ja` で使用 |
| Greenhouse-Geisser, Huynh-Feldt | Greenhouse-Geisser、Huynh-Feldt | 人名は英字 (規則 11) |
| partial eta squared | 部分イータ二乗 | `docs/ja` で使用。`"pes"` の効果量 |
| mean square | 平均平方 | `docs/ja` で使用 |
| residual mean square | 残差平均平方 | `docs/ja` で使用 |
| between-subjects factor | 被験者間因子 | `docs/ja` で使用 |
| within-subjects factor | 被験者内因子 | `docs/ja` で使用。被験者間因子と対 |
| formula | 式 | 新規。`"y ~ A * B"` などの R の式 |
| model matrix | モデル行列 | `docs/ja` で使用 |
| term (of a model) | 項 | `docs/ja` で使用。`terms()` の項 |
| indicator (variable) | 指示変数 | `docs/ja` で使用。因子の水準を 0 と 1 で表す列 |
| rank-deficient | ランク不足 | `docs/ja` で使用 |
| non-estimable | 推定できない | 新規。ランク不足の当てはめの予測に使う |
| weighted least squares | 重み付き最小二乗法 | `docs/ja` で使用 |
| pivoting (QR) | ピボット | `docs/ja` で「qr のピボット」として使用。`pivot` と同じ訳語 |
| attribute (of an R object) | 属性 | `docs/ja` で使用。`terms()` の属性 |
| observed (factor) | 観測された因子 | 新規。`aovEz` の `observed` |
| univariate (test) | 単変量 | `docs/ja` に 1 件 |
| sequential (sums of squares) | 逐次 | `docs/ja` で「逐次の表」として使用 |
| analysis of deviance | 逸脱度分析 | 新規。`glmAnova` の表 |
| residual deviance | 残差逸脱度 | 新規。`GlmResult.deviance` |
| null deviance | 帰無逸脱度 | 新規。切片だけのモデルの逸脱度 |
| score statistic | スコア統計量 | 新規。`"Rao"` の検定の統計量 |
| power link | べき乗リンク | 新規。`mu^power` のリンク |
| variance function | 分散関数 | 新規。`quasi` の分散関数 |
| prior weights | 事前重み | `docs/ja` で使用 |
| working weights | 作業重み | `docs/ja` で使用 |
| working residuals | 作業残差 | `docs/ja` で使用 |
| iteratively reweighted least squares | 反復重み付き最小二乗法 | `docs/ja` で使用 |
| link (of a GLM) | リンク | `docs/ja` で使用 |
| offset | オフセット | `docs/ja` で使用 |
| profile likelihood | プロファイル尤度 | `docs/ja` で使用 |
| profile equations | プロファイルの方程式 | 新規。`glmConfint` の輪郭方程式 |
| profile points | プロファイルの点 | 新規。R のスプラインの格子の点 |
| hat matrix | ハット行列 | `docs/ja` で使用 |
| Cook's distance | Cook の距離 | 人名は英字。`docs/ja` で使用 |
| standardized residuals | 標準化残差 | 新規。Pearson 残差などの標準化 |
| z statistic, t statistic | z 統計量、t 統計量 | 新規。出力の `"z value"`、`"t value"` は英字 |
| starting coefficients | 初期係数 | 新規。`start` の係数 |
| maximum number of iterations | 反復の最大回数 | 新規 |
| convergence tolerance | 収束の許容誤差 | `docs/ja` で使用 |
| residual degrees of freedom | 残差の自由度 | `docs/ja` で使用 |
| successes (number of) | 成功数 | `docs/ja` で使用。「(成功数, 失敗数)」 |
| covariance matrix | 共分散行列 | `docs/ja` で使用 |
| fitted means | 平均の当てはめ値 | 新規。`fitted value` の平均尺度 |
| size (of a binomial response) | サイズ | 新規。二項分布の 2 列応答の行ごとの値 |
| Laplace approximation | Laplace 近似 | `docs/ja/r-functions.md` で使用。人名は英字 |
| adaptive Gauss-Hermite quadrature | 適応的 Gauss-Hermite 求積 | `docs/ja/r-functions.md` で使用。人名は英字 |
| quadrature points | 求積点 | 新規。求積の点数 |
| penalised IRLS | 罰則付き IRLS | `docs/ja/r-functions.md` で使用 |
| Akaike's information criterion | Akaike の情報量規準 | 人名は英字 |
| Schwarz's Bayesian information criterion | Schwarz のベイズ情報量規準 | 人名は英字 |
| information criterion | 情報量規準 | `docs/ja` で使用 |
| saturated model | 飽和モデル | 新規 |
| covariance parameters | 共分散パラメータ | 新規。`theta` の値 |
| relative covariance factor | 相対共分散因子 | 新規 |
| spherical random effects | 球面化された変量効果 | 新規 |
| conditional modes (of random effects) | 条件付きモード | 新規。変量効果の推定値 |
| grouping factor | グループ化因子 | 新規。変量効果の群を定める因子 |
| random-effects term | 変量効果の項 | 新規 |
| fixed-effects part (of a formula) | 固定効果の部分 | 新規 |
| Hessian | ヘッセ行列 | `docs/ja/r-functions.md` で使用 |
| Satterthwaite's degrees of freedom | Satterthwaite の自由度 | 人名は英字。`docs/ja` で使用 |
| deviance residuals | 逸脱度残差 | `docs/ja` で使用 |
| Pearson residuals | Pearson 残差 | 人名は英字。`docs/ja` で使用 |
| response residuals | 応答残差 | 新規 |
| scaled residuals | 尺度化残差 | `docs/ja/r-functions.md` で使用 |
| singular fit | 特異な当てはめ | 新規。`singular (matrix)` の「特異」と同じ語 |
| REML criterion | REML 基準 | 新規 |
| ML | ML | 英字のまま。最尤法 |
| log-likelihood | 対数尤度 | `docs/ja` で使用 |
| quartile | 四分位点 | 新規 |
| treatment contrasts | 処理対比 | 新規 |
| Cholesky factor | コレスキー因子 | 新規 |
| joint F-test | 同時 F 検定 | 新規。行をまとめて検定する F 検定 |
| quasi families | quasi 系の分布族 | 新規 |
| rank of the hypothesis | 仮説のランク | 新規 |
| level scores | 水準の得点 | 新規 |
| orthogonal polynomials | 直交多項式 | 新規 |
| identity link | identity リンク | 新規。値 `"identity"` は英字 |
| population level | 母集団の水準 | 新規 |
| Laplace approximation | Laplace 近似 | 新規 (`glmer`) |
| adaptive Gauss-Hermite quadrature | 適応的 Gauss-Hermite 求積 | 新規 (`nAGQ > 1`)。人名は英字 |
| penalised IRLS | 罰則付き IRLS | 新規。IRLS は英字 |
| conditional mode | 条件付きモード | 新規。変量効果の推定値 |
| criterion (optimised) | 基準 | 既存の訳語 (`REML 基準`、`REMLcrit`) で使用 |
| grouping factor | グループ化因子 | 既存の訳語で使用 |
| Satterthwaite (degrees of freedom) | Satterthwaite の自由度 | 人名は英字 (規則 11) |
| Henderson's equations | Henderson の方程式 | 人名は英字 (新規) |
| Hessian | ヘッセ行列 | 既存の訳語で使用 |
| Cholesky factor | コレスキー因子 | 新規。`コレスキー分解` の因子 |
| saturated model | 飽和モデル | 新規 |
| Wald sum of squares | Wald 平方和 | 新規。Wald は人名英字 |
| sparse (computation) | 疎 | 新規。疎な行列の計算 |
| covariance parameters | 共分散パラメータ | 新規。`θ` (英字の記号は残す) |
| relative covariance factor | 相対共分散因子 | 新規 |
| nested (models) | ネストしている | 新規。モデルの包含関係。「ネストしたモデル」とも書く |
| nested (factor levels, `a/b`) | 入れ子 | 新規。`a/b` の意味 |
| contrast | 対比 | 新規。`L β = rhs` の `L` |
| refit | 当てはめ直し | 新規 |
| scaled residuals | 尺度化された残差 | 新規 |
| random-effects term | 変量効果の項 | 新規。`random effect` の訳 (変量効果) を項に付けた形 |
| boundary (of θ) | 境界 | 新規。「境界上」 |
| Fisher weights | Fisher 重み | 新規。Fisher は人名英字 |
| working weights | 作業用の重み | 新規 |
| prior weights | 事前の重み | 新規 |
| offset | オフセット | 新規 |
| link (function) | リンク | 新規 (`glm` の `link`) |
| inverse link | 逆リンク | 新規 |
| variance function | 分散関数 | 新規 |
| response (variable) | 応答 | 新規。`応答変数` とはしない |
| log-likelihood | 対数尤度 | 新規 (`logLik`) |
| deviance residuals | 逸脱度残差 | 新規 |
| information criteria | 情報量規準 | 新規。`AIC` と `BIC` が含まれる |
| ANOVA table | 分散分析表 | 既存の訳語で使用 |
| mean square | 平均平方 | 新規 |
| t-test | t 検定 | 新規。`t` は英字。空白あり |
| F-test | F 検定 | 新規。`F` は英字。空白あり |
| Cronbach's alpha | Cronbach の α | `docs/ja/r-functions.md` で使用 |
| Guttman's lambda 6 | Guttman の λ6 | `docs/ja/r-functions.md` で使用。人名は英字 |
| squared multiple correlations | 重相関係数の二乗 | 新規 |
| raw alpha | raw alpha | 英字のまま。共分散から求めた α |
| uniquenesses | 独自因子分散 | `docs/ja/differences-from-r.md` で使用 |
| factor scores | 因子得点 | 新規 |
| Thomson's method (factor scores) | Thomson の方法 | 人名は英字。新規 |
| loadings | 負荷量 | `docs/ja/differences-from-r.md` で使用 |
| rotation (of loadings) | 回転 | 新規 |
| rotation matrix | 回転行列 | 新規 |
| varimax, promax, oblimin, minres | 英字のまま | 回転法・因子解法の名前。値 `"varimax"` などと同じ |
| F statistic | F 統計量 | 新規。`z statistic, t statistic` と同じ形 |
| kappa (coefficient) | κ 係数 | 記号 κ は `docs/ja/r-functions.md` で使用 |
| Cohen's kappa | Cohen の κ | `docs/ja/r-functions.md` で使用 |
| Fleiss' kappa | Fleiss の κ | `docs/ja/r-functions.md` で使用 |
| Conger's exact kappa | Conger の正確な κ | 新規 |
| McDonald's omega | McDonald の ω | `docs/ja/r-functions.md` で使用 |
| omega hierarchical | 階層的 ω | 新規 |
| omega asymptotic | 漸近 ω | 新規 |
| omega total | 全体の ω | 新規 |
| Schmid-Leiman transformation | Schmid-Leiman 変換 | 人名は英字。`docs/ja/r-functions.md` で使用 |
| pattern matrix (oblique) | パターン行列 | 新規 |
| factor correlations | 因子間相関 | 新規 |
| first-order (factors) | 一次因子 | 新規 |
| general factor | 一般因子 | 新規 |
| group factor | 群因子 | 新規 |
| explained common variance | 説明された共通分散 | 新規 |
| ultra-Heywood (case) | ultra-Heywood の場合 | 新規。`docs/ja/differences-from-r.md` の「(Heywood)」と同じ語 |
| forms (of the intraclass correlation) | 形式 | 新規。`McGraw and Wong's forms` |
| two-way (model) | 二元配置 | 新規。`one-way` の「一元配置」と対 |
| disagreement | 不一致 | 新規 |
| weighted, unweighted (kappa) | 重み付き、重みなし | `docs/ja/r-functions.md` の「重みなし」を使用。「重み付き」は「重み付き平均」と統一 |
| polychoric correlation | 多分相関 | 新規 |
| polyserial correlation | ポリシリアル相関 | `docs/ja/r-functions.md` で使用 |
| partial correlation | 偏相関 | 新規 |
| bivariate normality | 2 変量正規性 | 新規 |
| threshold (of an ordinal variable) | 閾値 | 新規 |
| ordinal variable | 順序変数 | 新規 |
| numeric variable | 数値変数 | 新規 |
| category (of a variable) | カテゴリ | 新規 |
| chi-square statistic | カイ二乗統計量 | 新規。「カイ二乗」は `chi-squared test` と同じ |
| item (of a scale) | 項目 | `docs/ja/r-functions.md` で使用 |
| rater | 評定者 | `docs/ja/r-functions.md` で使用 |
| rating | 評定 | `docs/ja/r-functions.md` で使用 |
| subject (of a study) | 被験者 | `docs/ja` で使用 (`between-subjects factor`) |
| observation (row of data) | 観測値 | 新規。`number of observations` の「観測数」と対 |
| message (of R) | メッセージ | 新規 |
| lower bound, upper bound | 下限、上限 | 新規。区間の端は `lower end, upper end` (下端、上端) |
| starting values | 初期値 | 新規。`starting coefficients` の「初期係数」と対 |
| optimisation | 最適化 | `docs/ja/performance.md` で使用 |
| evaluations (of function, gradient) | 評価回数 | 新規 |
| reversed item, flipped item | 反転 | 新規。符号を反転すること |
| positive definite | 正定値 | 新規。`chol` の前提 |
| positive semi-definite | 半正定値 | 新規 |
| upper triangular | 上三角 | `docs/ja` で使用 (上三角行列) |
| triangular factor | 三角因子 | 新規。`R` などの三角行列の因子 |
| quasi-triangular | 準三角 | 新規。Schur 分解の `T` |
| unit lower triangular | 単位下三角 | 新規。LU 分解の `L` |
| permutation (matrix) | 置換行列 | 新規。LU 分解の `P` |
| orthogonal factor | 直交因子 | 新規。Schur 分解の `Q` |
| pivoted (decomposition) | ピボット付き | 新規。`pivot: true` の分解 |
| diagonal pivoting | 対角ピボット | 新規 |
| Householder vector | Householder ベクトル | 新規。Householder は人名のため英字 |
| Hessenberg reduction | Hessenberg 化 | 新規。Hessenberg は人名のため英字 |
| tridiagonalization | 三重対角化 | `docs/ja` で使用 |
| implicit QL method | 陰的 QL 法 | 新規 |
| Francis double-shift QR method | Francis の二重シフト QR 法 | 新規。人名は英字 (規則 11) |
| balancing (of a matrix) | 平衡化 | `docs/ja` で使用。LAPACK の `dgebal` |
| Padé approximant | Padé 近似 | 新規。人名は英字 |
| Taylor polynomial | Taylor 多項式 | 新規。人名は英字 |
| recycling (R's) | リサイクル | 新規。R の要素の再利用規則。`docs/ja/api` で使用 |
| singular value | 特異値 | `docs/ja` で使用 |
| condition number | 条件数 | 新規 |
| reciprocal condition number | 逆数の条件数 | 新規。`rcond` |
| one-norm (1-norm) | 1-ノルム | 新規 |
| infinity norm | 無限大ノルム | 新規 |
| spectral norm | スペクトルノルム | 新規。最大の特異値 |
| Frobenius norm | Frobenius ノルム | 新規。Frobenius は人名は英字 |
| modulus (of a complex number or determinant) | 絶対値 | 新規。`modulus` (行列式) |
| scores (of principal components) | 得点 | 新規。`prcomp` の `x` |
| identity matrix | 単位行列 | 新規 |
| cross-product (matrix) | クロス積 | 新規。`crossprod` |
| compact form (of a decomposition) | コンパクトな形式 | 新規。R の `qr` の表現 |
| 0-based (index) | 0 始まり | 新規。`1-based` の対 |
| Moore-Penrose generalized inverse | Moore-Penrose の一般化逆行列 | `docs/ja/r-functions.md` で使用。人名は英字 |
| Kronecker product | Kronecker 積 | `docs/ja/r-functions.md` で使用 |
| outer product | 外積 | `docs/ja/r-functions.md` で使用 |
| Golub-Reinsch (algorithm) | Golub–Reinsch 法 | 人名は英字。`docs/ja/differences-from-r.md` で「Golub–Reinsch」を使用 |
| Householder transformation | Householder 変換 | 新規。人名は英字 (`Householder vector` と同じ) |
| LINPACK-style (QR) | LINPACK 形式 | 新規。`LINPACK` は英字のまま |
| LU decomposition | LU 分解 | `docs/ja` で使用 |
| partial pivoting | 部分ピボット | `docs/ja` で使用 |
| projection (onto a space) | 射影 | `docs/ja` で使用 |
| space spanned by (vectors) | 張る空間 | `docs/ja` で使用 |
| orthogonal matrix | 直交行列 | `docs/ja/r-functions.md` で使用 |
| orthogonal complement | 直交補空間 | `docs/ja/differences-from-r.md` の「直交補完」は誤記 |
| singular vector | 特異ベクトル | `docs/ja` で使用 |
| Schur decomposition | Schur 分解 | 新規。`quasi-triangular` の行で既に使用 |
| upper quasi-triangular | 上準三角 | 新規。`quasi-triangular` の上三角側 |
| complex conjugate pair | 複素共役の組 | 新規 |
| Padé quotient | Padé 近似の商 | 新規。`expm` の有理近似 |
| conjugate gradient squared method | 共役勾配二乗法 | 新規。英字の名称を括弧で添える |
| scaling and squaring | 尺度化と二乗法 | 新規 |
| triangular system (of equations) | 三角連立方程式 | `docs/ja/r-functions.md` で使用 |
| regular sequence | 等間隔の数列 | 新規。`seq` |
| least squares (coefficients, fitted values, residuals) | 最小二乗 | `docs/ja` で使用 |
| right-hand side | 右辺 | `docs/ja` で使用 |
| LAPACK estimator (of a condition number) | 推定ルーチン | 新規。`rcond`、`kappa` の推定 |
| step function (`method: "constant"`) | 階段関数 | 新規。`approx` の `"constant"` |
| extrapolation rule | 外挿規則 | 新規。`approx` の `rule` (1 は NaN、2 は端の値) |
| Nelder-Mead | Nelder-Mead | 人名は英字 (最適化法) |
| Nelder-Mead reflection factor | 反射係数 | 新規 |
| Nelder-Mead contraction factor | 縮小係数 | 新規 |
| Nelder-Mead expansion factor | 拡大係数 | 新規 |
| simplex | 単体 | 新規。Nelder-Mead の単体 |
| degenerate (simplex) | 退化 | 新規 |
| BFGS | BFGS | 英字のまま (最適化法の名称) |
| L-BFGS-B | L-BFGS-B | 英字のまま (最適化法の名称) |
| SANN | SANN | 英字のまま (最適化法の名称) |
| CG update | 更新式 | 新規。CG の更新式 |
| Fletcher-Reeves, Polak-Ribière, Beale-Sorenson | Fletcher-Reeves、Polak-Ribière、Beale-Sorenson | 人名は英字 (CG の更新式) |
| starting temperature, temperature (SANN) | 初期温度、温度 | 新規 |
| projected gradient | 射影勾配 | 新規。L-BFGS-B の `pgtol` |
| relative reduction tolerance | 相対的な減少の許容誤差 | 新規。L-BFGS-B の `factr` |
| iteration limit | 反復回数の上限 | 新規 |
| objective (function) | 目的関数 | 新規 |
| minimise, maximise | 最小化、最大化 | 新規 |
| control parameters | 制御パラメータ | 新規。`optim` の `control` |
| gradient | 勾配 | 新規 |
| scalar function | スカラー関数 | 新規 |
| vector function | ベクトル関数 | 新規 |
| numerical differentiation | 数値微分 | 新規 |
| finite difference | 有限差分 | 新規 |
| central difference | 中心差分 | 新規 |
| forward difference | 前進差分 | 新規 |
| derivative | 導関数 | 新規 |
| Richardson extrapolation | Richardson 外挿 | 人名は英字 |
| Richardson iteration | Richardson の反復 | 人名は英字。`DerivOptions.r` |
| Jacobian | ヤコビ行列 | 新規。`docs/ja` の Hessian (ヘッセ行列) と同じく片仮名で統一 |
| Brent | Brent | 人名は英字。Brent の zeroin、Brent の黄金分割探索 |
| golden-section search | 黄金分割探索 | 新規 |
| parabolic search | 放物線探索 | 新規 |
| Heun's method | Heun 法 | 人名は英字 |
| Runge-Kutta method | Runge-Kutta 法 | 人名は英字 |
| initial value problem | 初期値問題 | 新規 |
| fixed step | 固定ステップ | 新規。`ode` の固定ステップ |
| equally spaced | 等間隔 | 新規 |
| subinterval | 部分区間 | 新規。`integrate` の `subdivisions` |
| QUADPACK | QUADPACK | 英字のまま (ソフトウェア名) |
| cubic spline | 3 次スプライン | 新規 |
| cubic Hermite spline | 3 次 Hermite スプライン | 新規 |
| Lagrange interpolation | Lagrange 補間 | 人名は英字 |
| Hermite interpolation | Hermite 補間 | 人名は英字 |
| piecewise (cubic) | 区分的 | 新規 |
| barycentric form | 重心形式 | 新規 |
| divided differences | 差分商 | 新規 |
| node (of interpolation) | 節点 | 新規 |
| Bessel function of the first kind | 第 1 種ベッセル関数 | `docs/ja` で使用 (`besselJ`)。ヘッセ行列と同じく定着した訳語なのでカタカナ |
| Bessel function of the second kind | 第 2 種ベッセル関数 | `docs/ja` で使用 (`besselY`) |
| modified Bessel function | 変形ベッセル関数 | `besselI` は「第 1 種変形」、`besselK` は「第 2 種変形」 |
| order (of a Bessel function) | 次数 | `docs/ja` で使用 |
| Debye's uniform expansion | Debye の一様漸近展開 | `docs/ja` で使用。人名は英字 |
| asymptotic expansion | 漸近展開 | `docs/ja` で使用 |
| continued fraction | 連分数 | `docs/ja` で使用 |
| recurrence (formula) | 漸化式 | `docs/ja` で使用 |
| turning point | 転換点 | 新規。ベッセル関数で次数と引数が近い付近 |
| phase correction | 位相の補正 | `docs/ja` で使用 |
| gamma function | ガンマ関数 | `docs/ja` で使用 |
| beta function | ベータ関数 | `docs/ja` で使用 |
| incomplete gamma function | 不完全ガンマ関数 | `docs/ja` で使用 |
| lower / upper incomplete gamma function | 下側 / 上側不完全ガンマ関数 | `docs/ja` で使用 |
| non-regularized | 正則化しない | `docs/ja` で使用 |
| digamma function | ディガンマ関数 | `docs/ja` で使用 (`lgamma` の導関数) |
| polygamma function | ポリガンマ関数 | `docs/ja` で使用 |
| trigamma function | トリガンマ関数 | `docs/ja` で使用 |
| binomial coefficient | 二項係数 | `docs/ja` で使用 |
| factorial | 階乗 | `docs/ja` で使用 |
| error function | 誤差関数 | `docs/ja` で使用 |
| complementary error function | 相補誤差関数 | `docs/ja` で使用 |
| inverse function | 逆関数 | 新規 (`erfinv`、`erfcinv`) |
| subnormal (number) | 非正規化数 | `docs/ja` で使用 |
| round half to even | 最も近い偶数への丸め | 新規 (`psigamma` の `deriv`) |
| nearest integer | 最も近い整数 | `docs/ja` で使用 |
| cancellation (loss of significance) | 桁落ち | `docs/ja` で使用 |
| zero (of a function) | 零点 | `docs/ja` で使用 (`lgamma` の x = 1、x = 2) |
| pole | 極 | 新規 (`lgamma1p` の `Infinity`) |
| exponent (of exp) | 指数 | 新規 (`besselI` の `nu eta - x`)。「指数分布」の「指数」と同じ語 |
| unscaled | 指数スケールなし | 新規。`exponScaled` が `false` の場合 |
| flushed (to zero) | 0 に落とされる | 新規。丸めで 0 になること |
| edge case | 端のケース | `docs/ja` で使用。R が特別に定義する入力 |
| mathematical value | 数学的な値 | `docs/ja` で使用 |
| first argument | 第 1 引数 | `docs/ja` で使用 |
| single number | 単一の数値 | 新規。ベクトルを受け付けない関数 (「1 つの数値」は `Takes a single number`) |
| order (of the derivative) | 導関数の階数 | 新規 (`psigamma` の `deriv`) |
| ordered (selection) | 順序付き | 新規 (`perm`)。「順序を考えない」は unordered |
| equivalence margin | 同等性マージン | 新規。TOST の `margin` (`epsilon`) |
| hybrid score interval | ハイブリッドスコア区間 | 新規。Newcombe の区間 |
| score (interval) | スコア区間 | 新規。`"score"` の区間 |
| Wald (interval) | Wald 区間 | 新規。`Wald` は人名のため英字 |
| number of trials | 試行回数 | 新規。二項検定の `parameter` |
| concordant pairs, discordant pairs | 一致する組、不一致の組 | 新規。Goodman-Kruskal の γ |
| pairs (of observations) | 組 | 新規。`pairs with NaN are dropped` など |
| median-unbiased estimate | 中央値不偏推定値 | 新規。`oddsRatio` の `"midp"` |
| conditional maximum likelihood estimate | 条件付き最尤推定値 | 新規。`fisherTest` の `estimate` |
| mid-p | mid-p | 英字のまま。mid-p の裾・mid-p 値 |
| central (two-sided method) | central | 英字のまま。`"central"` の両側の方法 |
| classes (of a chi-squared test) | 区分 | 新規。`pearsonTest` の `nClasses` |
| event rate | 事象率 | 新規。`poissonTest` の推定値 |
| replicates (of a simulation) | 反復回数 | 新規。`B` の説明 |
| expected probabilities | 期待確率 | 新規。適合度検定の `p` |
| doubles (number of values, memory) | 倍精度数 | 新規。`double precision` の値の数 |
| multiply-adds | 乗算と加算 | 新規。計算量の単位 |
| hypothesized (value, proportion) | 仮説上の (値、比率) | 新規。`poissonTest` の `r` など |
| deviates (Freeman-Tukey) | 偏差 | 新規。Freeman-Tukey の偏差 |
| relative effect | 相対効果 | 新規。Brunner-Munzel の検定 |
| limit (of an interval) | 限界 | 新規。「下側の限界」「上側の限界」(区間の片側の限界) |
| clipped | 切り詰め | 新規。区間を範囲に収める処理 |
| rescale | 再スケール | 新規。`rescaleP` |
| exact (p-value, method) | 正確 (正確な p 値、正確法) | 新規。`exact` オプション。`exact test` の「正確」と同じ語 |
| finite (values) | 有限 | 既存の訳語に合わせた。「正の有限値」 |
| population (of a sample) | 母集団 | 既存の訳語に合わせた。「母集団の既知の標準偏差」 |
| proportion (binomial) | 比率 | 既存の訳語に合わせた。「観測された比率」 |
| Edgeworth term | Edgeworth 項 | 既存の訳語に合わせた。人名は英字 (規則 11 より `docs/ja` を優先) |
| signed rank test | 符号付き順位検定 | 既存の訳語に合わせた。`Wilcoxon signed rank statistic` とは別 |
| Hodges-Lehmann estimate | Hodges-Lehmann 推定値 | 人名は英字 (規則 11) |
| unreplicated complete block design | 反復のない完全ブロック計画 | 既存の訳語に合わせた (`friedmanTest`、`cochranQTest`) |
| block (of a block design) | ブロック | 既存の訳語に合わせた |
| treatment (of a block design) | 処理 | 既存の訳語に合わせた。`treatment contrasts` (処理対比) とは別 |
| binary response | 2 値応答 | 既存の訳語に合わせた |
| Bernoulli trial | ベルヌーイ試行 | 既存の訳語に合わせた (`binomTest`) |
| dual (test and interval) | 双対 | 新規。検定と区間の対応 (`binomDiffEquivalenceTest`) |
| margins (of a table) | 周辺和 | 既存の訳語に合わせた。行和・列和の総称 |
| supremum | 上限 | 新規。`真の上限 (supremum)` の形で併記 (`boschlooTest`) |
| attributable risk | 寄与危険 | 既存の訳語に合わせた (epiR の寄与危険のスコア区間) |
| code point (order) | コードポイント順 | 既存の訳語に合わせた。並べ替えの順序 |
| homogeneity (of variances) | 分散の等質性 | 新規。`flignerTest` の説明 |
| orientation (of an alternative) | 向き | 新規。`alternative: "less"` が指す向き |
| location shift | 位置のずれ | 新規。二標本の位置の差 (`mu`) |
| root (of an equation) | 根 | 既存の訳語に合わせた。「スコア統計量の根」 |
