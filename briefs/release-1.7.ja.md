# 指示書: 1.7.0 の公開の準備 (英語の説明・配線・文書・デモ)

作成 2026-11-20 (調整役)。入口は `briefs/regression-1.7-status.ja.md` (規則と進め方)。手本は 1.6.0 のとき
(`briefs/release-1.6.ja.md`)。

1.7.0 の回帰 (polr・rlm・nls) は、実装・数値の点検・端の入力の直しまで `work/regression` で済んでいる
(PR #541 は draft、CI は緑)。今回は、それを文書・デモ・API リファレンスに載せる準備。日本語の API リファレンスの訳は、
この作業の後に調整役が抜き出しをやり直してから、別の依頼にする (今回は訳さない)。

## 0. 進め方

- 前回と同じく GitHub に直接 `work/regression` へ push し、PR #541 の CI でテストする。push のたびに、そのファイルを
  GitHub 上で開き直し、文字どおりの `\n` が入っていないか確かめる
- R0〜R3 を順に。それぞれの区切りで Issue #540 に数行の途中経過を書く。全部済んで CI が緑になったら、Issue #540 に
  1 回報告して止まる
- 判断に迷ったら、推測で進めず Issue #540 に質問を書いて止まる

## 1. 対象の関数 (`/regression`、`src/entries/regression.ts` から export)

| 関数 | R の対応 | 仕様 (末尾の「rStats.js's choices」) |
|---|---|---|
| `polr`・`polrSummary`・`polrVcov`・`polrPredict`・`polrConfint`・`polrAnova` | MASS の `polr` と `summary`・`vcov`・`predict`・`confint`・`anova` | `oracle/polr-behaviour.md` |
| `rlm`・`rlmSummary`・`rlmVcov`・`psiHuber`・`psiHampel`・`psiBisquare` | MASS の `rlm`・`psi.huber`・`psi.hampel`・`psi.bisquare` | `oracle/rlm-behaviour.md` |
| `nls`・`nlsSummary`・`nlsVcov`・`nlsPredict`・`nlsConfint`・`nlsAnova` (自己開始モデル 10 個は式の中だけ) | stats の `nls` と `summary`・`vcov`・`predict`・`confint`・`anova`、`SSlogis` など | `oracle/nls-behaviour.md` |

`/regression` は `/mixed` と同じく、ルートの export と `dist/rstats.js` には入れない。

## 2. R0: 英語の説明 (TSDoc) を埋める

調整役が API リファレンスの入口 (`src/api-reference.ts`) に `/regression` を足したところ、TypeDoc の警告が 175 件
増えた。一覧は `briefs/release-1.7-typedoc-warnings.txt`。

- 結果とオプションの型 (`PolrModel`・`PolrSummaryResult`・`RlmResult`・`NlsResult`・`NlsControl`・`NlsOptions` など) の
  **すべてのプロパティ**に、1 行以上の英語の説明を書く。既存の型 (`src/models/glm.ts`・`src/models/lmer.ts` など) の
  説明の書き方と長さに合わせる。R の対応する要素があれば名前を書く (例: "Equivalent to `fit$zeta` in R.")
- 文書にない型を指している 5 件 (`NlsExpr`・`DesignContrast`・`FormulaNode`・`PsiResult`・`PsiInput`):
  `PsiResult`・`PsiInput` は利用者が使う型なので `src/entries/regression.ts` から型として export して説明を書く。
  内部の構造 (`NlsModel.expression`・`PolrModel.rhs`・`PolrModel.contrasts` など、利用者が読む必要のないもの) は、
  プロパティに `@internal` を付けて文書から外す (`typedoc.json` は `excludeInternal: true`)。どれを `@internal` に
  したかを報告に一覧で書く
- 変えてよいのはコメントと `export type` の行だけ。**コードの振る舞いは変えない**
- 目標: 回帰の分の警告が 0 件 (調整役が手元で TypeDoc を流して確かめる)

## 3. R1: 配線

手本は `/mixed` の配線 (`git grep -n mixed -- package.json scripts/ demo/ test/`)。

- `package.json` の `exports` に `./regression` (`./mixed` と同じ形)
- `scripts/bundle.mjs` の `AREAS` と `scripts/size.mjs` の `areas` に `regression`。`size.mjs` に `/mixed` と同じ形で
  回帰の行を足す: `polr`、`rlm`、`nls` のそれぞれ単独と、それぞれの全関数 (例: `polr, polrSummary, polrVcov,
  polrPredict, polrConfint, polrAnova`)
- `demo/app.js`: `dist/mixed.js` と同じく `dist/regression.js` も読み、デモの例から使えるようにする
- `test/demo.test.ts` の scope と `test/docExamples.test.ts` は済んでいる
- サイズの表 (`docs/performance.md` など) は `npm run size` の結果から作るので調整役がする。触らない

## 4. R2: 文書

手本は 1.5.0・1.6.0 の PR (#534・#537) の文書の差分。

- `README.md` と `README.ja.md`: 機能の一覧に「Regression」の行 (`/regression` の 18 関数と自己開始モデル 10 個)。
  `/mixed` の行と同じ書き方。版の番号・Status の行・CDN の URL は **変えない** (公開のときに調整役が変える)
- `llms.txt`: `/regression` の入口と、R からの書き換えの例 (`polr`・`rlm`・`nls` を 1 つずつ。既存の `/mixed` の
  書き方に合わせる)
- `docs/api-reference.md` と `docs/ja/api-reference.md`: 回帰の節
- `docs/differences-from-r.md` と `docs/ja/differences-from-r.md`: 新しい節「Regression: polr, rlm and nls」
  (日本語は「回帰: polr・rlm・nls」)。**3 つの仕様書の choices のうち「a known difference」と書いた項目を全部**、
  利用者向けに短く (1 項目 2〜4 行、根拠は仕様書へのリンク)。例: polr の cauchit (choice 12)・newdata の offset
  (13)・観測 0 件の水準と入れ子でない anova はエラー、rlm の MM と LTS は決定的・MM とケースの重みはエラー・
  過半数が直線上 (12)、nls の既定で真の解まで反復 (1)・プロファイル区間は正確な根 (5)・完全一致 (6)・反復前の
  エラー (7)・port は PORT でない (8)。既存の節の書き方と見出しの形に合わせる
- `CHANGELOG.md`: `## Unreleased` に 1.7.0 の項目 (新しい関数、`/regression` の入口、主な R との違いへのリンク)。
  既存の版の書き方に合わせる
- `ROADMAP.md` と `ROADMAP.ja.md`: 「Remaining」の 1 (1.7.0 の回帰) を済みにする。1.6.0 のときの書き方に合わせる

## 5. R3: デモの例

手本は 1.6.0 のときの `demo/` の差分。

- `demo/examples.R` と `demo/examples.json` に、回帰の例を足す (polr・rlm・nls を 2〜3 個ずつ。1 つの例で複数の関数を
  使ってよい)。R の側は MASS・stats の公開の関数を呼ぶだけ、JS の側は rStats.js の呼び出し。**`demo/examples.json` は
  1 例を数行に詰めた今の書式を崩さない** (整形し直さない)
- `test/demo.test.ts` の `NOT_IN_DEMO_YET` から、例を足した関数を消す (全部消せるのが望ましい)
- **R と違うと決めた所はデモの例にしない** (デモは R と同じ値を見せるもの): polr の cauchit・newdata の offset、
  rlm の `method = "MM"` と `init = "lts"` (R は乱数しだい)、nls のプロファイル区間 (R は補間で最大 0.5% ずれる。
  `nlsConfint` は `method = "wald"` なら例にしてよい)、完全一致のデータ。nls は収束の止まり方で R と下の桁が違うので、
  表示を 4〜6 桁にする
- データは小さく (数十行まで)。R の組み込みのデータ (housing・stackloss・Puromycin・DNase など) の一部を使ってよい
  (その場合は R の側でも同じ行だけを使う)
- `demo/r-results.json` は **書かない** (`oracle/demo.R` を Docker の R で流して調整役が作る)。`oracle/demo.R` に
  変更が要れば Issue に案として書く

## 6. 報告 (Issue #540、1 回)

R0〜R3 のそれぞれ何をしたか、`@internal` にしたプロパティの一覧、`differences-from-r` に載せた項目の一覧、デモの例の
一覧、迷った所、クリーンルームの確認。

## 7. 規則の要点

- R・MASS・GPL のソースは読まない (検索結果に出たら、読まずに報告)。R は実行しない
- **コードの振る舞いを変えない** (`src/` で変えてよいのはコメントと型の export だけ)。`oracle/`・`test/fixtures/`・
  `scripts/` のうち 3 節で挙げたもの以外・生成物 (`docs/r-functions*`・`docs/ja/api/*.json`・`demo/r-results.json`)・
  choices は変えない
- 改行は LF。日本語の文書の表記: 括弧は半角 `( )`、コロンは半角 `:`、和文と英数字の間に半角スペース
- push 先は `work/regression` だけ
