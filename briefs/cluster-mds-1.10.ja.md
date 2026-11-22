# 指示書: クラスタ分析と多次元尺度法 (1.10.0): dist・hclust・cutree・kmeans、cmdscale・isoMDS

作成 2026-11-22。基準のコミットは依頼の文で指定します (`git log -1` で確かめてから始める)。入口は
`briefs/cluster-mds-1.10-status.ja.md` (規則の全文と今の状態)。この文書は今回の中身です。

あなた (ChatGPT) には、rStats.js の `/multivariate` に 7 つの関数を足す作業を頼みます。1.9.0 (指示書
`briefs/tests-multivariate-1.9.ja.md`) と同じく、仕様書 → 実装 → 数値の点検 → 文書の順です。1.9.0 から引き継ぐ規則:
**ウェブ検索を使わない**、**仕様書は式のレベルで、R の出力と数値で突き合わせたものだけ書く**、**テストは返す値の全要素を
R と比べる**。1.9.0 の教訓 (4 節の終わり) も最初から守ってください。

## 0. 範囲と照合先 (ユーザーが決めたもの、2026-11-22)

照合先は R 4.6.2 の stats と **MASS 7.3.66** (どちらも GPL。クリーンルーム)。cluster パッケージは照合に使わない。

全部 **`/multivariate`** (`src/multivariate/`、入口 `src/entries/multivariate.ts`) に置く。配線 (`package.json`・
`scripts/bundle.mjs`・`typedoc.json`) は 1.9.0 で済んでいるので、今回は入口に export を足すだけでよい。ルートと
`dist/rstats.js` には入れない。

- **`dist`** (stats `dist`): method 6 つ (`"euclidean"`・`"maximum"`・`"manhattan"`・`"canberra"`・`"binary"`・
  `"minkowski"` と `p`)。R と同じく名前の前方一致を受けるかは Decisions に。NA・NaN・Infinity の扱いは R どおり
  (下の「分かっていること」)。`diag`・`upper` は R では表示のためだけの属性 → 返す形と一緒に Decisions に
- **`asDist`** (stats `as.dist`): 正方行列の下三角から距離の形を作る (上三角は使わない)。hclust・cmdscale・isoMDS に
  利用者の非類似度行列を渡すため
- **`hclust`** (stats `hclust`): method 8 つ (`"ward.D"`・`"ward.D2"`・`"single"`・`"complete"`・`"average"`・
  `"mcquitty"`・`"median"`・`"centroid"`) と `members`。`merge`・`height`・`order`・`labels`・`method`・`distMethod`
  (R の `dist.method`) を返す。**同じ高さの併合の順 (同点) と `merge` の行の中の向き・`order` を R と全く同じにするのが
  最大の難所** (R の出力から規則を決める。ソースは読まない)。median・centroid の高さの逆転も R どおり
- **`cutree`** (stats `cutree`): `k`・`h` (どちらもベクトルを受ける。ベクトルなら行列)。クラスタの番号の付け方は R どおり
- **`kmeans`** (stats `kmeans`): `centers` (数か行列)、`algorithm` 4 つ (`"Hartigan-Wong"` (既定)・`"Lloyd"`・
  `"Forgy"`・`"MacQueen"`)、`iterMax` (R の `iter.max`)、`nstart`。`cluster`・`centers`・`totss`・`withinss`・
  `totWithinss`・`betweenss`・`size`・`iter`・`ifault`。警告とエラーは R どおり (Hartigan-Wong の `ifault` も)
- **`cmdscale`** (stats `cmdscale`): `k`・`eig`・`add` (Cailliez の加算定数)・`xRet` (R の `x.ret`)。`points`・`eig`・
  `x`・`ac`・`GOF`。R の `list.` は「いつも全部を返す」で置き換えるのを推奨 (Decisions に)
- **`isoMDS`** (MASS `isoMDS`): Kruskal の非計量 MDS。`y` (初期の配置、既定は cmdscale)、`k`・`maxit`・`tol`・`p`
  (Minkowski の指数)。`points`・`stress` (百分率)。R の `trace` (途中の stress の表示) を返すかは Decisions に
- **範囲外:** MASS の `sammon`・`Shepard`、対応分析 (ca パッケージ)、cluster パッケージ (pam・agnes など)、`as.dendrogram`
  ・`cophenetic`・`rect.hclust` (図のための関数)
