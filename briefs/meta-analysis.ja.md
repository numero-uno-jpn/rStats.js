# 指示書: メタアナリシス (ROADMAP の 1 番、1.5.0 に入れる)

作成 2026-11-17。基準のコミットは依頼の文で指定します (この文書の版ではなく、依頼の指定に従う)。

あなた (ChatGPT) には、rStats.js (R の数値計算を TypeScript に移したライブラリ) に、メタアナリシスの関数を足す作業を
頼みます。進め方は前回のサンプルサイズの作業 (Issue #527、PR #528、指示書 `briefs/samplesize.ja.md`) と同じです。
仕様書と fixture の生成スクリプトから始め、実装、数値の点検の順に進めます。テストは実行できませんが、R は 3 節の仕組みで
自分で実行できます。テストはこちらで流して結果を返します。

## 0. 範囲と照合先

- 照合先: **metafor 5.2.1** (例のデータは metadat 1.6.0)。どちらも GPL なので、1 節の規則を守る
- ROADMAP の項目: 固定効果とランダム効果 (DerSimonian-Laird、REML)、Q と I²、Egger の検定
- 中心になる関数: `escalc` (効果量とその分散)、`rma` (= `rma.uni`。`method` の `"EE"`・`"FE"`・`"DL"`・`"REML"`)、
  その結果の Q 検定・τ²・I²・H²、`confint` (τ² などの区間)、`predict` (予測区間)、`regtest` (Egger の検定)
- 仕様書の段で、上のほかに入れるべきもの・外すべきものを「Decisions for the user」に挙げる。例: `method` のほかの
  推定法 (ML・HE・PM・SJ など)、`test = "knha"` (Knapp-Hartung)、モデレーター (メタ回帰)、`ranktest` (Begg)、
  `trimfill`、`escalc` のどの `measure` を入れるか、`rma.mh`・`rma.peto`、`forest`・`funnel` (描画は rStats.js の
  範囲外の見込み)
- 既にある近い関数・形: 回帰の結果の形は `lm`・`glm` (`src/models/lm.ts`・`glm.ts`)、検定の結果は R の `htest` の形
  (`src/htest/`)。名前は R の名前の camelCase (llms.txt)。`rma.uni` のように点を含む名前の扱いは仕様書で提案する
- 新しい分野なので、どの入口から export するか (`src/entries/tests.ts` か新しい入口か) も Decisions に入れる。
  CDN の全部入りの大きさの目安は README の「Size」

## 1. クリーンルームの規則 (最重要)

- metafor・metadat と R の**ソースを読まない・思い出して書かない・写さない**。R のコード (関数の本体を表示する、
  `deparse`・`body`・`getAnywhere` を使う、など) も、CRAN・GitHub のミラー、解説記事やウェブ検索の結果に引用された
  ソースも対象。記憶にあるコードの構造や変数名をなぞった実装もしない
- **前回、ウェブ検索の結果一覧にソースの抜粋が表示されてしまいました。** 検索は論文・教科書・ヘルプの文書を探す
  語で行い、関数名だけで検索しないでください。抜粋が見えてしまったら、使わずに報告に書いてください
- R の実行で使ってよいのは、**公開の関数を呼ぶことと、ヘルプに書かれた戻り値**だけ。内部の関数 (`pkg:::...`) は使わない
- 使ってよいもの: 論文と教科書 (DerSimonian & Laird 1986、Viechtbauer 2005 (τ² の推定)・2010 (metafor の論文)、
  Higgins & Thompson 2002 (I²)、Egger et al. 1997、Hartung & Knapp 2001、Borenstein et al. "Introduction to
  Meta-Analysis" など)、R のヘルプ (文書。例の節も含む)、こちらが返す R の実行結果
- こちらの作業者 (Mac のセッション) は metafor のソースを見ていません
- 報告の最後に、クリーンルームの確認 (ソースを使っていないこと、参照した文献、実行した実験のスクリプトの一覧) を書く

## 2. 読むファイル

- 規則: `CONTRIBUTING.md`、`README.md` の「Versioning」と「Size」、`llms.txt`
- 前回の成果 (書き方の手本): `oracle/samplesize-behaviour.md` (特に末尾の「rStats.js's choices」の形)、
  `oracle/samplesize.R`、`src/htest/sampleSize.ts`、`test/sampleSize.test.ts`
- 回帰の結果の形: `src/models/lm.ts`・`src/models/glm.ts` の公開の型
- 書き方の決まり: `briefs/survival-1.4.ja.md` の 8 節 (今回も守る)
- 公開の入口: `src/entries/tests.ts`。オプションの検査: `src/internal/checkOptions.ts`、警告: `src/internal/warnings.ts`
- 精度: `docs/accuracy.md`。R と違う扱いの記録: `docs/differences-from-r.md` の末尾の節「Sample size and power for
  trial designs」(書き方の手本)

## 3. R の実験の仕組み (GitHub Actions の `R experiments`)

前回と同じです。

- 作業ブランチ (`work/meta`) に `experiments/<名前>.R` を push すると、push で追加・変更されたスクリプトが実行され、
  出力が Issue にコメントされる
- スクリプトの先頭 5 行以内に `# issue: <この作業の Issue の番号>` と書く。名前は英数字と `.`・`_`・`-` だけ
- 環境: R 4.6.2 (x86_64、fixture と同じ CRAN の日付)、`Rscript --vanilla`、ネットワークなし、メモリ 2 GB、
  1 本 120 秒まで。使えるパッケージ: metafor・metadat・survival・jsonlite (と stats・utils・base。前回の epiR・
  exact2x2・clinfun・powerSurvEpi・cmprsk も使える)
- 出力は 17 桁 (`sprintf("%.17g", x)` か `jsonlite::toJSON(x, digits = NA)`)
- 実行の前にクリーンルームの検査 (`scripts/r-experiment-check.mjs`) が通る。関数を呼ばずに名前だけ書く、`deparse`・
  `body`・`:::`・`get`・`eval`・`parse` など、文字列で関数名を渡す、許可外のパッケージ、を含むと実行されない。
  変数名の `args`・`file`・`get`・`methods` なども止まるので避ける
- 当てはめや仮説の検証は、あなたの側で Python などを使って行う

## 4. 前回の作業で直しが入った点 (最初から守る)

1. **fixture はこちらが作る。** oracle スクリプトを push したら、こちらが `npm run oracle -- <name>` で
   `test/fixtures/<name>.json` を作り、ブランチに push する。GitHub Actions に fixture を作るジョブはない
2. **oracle スクリプトの記録する引数と、実際の呼び出しを必ず一致させる** (前回、`strict = TRUE` を記録して呼び出しで
   渡していない case があった)。1 つの引数の一覧から、記録と呼び出しの両方を作る書き方にする
3. **テストは R の値と比べる。** rStats.js を rStats.js 自身 (別のオプションの値など) と比べるだけのテストにしない。
   R と違う値にする所 (choices で決めたもの) だけ、式を別に計算して比べ、既知の違いとしてラベルを付ける
4. **表は全行を比べる** (前回、先頭と末尾の行だけを比べていて、途中の行の違いを見落とした)
5. **既知の違いの条件を 1 つの入力に限らない。** 条件は性質 (境界である、など) で書く
6. **R がおかしく見えたら、正確な値を独立に計算して、どちらが正しいかを確かめてから書く** (前回、exact2x2 の
   `errbound = 0` の値を正しいと見なして、rStats.js の正しい値を「異常」としていた)
7. **数式は `$...$` と `$$...$$` で書く**
8. 新しい関数の先頭に `checkOptions(options, <NAME>_KEYS, "<name>"); // generated: option-keys.mjs` の 1 行を入れる。
   生成されるブロックと `docs/r-functions.md` (と ja) は、こちらが最後にスクリプトで作る
9. 段階の途中で時間が切れそうなら、Issue に途中経過を書いてよい。ただし「完了報告」は段階を終えてから書く

## 5. 進め方 (3 段階。各段階の終わりで止まって報告する)

### 段階 1: 仕様書と fixture の生成スクリプト

- `oracle/meta-behaviour.md` (英語): 式 (推定量、τ² の反復と収束、Q・I²・H²、検定と区間、Egger の検定の回帰)、
  既定値、エラーと警告、境界 (研究が 1〜2 件、τ² が 0 に張り付く、分散が 0 の研究、反復が収束しない場合、
  巨大・微小な効果量など) を書く。章立ては `oracle/samplesize-behaviour.md` に合わせ、末尾に
  「Decisions for the user」(選択肢と推奨) と空の「rStats.js's choices」を置く。API の形 (引数・結果の欄の名前、
  データの渡し方 (`yi`・`vi` の配列か、`escalc` の結果か)) も Decisions に入れる
- `oracle/meta.R` (必要なら分けてよい): metadat の例のデータ (`dat.bcg` など) と、境界の case を入れる
- **段階 1 の報告:** 仕様書の要点、未解明の所、Decisions for the user。ここで止まり、こちらの「進めてよい」を待つ
  (ユーザーが Decisions に答えて、こちらが「rStats.js's choices」を書きます)

### 段階 2: 実装

- 新しいファイル (例: `src/models/metaAnalysis.ts`、`escalc` は別ファイルでもよい) に実装し、choices で決めた入口から
  export する。テスト `test/metaAnalysis.test.ts`
- `briefs/survival-1.4.ja.md` の 8 節と、この指示書の 4 節を守る
- 作業ブランチから main への PR を作り、CI の結果を確かめてから Issue に段階 2 の報告を書いて止まる。PR には実験の
  スクリプト (`experiments/*.R`) を入れない (前回のように別のブランチから PR を作ってよい)

### 段階 3: 数値の点検

極端な入力 (効果量 1e±150、分散 1e-300 や 1e+300、研究 1 件・2 件・数千件、全部同じ効果量、τ² の推定が境界)
で、rStats.js と R がどうなるかを確かめ、違いを報告する

## 6. 書くもの・触らないもの

- 書く: `oracle/meta-behaviour.md`、`oracle/meta*.R`、`src/` の新しいファイル、入口の export、`test/` の新しいテスト、
  `test/demo.test.ts` の `NOT_IN_DEMO_YET`
- 実験のスクリプト `experiments/*.R` は作業ブランチにだけ置く (main には取り込みません)
- 触らない: 既存の関数、`test/fixtures/` (こちらが作る)、`test/helpers/`、`docs/`、`CHANGELOG.md`、`.github/`、
  `scripts/`。文書 (`docs/differences-from-r.md`、CHANGELOG) の案は報告に書いてもらえれば、こちらで直します

## 7. Issue とブランチ

- Issue は 1 つ。タイトルは `ROADMAP 1: メタアナリシス`
- ブランチ `work/meta` を依頼で指定する基準のコミットから作り、そこに push する
- 報告 (各段階の最初のコメント): 何をしたか、仕様書で決まっていなかったことと決め方、R と違う所と根拠、自信のない所、
  確かめられなかった所、クリーンルームの確認
- 判断に迷ったら、推測で進めず Issue に質問を書いて止まる
