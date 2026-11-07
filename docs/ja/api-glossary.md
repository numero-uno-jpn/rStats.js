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