- **符号 (ユーザーの決定):** cmdscale の座標の列の符号は、1.9.0 の lda・cancor と同じく**列ごとに絶対値最大の成分を正に
  する決まった規則**。R の符号は LAPACK で決まり合わせられないので、**R との既知の違い**として文書に書く。isoMDS の配置も
  既定の初期値が cmdscale なので、R の配置と列の反転だけ違いうる (stress は同じ)。**テストは列の符号を R にそろえてから
  全成分を比べる**
- 名前: `dist`・`asDist`・`hclust`・`cutree`・`kmeans`・`cmdscale`・`isoMDS` (R と同じ名前。付属の関数が要るなら
  `manovaSummary`・`ldaPredict` の形)。引数は camelCase (`iterMax`・`xRet`)。異論があれば Decisions に

## 1. 最初に読むもの

- 入口 `briefs/cluster-mds-1.10-status.ja.md` (規則の全文)
- 手本: 1.9.0 の仕様書 `oracle/lda-behaviour.md`・`oracle/cancor-behaviour.md` (特に末尾の「rStats.js's choices」の
  形)、実装 `src/multivariate/cancor.ts`・`lda.ts` とそのテスト、oracle の補助ファイル方式 `oracle/_multivariate19cases.R`
  と `oracle/lda.R`
- 既存の部品 (呼んでよい): `src/linalg/` (`eigen` (対称は実固有値)・`svd`・`prcomp`)、`src/random/` (`setSeed`・
  `sampleInt`。**R の `sample.int` と同じ列を出すことはこちらで確かめた**)、`src/entries/numerics.ts` の export
- **こちらが流した R の出力** (`experiments/`): `cluster110.R`/`.json` (dist・as.dist・hclust・cutree・kmeans。
  x86_64 の R)、`mds110.R`/`.json` (cmdscale・isoMDS)。JSON の形は 1.9.0 と同じ (`{ value, warnings, messages }` か
  `{ error, ... }`、行列は `{ rows, cols, values }`)。どの case が何を呼んだかは同じ名前の `.R` を読む

### こちらの実験で分かっていること

- **dist:** 戻り値は下三角を列の順に並べたもの (R の `as.vector`)。`p = Inf` と `p = 0` は `distance(): invalid p`
  のエラー、`p = 0.5` は通る。`method = "max"` の前方一致は通る。**NA は対ごとに両方に値のある座標だけで計算し、
  euclidean・manhattan・canberra・minkowski は使えた座標の数で尺度を直す** (`dist_na_*`。maximum と binary は直さない
  ように見える。式は仕様書で確かめる)。行が全部 NA なら、その行の対は NA。NaN も NA と同じ。**Inf:** euclidean 系は Inf、
  両方が Inf の座標は除かれる (`dist_inf_both_*`)、canberra は Inf の項を 1 とするように見える、binary は
  `treating non-finite values as NA` の警告 (対の数だけ出る)。canberra の 0/0 の項は除いて尺度を直し、全部 0/0 なら NA。
  binary は両方 0 の列を除き、全部 0 なら 0 か 1 (`dist_binary_zero_rows`)。文字の行列は `NAs introduced by coercion`。
  1e200 倍は Inf に溢れる、1e-200 倍は 0 に潰れる (R の素朴な二乗和)。**rStats.js がこれを R に合わせるか、溢れない計算に
  するかは Decisions に** (推奨: 溢れない計算。1.9.0 の T2 の自由度と同じ考え)
- **as.dist:** 下三角だけを使う。`method` は NULL
- **hclust:**
  - **median と centroid は距離を二乗しない** (利用者が `d^2` を渡す前提、ヘルプのとおり)。高さは逆転しうる
    (`hclust_small_centroid` の 4 番目、`hclust_triangle_centroid`)。逆転のある木の `cutree(h = )` は
    `the 'height' component of 'tree' is not sorted (increasingly)` のエラー、`k = ` は通る
  - 同点: 格子 (`hclust_grid_*`)・等間隔の直線 (`hclust_line_*`、並べ替えた `hclust_line_shuffled_*`)・全部等しい
    (`hclust_all_equal_*`)・距離 0 (`hclust_zero_*`) の case がある。**同点の選び方・`merge` の行の中の符号と順・`order`
    の規則を、これらの出力から仕様書に式で書く**
  - `members` の長さ違いは `invalid length of members`。`method = "ward"` は `ward.D` として通り、メッセージ
    `The "ward" method has been renamed to "ward.D"; note new "ward.D2"`。前方一致 (`"cent"`) も通る。n = 1 は
    `must have n >= 2 objects to cluster`。NA・Inf は `NA/NaN/Inf in foreign function call (arg 10)`。負の距離は
    そのまま通る。行列をそのまま渡すと `missing value where TRUE/FALSE needed` (R の内部の失敗)
  - **R 4.6.2 自身が `hclust(d * 1e200, method = "ward.D2")` で落ちる** (arm64 で segfault、x86_64 で止まらない)。
    尺度の端は R と比べず、同変性 (高さが尺度どおり、`merge`・`order` は同じ) で確かめる
