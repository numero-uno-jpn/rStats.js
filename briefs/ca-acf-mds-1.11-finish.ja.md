# 指示書: 1.11.0 の仕上げ (A: 数値の点検 → B: 文書・デモ)、Issue #560

作成 2026-11-24 (Claude)。基準のコミットは依頼の文で指定します。1.11.0 の範囲は **acf・pacf・ccf (`/timeseries`)、
ca・caSummary・caCoord・mjca・sammon・isoMDS (`/multivariate`)** の 9 つです。isoMDS はユーザーの決定で戻した
(2026-11-24)。**この指示書は `briefs/isomds-1.11-bfgs.ja.md` が済んでから始める** (isoMDS が合格に届かなければ、isoMDS を
除いて進め、報告に書く)。A と B を**この順に、途中で止まらずに**済ませ、最後に
Issue #560 に 1 回だけ報告して止まってください。

## 0. 書き込んでよい場所 (これ以外には書かない)

- **ブランチ `work/ca-acf-mds-1.11` だけ。** main・ほかのブランチ (`work/isomds-next` も) には push もコミットもしない。
  push のたびに、HEAD が自分のコミットで、変更したファイルが入っていることを確かめる
- **A で書いてよいファイル:** `src/timeseries/acf.ts`、`src/multivariate/{ca,mjca,sammon,isoMDS}.ts` (数値の直しだけ。関数の名前・
  引数・戻り値の形は変えない)、新しいテスト `test/ca-acf-sammon-numerics.test.ts`、`experiments/*111-numerics-*.R`
- **B で書いてよいファイル:** 上の 5 つの `.ts` の **TSDoc のコメントだけ**、`README.md`・`README.ja.md`、`llms.txt`、
  `docs/api-reference.md`・`docs/ja/api-reference.md`、`docs/differences-from-r.md`・`docs/ja/differences-from-r.md`、
  `CHANGELOG.md` (`## Unreleased` だけ)、`ROADMAP.md`・`ROADMAP.ja.md`、`demo/examples.json` (1.10.0 と同じ形で、R の側の
  コードも同じ項目に書く)、`test/demo.test.ts` の `NOT_IN_DEMO_YET`
- **GitHub:** Issue #560 へのコメントだけ。PR #561 は Checks を読むだけ
- **書かない:** `HANDOFF.md`、`test/fixtures/`、既存のテスト (`test/{acf,ca,mjca,sammon,isoMDS}.test.ts` を含む)、生成のブロック
  (`*_KEYS`・`checkOptions` の import と呼び出しの行)、`docs/r-functions*`・`docs/ja/api/*.json`・`demo/r-results.json`・
  `demo/examples.R` (生成物。こちらが作る)、`scripts/`、`.github/`、`package.json`、`typedoc.json`、`oracle/` の choices の節
- 手元で npm を流せなくてよい。テストは PR #561 の CI で確かめる。失敗したら直して push、を繰り返す

## 1. クリーンルーム (毎回守る)

R (stats の acf・pacf・ccf)、MASS (sammon・isoMDS)、ca パッケージ (ca・mjca・cacoord) は GPL。ソースを読まない・思い出して書かない・
写さない。使ってよいのは公開の関数の出力、ヘルプ、論文・教科書の文章、rStats.js の既存の関数。**ウェブ検索は使わない。**
R の実験 (`experiments/`、先頭 5 行に `# issue: 560`) では `trace`・関数名 (`acf`・`ca`・`sammon` など) を変数名に使わない。
報告の最後にクリーンルームの確認を書く。

## A. 数値の点検 (手本: `briefs/numerics-1.9.ja.md` の 2 節と同じ進め方)

fixture との一致は、普通のデータで R と同じ値を返すことしか確かめていません。極端な入力でも正しい値を返すこと
(`docs/accuracy.md`) を確かめ、直します。

1. **洗い出し:** 5 つのファイルのコードを読み、次の観点で弱点を探す
   - **尺度 (値を 2^±500・2^±1000 倍):** acf の相関は不変・共分散は二乗 (2^±1000 で溢れ・潰れないか)、ccf も同じ。ca・mjca
     は表を何倍しても全部の結果が不変 (2^±1000 で質量の和が溢れないか)。sammon・isoMDS は座標が尺度どおり・stress が不変 (isoMDS の止め方は choices 5 で尺度によらない)
   - **ずらし (1e8・1e12):** acf・ccf はずらしに不変 (平均を引いてから積を取っているか。2 回目の平均の直しが要るか)
   - **桁落ち:** acf の長い系列 (N = 10 万) の和の誤差の積み重なり、pacf の Durbin-Levinson で ρ(1) が 1 に近い系列
     (fixture の `acf_long_partial_exact` で 1.9e-13。もっと 1 に近い系列で悪くならないか)、ca の特異値分解で小さい特異値の
     軸 (mjca の補助の列の第 6 軸のような、小さい特異値で割る所)、sammon の距離の近い点の 1/d
   - **端の場合:** 定数の系列、N = 1・2、`lagMax = 0`、2 × 2 の表、独立な表 (慣性 0)、1 次元しかない ca、NaN・Infinity
     (choices どおりか)
   - **大きさ (指示書 `briefs/ca-acf-mds-1.11.ja.md` の 5 節):** acf・ccf は N = 10 万・`lagMax = 100`、ca は 1000 × 50 の表、
     mjca は 1 万行 × 10 変数 (各 5 水準)、sammon・isoMDS は n = 500 で動き、時間を報告する。acf が O(N·lagMax) より重くないか
