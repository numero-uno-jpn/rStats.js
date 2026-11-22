# 指示書: 小さな検定 3 つと多変量 3 つ (1.9.0): Tamhane の T2・Page の検定・Grubbs の検定、MANOVA・lda・cancor

作成 2026-11-22。基準のコミットは依頼の文で指定します (`git log -1` で確かめてから始める)。入口は
`briefs/tests-multivariate-1.9-status.ja.md` (規則の全文と今の状態)。この文書は今回の中身です。

あなた (ChatGPT) には、rStats.js に 6 つの関数を足す作業を頼みます。1.8.0 (指示書 `briefs/regression-1.8.ja.md`) と
同じく、仕様書 → 実装 → 点検の順です。1.8.0 との違い: (1) **ウェブ検索を使わない** (1.8.0 で検索結果にソースの抜粋が
5 回出た。方法は知っている範囲の論文と、R のヘルプと実行結果だけで決める)、(2) **仕様書は式のレベルで、R の出力と数値で
突き合わせたものだけ書く** (1.8.0 の 1 回目は薄くて差し戻した)、(3) **テストは返す値の全要素を R と比べる**。

## 0. 範囲と照合先 (ユーザーが決めたもの、2026-11-22)

照合先は R 4.6.2 の stats、**MASS 7.3.66・PMCMRplus 1.9.12・outliers 0.15** (どれも GPL。クリーンルーム)。

### 小さな検定: 既存の `/tests` (`src/entries/tests.ts`) に足す

- **Tamhane の T2** (PMCMRplus `tamhaneT2Test`): `welch = TRUE` (T2) と `FALSE` (T2')。入力は値と群 (既存の
  `gamesHowellTest` と同じ形)。置き場所は `src/htest/multipleComparisons.ts` (の隣のファイルでもよい)。手本は
  `gamesHowellTest`
- **Page の検定** (PMCMRplus `pageTest`): ブロック × 処理の行列 (と値・群・ブロックの 3 つのベクトル)。`alternative`。
  置き場所は `src/htest/rankTests.ts` の隣。手本は既存の Friedman 型の検定
- **Grubbs の検定** (outliers `grubbs.test`): `type` の 10・11・20、`opposite`、`two.sided`。p 値は outliers の
  `pgrubbs` と同じ求め方 (下の「分かっていること」)。分布関数 `pgrubbs`・`qgrubbs` も公開するかは Decisions に

### 多変量: 新しい `/multivariate` (ルートと `dist/rstats.js` には入れない)

- **MANOVA** (`manova` + `summary.manova`): 統計量 Pillai・Wilks・Hotelling-Lawley・Roy の 4 つと F 近似、`intercept`、
  型 I (逐次) の項の順、`tol`、SSP 行列 (`$SS`) と固有値 (`$Eigenvalues`)。入力は応答の行列 (または複数の列) と式・データ。
  既存の `src/models/` の式・モデル行列の部品を使う
- **判別分析** (MASS `lda`): `method = "moment"` だけ (mle・mve・t は範囲外)。`prior`、`tol`、`CV = TRUE` (一つ抜きの
  クラスと事後確率)。`predict` (`newdata`・`prior`・`dimen`、クラス・事後確率・判別得点)。`predict` の `method` は既定の
  `"plug-in"` だけを必須に、`"predictive"`・`"debiased"` は Decisions に。**判別得点と `scaling` の符号は R に合わせる**
- **正準相関** (`cancor`): `xcenter`・`ycenter` (TRUE・FALSE・数値のベクトル)。`cor`・`xcoef`・`ycoef`・`xcenter`・
  `ycenter`。係数の符号と尺度は R の定義に合わせる
- 置き場所: `src/multivariate/` (新しいディレクトリ) と入口 `src/entries/multivariate.ts`。**`package.json`・
  `scripts/bundle.mjs`・`scripts/size.mjs`・`typedoc.json` などの配線はこちらがする** (段階 2 で最初の関数ができたら
  Issue に「配線の依頼」と書く。それまで入口のファイルを作るだけでよい)
- 名前: 推奨は `tamhaneT2Test`・`pageTest`・`grubbsTest`、`manova`・`manovaSummary`、`lda`・`ldaPredict`、`cancor`。
  前例 (`glmSummary`・`polrPredict`) に合わせる。異論があれば Decisions に

## 1. 最初に読むもの

