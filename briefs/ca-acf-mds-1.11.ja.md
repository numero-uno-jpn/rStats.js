# 指示書: 対応分析・自己相関・非計量 MDS (1.11.0): ca・mjca、acf・pacf・ccf、isoMDS・sammon

作成 2026-11-23。基準のコミットは依頼の文で指定します (`git log -1` で確かめてから始める)。入口は
`briefs/ca-acf-mds-1.11-status.ja.md` (書き込んでよい場所・規則の全文・今の状態)。この文書は今回の中身です。

あなた (ChatGPT) には、rStats.js に 7 つの関数を足す作業を頼みます。1.10.0 (指示書 `briefs/cluster-mds-1.10.ja.md`) と
同じく、仕様書 → 実装 → 数値の点検 → 文書の順です。1.10.0 から引き継ぐ規則: **ウェブ検索を使わない**、**仕様書は式の
レベルで、R の出力と数値で突き合わせたものだけ書く**、**テストは返す値の全要素を R と比べる**。4 節の教訓も最初から
守ってください。

## 0. 範囲と照合先 (ユーザーが決めたもの、2026-11-23)

照合先は R 4.6.2 の stats (`acf`・`pacf`・`ccf`)、**MASS 7.3.66** (`isoMDS`・`sammon`)、**ca 0.72** (`ca`・`mjca`)。
どれも GPL。クリーンルーム。

- **`/timeseries` (新しい分野):** `acf`・`pacf`・`ccf`。入口 `src/entries/timeseries.ts` (空の入口と配線はこちらで済ませた:
  `package.json`・`scripts/bundle.mjs`・`scripts/size.mjs`・`typedoc.json` の分類 "Time series"・`src/api-reference.ts`・
  `test/docExamples.test.ts`)。ファイルは `src/timeseries/` に置く。ルートと `dist/rstats.js` には入れない
- **`/multivariate`:** `ca`・`mjca`・`isoMDS`・`sammon` (`src/multivariate/`、入口 `src/entries/multivariate.ts`)

関数ごとの範囲:

- **`acf`** (stats `acf`、**単変量だけ**): `type` 3 つ (`"correlation"` (既定)・`"covariance"`・`"partial"`)、`lagMax`
  (R の `lag.max`、既定 `floor(10 * log10(N))`、N 以下に丸めるかは R の出力で)、`demean`、`naAction` (R の `na.action`。
  `na.fail` (既定)・`na.pass` のどれを受けるかは Decisions に。`na.omit`・`na.contiguous` は推奨で外す)。返す値は `lag`・
  `acf`・`type`・`nUsed` (R の `n.used`) と、**図の点線の値 `clim = qnorm((1 + ci) / 2) / sqrt(nUsed)`** (`ci` の既定
  0.95、R の `plot.acf` の白色雑音の線)。`ci.type = "ma"` の帯は範囲外
- **`pacf`** (stats `pacf`、単変量): `lagMax` (1 以上)・`naAction`。`acf(type = "partial")` と同じ値か確かめる
- **`ccf`** (stats `ccf`): 2 つの系列の相互相関・相互共分散、`lag` は `-lagMax..lagMax`、**値の向き (lag k は
  `cor(x[t + k], y[t])`) を R の出力で確かめて仕様書に書く**。長さの違う系列・時点のずれ (R は `ts.intersect` で重なりを
  取る) を受けるかは Decisions に (推奨: 同じ長さの配列だけ、違えばエラー)
- **時間の単位:** R の `lag` は時間の単位 (`lag / frequency`)。rStats.js には ts オブジェクトが無い → `frequency` の
  オプションを受けるか、`lag` をいつも整数にするかを Decisions に
- **多変量の系列** (行列の acf、多変量の pacf) は範囲外。2 列の行列はエラーにする (`acf_matrix_2col` は形の参考)
- **`ca`** (ca パッケージ `ca`): 単純対応分析。行・列の質量・距離 (χ² 距離)・慣性、主座標と標準座標、特異値 (`sv`)、
  `nd`、補助の行・列 `suprow`・`supcol` (番号で。名前を受けるかは Decisions)。入力は行列 (ラベルつきの表の形は 1.10.0 の
  `KmeansInputTable` などの前例に合わせる)。**`summary` の表 (scree: 慣性と百分率、行・列の qlt・inr・cor・ctr) を
  付属の関数 `caSummary` で返すか**、**`cacoord` の地図の種類 (standard・principal・symmetric・rowprincipal・
  colprincipal・symbiplot・rowgab・colgab・rowgreen・colgreen) を `caCoord` で返すか** は Decisions に (推奨: どちらも
  入れる。どちらも fit から決まる計算)
