# 指示書: 1.5.0 のリリースの準備 (文書・デモ・日本語の API リファレンス)

作成 2026-11-17。基準のコミットとブランチは、依頼の文で指定します。

1.5.0 に入れる 2 つの分野 (試験デザインのサンプルサイズと検出力、メタアナリシス) と、その数値の点検は、すべて main に
取り込み済みです。今回の作業は、その新しい関数を文書・デモ・日本語の API リファレンスに載せることです。
**`src/` のコードは変えません。** 進め方は 1.4.0 のとき (`briefs/release-1.4.ja.md`、PR #524) と同じです。

## 0. 進め方

- 作業は R1〜R3 の 3 つです。1 つのブランチに順に積み重ね、ブランチから main への PR を作ってください (CI を走らせる
  ため。マージはしない)。push のたびに PR の CI の結果を確かめ、失敗があれば直してください
- Issue を 1 つ作り、R1〜R3 のそれぞれが終わるごとに、何をしたかを書いてください
- 判断に迷ったら、推測で進めず、Issue に質問を書いて止まってください

## 1. 新しい関数 (1.5.0)

`CHANGELOG.md` の `## Unreleased` に全部が書いてあります (1.4.1 として出すはずだった Gray の検定の修正も含む)。

| 関数 | R の対応 | 仕様 (末尾の「rStats.js's choices」) |
|---|---|---|
| `epiSsequb`・`epiSsequc`・`epiSsninfb`・`epiSsninfc`・`epiSssupb`・`epiSssupc` | epiR の `epi.ss*` | `oracle/samplesize-behaviour.md` |
| `powerPaired2x2` | `exact2x2::powerPaired2x2` | 同上 |
| `ssizeCT`・`powerCT`・`ssizeEpi`・`powerEpi`・`numDEpi` | powerSurvEpi の `.default` の版 | 同上 |
| `ph2simon` | `clinfun::ph2simon` | 同上 |
| `escalc`・`rma`・`confintRma`・`predictRma`・`regtest` | metafor の `escalc`・`rma.uni`・`confint.rma`・`predict.rma`・`regtest` | `oracle/meta-behaviour.md` |

## 2. R1: README・llms.txt・API リファレンスの表紙

手本は 1.4.0 のときの PR #524 (コミット `5361ca05`) です。その差分 (`git show 5361ca05`) を読み、同じ形で書いてください。

- `README.md` と `README.ja.md`: 機能の一覧に、上の関数を足す (メタアナリシスは新しい分野の見出しにする)。版の番号、
  Status の行、CDN の URL は **変えない** (公開のときにこちらで変える)。英語と日本語の内容をそろえる
- `ROADMAP.md` と `ROADMAP.ja.md` は **こちらで直し済み** なので触らない
- `llms.txt`: 新しい関数を足す (既存の書き方に合わせる)
- `docs/api-reference.md` と `docs/ja/api-reference.md`: 新しいカテゴリ「Meta-analysis」の分を、既存のカテゴリと
  同じ形で足す。ほかに 1.4.0 で変えた所と同じ所があれば直す

サイズの表 (`docs/performance.md` など) は `npm run size` の結果から作るので、こちらで直します。触らないでください。

## 3. R2: デモの例

手本は 1.4.0 のときのコミット `5361ca05` の `demo/` の部分です。

- `demo/examples.R` と `demo/examples.json` に、上の 18 関数の例を足す。1 つの例で複数の関数を使ってよい。
  R の側は照合先のパッケージ (epiR・exact2x2・powerSurvEpi・clinfun・metafor) で同じ計算をするコード、JS の側は
  rStats.js の呼び出し
- **R と rStats.js で値が違うと決めた所 (`docs/differences-from-r.md` の 2 つの節) は、デモの例にしない** (デモは R と
  同じ値になることを見せるもの)。例: epiR の同等性の検出力、`powerPaired2x2` の `errbound = 0`・`sigLevel = 1`、
  metafor の EB・PM の `se.tau2`
- `test/demo.test.ts` の `NOT_IN_DEMO_YET` から、例を足した関数を消す (全部消せるのが望ましい)
- `demo/r-results.json` は **書かない**。`oracle/demo.R` を Docker の R で流して作る生成物なので、こちらで作り直す
- 例のデータは小さく (数十行まで)、結果が読み取りやすいものにする。metadat のデータ (`dat.bcg` など) を使うときは、
  必要な列と行だけを例に書き写す
- `oracle/demo.R` が照合先のパッケージを読み込む必要があれば、その変更は Issue に案として書く (`oracle/` はこちらで
  直します)

## 4. R3: 日本語の API リファレンス

抜き出しはこちらで済ませました。訳のない項目が次の 2 ファイルで 144 件あります (訳し直しの要る `stale` の項目はなし)。

- `docs/ja/api/effect-sizes-and-power.json`: 121 件 (サンプルサイズの関数)
- `docs/ja/api/meta-analysis.json`: 23 件 (新しいファイル)

- 訳し方は `docs/ja/api/TRANSLATING.md` に従う。ただし、その 0 節 (モデル ID の報告) と、エージェントへの指示の
  部分は、あなたには当てはまらないので無視する
- 用語は `docs/ja/api-glossary.md` に従う。表にない語は `docs/ja/*.md` と `README.ja.md` の既存の訳語を探す。
  `docs/ja/differences-from-r.md` の「試験デザインのサンプルサイズと検出力」「メタアナリシス」の節の訳語にもそろえる。
  新しく決めた語は Issue に一覧で書く (用語集の更新はこちらで行う)
- 変えてよいのは各項目の `ja` の値だけ (`en`・`hash`・キー・順序は変えない)

## 5. 守ること

- `src/`、`test/fixtures/`、`oracle/`、`test/helpers/`、`scripts/`、`ROADMAP*.md`、`CHANGELOG.md`、
  `docs/differences-from-r.md` (と ja) は変えない
- 改行は LF
- 表記: 括弧は半角 `( )`、コロンは半角 `:`、和文と英数字の間に半角スペース
- 照合先のパッケージ (epiR・exact2x2・powerSurvEpi・clinfun・metafor・metadat) と R のソースは読まない
  (デモの R の側は公開の関数を呼ぶだけ)