- **cutree:** `k` と `h` の両方なら `k` を使う。`k = 2.5` は 2 として通る。`h < 0` は全部別のクラスタ。k の範囲外は
  `elements of 'k' must be between 1 and 50`。どちらも無いと `either 'k' or 'h' must be specified`。ラベルが無ければ
  名前なしのベクトル。クラスタの番号は観測の順に初めて出た順に見える (仕様書で確かめる)
- **kmeans:**
  - **乱数:** `centers` が数なら、**`nstart` 回だけ `sample.int(nrow(x), k)` を引く** (行の重複があっても nrow。
    `kmeans_seed_state_after*` の後の `runif` で確かめた)。行列なら乱数を使わない。最初の組が重複する行を選んだとき
    どうなるか (引き直すか) は未確認 → 仕様書で R の実験で確かめる。`more cluster centers than distinct data points.`
    のエラー (`kmeans_seed_k_too_big`)
  - `nstart > 1` は tot.withinss が最小の組を選ぶ。**同点のとき・クラスタの番号の付け方** は仕様書で
  - Hartigan-Wong: k = n は `number of cluster centres must lie between 1 and nrow(x)` のエラー (ほかの 3 つは通る)、空の
    クラスタは `empty cluster: try a better set of initial centers` の**エラー** (ほかの 3 つは同じ文の**警告**で、
    2 回出る)。`ifault` は Hartigan-Wong だけ数 (0・2・4)、ほかは NULL。`iter.max` に達すると `did not converge in 10
    iterations` の警告 (`iter.max = 1` なら `1 iteration`)。`iter` の数え方は algorithm ごとに違う (Lloyd・Forgy は
    収束しても 1 多く見える。仕様書で確かめる)
  - `initial centers are not distinct` (行列の centers に同じ行)、`must have same number of columns in 'x' and
    'centers'`、`'iter.max' must be positive`、NA は `NA/NaN/Inf in foreign function call (arg 1)`。ベクトルの x は
    1 列の行列として扱う。データフレームも通る
  - Lloyd と Forgy は同じ結果 (R のヘルプのとおり同じ手法)
- **cmdscale:** `eig` は n 個全部 (負も)。`GOF` は 2 つ (分母が |λ| の和と正の λ の和)。`k` が正の固有値の数より多いと
  `only 2 of the first 3 eigenvalues are > 0` の警告で列が減る。`k` の範囲外 (0、n 以上、n = 1) は
  `'k' must be in {1, 2, ..  n - 1}`。NA は `NA values not allowed in 'd'`。非対称の行列も通る (どう使うかは仕様書で)。
  `add = TRUE` の `ac` は Cailliez の定数で、ユークリッドの距離でもごく小さい正の値 (`cmdscale_usarrests_add` で
  2.5e-12、`cmdscale_small_add` で 4.8e-8) → **この値を R と比べる許容は仕様書で根拠を書いて決める**。ラベルなしなら
  行名なし
- **isoMDS:** `stress` は百分率。既定の初期値は cmdscale の配置 (`isomds_swiss_maxit0` の stress が初期値の stress)。
  途中の表示は 5 回ごとの `iter   5 value 4.499103` の形と `converged`・`stopped after 5 iterations` (capture.output で
  取ってある、`printed`)。距離 0 か負は `zero or negative distance between objects 1 and 2`。NA は初期値なしだと
  `an initial configuration must be supplied with NA/Infs in 'd'`。y の行数違いは `invalid initial configuration`。
  **尺度:** 1e150 倍で `converged` の判定がすぐ成り立ち、stress が初期値のまま (`isomds_scale`、`isomds_scale_y`)。
  収束の判定に尺度の絶対値が入っているように見える → 仕様書で確かめ、R に合わせるか Decisions に。同点の距離
  (`isomds_grid_ties*`) の扱い (Kruskal の primary か secondary か) も仕様書で

## 2. 段階 (各段階の終わりで止まって Issue に報告する)

### 段階 1: 仕様書と oracle (1 回の報告にまとめる)

