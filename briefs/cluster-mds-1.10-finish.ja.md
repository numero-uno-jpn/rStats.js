# 指示書: 1.10.0 の仕上げ (A: 数値の点検 → B: 文書・デモ)、Issue #556

作成 2026-11-23 (Claude)。基準のコミットは依頼の文で指定します。1.10.0 の範囲は **dist・asDist・hclust・cutree・kmeans・
cmdscale** の 6 つです (isoMDS は次の版へ回した。触らない)。6 つとも fixture の全 case で R と一致し、CI は緑です。
A と B を**この順に、途中で止まらずに**済ませ、最後に Issue #556 に 1 回だけ報告して止まってください。

## 0. 書き込んでよい場所 (これ以外には書かない)

- **ブランチ `work/cluster-mds-1.10` だけ。** main・ほかのブランチ (`work/isomds-next` も) には push もコミットもしない。
  push のたびに、GitHub のコミット一覧で HEAD が自分のコミットで、変更したファイルが入っていることを確かめる
- **A で書いてよいファイル:** `src/multivariate/{dist,hclust,kmeans,cmdscale}.ts` (数値の直しだけ。関数の名前・引数・戻り値の
  形は変えない)、`test/` の新しいテスト `test/cluster-mds-numerics.test.ts`、`experiments/cluster110-numerics-*.R`
- **B で書いてよいファイル:** 上の 4 つの `.ts` の **TSDoc のコメントだけ**、`README.md`・`README.ja.md`、`llms.txt`、
  `docs/api-reference.md`・`docs/ja/api-reference.md`、`docs/differences-from-r.md`・`docs/ja/differences-from-r.md`、
  `CHANGELOG.md` (`## Unreleased` だけ)、`ROADMAP.md`・`ROADMAP.ja.md`、`demo/examples.json` (デモの定義。1.9.0 の lda・cancor と同じ
  形で、R の側のコードも同じ項目に書く)、`test/demo.test.ts` の `NOT_IN_DEMO_YET`
- **GitHub:** Issue #556 へのコメントだけ。PR #557 は Checks を読むだけ
- **書かない:** `HANDOFF.md`、`test/fixtures/`、既存のテスト (`test/{dist,hclust,kmeans,cmdscale}.test.ts` を含む)、生成のブロック
  (`*_KEYS`・`checkOptions` の import)、`docs/r-functions*`・`docs/ja/api/*.json`・`demo/r-results.json`・`demo/examples.R` (生成物。こちらが作る)、
  `scripts/`、`.github/`、`package.json`、`oracle/` の choices の節、`src/multivariate/isoMDS.ts`
- 手元で npm を流せなくてよい。テストは PR #557 の CI で確かめる。失敗したら直して push、を繰り返す

## 1. クリーンルーム (毎回守る)

R (stats の dist・hclust・cutree・kmeans・cmdscale) は GPL。ソースを読まない・思い出して書かない・写さない
(hclust.f・kmns.f・AS 136 も)。使ってよいのは公開の関数の出力、ヘルプ、論文の文章、rStats.js の既存の関数。**ウェブ検索は
使わない。** R の実験 (`experiments/`、先頭 5 行に `# issue: 556`) では `args`・`trace`・`methods`・`hc`・関数名を変数名に
使わない (チェッカーに止められる)。報告の最後にクリーンルームの確認を書く。

## A. 数値の点検 (手本: `briefs/numerics-1.9.ja.md` の 2 節と同じ進め方)

fixture との一致は、普通のデータで R と同じ値を返すことしか確かめていません。極端な入力でも正しい値を返すこと
(`docs/accuracy.md`) を確かめ、直します。

1. **洗い出し:** 4 つのファイルのコードを読み、次の観点で弱点を探す
   - **尺度 (値を 2^±500・2^±1000 倍):** dist は尺度どおり (溢れ・潰れの対だけ尺度を直す choices 1 の経路が働くか)、hclust は
     高さが尺度どおりで merge・order は不変 (ward.D2・centroid・median は内部で二乗するので 2^±500 で溢れやすい。R は ward.D2
     の 1e200 で落ちる)、kmeans は cluster・iter 不変で中心が尺度どおり・平方和が二乗で、cmdscale は座標が尺度どおり・固有値が
     二乗 (2^±500 で固有値は 2^±1000 の近く)
   - **ずらし (1e8・1e12):** dist・hclust・cmdscale はずらしに不変 (入力を double にした時点の誤差の水準か)。kmeans の totss・
     withinss が E[x²] − x̄² の形で桁落ちしていないか (中心をずらす前の値で計算していないか)
   - **桁落ち・溢れ:** Cailliez の 2n × 2n の固有値問題 (尺度を直してから解いているか)、kmeans の更新の式 (平均を足し引きで
     直す所の誤差の積み重なり)、非正規化数 (1e-310) の近く
   - **端の場合:** n = 2・3、全部同じ点、1 列のデータ、k = 1・k = n、NaN・Infinity (choices どおりか)
   - **大きさ (指示書 `briefs/cluster-mds-1.10.ja.md` の 5 節):** dist・hclust は n = 5000、kmeans は 10 万行 × 10 列、cmdscale
     は n = 2000 で動き、時間を報告する。hclust が O(n³) の探索になっていないか