- **`mjca`** (ca パッケージ `mjca`): 多重対応分析と結合対応分析。`lambda` 4 つ (`"adjusted"` (既定)・`"indicator"`・
  `"Burt"`・`"JCA"`)、`nd`、`supcol`、`subsetcat`、`reti` (指示行列を返す)、`ps` (水準名の区切り)、JCA の `maxit`・
  `epsilon`。`sv`・`lambda`・`inertia.e`・`inertia.t`・`inertia.et`・`levelnames`・`colmass`・`coldist`・`colinertia`・
  `colcoord`・`colpcoord`・`colctr`・`colcor`・`subinertia`・`Burt` と、indicator のときの行の成分。入力は因子の列の
  表 (`data.frame` の形)。**分割表 (`table`) の入力を受けるかは Decisions に** (推奨: 外す)
- **`isoMDS`** (MASS `isoMDS`): 1.10.0 で `work/isomds-next` に書いた実装 (`src/multivariate/isoMDS.ts`・
  `test/isoMDS.test.ts`) を作業ブランチに取り込み済み。仕様書 `oracle/isomds-behaviour.md` の choices 1〜7 がそのまま
  有効で、**合格の条件は choices 7** (厳しく収束させた R `isomds_tight_*` と、stress が相対 1e-6、座標が Procrustes の
  後に R の座標の最大絶対値の 1e-5 以内)。**1.10.0 ではこれに届かなかった。** 届かない理由を先に調べて報告する (どの
  case がどれだけ外れるか、局所解か停止の判定か)
- **`sammon`** (MASS `sammon`): Sammon (1969) の非線形写像。`y` (初期の配置、既定は cmdscale)・`k`・`niter`・`magic`・
  `tol`。`points`・`stress` と、途中の表示 (`printed`) にあたる数を返すか (isoMDS の choices 3 の形) は Decisions に。
  **合格の条件は isoMDS と同じ形:** まず R の既定の設定の結果 (sammon は決定的なので、R の途中の stress と最終の座標に
  合わせることを目指す)。届かなければ、厳しく収束させた R (`tight_*`、`niter = 1e5`・`tol = 1e-14`) と許容内
- **isoMDS・sammon の打ち切り (ユーザーの決定):** 上の合格の条件に届かなければ、1.11.0 から外して公開する。早めに
  見通しを報告する
- **範囲外:** 多変量の時系列、`ar`・`arima` (1.12.0)、`spectrum`、ca パッケージの図の関数 (`plot.ca`・`plot3d.ca`)、
  `MASS::corresp`・`mca`、`Shepard`
- **符号 (1.10.0 と同じ規則):** ca・mjca の座標と isoMDS・sammon の既定の初期値 (cmdscale) の列の符号は、**列ごとに
  絶対値最大の成分を正にする決まった規則** (1.9.0 の lda・cancor、1.10.0 の cmdscale と同じ)。R の符号は特異値分解で
  決まり合わせられないので、R との既知の違いとして文書に書く。ca の行と列は同じ次元で一緒に反転する (行の規則で決めた
  符号を列にも使うか、その逆かは Decisions に)。**テストは列の符号を R にそろえてから全成分を比べる**
- 名前: `acf`・`pacf`・`ccf`・`ca`・`mjca`・`isoMDS`・`sammon` (R と同じ名前。付属は `caSummary`・`caCoord` の形)。
  引数は camelCase (`lagMax`・`naAction`・`nUsed`・`suprow`・`supcol` は R のまま小文字でよいかも Decisions に)

## 1. 最初に読むもの

- 入口 `briefs/ca-acf-mds-1.11-status.ja.md` (規則の全文)
- 手本: 1.10.0 の仕様書 `oracle/cmdscale-behaviour.md`・`oracle/isomds-behaviour.md` (末尾の「rStats.js's choices」の
  形)、実装 `src/multivariate/cmdscale.ts`・`kmeans.ts` とそのテスト、oracle の補助ファイル方式
  `oracle/_cluster110cases.R` と `oracle/cmdscale.R`
- 既存の部品 (呼んでよい): `src/linalg/` (`eigen`・`svd`・`prcomp`、k 本だけの固有ベクトル `symmetricLeading`)、
  `src/multivariate/cmdscale.ts` (isoMDS・sammon の初期値)、`src/distributions/` (`qnorm`)