- `oracle/dist-behaviour.md`・`oracle/hclust-behaviour.md` (cutree も)・`oracle/kmeans-behaviour.md`・
  `oracle/cmdscale-behaviour.md`・`oracle/isomds-behaviour.md` (英語)。**式のレベル**で書く: 距離の式と NA の尺度の
  直し方、Lance-Williams の更新式 (8 つの method の係数)、同点の規則と `merge`・`order` の作り方、kmeans の 4 つの
  手法の 1 回の更新と収束の判定と `iter` の数え方、cmdscale の二重中心化と Cailliez の定数の求め方、isoMDS の stress・
  単調回帰 (同点の扱い)・更新の手順と収束の判定。**書いた式は、R の出力と独立の計算 (あなたの手計算・rStats.js の既存の
  関数) で数値を突き合わせ、その case 名を書く。** 突き合わせていない式は「未確認」と明記する。末尾に「Decisions for the
  user」(**選択肢と推奨**) と空の「rStats.js's choices」
- **oracle は補助ファイル方式** (1.9.0 の教訓): ケースは `oracle/_cluster110cases.R` (と必要なら `_mds110cases.R`) に置き、
  `oracle/dist.R`・`hclust.R`・`kmeans.R`・`cmdscale.R`・`isomds.R` はそこから自分の分を選んで `/out/<名前>.json` に書く
  (`scripts/oracle.sh` は `oracle/` だけをマウントする。`experiments/` を読まない、標準出力に出さない)。R のオブジェクト
  (`hclust`・`kmeans` の結果) を JSON にそのまま入れない。数値と文字列だけを取り出す。kmeans の乱数の case は x86_64 の
  R で作る (こちらが `rstats-oracle-amd64:4.6.2` で作る)
- 決めること (少なくとも): 上の「分かっていること」で「仕様書で」と書いた所全部。特に hclust の同点の規則は、全ての
  同点の case で R と同じ `merge`・`height`・`order` になることを独立の計算で確かめる
- 足りない R の実験は、3 節の形で自分で流してよい。報告の前に、要る実験を済ませておく
- **報告:** 仕様書の要点、未解明の所、Decisions for the user。ここで止まり、こちらの「進めてよい」を待つ

### 段階 2: 実装 (dist・asDist → hclust・cutree → kmeans → cmdscale → isoMDS)

- 1 つが CI 緑になったら Issue に短い報告 (コミット、テストの件数、大きな入力の時間) を書いて、**止まらずに次へ進む**
  (こちらは並行して点検する)。全部済んだら段階 2 の報告をして止まる
- 5 節の端の入力のテストは、この段階で入れる

### 段階 3: 数値の点検 (1.9.0 の `briefs/numerics-1.9.ja.md` の形)

こちらが別の指示書で頼みます。極端な尺度・ずらし・桁落ち・溢れを、関数ごとに R か独立の計算と比べる段階です。

### 段階 4: 文書・デモ・訳

こちらが別の指示書 (`briefs/release-1.9.ja.md` の形) で頼みます。

## 3. R の実験 (あなたが GitHub Actions で流す)

- `experiments/<名前>.R` を作業ブランチに push すると、`.github/workflows/r-experiments.yml` が x86_64 の R 4.6.2
  (fixture と同じ CRAN の日付、MASS 入り) で流し、出力を Issue のコメントに書く (60000 バイトまで)。**スクリプトの先頭
  5 行のどこかに `# issue: <番号>` を書く** (無いと Issue に出ない)
- 先に `scripts/r-experiment-check.mjs` が検査し、通らないと流れない。止まるもの: 参照パッケージの関数を呼ばずに名前
  だけ書く (`print(hclust)`・`f <- kmeans`)、`deparse`・`body`・`:::`・`get`・`eval`・`unclass` など、文字列での関数名、
  許可外のパッケージ。**関数名を変数名にしない** (`dist`・`hclust`・`kmeans`・`cutree`・`cmdscale` は stats、`isoMDS` は
  MASS の関数名。`dist <- ...` は止まる。引数名として書くのは通る)。こちらが実際に止められたもの: `methods` (変数名)、
  `hc` (ほかの参照パッケージの関数名)、**`trace` (引数名でも止まる)** → isoMDS は `trace` を渡さず、表示は
  `capture.output(r <- isoMDS(...))` で受ける (`experiments/mds110.R` の `im`)
