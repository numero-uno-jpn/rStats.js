# 指示書: 回帰 (ROADMAP の 1 番、1.7.0 に入れる)

作成 2026-11-19。基準のコミットは依頼の文で指定します (この文書の版ではなく、依頼の指定に従う)。

あなた (ChatGPT) には、rStats.js (R の数値計算を TypeScript に移したライブラリ) に、順序ロジスティック回帰 (MASS の
`polr`)、非線形回帰 (stats の `nls` と自己開始モデル)、ロバスト回帰 (MASS の `rlm`) を足す作業を頼みます。進め方は
前回の混合モデルの作業 (Issue #535、PR #537、指示書 `briefs/mixed-1.6.ja.md`) と同じで、仕様書と fixture の生成
スクリプトから始め、実装、直しの順に進めます。**ただし今回は、あなたは R を実行しません** (3 節)。R の実行と、
テストの実行と、数値の点検はこちらが手元でまとめて行い、結果を返します。

## 0. 範囲と照合先 (ユーザーが決めたもの)

- 照合先: **R 4.6.2 の stats** (`nls`・`nls.control`・自己開始モデル `SS*`・`getInitial`・`profile` と `confint` の
  nls の方法) と **MASS 7.3-66** (`polr`・`rlm`・`psi.huber`・`psi.hampel`・`psi.bisquare` と、それらの
  `summary`・`predict`・`confint`・`profile`・`anova`・`vcov`・`logLik` の方法)。**どれも GPL** なので 1 節の規則を守る
- `polr`: `method` の `"logistic"`・`"probit"`・`"cloglog"`・`"loglog"`・`"cauchit"` の全部。`summary`
  (係数と切片の表、標準誤差、`t value`)、`predict` (`type = "class"` と `"probs"`、`newdata`)、`confint` (プロファイル
  尤度。Wald の `confint.default` も)、`anova` (当てはめどうしの尤度比検定)
- `nls`: `algorithm` の既定 (Gauss-Newton)・`"plinear"`・`"port"` (上下限つき)。自己開始モデルは R の stats にある
  10 個 (`SSasymp`・`SSasympOff`・`SSasympOrig`・`SSbiexp`・`SSfol`・`SSfpl`・`SSgompertz`・`SSlogis`・
  `SSmicmen`・`SSweibull`) を候補にし、どこまで入れるかは仕様書の Decisions で決める。`summary`・`predict`
  (`newdata`)・`confint` (プロファイル。R 4.4 から stats にある)・`anova` (入れ子の当てはめの F 検定) は Decisions で
  範囲を整理する
- `rlm`: psi 関数は Huber・Hampel・bisquare。`method` の `"M"` と `"MM"`。`scale.est` (`"MAD"`・`"Huber"`・
  `"proposal 2"`)、`init`、`k2`、`maxit`・`acc`、`weights`・`wt.method` は仕様書で整理する。`summary` (係数の表と
  残差の尺度)。**MM 推定の初期値 (S 推定) は R では乱数の抽出を使う** (`lqs`)。R の乱数の流れまで合わせるかどうかは
  Decisions に挙げる (rStats.js は R の乱数を再現している: `src/random/`)
- **入口: 新しい分野 `regression`** (`src/entries/regression.ts`)。`/mixed` と同じく、ルートの export (`src/index.ts`) と
  `dist/rstats.js` には入れない。package.json の `exports`・`scripts/bundle.mjs`・`scripts/size.mjs`・デモ・
  `test/demo.test.ts` と `test/docExamples.test.ts` の scope など、分野を足すための配線は**こちらが段階 2 の後に行う**。
  あなたは `src/entries/regression.ts` を作って export を書くだけでよい
- 名前: 当てはめは `polr`・`nls`・`rlm`。付属の関数の名前 (前例: `glmSummary`・`lmerSummary`・`glmerPredict`・
  `confintRma`・`predictCrr`・`confintLmer`) は Decisions に挙げ、推奨を書く
- 入力の形: 既存の `glm`・`lmer` と同じく、式の文字列とデータの行 (または列) を受け取る形を基本にする。`nls` の式
  (`y ~ a * exp(-b * x)` のような任意の式) をどう渡すか (式の文字列を解釈するか、JS の関数を受け取るか) は Decisions に
  挙げる
- 仕様書の段で、上のほかに決めるべきこと (結果の形、係数の名前の付け方、収束しないときの扱い、警告、R の既定値と
  違えるべき所) を「Decisions for the user」に挙げる

## 1. クリーンルームの規則 (最重要)

- MASS と R (stats の `nls` や自己開始モデルを含む) の**ソースを読まない・思い出して書かない・写さない**。R のコード
  (関数の本体を表示する、`deparse`・`body`・`getAnywhere` を使う、など) も、CRAN・GitHub のミラー、解説記事や
  ウェブ検索の結果に引用されたソースも対象。記憶にあるコードの構造や変数名をなぞった実装もしない
- **当てはめのオブジェクトの中にもコードがある:** `rlm` の結果の `$psi` (psi 関数そのもの)、`nls` の結果の `$m`
  (モデルの関数の集まり)、自己開始モデル (`SSlogis` など) を呼ばずに表示したもの、`unclass(fit)` の表示。**これらを
  表示しない・使わない**。値は `coef`・`vcov`・`summary`・`predict`・`residuals`・`fitted`・`logLik`・`deviance`・
  `confint`・`profile` の結果などの公開の関数と、ヘルプに書かれた戻り値の要素 (`fit$w`・`fit$s`・`fit$zeta`・
  `fit$convInfo` など) で取る
- **前回までに 2 回、ウェブ検索の結果一覧にソースの抜粋が表示されてしまいました。** 検索は論文・教科書・ヘルプの文書を
  探す語で行い、関数名だけで検索しないでください。抜粋が見えてしまったら、使わずに報告に書いてください
- **PORT のライブラリ** (R の `nls(algorithm = "port")` と `nlminb` の中身、netlib の Fortran) も写さない。上下限つきの
  最小二乗は論文 (Dennis, Gay & Welsch 1981 の NL2SOL など) と一般の文献から自分で組み立てる。R と反復の道筋が
  違っても、収束した値が一致すればよい
- 使ってよいもの: 論文と教科書 (Venables & Ripley "Modern Applied Statistics with S" 4th ed. の方法の説明、
  McCullagh 1980 "Regression models for ordinal data"、Agresti "Categorical Data Analysis"、Bates & Watts 1988
  "Nonlinear Regression Analysis and Its Applications"、Bates & Chambers の "Statistical Models in S" 10 章、Golub &
  Pereyra 1973 (plinear の変数射影)、Huber 1981 "Robust Statistics"、Hampel, Ronchetti, Rousseeuw & Stahel 1986、
  Yohai 1987 (MM 推定)、Rousseeuw & Yohai 1984 (S 推定) など)、R のヘルプ (文書。例の節も含む)、こちらが返す R の
  実行結果
- 既存の `glm`・`lm`・`optim` などは、R のソースを読んでよいとされていた時期に作られたものがある。今回の新しい
  コードは既存のコードの中身に頼らず、公開の型と関数を呼ぶ形で書く (既存の関数を呼ぶのはよい)
- 報告の最後に、クリーンルームの確認 (ソースを使っていないこと、参照した文献、頼んだ実験のスクリプトの一覧) を書く

## 2. 読むファイル

- 規則: `CONTRIBUTING.md`、`README.md` の「Versioning」と「Size」、`llms.txt`
- 前回の成果 (書き方の手本): `oracle/mixedconfint-behaviour.md` (特に末尾の「rStats.js's choices」の形)、
  `oracle/mixedconfint.R`、`src/models/mixedConfint.ts`、対応するテスト。その前の `oracle/meta-behaviour.md`
- 既存の回帰: `src/models/glm.ts`・`glmConfint.ts`・`glmFamily.ts`・`lm.ts`・`formula.ts`・`modelFrame.ts`・
  `modelMatrix.ts` の公開の型と関数 (式とデータの受け取り方、因子と対比、係数の名前)。`oracle/glm*.R`
- 最適化と数値計算: `src/entries/numerics.ts` から export されているもの (`optim` など。呼んで使ってよい)
- 乱数: `src/random/` (`setSeed`、`sample` など。MM 推定で R の乱数の流れに合わせるとき)
- 書き方の決まり: `briefs/survival-1.4.ja.md` の 8 節 (今回も守る)
- オプションの検査: `src/internal/checkOptions.ts`、警告: `src/internal/warnings.ts`
- 精度: `docs/accuracy.md`。R と違う扱いの記録: `docs/differences-from-r.md` (書き方の手本)

## 3. R の実行 (今回は、こちらが手元でまとめて流す)

前回、GitHub Actions の R の実験は 1 本ごとの待ちが長く、R 自身の不具合を追う方へ逸れました。今回は次の形にします。

- **最初の出力はこちらが用意します。** 作業ブランチ `work/regression` の `experiments/regression-*.R` (こちらが書いた、
  公開の関数だけを呼ぶスクリプト) と、その出力 `experiments/regression-*.json` (17 桁) を読んでください。代表的な
  データ (MASS の `housing`・`phones`、`stackloss`、`Puromycin`・`DNase`・`Loblolly`・`BOD` などの R の例) での
  当てはめ・要約・予測・区間・検定の値と、エラーと警告の文言が入っています
- JSON の形: 各 case は `{ value, warnings, messages }` か、R がエラーのとき `{ error, warnings, messages }`
  (`run()` が R の条件を集めたもの。`warnings` と `messages` は 1 つなら文字列、複数なら配列)。行列は
  `{ rows, cols, values }` (`values` は行の配列)。名前付きのベクトルは名前をキーにしたオブジェクト。入れ子の
  `confint` なども `run()` の形 (profile の「Waiting for profiling to be done...」は `messages` に入る)。どの case が
  何を呼んだかは、同じ名前の `.R` を読んで確かめる
- 分かっていること: `polr(method = "cauchit")` は housing で R の既定の初期値が失敗する (`housing_cauchit`。初期値を
  与えた `housing_cauchit_start` は通る)。`rlm(method = "MM")` は乱数の種で係数が変わる (`stackloss_MM_seed*`)
- **足りない実験は、まとめて 1 回で頼んでください。** `experiments/<名前>.R` を書いて作業ブランチに push し、Issue に
  「実験の依頼」と 1 行書いて止まる。こちらが検査 (`scripts/r-experiment-check.mjs`) を通して手元の R で流し、出力を
  `experiments/<名前>.out.txt` として push します。1 本ずつ頼まず、必要なものを全部書いてから 1 回で頼む
- 環境: R 4.6.2 (x86_64、fixture と同じ CRAN の日付)、`Rscript --vanilla`、ネットワークなし。使えるパッケージ:
  MASS・stats・utils・base・jsonlite (と前回までのもの)。1 本 120 秒まで
- 出力は 17 桁 (`sprintf("%.17g", x)` か `jsonlite::toJSON(x, digits = NA)`)
- 検査で止まるもの: 関数を呼ばずに名前だけ書く (`print(rlm)`、`f <- nls`)、`deparse`・`body`・`:::`・`get`・`eval`・
  `parse`・`unclass` など、文字列で関数名を渡す、許可外のパッケージ、`fit$psi`・`fit$m` (`[["psi"]]`・`[["m"]]` も)。
  `rlm(..., psi = psi.bisquare)` の形で psi 関数を渡すのは通る。変数名の `args`・`file`・`get`・`methods` や、MASS の
  公開関数の名前 (`select`・`area`・`huber` など) を変数名にしても止まるので避ける
- 当てはめや仮説の検証は、あなたの側で Python などを使って行う

## 4. 前回までの作業で直しが入った点 (最初から守る)

1. **fixture はこちらが作る。** oracle スクリプトを push したら、こちらが `npm run oracle -- <name>` で
   `test/fixtures/<name>.json` を作り、ブランチに push する
2. **oracle スクリプトの記録する引数と、実際の呼び出しを必ず一致させる**。1 つの引数の一覧から、記録と呼び出しの両方を
   作る書き方にする
3. **oracle で指定しない引数を `NULL` で明示的に渡さない** (前回、1 つの引数のつもりが別の引数にも `NULL` が渡り、R が
   エラーになった)。指定する引数だけを渡す
4. **テストは R の値と比べる。** rStats.js を rStats.js 自身と比べるだけのテストにしない。R と違う値にする所 (choices
   で決めたもの) だけ、式を別に計算して比べ、既知の違いとしてラベルを付ける
5. **表は全行・全列を比べる** (先頭と末尾の行だけの比較で、途中の違いを見落としたことがある)
6. **既知の違いの条件を 1 つの入力に限らない。** 条件は性質 (境界である、など) で書く
7. **R がおかしく見えたら、正確な値を独立に計算して、どちらが正しいかを確かめてから書く**
8. **許容誤差を広げて通さない** (2% や 0.0012 に広げた所があった)。違いが反復の止め方 (`nls` の収束判定、`rlm` の
   反復、profile の根の探索など) によるなら、真の解を高精度で求めて rStats.js と 1e-10 程度で比べ、R とは R の
   止め方の範囲で比べる。広い許容誤差が要る所は、理由をコメントに書いて報告で挙げる
9. **前提を確かめる。** 前回、REML の推定値を profile の中心と思い込んだテストがあった。何が何の中心か、何を最適化
   した値かは、R の出力で確かめてから書く
10. **モデルのオブジェクトを JSON に書かない。** fixture には入力 (データ・式・引数) と結果の数値だけを書く
11. **`@category`:** 既存の合わないカテゴリにしない。新しい分野なので、新しいカテゴリ (例: `Regression`) をカテゴリの
    一覧に足す
12. **JSON・既存のファイルを丸ごと整形し直さない** (`demo/examples.json` の詰めた書式が 2 回崩れた)。文字列の `\n` を
    本物の改行にしない
13. **テストの型:** テストも tsconfig の strict で型チェックが通るように書く。`describe` の中で `await` しない
    (前回どちらも失敗した)
14. **数式は `$...$` と `$$...$$` で書く**
15. 新しい関数の先頭に `checkOptions(options, <NAME>_KEYS, "<name>"); // generated: option-keys.mjs` の 1 行を入れる。
    生成されるブロックと `docs/r-functions.md` (と ja) は、こちらが最後にスクリプトで作る
16. **テストを実行できないことを理由に止まらない。** push すれば、CI とこちらの手元の結果で確かめる
17. **こちらが直している間は push しない。** こちらが「直します」と書いたら、こちらの「再開してよい」を待つ

## 5. 長い作業の進め方 (表示が崩れるのを防ぐ)

- **1 回の返答で 1 項目。** 長い作業を続けず、区切りごとに push と Issue への短い途中経過のコメント (数行: 何をしたか、
  次に何をするか、push したコミット) をして止まる
- 「完了報告」は段階を終えてから書く
- 会話が長くなったら、現状の要約を `briefs/regression-1.7-status.ja.md` (作業ブランチ) に書き、新しい会話はそれを
  読んで始める

## 6. 進め方 (3 段階。各段階の終わりで止まって報告する)

関数が 3 つあるので、段階 1 と 2 は `polr` → `rlm` → `nls` の順に 1 つずつ進めてよい (1 つの仕様書が済んだら報告して
止まり、こちらが Decisions をユーザーに聞く間に次の仕様書に進む、など)。順番の提案があれば報告に書く。

### 段階 1: 仕様書と fixture の生成スクリプト

- `oracle/polr-behaviour.md`・`oracle/rlm-behaviour.md`・`oracle/nls-behaviour.md` (英語): 式 (尤度・推定方程式・
  反復の手順を文献に基づいて)、既定値、収束の判定、標準誤差の求め方 (polr のヘッセ行列、rlm の漸近分散、nls の
  $\hat\sigma^2 (J^\top J)^{-1}$ など)、`summary`・`predict`・`confint`・`anova` の値、エラーと警告、境界 (完全分離、
  空の水準、外れ値だらけ、`nls` の特異な勾配と収束しない場合、上下限に張り付いた `port`)。章立ては
  `oracle/mixedconfint-behaviour.md` に合わせ、末尾に「Decisions for the user」(選択肢と推奨) と空の
  「rStats.js's choices」
- `oracle/polr.R`・`oracle/rlm.R`・`oracle/nls.R`: R の例のデータと境界の case を入れる
- **段階 1 の報告:** 仕様書の要点、未解明の所 (要る実験は 3 節の形でまとめて頼む)、Decisions for the user。ここで止まり、
  こちらの「進めてよい」を待つ

### 段階 2: 実装

- 新しいファイル (例: `src/models/polr.ts`・`src/models/rlm.ts`・`src/models/nls.ts`) に実装し、
  `src/entries/regression.ts` から export する。テスト `test/polr.test.ts`・`test/rlm.test.ts`・`test/nls.test.ts`
- `briefs/survival-1.4.ja.md` の 8 節と、この指示書の 4 節を守る
- 作業ブランチから main への PR を作り、Issue に段階 2 の報告を書いて止まる。PR には実験のスクリプト
  (`experiments/*`) を入れない (別のブランチから PR を作ってよい)。こちらが手元で型チェックと全テストを流して、失敗の
  一覧を返します

### 段階 3: 直し

数値の点検 (極端な尺度 1e±100、水準が 2 つ・数千、外れ値の割合が 50% 近く、完全分離に近い順序データ、`nls` の
悪条件の問題) はこちらが手元で行い、見つかった直しを 1 回に 1 項目ずつ頼みます。

## 7. 書くもの・触らないもの

- 書く: `oracle/polr*`・`rlm*`・`nls*` の仕様書と `.R`、`src/` の新しいファイル、`src/entries/regression.ts`、`test/` の
  新しいテスト、`test/demo.test.ts` の `NOT_IN_DEMO_YET`
- 実験のスクリプト `experiments/*` は作業ブランチにだけ置く (main には取り込みません)
- 触らない: 既存の関数 (呼ぶのはよい。直す必要があれば報告で提案する)、`test/fixtures/` (こちらが作る)、
  `test/helpers/`、`docs/`、`CHANGELOG.md`、`ROADMAP*.md`、`.github/`、`scripts/`、`package.json`、`demo/`。
  文書の案は報告に書いてもらえれば、こちらで直します

## 8. Issue とブランチ

- Issue は 1 つ。タイトルは `ROADMAP 1: 回帰 (polr・rlm・nls)`
- ブランチ `work/regression` は、こちらが最初の R の出力を入れて作ります。依頼で指定するコミットを `git log -1` で
  確かめてから始める
- 報告 (各段階の最初のコメント): 何をしたか、仕様書で決まっていなかったことと決め方、R と違う所と根拠、自信のない所、
  確かめられなかった所、クリーンルームの確認
- 判断に迷ったら、推測で進めず Issue に質問を書いて止まる