- **こちらが流した R の出力** (`experiments/`、どれも **x86_64 の R 4.6.2・17 桁**): `ca111.R`/`.json` (ca・mjca)、
  `acf111.R`/`.json` (acf・pacf・ccf)、`sammon111.R`/`.json` (sammon と厳しく収束させたもの)。isoMDS は 1.10.0 の
  `mds110.R`/`.json`・`mds110-isomds-tight.R` と `test/fixtures/isomds.json`。JSON の形は 1.10.0 と同じ
  (`{ value, warnings, messages }` か `{ error, ... }`、行列は `{ rows, cols, values }`)。どの case が何を呼んだかは同じ
  名前の `.R` を読む

### こちらの実験で分かっていること

- **ca:**
  - fit の成分は `keep()` で全部取ってある (`value.fit`)。`summary()` は別の `run()` (`value.summary`) で、**ca 0.72 の
    summary は次元が 1 つ以下だと落ちる** (`ca_smoke_nd1`・`ca_author_nd3` は `non-conformable arguments`、`ca_2x2`・
    `ca_no_names`・`ca_one_row` は `subscript out of bounds`、`ca_independent`・`ca_identity` は `arguments imply
    differing number of rows`)。fit は全部取れている → rStats.js の `caSummary` はこれらで値を返し、R のエラーは写さない
    のを推奨 (Decisions に。値は独立の計算で確かめる)
  - エラー: 行か列が全部 0、負の値、NA は `infinite or missing values in 'x'` (負の値は `NaNs produced` の警告つき)。
    `suprow` で残りの行が 1 つになると `non-numeric matrix extent`、`suprow` に名前は `no 'dimnames' attribute for
    array` (名前は受けない)
  - 尺度: 表を 2^±300 倍しても結果は同じはず (`ca_scale_big`・`ca_scale_small`、`ca_fraction`)
- **mjca:**
  - wg93 (871 行) の case は行の成分を落としてある (`rows = FALSE`)。行まで比べるのは先頭 60 行の `mjca_w60_*`、
    指示行列は `mjca_w60_reti` (12 行)
  - 小さな表 (`mjca_small_*`) の adjusted・JCA、2 変数、未使用の水準、数値の列は `non-conformable arguments` のエラー、
    1 変数は `infinite or missing values in 'x'`。indicator・Burt は通る。**R がこれらで落ちるのは次元が足りない所の
    扱いのように見える** → 仕様書で原因を式で書き、rStats.js がエラーにするか値を返すかを Decisions に
  - NA は通る (`mjca_na`。NA を水準として扱うか除くかを仕様書で)。分割表の入力は `'as.is' should be specified by the
    caller` の警告が 3 回 (`mjca_wg93_crosstab`)
- **acf・pacf・ccf:**
  - `lag.max` の既定は N = 48 で 16 (`acf_lh_correlation` の長さ 17 = lag 0..16)、`lag.max = 100` は N - 1 に丸める、
    `3.7` は 3、負は `'lag.max' must be at least 0`。pacf は lag 1 から、`lag.max = 0` は `'lag.max' must be at least 1`
  - NA: 既定 (`na.fail`) は `missing values in object`、`na.pass` は通る (欠けた積を除いて和を取る形かを仕様書で)、
    `na.omit` は `time series contains internal NAs`、`na.contiguous` は最長の連続部分 (79 点)。NaN も通る
    (`acf_nan`)、Inf も通る (`acf_inf`、値は NaN になるはず)
  - 文字・論理は `'x' must be numeric`、空は `'ts' object must have one or more observations`、定数の系列は分散 0
    (`acf_constant*`、NaN の出方を仕様書で)
  - ccf: `type = "partial"` は `'arg' should be one of ...` のエラー。長さ違い (`ccf_lengths`) と時点のずれ
    (`ccf_ts_window`) は重なりの 8 点、頻度違いは `not all series have the same frequency`
  - 点線: `clim_*` に `n.used` と `qnorm((1 + ci) / 2) / sqrt(n.used)` (na.pass でも `n.used` は全長)
  - 長い系列 (N = 5000、`acf_long*`) と 2^±300 倍・1e8 のずらし
