# 指示書: 1.4.0 のリリースの準備 (文書・デモ・日本語の API リファレンス)

作成 2026-11-16。基準のコミットとブランチは、依頼の文で指定します。

1.4.0 の生存時間解析の続き (作業 A〜D と数値の点検) は、すべて main に取り込み済みです。今回の作業は、その新しい関数を
文書・デモ・日本語の API リファレンスに載せることです。**`src/` のコードは変えません。**

## 0. 進め方

- 作業は R1〜R3 の 3 つです。1 つのブランチに順に積み重ね、ブランチから main への PR を作ってください (CI を走らせる
  ため。マージはしない)。push のたびに PR の CI の結果を確かめ、失敗があれば直してください
- Issue を 1 つ作り、R1〜R3 のそれぞれが終わるごとに、何をしたかを書いてください
- 判断に迷ったら、推測で進めず、Issue に質問を書いて止まってください

## 1. 新しい関数と変わった関数 (1.4.0)

`CHANGELOG.md` の `## Unreleased` に全部が書いてあります。要点は次のとおりです。

| 関数 | R の対応 | 作業 |
|---|---|---|
| `survfit` の拡張 (`ctype`・`stype`・`weights`・`robust`・`rmean`・`confType` の追加、`start`・`id`) | `survival::survfit` | A・B |
| `rmst2` | `survRM2::rmst2` | A |
| `cuminc`・`timepoints` | `cmprsk::cuminc`・`timepoints` | C |
| `crr`・`predictCrr` | `cmprsk::crr`・`predict.crr` | C |
| `coxph` の (start, stop] データ (`start`・`id`) | `survival::coxph` | B |
| `coxZph` | `survival::cox.zph` | B |
| `survreg`・`survregPredict`・`survregResiduals` | `survival::survreg`・`predict.survreg`・`residuals.survreg` | D |

仕様とユーザーの判断は `oracle/survfit2-behaviour.md`・`coxph2-behaviour.md`・`competing-behaviour.md`・
`survreg-behaviour.md` の末尾の「rStats.js's choices」にあります。

## 2. R1: README・ROADMAP・llms.txt・API リファレンスの表紙

手本は 1.3.0 のときのコミット `64303164` です。その差分 (`git show 64303164`) を読み、同じ形で書いてください。

- `README.md` と `README.ja.md`: 生存時間解析の機能の一覧に、上の関数を足す。版の番号、Status の行、CDN の URL は
  **変えない** (公開のときにこちらで変える)。英語と日本語の内容をそろえる
- `ROADMAP.md` と `ROADMAP.ja.md`: 「Remaining」(残っていること) の 1 番「生存時間解析の続き」を「Done」(完了した
  こと) に移し、残りの番号を繰り上げる。入れなかったもの (仕様書の choices で「今は入れない」と決めたもの。
  例: crr の `cengroup`、survfit の `scale`) を、1.3.0 の書き方にならって添える
- `llms.txt`: 新しい関数を足す (既存の書き方に合わせる)
- `docs/api-reference.md` と `docs/ja/api-reference.md`: 1.3.0 で変えた所と同じ所を、必要なら直す

サイズの表 (`docs/performance.md` など) は `npm run size` の結果から作るので、こちらで直します。触らないでください。

## 3. R2: デモの例

手本は 1.3.0 のときのコミット `e0356628` です。

- `demo/examples.R` と `demo/examples.json` に、上の新しい関数の例を足す。1 つの例で複数の関数を使ってよい。
  R の側は R の関数 (survival・survRM2・cmprsk) で同じ計算をするコード、JS の側は rStats.js の呼び出し
- `test/demo.test.ts` の `NOT_IN_DEMO_YET` から、例を足した関数を消す
- `demo/r-results.json` は **書かない**。`oracle/demo.R` を Docker の R で流して作る生成物なので、こちらで作り直す
- 例のデータは小さく (数十行まで)、結果が読み取りやすいものにする。R の組み込みのデータ (`lung` など) を使う
  ときは、必要な列と行だけを例に書き写す

## 4. R3: 日本語の API リファレンス (docs/ja/api/survival-analysis.json)

`docs/ja/api/survival-analysis.json` に、訳のない項目が 149 件、英文が変わって訳し直しの要る項目 (`"stale": true`)
が 22 件あります (抜き出しはこちらで済ませました)。

- 訳し方は `docs/ja/api/TRANSLATING.md` に従う。ただし、その 0 節 (モデル ID の報告) と、エージェントへの指示の
  部分は、あなたには当てはまらないので無視する
- 用語は `docs/ja/api-glossary.md` に従う。表にない語は `docs/ja/*.md` と `README.ja.md` の既存の訳語を探す。
  新しく決めた語は Issue に一覧で書く (用語集の更新はこちらで行う)
- 変えてよいのは各項目の `ja` の値と、訳し直した項目の `stale` のキーの削除だけ (`en`・`hash`・キー・順序は変えない)

## 5. 守ること

- `src/`、`test/fixtures/`、`oracle/`、`test/helpers/`、`scripts/` は変えない
- 改行は LF
- 表記: 括弧は半角 `( )`、コロンは半角 `:`、和文と英数字の間に半角スペース