2. **確かめ:** 各項目を実際の入力で確かめる。正しい値は高精度の計算 (尺度の性質、mpmath・BigInt の厳密な計算) か、R が
   正しいときは R の実験で
3. **直しとテスト:** 誤りを直し、`test/cluster-mds-numerics.test.ts` にテストを足す (正しい値とその求め方をコメントに)。
   **普通のデータの値を変えない** (既存のテストが全部通る。dist はビット単位のまま)。尺度の調整は必要なときだけ働くように。
   許容を広げない。直さないものは理由を報告に書く。R と違う値を返すようになった所は B の differences に書く

## B. 文書・デモ (手本: `briefs/release-1.9.ja.md` の R0〜R3)

- **R0 (TSDoc):** 6 つの関数と、その結果・オプションの型の**すべてのプロパティ**に英語の説明 (doc comment の 1 文目は説明、
  2 文目に「Equivalent to R's `hclust()`.」の決まった形。今の形を崩さない)。こちらが最後に TypeDoc を流す
- **R1 (配線):** 不要 (`/multivariate` は 1.9.0 で済み)
- **R2 (文書):** README (英・日) の Multivariate analysis (`/multivariate`) の行に 6 つを足す。`llms.txt` に dist + hclust +
  cutree と kmeans と cmdscale の書き換えの例を 1 つずつ。`docs/api-reference.md` (英・日)。`CHANGELOG.md` の
  `## Unreleased` に 1.10.0。`ROADMAP.md` (英・日) のクラスタ分析・多次元尺度法を済みに (isoMDS・sammon・対応分析は残りに)。
  `docs/differences-from-r.md` (英・日) に節「Cluster analysis and classical scaling: dist, hclust, kmeans and cmdscale」
  (日本語は「クラスタ分析と古典的多次元尺度法: dist・hclust・kmeans・cmdscale」)。**5 つの仕様書の choices で R と違う
  ことにした所を全部:** dist の極端な尺度 (R は 1e200 倍で Inf・1e-200 倍で 0、rStats.js は正しい値)、Minkowski (p ≠ 1・2)
  の最後の 1 ビット (pow の丸め)、hclust に行列をそのまま渡すと分かりやすいエラー (R は内部の失敗)・ward.D2 の極端な尺度で
  正しい値 (R 4.6.2 は落ちる)、cmdscale の列の符号 (決まった規則。R は LAPACK で決まる)・Cailliez の定数の丸めの大きさ (理論上
  0 のとき)・いつも全部の結果を返す (R の `list.`・`eig` は要らない)。警告は結果の `warnings`。**R の不具合と書いてよいのは
  ward.D2 の 1e200 で R が落ちることだけ。** ほかは「R と違う」「rStats.js はこうする」と書く。A で R と違う値にした所も
- **R3 (デモ):** 6 つの関数から 3〜4 個 (例: USArrests の dist + hclust + cutree、iris の kmeans は**中心を行列で渡す**
  (乱数を使わない)、eurodist の cmdscale は **eig と GOF だけ**を見せる (座標は符号が R と違いうる))。`demo/examples.json` に
  R のコードを必ず書く (こちらが `demo/examples.R` を生成し、R で流して照らし合わせる)。デモに入れた関数を `NOT_IN_DEMO_YET` から外す
- 日本語の API の訳 (`docs/ja/api/*.json`) はこちらが別にする
- 改行は LF。日本語の文書の表記: 括弧は半角 `( )`、コロンは半角 `:`、和文と英数字の間に半角スペース

## 2. 報告 (最後に 1 回、Issue #556 に)

A の一覧 (項目ごとに「直した・直さない (理由)・問題なし」と確かめた入力)、足したテスト、大きな入力の時間 (直す前と後)、
B で書いたファイルの一覧、デモの関数、CI が緑になったコミット、クリーンルームの確認。