- 入口 `briefs/tests-multivariate-1.9-status.ja.md` (規則の全文)
- 手本: `oracle/polr-behaviour.md`・`oracle/rq-behaviour.md` (特に末尾の「rStats.js's choices」の形)、
  `src/htest/multipleComparisons.ts` の `gamesHowellTest` と `test/` のそのテスト、`src/htest/rankTests.ts`
- 既存の部品 (呼んでよい): `src/models/formula.ts`・`modelFrame.ts`・`modelMatrix.ts`、`src/linalg/` (QR・固有値・
  特異値分解・Cholesky)、`src/distributions/` (t・F・正規)、`src/entries/numerics.ts` の export
- **こちらが流した R の出力** (作業ブランチの `experiments/`): `tests19-small.R`/`.json` (T2・Page・Grubbs と
  `pgrubbs`・`qgrubbs`)、`multivariate19.R`/`.json` (manova・lda・cancor)。JSON の形は 1.8.0 と同じ
  (`{ value, warnings, messages }` か `{ error, ... }`、行列は `{ rows, cols, values }`)。どの case が何を呼んだかは
  同じ名前の `.R` を読む

### こちらの実験で分かっていること

- **T2:** `alternative = "greater"` と `p.adjust.method = "holm"` を渡しても結果は変わらない (両側、`p.adjust.method`
  は `"T2 (Sidak)"`)。`dist` は `"t"`。群の大きさ 1 の組は統計量・p 値とも NA (エラーにならない)。**文字列の群
  (`rep(c("x", "y"), each = 4)`) は `all group levels must be finite` のエラー** (因子なら通る見込み。仕様書で確かめる)
- **Page:** 小さい標本 (k = 3, n = 2) でも統計量は正規近似の `z` だけで、`estimate` に Page の L を入れる。同順位の
  ある `page_ties` も z。正確な分布に切り替わる大きさはこちらの範囲 (k 3〜8、n 2〜20) では見ていない (z の式と同順位の
  補正の有無を出力から決める)
- **Grubbs:** `statistic` は `G` と `U` の 2 つ (type 20 は同じ値)。`alternative` は `"highest value 245.57 is an
  outlier"` のような文。type 20 は **n が 3〜30 の外だとエラー** (`n must be in range 3-30`)。定数の x は G・U が NaN で
  p 値 0。`pgrubbs`・`qgrubbs` は**ベクトルを受け付けない** (`the condition has length > 1`) ので 1 値ずつ呼んである。
  ヘルプによると、type 10 は Pearson & Sekar (1936) の近似を逆にしたもの、type 11 は David, Hartley & Pearson (1954)
  の式を `uniroot` で逆に解く (q によって `f() values at end points not of opposite sign` のエラー)、**type 20 は
  Grubbs (1950) の表を補間** (`qgrubbs` の値が 0.1145 のような表の値)。type 20 の表の値は R の出力 (`qgrubbs` を表の
  確率で呼ぶ) から取り、**ソースから写さない**。補間の方法は `pgrubbs_type20_grid_*` の格子から決める
- **MANOVA:** 応答 1 つは `need multiple responses` のエラー。残差の階数が応答の数より小さいと `residuals have rank
  5 < 6` のエラー (共線の応答も)。`intercept = TRUE` で `(Intercept)` の行が足される
- **lda:** 空の水準は `group none is empty` の警告 (水準を落とす)、共線の変数は `variables are collinear` の警告、
  群内で定数の変数は `variable 2 appears to be constant within groups` のエラー (`tol = 0.5` だと複数の変数で同じ)。
  1 件だけのクラスは通る。`NA` は式のときに `na.action` で除かれる
- **cancor:** `NA` は `NA/NaN/Inf in foreign function call (arg 1)` のエラー。共線の x は通る (係数の行が減る)。
  ベクトル 2 つでも通る

## 2. 段階 (各段階の終わりで止まって Issue に報告する)

### 段階 1: 仕様書と oracle (1 回の報告にまとめる)

- `oracle/tamhane-behaviour.md`・`oracle/page-behaviour.md`・`oracle/grubbs-behaviour.md`・`oracle/manova-behaviour.md`・
  `oracle/lda-behaviour.md`・`oracle/cancor-behaviour.md` (英語。小さいものはまとめてよい)。**式のレベル**で書く:
  統計量・自由度・p 値の式、既定値、境界、エラーと警告。**書いた式は、R の出力と独立の計算 (あなたの手計算・
  rStats.js の既存の関数) で数値を突き合わせ、その case 名を書く。** 突き合わせていない式は「未確認」と明記する。
  末尾に「Decisions for the user」(**選択肢と推奨**) と空の「rStats.js's choices」
- `oracle/tamhane.R`・`oracle/page.R`・`oracle/grubbs.R`・`oracle/manova.R`・`oracle/lda.R`・`oracle/cancor.R`
  (まとめてよい): fixture の生成。**R のオブジェクト (当てはめ・`summary`・`htest`) を JSON にそのまま入れない。数値と
  文字列だけを取り出す** (1.8.0 で 3 回 `No method asJSON S3 class` で止まった)
- 決めること (少なくとも): T2 の自由度と p 値の調整 (Šidák) の式、Page の z の式と同順位の補正、Grubbs の 3 つの
  type の p 値の求め方 (type 11 の `uniroot` が失敗する所、type 20 の表の範囲外)、MANOVA の 4 つの F 近似の自由度、
  lda の `scaling` の求め方と符号の向き・`CV` の事後確率、cancor の係数の正規化と符号
- 足りない R の実験は、3 節の形で自分で流してよい。報告の前に、要る実験を済ませておく
- **報告:** 仕様書の要点、未解明の所、Decisions for the user。ここで止まり、こちらの「進めてよい」を待つ

### 段階 2: 実装 (T2 → Page → Grubbs → manova → lda → cancor)

- 1 つが CI 緑になったら Issue に短い報告を書いて、**止まらずに次へ進む** (こちらは並行して点検する)。6 つが済んだら
  段階 2 の報告をして止まる
- 5 節の端の入力のテストは、この段階で入れる

### 段階 3: 点検と直し

こちらの点検で見つけたものを、一覧にして 1 回で頼みます。その後、文書・デモ・訳は別の依頼 (`briefs/release-1.8.ja.md`
の形) で頼みます。

## 3. R の実験 (あなたが GitHub Actions で流す)

- `experiments/<名前>.R` を作業ブランチに push すると、`.github/workflows/r-experiments.yml` が x86_64 の R 4.6.2
  (fixture と同じ CRAN の日付、MASS・PMCMRplus・outliers 入り) で流し、出力を Issue のコメントに書く (60000 バイト
  まで)。**スクリプトの先頭 5 行のどこかに `# issue: <番号>` を書く** (無いと Issue に出ない)
- 先に `scripts/r-experiment-check.mjs` が検査し、通らないと流れない。止まるもの: 参照パッケージの関数を呼ばずに名前
  だけ書く (`print(lda)`・`f <- grubbs.test`)、`deparse`・`body`・`:::`・`get`・`eval`・`unclass` など、文字列での関数名、
  許可外のパッケージ。**関数名を変数名にしない** (`scores`・`outlier` は outliers の関数名、`cancor`・`manova` は
  stats の関数名。`scores <- ...` は止まる。引数名として書くのは通る)
- 1 本 120 秒、メモリ 2 GB、ネットワークなし。**まとめて書いてから push する** (1 本ずつ待たない)。出力は 17 桁
  (`jsonlite::toJSON(x, digits = NA)`)。大きな出力は要約して 60000 バイトに収める
- **実験は仕様を決めるためだけ。R の不具合を深追いしない。** R がおかしく見えたら、正確な値を独立に計算して記録し、
  先へ進む

## 4. 前回までの直し (最初から守る)

`briefs/regression-1.7.ja.md` の 4 節の 1〜17 を全部守る。特に:

- fixture (`test/fixtures/`) と生成物はこちらが作る。oracle スクリプトを push して Issue に「fixture の依頼」と書けば、
  こちらが `npm run oracle -- <name>` で作って push する (それまで、そのテストは fixture が無くて落ちてよい)
- **テストは R の値と比べる。返す値の全要素** (表は全行・全列、行列は全成分、ラベルと文字列も) を比べる。不一致は
  ラベル付きで集め、最後に `expect(mismatches).toEqual([])`
- **許容誤差を広げて通さない。期待値を実装に合わせて書き換えない** (1.8.0 で両方あった)。合わなければ根拠を添えて
  報告する
- choices で決めた仕様は、項目ごとにどのテストで確かめるかを書く
- `checkOptions(options, <NAME>_KEYS, "<name>"); // generated: option-keys.mjs` の 1 行。生成のブロックは手で書かない

## 5. 端の入力 (合格の条件。段階 2 のテストに入れる)

- **尺度:** 値を 1e100 倍・1e-100 倍、1e8 だけずらす (検定は不変、係数は理論どおりに変わる)。相対 1e-10 で一致する
- **大きさ:** 10 万件で動く (T2 と Grubbs は 10 万件、Page は 1 万ブロック × 10 処理、manova・lda・cancor は 10 万行 ×
  10 列)。時間を報告に書く。**配列を関数の引数に展開しない** (`Math.max(...列)`・`push(...列)`)
- **異常な値:** NaN・Infinity を含む入力はエラーか、R と同じ除き方
- **縮退:** 定数の値・群内で定数、大きさ 1 の群、同順位、共線の列、応答 1 つ、n が変数の数より小さい
- R の値と比べられないもの (R が失敗する、R が不正確) は、同変性か独立の計算と比べる

## 6. 書くもの・触らないもの

- 書く: `oracle/` の新しい仕様書と `.R`、`src/` の新しいファイルと `src/htest/` の追記、`src/entries/tests.ts`・
  `src/entries/multivariate.ts`、`test/` の新しいテスト、`test/demo.test.ts` の `NOT_IN_DEMO_YET`、`experiments/` の実験
- 触らない: 仕様書の「rStats.js's choices」の節、既存の関数 (呼ぶのはよい。直す必要があれば提案)、`test/fixtures/`、
  `test/helpers/`、`docs/`、`CHANGELOG.md`、`ROADMAP*.md`、`.github/`、`scripts/`、`package.json`、`typedoc.json`、`demo/`