- **sammon:**
  - 途中の表示は `Initial stress        : 0.01959` と `stress after  20 iters: 0.00094, magic = 0.500` の形
    (`printed`)。**swiss は既定でも厳しくしても「0 回の反復」で止まり、初期値の stress のまま** (`sammon_swiss`・
    `tight_swiss`)。止まる理由 (最初の一歩で stress が下がらず magic を縮める規則か) を仕様書で式で書く
  - エラー: 距離 0 か負は `zero or negative distance between objects 1 and 2`、y に重複は `initial configuration has
    duplicates`、y の形違いは `invalid initial configuration`、NA は初期値なしだと `an initial configuration must be
    supplied if there are NAs in 'd'`、Inf は `Infs not allowed in 'd'`、`k = n` は `'k' must be in {1, 2, ..  n - 1}`
  - 尺度: 2^±300 倍で stress は同じ (`sammon_scale_*`)。**初期値だけ 2^100 倍 (`sammon_scale_y`) は R の stress が
    1.6e39 で 100 回で打ち切り** (R は初期値の尺度を直さない)
  - 厳しく収束させた case (`tight_*`) は全部、表示の上で収束している (k3 は 250 回、usarrests は 370 回)

## 2. 段階 (各段階の終わりで止まって Issue に報告する)

### 段階 1: 仕様書と oracle (1 回の報告にまとめる)

- `oracle/acf-behaviour.md` (pacf・ccf も)・`oracle/ca-behaviour.md`・`oracle/mjca-behaviour.md`・
  `oracle/sammon-behaviour.md` (英語) と、`oracle/isomds-behaviour.md` への追記 (1.10.0 で届かなかった理由の調べ)。
  **式のレベル**で書く: acf の分母 (N で割るか N - k か)・demean・NA の扱い、pacf の Durbin-Levinson の漸化式、ccf の
  向きと重なり、ca の特異値分解と座標の式・補助の点の射影・summary の qlt・inr・cor・ctr の式 (千分率か)、mjca の 4 つの
  lambda の慣性の式 (Benzécri・Greenacre の調整) と JCA の反復、sammon の stress・更新 (Newton の対角の近似と magic)・
  打ち切りの判定。**書いた式は、R の出力と独立の計算 (あなたの手計算・rStats.js の既存の関数) で数値を突き合わせ、
  その case 名を書く。** 突き合わせていない式は「未確認」と明記する。末尾に「Decisions for the user」(**選択肢と推奨**)
  と空の「rStats.js's choices」
- **oracle は補助ファイル方式:** ケースは `oracle/_ca111cases.R`・`oracle/_acf111cases.R`・`oracle/_sammon111cases.R`
  に置き、`oracle/acf.R`・`ca.R`・`mjca.R`・`sammon.R` はそこから自分の分を選んで `/out/<名前>.json` に書く
  (`scripts/oracle.sh` は `oracle/` だけをマウントする。`experiments/` を読まない、標準出力に出さない)。**先頭に
  `# oracle-platform: amd64`** (ビット単位の照合は x86_64 の R。arm64 は FMA で最後の桁が違う)。**JSON は 17 桁
  (`jsonlite::toJSON(x, digits = I(17))`。`digits = NA` は 15 桁に丸める)**。R のオブジェクトを JSON にそのまま入れない
- 決めること (少なくとも): 上の「分かっていること」で「仕様書で」「Decisions に」と書いた所全部
- 足りない R の実験は、3 節の形で自分で流してよい。報告の前に、要る実験を済ませておく
- **報告:** 仕様書の要点、未解明の所、Decisions for the user、isoMDS が届かなかった理由の調べ。ここで止まり、こちらの
  「進めてよい」を待つ

### 段階 2: 実装 (acf・pacf・ccf → ca → mjca → sammon → isoMDS)

- 1 つが CI 緑になったら Issue に短い報告 (コミット、テストの件数、R と比べた case の数と最大の誤差、大きな入力の時間)
  を書いて、**止まらずに次へ進む** (こちらは並行して点検する)。全部済んだら段階 2 の報告をして止まる
- 5 節の端の入力のテストは、この段階で入れる

### 段階 3: 数値の点検 (`briefs/numerics-1.9.ja.md` の形)

こちらが別の指示書で頼みます。

### 段階 4: 文書・デモ・訳

こちらが別の指示書 (`briefs/release-1.9.ja.md` の形) で頼みます。

## 3. R の実験 (あなたが GitHub Actions で流す)

- `experiments/<名前>111-*.R` を作業ブランチに push すると、`.github/workflows/r-experiments.yml` が x86_64 の R 4.6.2
  (fixture と同じ CRAN の日付、MASS 7.3.66・**ca 0.72** 入り) で流し、出力を Issue のコメントに書く (60000 バイトまで)。
  **スクリプトの先頭 5 行のどこかに `# issue: <番号>` を書く** (無いと Issue に出ない)
