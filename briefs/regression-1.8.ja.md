# 指示書: 回帰の続き (ROADMAP の 2 番、1.8.0 に入れる): rq・GEE・glmnet

作成 2026-11-20。基準のコミットは依頼の文で指定します (`git log -1` で確かめてから始める)。入口は
`briefs/regression-1.8-status.ja.md` (規則の全文と今の状態)。この文書は今回の中身です。

あなた (ChatGPT) には、rStats.js に分位点回帰 (quantreg の `rq`)、一般化推定方程式 (geepack の `geeglm`)、罰則つき
回帰 (glmnet の `glmnet`・`cv.glmnet`) を足す作業を頼みます。1.7.0 (polr・rlm・nls、指示書 `briefs/regression-1.7.ja.md`)
と同じく、仕様書 → 実装 → 直しの順です。1.7.0 との違いは 3 つです: (1) **R の実験はあなたが GitHub Actions で流す**
(3 節)、(2) **端の入力の点検を最初から合格の条件に入れる** (5 節)、(3) **仕様書は 3 つまとめて書き、1 回で報告する**。

## 0. 範囲と照合先 (ユーザーが決めたもの、2026-11-20)

照合先は R 4.6.2 と、**quantreg 6.1・geepack 1.3.13・glmnet 5.1** (どれも GPL。クリーンルーム)。入口は既存の
**`/regression`** (`src/entries/regression.ts`) に足す。分野の配線は済んでいるので、export を足すだけでよい。

- **rq:** `method` の `"br"` (Barrodale-Roberts の単体法) と `"fn"` (Frisch-Newton の内点法)。`tau` は 1 つと複数
  (R の `rqs`)。`weights`。`summary` の `se` = `"rank"` (順位検定の反転による区間)・`"iid"`・`"nid"` (Hall-Sheather と
  Bofinger の帯域)・`"ker"` (`covariance = TRUE` の共分散も)・**`"boot"`** (`bsmethod` の `"xy"`・`"pwy"`・`"mcmb"`・
  `"wxy"`、`R`。**R の乱数列まで合わせる**: `set.seed` を同じにすれば R と同じ標準誤差になること)。`predict`
  (`interval = "confidence"`、`type` の `"none"`・`"percentile"`・`"direct"`)。`anova` (入れ子の当てはめどうしの Wald と
  順位検定、複数の τ の傾きが等しいことの検定 `joint`)。`tau` が (0, 1) の外 (R は解の過程全体を返す) は範囲外にして
  よい (Decisions に挙げる)
- **geeglm:** 族は gaussian・binomial・poisson・Gamma (と既存の `glm` が持つリンク)。作業相関は `"independence"`・
  `"exchangeable"`・`"ar1"`・`"unstructured"`・**`"userdefined"` と `"fixed"` (`zcor`)**。分散は `std.err` の
  `"san.se"` (サンドイッチ)・**`"jack"`・`"j1s"`・`"fij"` (jackknife)**。`waves`・`weights`・`scale.fix`・`offset`。
  `summary` (係数の表、相関と尺度の推定値とその標準誤差)・`anova` (逐次の Wald、入れ子の当てはめどうし)・`predict`
  (`newdata`、`type`)・`vcov`・`QIC`。`zcor` を作る `genZcor`・`fixed2Zcor` に当たるものも要るなら Decisions に
- **glmnet:** 族は gaussian・binomial・poisson・**multinomial** (`type.multinomial` の `"ungrouped"` と `"grouped"`)。
  cox は範囲外。`alpha`、λ の経路 (`nlambda`・`lambda.min.ratio`・与えた `lambda`)、`standardize`・`intercept`・
  `weights`・`offset`・`penalty.factor`・`lower.limits`/`upper.limits`・`dfmax`/`pmax`。`coef`・`predict` (`s` が経路の
  外のときの補間、`type` の `"link"`・`"response"`・`"class"`・`"nonzero"`)。`cv.glmnet` は **`foldid` を与えたときだけ**
  R と比べる (`type.measure` の `"deviance"`・`"mse"`・`"mae"`・`"class"`・`"auc"`、`lambda.min`・`lambda.1se`、
  `grouped`、`keep`)。`relax` は範囲外
- 名前: 当てはめは `rq`・`geeglm`・`glmnet`・`cvGlmnet`。付属の関数の名前 (前例: `glmSummary`・`rlmSummary`・
  `polrPredict`・`confintLmer`) は Decisions に推奨つきで挙げる
- 入力の形: `rq`・`geeglm` は既存の `glm`・`rlm` と同じく式とデータ。`glmnet` は R と同じく行列 `x` と `y` (式は
  受け取らない。推奨。異論があれば Decisions に)

## 1. 最初に読むもの

