# 指示書: 1.9.0 の仕上げと公開の準備 (英語の説明・文書・デモ)

作成 2026-11-22 (Claude)。入口は `briefs/tests-multivariate-1.9-status.ja.md` (規則と進め方)。**手本は
`briefs/release-1.8.ja.md` と `briefs/release-1.7.ja.md`** で、進め方・R0〜R3 の中身・規則はそれと同じ。違う所だけを書く。

## 0. 進め方

GitHub に直接 `work/multivariate-1.9` へ push し、PR #550 の CI で全部が通ること (今は全部緑)。push のたびにファイルを
開き直し、文字どおりの `\n` が入っていないか確かめる。R0〜R3 を順に進め、**途中で止まらない**。全部済んだら Issue #549 に
1 回だけ報告して止まる。**ウェブ検索は使わない。** HANDOFF.md は触らない。

## 1. 対象の関数

| 関数 | 置き場所 | R の対応 | 仕様 |
|---|---|---|---|
| `tamhaneT2Test` | `/tests` | PMCMRplus `tamhaneT2Test` | `oracle/tamhane-behaviour.md` |
| `pageTest` | `/tests` | PMCMRplus `pageTest` | `oracle/page-behaviour.md` |
| `grubbsTest`・`pgrubbs`・`qgrubbs` | `/tests` | outliers `grubbs.test`・`pgrubbs`・`qgrubbs` | `oracle/grubbs-behaviour.md` |
| `manova`・`manovaSummary` | `/multivariate` (新しい分野) | stats `manova`・`summary.manova` | `oracle/manova-behaviour.md` |
| `lda`・`ldaPredict` | `/multivariate` | MASS `lda`・`predict.lda` | `oracle/lda-behaviour.md` |
| `cancor` | `/multivariate` | stats `cancor` | `oracle/cancor-behaviour.md` |

## 2. 1.8.0 の R0〜R3 との違い

- R0 (TSDoc): 上の関数と、その結果・オプションの型の**すべてのプロパティ**に英語の説明。こちらが最後に TypeDoc を流す
- R1 (配線): `/multivariate` の配線と `scripts/size.mjs` の行はこちらで済み。**`demo/app.js` が `dist/multivariate.js` も
  読むようにし、`test/browser/demo.mjs` の読み込みの一覧 (`["rstats.js", "mixed.js", "regression.js"]` とコメント) にも
  足す** (`regression.js` を足した 1.7.0 の形)
- R2 (文書): README (英・日) に新しい分野 Multivariate analysis (`/multivariate`) の行と、`/tests` の行に T2・Page・
  Grubbs。`llms.txt` に manova・lda・cancor の書き換えの例を 1 つずつ。`docs/api-reference.md` (英・日)。`CHANGELOG.md`
  の `## Unreleased` に 1.9.0。`ROADMAP.md` (英・日) の 1.9.0 を済みに。`docs/differences-from-r.md` (英・日) に節
  「Small tests: Tamhane's T2, Page's test and Grubbs' test」と「Multivariate analysis: manova, lda and cancor」
  (日本語は「小さな検定: Tamhane の T2・Page の検定・Grubbs の検定」「多変量解析: manova・lda・cancor」)。**6 つの
  仕様書の choices で R と違うことにした所を全部**: T2 の溢れない自由度 (R は 1e100 倍で NaN)、文字列の群を受ける
  (R はエラー)、Page の NA はエラー (R は NA を最後の順位にする)、Grubbs は type 10 だけ (11・20 は R の近似が出力から
  再現できない)・定数の x は p = NaN (R は 0)・小さい p を桁落ちなしで求める (R は 1 − F)、lda・cancor の符号
  (決まった規則。列 (cancor は組) の符号が R と違うことがある)。**R の不具合と書いてよいのは Grubbs の定数の x の p = 0
  だけ**。ほかは「R と違う」「rStats.js はこうする」と書く
- R3 (デモ): 6 つの関数を 1〜2 個ずつ (T2・Page・Grubbs は 1 個、manova・lda・cancor は 2 個まで)。**R と違うと決めた所は
  デモにしない** (lda・cancor は符号が R と同じになる例だけ。iris の lda と LifeCycleSavings の cancor は R と符号が同じ
  ことを fixture で確かめてから)。`demo/examples.R` の R のコードを必ず書く (こちらが R で流して照らし合わせる)。
  `test/demo.test.ts` の `NOT_IN_DEMO_YET` から、デモに入れた関数を外す
- 日本語の API の訳 (`docs/ja/api/*.json`) はこちらが別に頼む (`docs/ja/api/TRANSLATING.md`)

## 3. 規則の要点

- クリーンルーム: PMCMRplus・outliers・MASS と R のソースを読まない・思い出して書かない・写さない。ウェブ検索は使わない
- コードは変えない (R1 のデモの読み込みを除く)。R0〜R3 ではコメントと型の export だけ
- 変えない: 仕様書の choices、`test/fixtures/`、`scripts/`、`package.json`、生成物 (`docs/r-functions*`・
  `docs/ja/api/*.json`・`demo/r-results.json`)、HANDOFF.md。push 先は `work/multivariate-1.9` だけ
- 改行は LF。日本語の文書の表記: 括弧は半角 `( )`、コロンは半角 `:`、和文と英数字の間に半角スペース
