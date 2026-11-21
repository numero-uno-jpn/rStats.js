# 段階 1 の点検と差し戻し (1.8.0、Issue #545)

作成 2026-11-21。点検した版: `312d9169`。規則は入口 `briefs/regression-1.8-status.ja.md` のとおり (クリーンルーム)。

## 結論

仕様書 3 つの形 (章立て、Decisions と推奨) はよい。ただし **実装できる細かさになっていない**。1.7.0 の
`oracle/polr-behaviour.md` (318 行)・`rlm-behaviour.md` (579 行) は、標準誤差・検定・既定値を式で書き、R の出力と
数値で突き合わせていた。今回の 3 つ (各 100 行前後) は、実装で必ず要る式がなく、指示書 2 節で「報告の前に済ませる」と
頼んだ R の実験が 1 本も流れていない。そのため「未解明」が残り、このまま段階 2 に進むと、実装のたびに往復が増える。

**段階 1 をやり直してください。** 3 節の実験を `experiments/` に書いて流し (`# issue: 545`。まとめて push)、R の出力の
数値を、あなたが文献の式で独立に計算した値 (Python など) と突き合わせ、合った式を仕様書に書く。照合のスクリプトと
出力も `experiments/regression18-*-check.*` として push する (証拠)。

## 1. 必ず直すもの

1. **`oracle/gee.R` が動かない:** `Error: No method asJSON S3 class: lm` で止まる (こちらの R 4.6.2・geepack 1.3.13)。
   直したら、同じ中身を `experiments/regression18-oracle-gee.R` (`# issue: 545` つき) として流し、最後まで動くことを
   確かめる。rq.R・glmnet.R も同じ形で一度流して確かめる (こちらでは動いた)
2. **rq の Decisions 2 (boot):** ユーザーの決定は「R の乱数列まで合わせる」(指示書 0 節)。推奨 B は決定と違う。
   実験で突き止めてから書く (3 節)。どうしても突き止められない方法があれば、試したことと結果を添えて、その方法だけを
   Decisions に挙げる
3. **「Unresolved」をなくす。** 残すなら、何を試して何が分からなかったかを書く

## 2. 仕様書に書くもの (式のレベルで。どれも R の出力と数値で突き合わせる)

### rq

- `iid`: 疎さ (sparsity) の推定の式、Hall-Sheather と Bofinger の帯域の式 (h の値を R の値と比べる)、共分散の式
- `nid`: 局所の疎さの推定の式 (各観測の $f_i$ の求め方、非正のときの扱い = `non-positive fis` の警告)、サンドイッチの式
- `ker`: 核と帯域の式、共分散
- `rank`: 順位検定の反転の手順 (iid と `iid = FALSE` のスコア、区間の端の求め方、`alpha`)。表の列 (`lower bd`・`upper bd`)
- `anova`: 入れ子の Wald (統計量・自由度・分布)、rank (スコアの既定)、複数の τ の `joint = TRUE/FALSE` の統計量
- `predict`: `interval = "confidence"` の `none` と `direct` の式
- 重み: どの式にどう入るか
- `summary` の既定の `se` の切り替えの正確な条件 (n = 1000・1001 で確かめる)

### geeglm

- 作業相関の推定量: exchangeable・AR(1)・unstructured・userdefined の式 (分母に p を引くか、など)。`waves` の意味
  (欠けた時点があるとき)。尺度 φ の推定量 (分母)
- 反復の手順と geese の既定の収束 (`epsilon`・`maxit`、ヘルプの値)。厳しい当て直しで何桁合うか
- jackknife 3 種 (`jack`・`j1s`・`fij`) の定義 (Halekoh, Højsgaard & Yan 2006、Yan & Fine 2004 などの文献) と、R の値の再現
- `summary` の相関と尺度の推定値の標準誤差の式、QIC (QIC・QICu・CIC など R が返す全部) の式、`anova` の逐次 Wald の式
- クラスタの並び: id が連続していないとき R は何をしたか (こちらの実験の `unsorted_id` の case を読む)。NA の行

### glmnet

- 目的関数の尺度: gaussian の $1/(2n)$、重みの正規化 (和を n にするか)、標準化 (分散の分母 n か n−1)、gaussian で y も
  標準化されるか (λ の尺度)
- λ の経路: $\lambda_{\max}$ の式 (`alpha = 0` のときの扱いを含む)、`lambda.min.ratio` の既定 (n と p で変わる)、経路が
  途中で終わる規則 (dev.ratio・変化の閾値。`glmnet.control` のヘルプの値)。**R の λ の列を、x と y だけから相対 1e-12 で
  再現できること** を確かめる
- `df`、`dev.ratio`・`nulldev` の定義 (binomial・poisson・multinomial、offset あり)
- multinomial: 切片と係数の識別 (クラスの間でどう中心化されるか)、grouped の罰則の式
- `coef`・`predict` の経路の外の `s` の補間の式 (λ に線形か log λ か。出力で確かめる)
- `cv.glmnet`: `cvm`・`cvsd` の式 (分割の重み)、`lambda.1se` の規則、`grouped = FALSE`、`auc`・`class`・`mae` の定義

## 3. 実験の進め方

- 必要な出力 (`residuals`・`fitted`・`summary` の表・`$B` などヘルプにある要素) を R から出させ、式は自分の側で計算して
  比べる。R の関数の中身を見る方法は使わない (検査で止まる)
- rq の boot: 例えば `set.seed(1)` の直後の `sample(n, n * R, replace = TRUE)` などで添字を作り、自分で再計算した標準誤差が
  R と一致するかを確かめる。方法ごとに (xy・pwy・mcmb・wxy)
- 1 回の push に全部の実験を入れる。出力が 60000 バイトを超えないよう要約する
- R の不具合を深追いしない (geeglm の `scale.fix`、fixed の anova は記録だけでよい)
