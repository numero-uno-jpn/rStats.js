# 指示書: 混合モデルの続き (ROADMAP の 1 番、1.6.0 に入れる)

作成 2026-11-17。基準のコミットは依頼の文で指定します (この文書の版ではなく、依頼の指定に従う)。

あなた (ChatGPT) には、rStats.js (R の数値計算を TypeScript に移したライブラリ) の混合モデル (`lmer`・`glmer`) に、
lme4 の `confint` と `simulate` に当たる関数を足す作業を頼みます。進め方は前回のメタアナリシスの作業 (Issue #529、
PR #530、指示書 `briefs/meta-analysis.ja.md`) と同じです。仕様書と fixture の生成スクリプトから始め、実装、数値の点検の
順に進めます。テストは実行できませんが、R は 3 節の仕組みで自分で実行できます。テストはこちらで流して結果を返します。

## 0. 範囲と照合先 (ユーザーが決めたもの)

- 照合先: **lme4 2.0-6** (Matrix 1.7-6)。どちらも GPL なので、1 節の規則を守る
- `confint`: `method = "profile"` (lme4 の既定) と `method = "Wald"`。`"boot"` は入れない。`parm`・`level` と、
  profile の区間に関わる引数は仕様書で整理する
- 対象: `lmer` と `glmer`。glmer の profile の区間は `nAGQ = 1` (と `nAGQ = 0` が R で可能ならそれ) の当てはめだけ。
  `nAGQ > 1` の当てはめで呼ばれたときの扱い (R の挙動、エラーにするか) は仕様書で決める。Wald は当てはめを問わない
- `simulate`: **R の乱数の流れまで lme4 と一致させる** (`setSeed` の後の結果が R の `set.seed` の後の結果と同じ)。
  引数は `nsim`・`seed`・`use.u`・`re.form` まで。`newdata`・`newparams`・`allow.new.levels` は入れない
- 名前: `confintLmer`・`confintGlmer`・`simulateLmer`・`simulateGlmer` (前例 `predictCrr`・`confintRma`)。
  `profile()` のプロファイルの表は公開しない (内部でだけ使う)
- 混合モデルの分野は `/mixed` (`src/entries/mixed.ts`) から export する。ルートの export と `dist/rstats.js` には
  入れない
- 仕様書の段で、上のほかに決めるべきこと (結果の形、行の名前 `.sig01` などの付け方、`oldNames`、`signames`、
  profile の分割の細かさと補間、収束しないときの扱い、glmer の family ごとの simulate など) を
  「Decisions for the user」に挙げる

## 1. クリーンルームの規則 (最重要)

- lme4・Matrix・lmerTest と R の**ソースを読まない・思い出して書かない・写さない**。R のコード (関数の本体を表示する、
  `deparse`・`body`・`getAnywhere` を使う、など) も、CRAN・GitHub のミラー、解説記事やウェブ検索の結果に引用された
  ソースも対象。記憶にあるコードの構造や変数名をなぞった実装もしない
- lme4 のオブジェクトの中にもコードがある: 当てはめの `@resp`・`@pp` (参照クラスのメソッド)、`devFunOnly = TRUE` や
  `mkLmerDevfun` などが返す関数。**これらを表示しない・使わない**。値は `getME`・`VarCorr`・`fixef`・`ranef`・
  `vcov`・`logLik`・`summary` などの公開の関数で取る
- **前回までに 2 回、ウェブ検索の結果一覧にソースの抜粋が表示されてしまいました。** 検索は論文・教科書・ヘルプの文書を
  探す語で行い、関数名だけで検索しないでください。抜粋が見えてしまったら、使わずに報告に書いてください
- R の実行で使ってよいのは、**公開の関数を呼ぶことと、ヘルプに書かれた戻り値**だけ。内部の関数 (`pkg:::...`) は使わない
- 使ってよいもの: 論文と教科書 (Bates, Mächler, Bolker & Walker 2015 "Fitting Linear Mixed-Effects Models Using
  lme4" (J. Stat. Softw. 67(1))、lme4 の vignette の文書、Pinheiro & Bates 2000、プロファイル尤度の区間の一般の
  文献 (Venzon & Moolgavkar 1988 など))、R のヘルプ (文書。例の節も含む)、こちらが返す R の実行結果
- R の乱数の生成法 (Mersenne-Twister、inversion、`rbinom` などのアルゴリズム) は rStats.js に既にある
  (`src/random/`)。それを使い、lme4 がどの順で何個の乱数を引くかは、**R の出力を比べる実験で**突き止める
- こちらの作業者 (Mac のセッション) は今回の作業で lme4 のソースを見ません。既存の `lmer`・`glmer` は、R のソースを
  読んでよいとされていた時期に作られたものなので、今回の新しいコードは既存のコードの中身に頼らず、公開の型と関数を
  呼ぶ形で書く (既存の当てはめ・逸脱度の関数を呼ぶのはよい)
- 報告の最後に、クリーンルームの確認 (ソースを使っていないこと、参照した文献、実行した実験のスクリプトの一覧) を書く

## 2. 読むファイル

- 規則: `CONTRIBUTING.md`、`README.md` の「Versioning」と「Size」、`llms.txt`
- 前回の成果 (書き方の手本): `oracle/meta-behaviour.md` (特に末尾の「rStats.js's choices」の形)、`oracle/meta.R`、
  `src/models/metaAnalysis.ts` の `confintRma`、対応するテスト
- 既存の混合モデル: `oracle/lmer-behaviour.md`・`glmer-behaviour.md`・`lmertest-behaviour.md`、`src/entries/mixed.ts`、
  `src/models/lmer.ts`・`glmer.ts`・`mixedPredict.ts` の公開の型、`src/models/mixedDeviance.ts`・`glmerDeviance.ts`
  (プロファイル化した逸脱度。呼んで使う)、fixture の oracle `oracle/lmer*.R`・`glmer*.R`・`mixedpredict.R`
- 乱数: `src/random/` (`setSeed`、`rnorm`、`rbinom`、`rpois` など)
- 書き方の決まり: `briefs/survival-1.4.ja.md` の 8 節 (今回も守る)
- オプションの検査: `src/internal/checkOptions.ts`、警告: `src/internal/warnings.ts`
- 精度: `docs/accuracy.md`。R と違う扱いの記録: `docs/differences-from-r.md` (書き方の手本)

## 3. R の実験の仕組み (GitHub Actions の `R experiments`)

前回と同じです。

- 作業ブランチ (`work/mixed`) に `experiments/<名前>.R` を push すると、push で追加・変更されたスクリプトが実行され、
  出力が Issue にコメントされる
- スクリプトの先頭 5 行以内に `# issue: <この作業の Issue の番号>` と書く。名前は英数字と `.`・`_`・`-` だけ
- 環境: R 4.6.2 (x86_64、fixture と同じ CRAN の日付)、`Rscript --vanilla`、ネットワークなし、メモリ 2 GB、
  1 本 120 秒まで。使えるパッケージ: lme4・Matrix (と前回までのもの、jsonlite・stats・utils・base)
- 出力は 17 桁 (`sprintf("%.17g", x)` か `jsonlite::toJSON(x, digits = NA)`)
- 実行の前にクリーンルームの検査 (`scripts/r-experiment-check.mjs`) が通る。関数を呼ばずに名前だけ書く、`deparse`・
  `body`・`:::`・`get`・`eval`・`parse` など、文字列で関数名を渡す、許可外のパッケージ、`@resp`・`@pp`、
  `devFunOnly`、`mkLmerDevfun` などを含むと実行されない。変数名の `args`・`file`・`get`・`methods` なども止まるので
  避ける。lme4・Matrix の公開関数の名前 (`bdiag`、`expand` など) を変数名にしても止まる
- 当てはめや仮説の検証は、あなたの側で Python などを使って行う

## 4. 前回までの作業で直しが入った点 (最初から守る)

1. **fixture はこちらが作る。** oracle スクリプトを push したら、こちらが `npm run oracle -- <name>` で
   `test/fixtures/<name>.json` を作り、ブランチに push する。GitHub Actions に fixture を作るジョブはない
2. **oracle スクリプトの記録する引数と、実際の呼び出しを必ず一致させる**。1 つの引数の一覧から、記録と呼び出しの両方を
   作る書き方にする
3. **テストは R の値と比べる。** rStats.js を rStats.js 自身と比べるだけのテストにしない。R と違う値にする所 (choices
   で決めたもの) だけ、式を別に計算して比べ、既知の違いとしてラベルを付ける
4. **表は全行・全列を比べる** (先頭と末尾の行だけの比較で、途中の違いを見落としたことがある)
5. **既知の違いの条件を 1 つの入力に限らない。** 条件は性質 (境界である、など) で書く
6. **R がおかしく見えたら、正確な値を独立に計算して、どちらが正しいかを確かめてから書く**
7. **許容誤差を広げて通さない** (前回、2% や 0.0012 に広げた所があった)。違いが反復の止め方 (profile の根の探索など)
   によるなら、真の根を高精度で求めて rStats.js と 1e-10 程度で比べ、R とは R の止め方の範囲で比べる。広い許容誤差が
   要る所は、理由をコメントに書いて報告で挙げる
8. **モデルのオブジェクトを JSON に書かない** (C のスタックがあふれる)。fixture には入力 (データ・式・引数) と結果の
   数値だけを書く。R がメモリを使い果たす・120 秒を超える入力は oracle から外す
9. **`@category`:** 既存の合わないカテゴリにしない。新しく要るならカテゴリの一覧に足す
10. **JSON・既存のファイルを丸ごと整形し直さない** (`demo/examples.json` の詰めた書式が崩れたことがある)。文字列の
    `\n` を本物の改行にしない
11. **数式は `$...$` と `$$...$$` で書く**
12. 新しい関数の先頭に `checkOptions(options, <NAME>_KEYS, "<name>"); // generated: option-keys.mjs` の 1 行を入れる。
    生成されるブロックと `docs/r-functions.md` (と ja) は、こちらが最後にスクリプトで作る
13. **テストを実行できないことを理由に止まらない。** push すれば、CI とこちらの手元の結果で確かめる
14. **こちらが直している間は push しない。** こちらが「直します」と書いたら、こちらの「再開してよい」を待つ

## 5. 長い作業の進め方 (表示が崩れるのを防ぐ)

- 1 回の返答で長い作業を続けない。**区切りごとに push と Issue への短い途中経過のコメント**をし、段階の終わりで
  完了報告を書いて止まる
- 途中経過のコメントは数行でよい (何をしたか、次に何をするか、push したコミット)
- 「完了報告」は段階を終えてから書く

## 6. 進め方 (3 段階。各段階の終わりで止まって報告する)

### 段階 1: 仕様書と fixture の生成スクリプト

- `oracle/mixedconfint-behaviour.md` と `oracle/mixedsimulate-behaviour.md` (英語。1 つにまとめてもよい): 式
  (Wald の区間、プロファイル尤度の区間: 何をプロファイルするか (`.sig01` などの尺度)、符号付き平方根 $\zeta$、
  区間の端の求め方、lmer と glmer の違い)、simulate の生成の順序 (固定効果・ランダム効果・残差の乱数を引く順と数、
  `use.u`・`re.form` の効き方、`nsim` の並び、`seed` の扱い、family ごとの分布と重み)、既定値、エラーと警告、境界
  (分散が 0 に張り付いた当てはめ、相関が ±1、profile が端まで届かない、収束の警告) を書く。章立ては
  `oracle/meta-behaviour.md` に合わせ、末尾に「Decisions for the user」(選択肢と推奨) と空の「rStats.js's choices」
- `oracle/mixedconfint.R`・`oracle/mixedsimulate.R`: lme4 の例のデータ (`sleepstudy`、`cbpp`、`Penicillin`、
  `Pastes`、`grouseticks` など) と境界の case を入れる
- **段階 1 の報告:** 仕様書の要点、未解明の所、Decisions for the user。ここで止まり、こちらの「進めてよい」を待つ

### 段階 2: 実装

- 新しいファイル (例: `src/models/mixedConfint.ts`・`src/models/mixedSimulate.ts`) に実装し、`src/entries/mixed.ts`
  から export する。テスト `test/mixedConfint.test.ts`・`test/mixedSimulate.test.ts`
- `briefs/survival-1.4.ja.md` の 8 節と、この指示書の 4 節を守る
- 作業ブランチから main への PR を作り、CI の結果を確かめてから Issue に段階 2 の報告を書いて止まる。PR には実験の
  スクリプト (`experiments/*.R`) を入れない (別のブランチから PR を作ってよい)

### 段階 3: 数値の点検

極端な入力 (応答の尺度 1e±100、群が 2 つ・数千、分散が境界、完全分離に近い二項、計数が 0 だけ、`nsim` が大きい)
で、rStats.js と R がどうなるかを確かめ、違いを報告する

## 7. 書くもの・触らないもの

- 書く: `oracle/mixed*-behaviour.md`、`oracle/mixed*.R`、`src/` の新しいファイル、`src/entries/mixed.ts` の export、
  `test/` の新しいテスト、`test/demo.test.ts` の `NOT_IN_DEMO_YET`
- 実験のスクリプト `experiments/*.R` は作業ブランチにだけ置く (main には取り込みません)
- 触らない: 既存の関数 (呼ぶのはよい。直す必要があれば報告で提案する)、`test/fixtures/` (こちらが作る)、
  `test/helpers/`、`docs/`、`CHANGELOG.md`、`.github/`、`scripts/`。文書の案は報告に書いてもらえれば、こちらで直します

## 8. Issue とブランチ

- Issue は 1 つ。タイトルは `ROADMAP 1: 混合モデルの confint と simulate`
- ブランチ `work/mixed` を依頼で指定する基準のコミットから作り、そこに push する
- 報告 (各段階の最初のコメント): 何をしたか、仕様書で決まっていなかったことと決め方、R と違う所と根拠、自信のない所、
  確かめられなかった所、クリーンルームの確認
- 判断に迷ったら、推測で進めず Issue に質問を書いて止まる