2. **確かめ:** 各項目を実際の入力で確かめる。正しい値は高精度の計算 (尺度の性質、BigInt の厳密な計算) か、R が正しいときは
   R の実験で
3. **直しとテスト:** 誤りを直し、`test/ca-acf-sammon-numerics.test.ts` にテストを足す (正しい値とその求め方をコメントに)。
   **普通のデータの値を変えない** (既存のテストが全部通る)。許容を広げない。直さないものは理由を報告に書く。R と違う値を返す
   ようになった所は B の differences に書く

## B. 文書・デモ (手本: `briefs/release-1.9.ja.md` の R0〜R3、1.10.0 の文書)

- **R0 (TSDoc):** 9 つの関数と、その結果・オプションの型の**すべてのプロパティ**に英語の説明 (doc comment の 1 文目は説明、
  2 文目に「Equivalent to R's `acf()`.」の決まった形。今の形を崩さない)。acf・pacf・ccf の `@category` は "Time series"、
  ほかは "Multivariate analysis"。こちらが最後に TypeDoc を流す
- **R1 (配線):** 不要 (`/timeseries` はこちらで済ませた)
- **R2 (文書):** README (英・日) の分野の表に `/timeseries` (Time series: acf・pacf・ccf) の行を足し、Multivariate analysis の行に
  ca・mjca・sammon・isoMDS を足す。`llms.txt` に acf・ccf、ca、mjca、sammon、isoMDS の書き換えの例を 1 つずつ。`docs/api-reference.md`
  (英・日) に `/timeseries` の節と import の例。`CHANGELOG.md` の `## Unreleased` に 1.11.0。`ROADMAP.md` (英・日) の対応分析
  と自己相関、sammon・isoMDS を済みに (arima は残りに。1.12.0 の予定)。`docs/differences-from-r.md` (英・日) に節
  「Autocorrelation, correspondence analysis and non-metric scaling」(日本語は「自己相関・対応分析・非計量の尺度法」)。**5 つの
  仕様書の choices で R と違うことにした所を全部:** acf のラグは整数 (R の時系列の時間の単位・`frequency` は無い)、ccf は同じ
  長さの配列だけ (R は時点の重なりを取る)、`naAction` は fail と pass だけ、acf_long_partial のように R が不正確な所
  (rStats.js は 200 ビットの計算と 1.9e-13、R は 5.0e-12)、ca・mjca の軸の符号 (決まった規則)、`caSummary` は R の
  summary が落ちる表でも値を返す、mjca に JCA は無い・分割表の入力は受けない・NA の行を除く、sammon・isoMDS の既定の初期値は
  rStats.js の cmdscale (列の符号)、isoMDS の同点は R と同じ固定の順・止め方は尺度によらない (R は極端な尺度で始めに止まる)。**R の不具合とは書かない。**「R と違う」「rStats.js はこうする」と書く。A で R と違う値に
  した所も
- **R3 (デモ):** 9 つの関数から 3〜4 個 (例: lh の acf と pacf、mdeaths・fdeaths の ccf、smoke の ca + caSummary、swiss の
  sammon は stress だけを見せる (座標は符号が R と違いうる))。`demo/examples.json` に R のコードを必ず書く (こちらが
  `demo/examples.R` を生成し、R で流して照らし合わせる)。デモに入れた関数を `NOT_IN_DEMO_YET` から外す
- 日本語の API の訳 (`docs/ja/api/*.json`) はこちらが別にする
- 改行は LF。日本語の文書の表記: 括弧は半角 `( )`、コロンは半角 `:`、和文と英数字の間に半角スペース

## 2. 報告 (最後に 1 回、Issue #560 に)

A の一覧 (項目ごとに「直した・直さない (理由)・問題なし」と確かめた入力)、足したテスト、大きな入力の時間 (直す前と後)、
B で書いたファイルの一覧、デモの関数、CI が緑になったコミット、クリーンルームの確認。