- 入口 `briefs/regression-1.8-status.ja.md` (規則の全文)
- 1.7.0 の成果 (書き方の手本): `oracle/polr-behaviour.md`・`oracle/rlm-behaviour.md`・`oracle/nls-behaviour.md` (特に
  末尾の「rStats.js's choices」の形)、`oracle/polr.R`・`oracle/rlm.R`、`src/models/polr.ts`・`rlm.ts`・`nls.ts`、
  `test/polr.test.ts`・`test/rlm.test.ts`・`test/nls.test.ts`
- 既存の部品 (呼んでよい): `src/models/glm.ts`・`glmFamily.ts`・`formula.ts`・`modelFrame.ts`・`modelMatrix.ts`、
  `src/entries/numerics.ts` の export、乱数 `src/random/` (`setSeed`・`sample` など。rq の boot で R の乱数列に合わせる)
- **こちらが流した R の出力** (作業ブランチの `experiments/`): `regression18-rq.R`/`.json`、`regression18-gee.R`/`.json`、
  `regression18-glmnet.R`/`.json`。JSON の形は 1.7.0 と同じ (`{ value, warnings, messages }` か `{ error, ... }`、行列は
  `{ rows, cols, values }`)。どの case が何を呼んだかは同じ名前の `.R` を読む

### こちらの実験で分かっていること

- rq: `Solution may be nonunique` の警告は `rq` ではなく `summary` が出す (`mtcars_factor` の `iid`、`exact_fit` の
  既定)。解が一意でない `nonunique` の case の当てはめ自体は警告なし。`exact_fit` の `se = "nid"` は
  `singular matrix in 'backsolve'` のエラー。`stackloss_weights` の `nid` で `1 non-positive fis` の警告。共線の列は
  `Singular design matrix` のエラー。`predict(type = "percentile")` は `se = "boot"` を求めるエラー。`summary` の既定の
  `se` は n < 1001 で `"rank"` (ヘルプ)
- geeglm: `corstr = "fixed"` の当てはめで **`anova(fit)` が 40 秒たっても終わらない** (`ohio_fixed` では外した)。
  `scale.fix = TRUE, scale.value = 4` は `variable lengths differ (found for '(scale.value)')` のエラー (R 側の不具合の
  見込み。仕様書で扱いを決める)。**geese の既定の収束の許容は粗い** (ヘルプで確かめる) ので、polr と同じく厳しい
  当て直し `fitTight` を fixture に入れる
- glmnet: 5.1 では `thresh` などを直接渡すと「`control = list(thresh = ...)` を使え」という非推奨の警告。fixture の
  `fitTight` (`thresh = 1e-14`) はこの形で作り直す。`x` が 1 列だとエラー、y が定数の gaussian はエラー、`NA` を含む x は
  エラー。完全分離に近い binomial で 82 番目の λ が `maxit` で収束せず、手前の λ までを返す警告。`auc` は各分割に
  10 件未満だと `deviance` に切り替える警告

## 2. 段階 (各段階の終わりで止まって Issue に報告する)

### 段階 1: 3 つの仕様書と oracle (1 回の報告にまとめる)

- `oracle/rq-behaviour.md`・`oracle/gee-behaviour.md`・`oracle/glmnet-behaviour.md` (英語)。式 (文献に基づく)、既定値、
  収束の判定、標準誤差の求め方、`summary`・`predict`・`anova`・`cv` の値、エラーと警告、境界。章立ては
  `oracle/polr-behaviour.md` に合わせ、末尾に「Decisions for the user」(**選択肢と推奨**) と空の「rStats.js's choices」
- `oracle/rq.R`・`oracle/gee.R`・`oracle/glmnet.R`: fixture の生成スクリプト。**R の既定の止め方が粗いもの
  (geese・glmnet、rq の `fn`) は、厳しい当て直しの値 `fitTight` も入れる**
- 決めること (少なくとも): rq の解が一意でないときにどの解を返すか (R の `br` と同じ頂点を返せるか、出力だけから
  決める。無理なら「目的関数が R 以下で最適性の条件を満たす」を合格にする)、boot の乱数の使い方を出力から突き止められる
  か (突き止められなければ Decisions に)、geeglm の jackknife の定義 (3 種の違い)、`scale.fix` のエラーの扱い、
  glmnet の λ の経路の作り方と、収束の判定 (rStats.js は真の解まで解く。1.7.0 の polr と同じ)
- 足りない R の実験は、3 節の形で自分で流してよい。報告の前に、要る実験を済ませておく
- **報告:** 仕様書の要点、未解明の所、Decisions for the user。ここで止まり、こちらの「進めてよい」を待つ

### 段階 2: 実装 (1 パッケージずつ、rq → geeglm → glmnet)

- `src/models/rq.ts`・`gee.ts`・`glmnet.ts` (分けてよい) に実装し、`src/entries/regression.ts` から export する。テストは
  `test/rq.test.ts`・`test/gee.test.ts`・`test/glmnet.test.ts`
- 1 パッケージが CI 緑になったら Issue に短い報告を書いて、**止まらずに次へ進む** (こちらは並行して点検する。
  直しが要るときはこちらから Issue に書く)。3 つが済んだら段階 2 の報告をして止まる
- 5 節の端の入力のテストは、この段階で入れる

### 段階 3: 直し

こちらの点検で見つけたものを、一覧にして 1 回で頼みます。

## 3. R の実験 (あなたが GitHub Actions で流す)

- `experiments/<名前>.R` を作業ブランチ `work/regression-1.8` に push すると、`.github/workflows/r-experiments.yml` が
  x86_64 の R 4.6.2 (fixture と同じ CRAN の日付、quantreg・geepack・glmnet 入り) で流し、出力を Issue のコメントに書く
  (60000 バイトまで)。**スクリプトの先頭 5 行のどこかに `# issue: <番号>` を書く** (無いと Issue に出ない)
- 先に `scripts/r-experiment-check.mjs` が検査し、通らないと流れない。止まるもの: 参照パッケージの関数を呼ばずに名前
  だけ書く (`print(rq)`・`f <- glmnet`)、`deparse`・`body`・`:::`・`get`・`eval`・`unclass` など、文字列での関数名、許可外の
  パッケージ。**関数名を変数名にしない** (`se`・`ranks`・`dither`・`latex`・`tidy`・`combos` などは quantreg・geepack の
  関数名。`for (se in ...)` は止まる。引数名として `se = "nid"` と書くのは通る)
- 1 本 120 秒、メモリ 2 GB、ネットワークなし。**まとめて書いてから push する** (1 本ずつ待たない)。出力は 17 桁
  (`jsonlite::toJSON(x, digits = NA)`)。大きな出力は要約して 60000 バイトに収める
- **実験は仕様を決めるためだけ。R の不具合を深追いしない** (1.6.0 で逸れた)。R がおかしく見えたら、正確な値を独立に
  計算して記録し、先へ進む

## 4. 前回までの直し (最初から守る)

`briefs/regression-1.7.ja.md` の 4 節の 1〜17 を全部守る。特に:

- fixture (`test/fixtures/`) と生成物はこちらが作る。oracle スクリプトを push して Issue に「fixture の依頼」と書けば、
  こちらが `npm run oracle -- <name>` で作って push する (それまで、そのテストは fixture が無くて落ちてよい)
- **テストは R の値と比べる。** 推定値は `fitTight` と厳しく (相対 1e-8 程度)、R の既定の当てはめとは「既定と
  `fitTight` の差」から決めた幅で。**許容誤差を広げて通さない。** 合わなければ根拠を添えて報告する
- 表は全行・全列を比べる。不一致はラベル付きで集め、最後に `expect(mismatches).toEqual([])`
- choices で決めた仕様は、項目ごとにどのテストで確かめるかを書く (1.7.0 で「縮退した列を落とす」が未実装だった)
- `checkOptions(options, <NAME>_KEYS, "<name>"); // generated: option-keys.mjs` の 1 行。生成のブロックは手で書かない

## 5. 端の入力 (合格の条件。段階 2 のテストに入れる)

1.7.0 では最後にまとめて点検し、不具合が 4 つ見つかりました。今回は最初から次を満たすこと:

- **尺度:** x の列を 1e100 倍・1e-100 倍、y を 1e100 倍・1e-100 倍 (別々に)。係数は同変 (理論どおりに尺度が変わる)
  で、相対 1e-10 で一致する。標準誤差も同じ。満たせない所は理由を書いて報告する (1.7.0 の rlm の x × 1e-200 のように
  記録だけで済ませるものは、報告で挙げる)
- **大きさ:** 10 万件で動く (rq の `fn`・geeglm の独立と交換可能・glmnet の gaussian)。時間を報告に書く。**配列を関数の
  引数に展開しない** (`Math.max(...列)`・`push(...列)` は 10 万件でスタックがあふれる。1.7.0 で 2 回入った)
- **異常な値:** NaN・Infinity を含む y・x・weights はエラーか、R と同じ除き方。重み 0、重みの定数倍で係数が変わらない
  (相対 1e-12)
- **縮退:** 共線の列、定数の列、1 クラスタだけ・各クラスタ 1 件、完全分離 (binomial)、全部が同じ y、p > n (glmnet)
- それぞれ、R の値と比べられないもの (R が失敗する、R が不正確) は、同変性か独立の計算と比べる

## 6. 書くもの・触らないもの

- 書く: `oracle/rq*`・`gee*`・`glmnet*` の仕様書と `.R`、`src/` の新しいファイル、`src/entries/regression.ts`、`test/` の
  新しいテスト、`test/demo.test.ts` の `NOT_IN_DEMO_YET`、`experiments/` の実験
- 触らない: 仕様書の「rStats.js's choices」の節、既存の関数 (呼ぶのはよい。直す必要があれば提案)、`test/fixtures/`、
  `test/helpers/`、`docs/`、`CHANGELOG.md`、`ROADMAP*.md`、`.github/`、`scripts/`、`package.json`、`demo/`
- 文書 (API の説明・日本語訳・デモ) は最後に別の依頼で頼みます
