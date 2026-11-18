# 指示書: 1.6.0 のリリースの準備 (文書・デモ・日本語の API リファレンス)

作成 2026-11-19。基準のコミットとブランチは、依頼の文で指定します。

1.6.0 に入れる混合モデルの続き (lme4 の `confint` と `simulate`) と、その数値の点検は、すべて main に取り込み済み
です (PR #537、Issue #535)。今回の作業は、その新しい関数を文書・デモ・日本語の API リファレンスに載せることです。
**`src/` のコードは変えません。** 進め方は 1.5.0 のとき (`briefs/release-1.5.ja.md`、PR #534) と同じです。

## 0. 進め方

- 作業は R1〜R3 の 3 つです。1 つのブランチに順に積み重ね、ブランチから main への PR を作ってください (CI を走らせる
  ため。マージはしない)。push のたびに PR の CI の結果を確かめ、失敗があれば直してください
- Issue を 1 つ作り、R1〜R3 のそれぞれが終わるごとに、何をしたかを書いてください
- 判断に迷ったら、推測で進めず、Issue に質問を書いて止まってください

## 1. 新しい関数 (1.6.0)

`CHANGELOG.md` の `## Unreleased` に書いてあります。どれも `/mixed` (`src/entries/mixed.ts`) から export します。

| 関数 | R の対応 | 仕様 (末尾の「rStats.js's choices」) |
|---|---|---|
| `confintLmer`・`confintGlmer` | lme4 の `confint` (`confint.merMod`) | `oracle/mixedconfint-behaviour.md` |
| `simulateLmer`・`simulateGlmer` | lme4 の `simulate` (`simulate.merMod`) | `oracle/mixedsimulate-behaviour.md` |

## 2. R1: README・llms.txt・API リファレンスの表紙

手本は 1.5.0 のときの PR #534 (コミット `4b0f81ef`) です。その差分 (`git show 4b0f81ef`) を読み、同じ形で書いてください。

- `README.md` と `README.ja.md`: 機能の一覧の「Mixed models」の行に、上の関数を足す。版の番号、
  Status の行、CDN の URL は **変えない** (公開のときにこちらで変える)。英語と日本語の内容をそろえる
- `ROADMAP.md` と `ROADMAP.ja.md` は **こちらで直し済み** なので触らない
- `llms.txt`: 新しい関数を足す (既存の書き方に合わせる)
- `docs/api-reference.md` と `docs/ja/api-reference.md`: 混合モデルの所に上の関数を足す。ほかに 1.5.0 で変えた所と
  同じ所があれば直す

サイズの表 (`docs/performance.md` など) は `npm run size` の結果から作るので、こちらで直します。触らないでください。

## 3. R2: デモの例

手本は 1.5.0 のときのコミット `4b0f81ef` の `demo/` の部分です。

- `demo/examples.R` と `demo/examples.json` に、上の 4 関数の例を足す。1 つの例で複数の関数を使ってよい。R の側は
  lme4 で同じ計算をするコード (`confint(fit)`、`confint(fit, method = "Wald")`、`simulate(fit, nsim = 3, seed = 1)`)、
  JS の側は rStats.js の呼び出し。既存の混合モデルの例 (sleepstudy・cbpp など) のデータを使ってよい
- **R と rStats.js で値が違うと決めた所 (`docs/differences-from-r.md` の「Mixed models: confint and simulate」) は、
  デモの例にしない** (デモは R と同じ値になることを見せるもの)。例: 項が 2 つ以上ある当てはめの部分的な `reForm`、
  Gamma などの profile、境界の当てはめの profile (R は補間なので 3〜4 桁目で違う)。profile の例は、端が R と
  よく合う当てはめ (sleepstudy の lmer など) にし、表示の桁を 4 桁ほどにする
- `test/demo.test.ts` の `NOT_IN_DEMO_YET` から、例を足した関数を消す (全部消せるのが望ましい)
- `demo/r-results.json` は **書かない**。`oracle/demo.R` を Docker の R で流して作る生成物なので、こちらで作り直す
- 例のデータは小さく (数十行まで)、結果が読み取りやすいものにする。既存のデモの例のデータを使い回してよい
- `oracle/demo.R` が lme4 を読み込む必要があれば、その変更は Issue に案として書く (`oracle/` はこちらで
  直します)

## 4. R3: 日本語の API リファレンス

抜き出しはこちらで済ませました。訳のない項目が `docs/ja/api/mixed-models.json` に 119 件あります (訳し直しの要る
`stale` の項目はなし)。

- 訳し方は `docs/ja/api/TRANSLATING.md` に従う。ただし、その 0 節 (モデル ID の報告) と、エージェントへの指示の
  部分は、あなたには当てはまらないので無視する
- 用語は `docs/ja/api-glossary.md` に従う。表にない語は `docs/ja/*.md` と `README.ja.md` の既存の訳語を探す。
  `docs/ja/differences-from-r.md` の「混合モデルの confint と simulate」の節と、既存の混合モデルの項目の訳語にもそろえる。
  新しく決めた語は Issue に一覧で書く (用語集の更新はこちらで行う)
- 変えてよいのは各項目の `ja` の値だけ (`en`・`hash`・キー・順序は変えない)

## 5. 守ること

- `src/`、`test/fixtures/`、`oracle/`、`test/helpers/`、`scripts/`、`ROADMAP*.md`、`CHANGELOG.md`、
  `docs/differences-from-r.md` (と ja) は変えない
- 改行は LF
- 表記: 括弧は半角 `( )`、コロンは半角 `:`、和文と英数字の間に半角スペース
- **クリーンルーム開発が必須:** lme4・Matrix・lmerTest と R のソースを読まない・思い出して書かない・写さない
  (関数の本体の表示、ミラー、記事や検索結果での引用も含む)。デモの R の側は公開の関数を呼ぶだけ。ウェブ検索は
  関数名だけで行わず、ソースの抜粋が見えたら使わずに報告する。報告の最後にクリーンルームの確認を書く
- R の実験は要りません (`demo/r-results.json` はこちらが作ります)
