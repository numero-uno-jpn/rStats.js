# 指示書: 1.8.0 の仕上げと公開の準備 (未対応の整理・英語の説明・配線・文書・デモ)

作成 2026-11-21 (調整役)。入口は `briefs/regression-1.8-status.ja.md` (規則と進め方)。**手本は 1.7.0 の
`briefs/release-1.7.ja.md`** で、進め方・R0〜R3 の中身・規則はそれと同じ。違う所だけをここに書く。

## 0. 進め方

GitHub に直接 `work/regression-1.8` へ push し、PR #546 の CI でテストする (生成物の 4 件 = `unknownOptions`・
`rIndexDoc` 以外が全部通ること)。push のたびにファイルを開き直し、文字どおりの `\n` が入っていないか確かめる。
F・R0〜R3 を順に、区切りごとに Issue #545 に数行。全部済んだら Issue #545 に 1 回報告して止まる。**ウェブ検索は使わない。**

## 1. F: 段階 2 の仕上げ (ここだけコードを変えてよい)

- glmnet の Gaussian CV の `it.todo`: fixture に R の厳しい当て直し (`lambdaTight`・`cvmTight`・`cvsdTight`) が入った
  (`64d30930`)。それと比べるテストにして todo を外す。許容は 1.7.0 と同じ考え方 (広げない)
- **1.8.0 に入れないもの** (ユーザーの決定、各仕様書の choices の最後): rq の `se = "iid"`・`"ker"`・`"boot"` と rank の
  `iid = FALSE`、geeglm の `std.err = "jack"`・`"j1s"`・`"fij"`。指定したら、未対応であることがわかる英語のエラー
  (例: `se = "ker" is not supported yet; use "rank" or "nid"`)。型からも外す (`RqSummaryOptions["se"]` は
  `"rank" | "nid"`、`GeeStdErr` は `"san.se"`)。関係する `it.todo` は「エラーになること」のテストに替える。
  jackknife の実装のコードは消してよい (残すなら export しない)

## 2. 対象の関数 (`/regression` に足すもの。入口・配線は 1.7.0 で済み)

| 関数 | R の対応 | 仕様 |
|---|---|---|
| `rq`・`rqSummary`・`rqPredict`・`rqPredictInterval`・`rqAnova` | quantreg の `rq`・`summary.rq`・`predict.rq`・`anova.rq` | `oracle/rq-behaviour.md` |
| `geeglm`・`geeSummary`・`geeVcov`・`geePredict`・`geeAnova`・`geeQIC` | geepack の `geeglm`・`summary`・`vcov`・`predict`・`anova`・`QIC` | `oracle/gee-behaviour.md` |
| `glmnet`・`glmnetCoef`・`glmnetPredict`・`cvGlmnet` | glmnet の `glmnet`・`coef`・`predict`・`cv.glmnet` | `oracle/glmnet-behaviour.md` |

## 3. 1.7.0 の R0〜R3 との違い

- R0 (TSDoc): 上の関数と、その結果・オプションの型の**すべてのプロパティ**に英語の説明。調整役が最後に TypeDoc を流す
- R1 (配線): `/regression` の配線は済み。`scripts/size.mjs` に rq・geeglm・glmnet のそれぞれ単独と全関数の行を足すだけ
- R2 (文書): README (英・日) の Regression の行に 15 関数を足す。`llms.txt` に rq・geeglm・glmnet の書き換えの例を 1 つ
  ずつ。`docs/api-reference.md` (英・日)。`CHANGELOG.md` の `## Unreleased` に 1.8.0。`ROADMAP.md` (英・日) の
  1.8.0 を済みに。`docs/differences-from-r.md` (英・日) に新しい節「Regression: rq, geeglm and glmnet」(日本語は
  「回帰: rq・geeglm・glmnet」)。**3 つの仕様書の choices の「a known difference」と「Not in 1.8.0」を全部**。
  書き方の決まり (ユーザーの決定): glmnet は「R の既定は収束していないことがある (iris の multinomial で厳しい当て直しから
  最大 2.3、CV の cvm で 1.2e-5)。rStats.js は真の解まで解く」、rank は「同点のデータで双対が退化する所では、R と端点が
  違うことがある」。**どちらも R の不具合とは書かない。** R 側の不具合と書いてよいのは geepack の `scale.fix` のエラー
  (gee の choices 2) だけ
- R3 (デモ): rq・geeglm・glmnet を 2〜3 個ずつ。**R と違うと決めた所と、R の既定が収束していない所はデモにしない**
  (glmnet の multinomial は避ける。gaussian・binomial は R の既定と rStats.js の差が表示の桁より小さい例だけ。表示は
  4〜6 桁)。rq は同点のない連続のデータで

## 4. 規則の要点

- クリーンルーム: quantreg・geepack・glmnet と R のソースを読まない・思い出して書かない・写さない。ウェブ検索は使わない
- コードを変えてよいのは 1 節 (F) だけ。R0〜R3 ではコメントと型の export だけ
- 変えない: 仕様書の choices、`test/fixtures/`、`scripts/` (`size.mjs` を除く)、生成物 (`docs/r-functions*`・
  `docs/ja/api/*.json`・`demo/r-results.json`)。push 先は `work/regression-1.8` だけ
- 改行は LF。日本語の文書の表記: 括弧は半角 `( )`、コロンは半角 `:`、和文と英数字の間に半角スペース