- 先に `scripts/r-experiment-check.mjs` が検査し、通らないと流れない。止まるもの: 参照パッケージの関数を呼ばずに名前
  だけ書く、`deparse`・`body`・`:::`・`get`・`eval`・`unclass` など、文字列での関数名、許可外のパッケージ。**関数名を
  変数名にしない** (`acf`・`pacf`・`ccf` は stats、`ca`・`mjca`・`cacoord` は ca、`sammon`・`isoMDS` は MASS の関数名。
  `ca <- ...` は止まる)。**`trace` は引数名でも止まる** → isoMDS・sammon の表示は `capture.output(r <- sammon(...))` で
  受ける (`experiments/sammon111.R` の `sm`)
- 1 本 120 秒、メモリ 2 GB、ネットワークなし。**まとめて書いてから push する**。出力は 17 桁
  (`jsonlite::toJSON(x, digits = I(17))`)。大きな出力は要約して 60000 バイトに収める (wg93 の行の成分は大きい)
- **実験は仕様を決めるためだけ。R や ca パッケージの不具合を深追いしない。** R がおかしく見えたら、正確な値を独立に
  計算して記録し、先へ進む

## 4. 前回までの直し (最初から守る)

`briefs/regression-1.7.ja.md` の 4 節の 1〜17 と `briefs/cluster-mds-1.10.ja.md` の 4 節を全部守る。特に:

- fixture (`test/fixtures/`) と生成物はこちらが作る。oracle スクリプトを push して Issue に「fixture の依頼」と書けば、
  こちらが作って push する (それまで、そのテストは fixture が無くて落ちてよい)
- **テストは R の値と比べる。返す値の全要素** (表は全行・全列、行列は全成分、ラベルと文字列も、警告の文も) を比べる。
  不一致はラベル付きで集め、最後に `expect(mismatches).toEqual([])`
- **許容誤差を広げて通さない。期待値を実装に合わせて書き換えない。** 合わなければ根拠を添えて報告する。許容は根拠の
  ある最小に (直接の計算なら相対 1e-12 前後が目安。acf・ca は和と特異値分解なので 1e-13 前後まで締められるはず)
- choices で決めた仕様は、項目ごとにどのテストで確かめるかを書く
- `checkOptions(options, <NAME>_KEYS, "<name>"); // generated: option-keys.mjs` の 1 行。生成のブロックは手で書かない

**1.10.0 の教訓 (こちらが点検で見つけたもの):**

- **テストの誤りが多かった:** 警告を value の中から読む (警告は value の横の `warnings`)、R と違う入力でテストする、
  fixture に無い case を作る、**例外で途中で止まって不一致が出ない** (「全部通った」に見える)。テストが最後まで走って
  全 case を比べたことを、比べた case の数で報告する
- **戻り値はいつも配列** (長さ 1 でも)。テストの比較の側で R の長さ 1 のスカラーを配列に直す
- **export を確かめる:** 新しい関数は入口 (`src/entries/timeseries.ts`・`multivariate.ts`) から export し、テストは入口
  から import する
- 結果の型の名前は `*Result`・`*Fit` (`scripts/option-keys.mjs` は `*Result` をデータとして扱う)
- 極端なテストのデータは double で正確に表せるものにする (整数・2 の冪)
- **配列を関数の引数に展開しない** (`Math.max(...列)`・`push(...列)`)

## 5. 端の入力 (合格の条件。段階 2 のテストに入れる)

- **尺度:** 値を 2^±300 倍 (acf の相関・ca・mjca の座標と慣性は不変、acf の共分散は二乗、sammon・isoMDS の座標は
  尺度どおり・stress は不変)、1e8 だけずらす (acf は不変)。相対 1e-10 で一致する。R が溢れる所は同変性で
- **大きさ:** acf は N = 10 万・`lagMax = 100`、ccf も同じ、ca は 1000 × 50 の表、mjca は 1 万行 × 10 変数 (各 5 水準)、
  sammon・isoMDS は n = 500 で動く。時間を報告に書く。acf を O(N·lagMax) より重くしない
- **異常な値:** NaN・Infinity を含む入力はエラーか、R と同じ扱い
- **縮退:** 定数の系列、N = 1・2、`lagMax = 0`、2 × 2 の表、独立な表 (慣性 0)、1 次元しかない ca、距離 0 の点
- R の値と比べられないもの (R が失敗する、R が不正確) は、同変性か独立の計算と比べる

## 6. 書くもの・触らないもの

入口 `briefs/ca-acf-mds-1.11-status.ja.md` の「書き込んでよい場所」がすべて。そこに無いファイルは書かない。