- 1 本 120 秒、メモリ 2 GB、ネットワークなし。**まとめて書いてから push する** (1 本ずつ待たない)。出力は 17 桁
  (`jsonlite::toJSON(x, digits = NA)`)。大きな出力は要約して 60000 バイトに収める。**R が落ちる入力 (上の ward.D2 の
  1e200) を入れると、その 1 本全部の出力が失われる**
- **実験は仕様を決めるためだけ。R の不具合を深追いしない。** R がおかしく見えたら、正確な値を独立に計算して記録し、
  先へ進む

## 4. 前回までの直し (最初から守る)

`briefs/regression-1.7.ja.md` の 4 節の 1〜17 を全部守る。特に:

- fixture (`test/fixtures/`) と生成物はこちらが作る。oracle スクリプトを push して Issue に「fixture の依頼」と書けば、
  こちらが `npm run oracle -- <name>` で作って push する (それまで、そのテストは fixture が無くて落ちてよい)
- **テストは R の値と比べる。返す値の全要素** (表は全行・全列、行列は全成分、ラベルと文字列も、警告の文も) を比べる。
  不一致はラベル付きで集め、最後に `expect(mismatches).toEqual([])`
- **許容誤差を広げて通さない。期待値を実装に合わせて書き換えない** (1.8.0・1.9.0 で両方あった)。合わなければ根拠を
  添えて報告する。許容は根拠のある最小に (1.9.0 で 1e-8 を締めた。直接の計算なら相対 1e-12 前後が目安)
- choices で決めた仕様は、項目ごとにどのテストで確かめるかを書く
- `checkOptions(options, <NAME>_KEYS, "<name>"); // generated: option-keys.mjs` の 1 行。生成のブロックは手で書かない

**1.9.0 の教訓:**

- **作業ブランチで `HANDOFF.md` を触らない** (main と衝突し、衝突した PR では CI が動かなかった)
- **戻り値はいつも配列** (長さ 1 でもスカラーにしない。R の JSON の auto_unbox を写さない)。テストの比較の側で
  R の長さ 1 のスカラーを配列に直す
- 群・ラベルの順は R の `factor()` の順 (既存の `labelledGroups`) — 今回は kmeans の行名・dist のラベルで、入力の順を
  そのまま使う所と区別する
- **export を確かめる:** 新しい関数は `src/entries/multivariate.ts` から export し、テストは入口から import する
  (1.9.0 で export し忘れたのに、テストが内部のファイルから import していて気づかなかった)
- CI が緑でも「済んだ」で終わらない。報告に、R と比べた case の数と最大の誤差を書く
- 極端なテストのデータは double で正確に表せるものにする (整数・2 の冪)

## 5. 端の入力 (合格の条件。段階 2 のテストに入れる)

- **尺度:** 値を 1e100 倍・1e-100 倍 (dist・hclust は高さが尺度どおり、`merge`・`order`・`cluster` は不変。cmdscale の
  座標は尺度どおり、固有値は二乗)、1e8 だけずらす (dist は不変)。相対 1e-10 で一致する。R が溢れる・落ちる所は同変性で
- **大きさ:** dist と hclust は n = 5000 (距離 1250 万個)、kmeans は 10 万行 × 10 列、cmdscale は n = 2000、isoMDS は
  n = 500 で動く。時間を報告に書く。hclust は O(n²) の記憶で、O(n³) の素朴な探索にしない。**配列を関数の引数に展開
  しない** (`Math.max(...列)`・`push(...列)`)
- **異常な値:** NaN・Infinity を含む入力はエラーか、R と同じ除き方 (dist は R どおりに NA の尺度を直す)
- **縮退:** 同じ点 (距離 0)、全部等しい距離、n = 2、k = 1・k = n、空のクラスタ、正の固有値が k より少ない、1 列のデータ
- R の値と比べられないもの (R が失敗する、R が不正確) は、同変性か独立の計算と比べる

## 6. 書くもの・触らないもの

- 書く: `oracle/` の新しい仕様書と `.R` (補助ファイル `_cluster110cases.R` など)、`src/multivariate/` の新しいファイル、
  `src/entries/multivariate.ts` の export、`test/` の新しいテスト、`test/demo.test.ts` の `NOT_IN_DEMO_YET`、
  `experiments/` の実験
- 触らない: 仕様書の「rStats.js's choices」の節、既存の関数 (呼ぶのはよい。直す必要があれば提案)、`test/fixtures/`、
  `test/helpers/`、`docs/`、`CHANGELOG.md`、`ROADMAP*.md`、`HANDOFF.md`、`.github/`、`scripts/`、`package.json`、
  `typedoc.json`、`demo/`
