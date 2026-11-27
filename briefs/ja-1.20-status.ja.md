# rStats.js 1.20.0 の日本語訳 (API リファレンスと関数索引): ChatGPT への入口

## 書き込んでよい場所 (これ以外には書き込まない)

- リポジトリ: `numero-uno-jpn/rStats.js` (https://github.com/numero-uno-jpn/rStats.js)
- 土台: ブランチ `dev/ts-meta-1.20` のコミット `656fe8500c6f162e2a73d6dc9e3d9886482ad666`。作業の前に、`git log -1 --format=%H origin/dev/ts-meta-1.20` がこれと一致することを確かめる。
- 作業ブランチ: **`work/ja-1.20`** を土台から作り、ここにだけ push する。`main`、`dev/ts-meta-1.20`、ほかのブランチ、タグには push しない。
- PR・Issue・リリースは作らない。コメントもしない (PR を作ると CI が走る)。
- 変えてよいファイルは次の 3 つだけ。
  - `docs/ja/api/time-series.json`
  - `docs/ja/api/meta-analysis.json`
  - `docs/ja/r-functions.json`
- push の後、`git ls-remote origin work/ja-1.20` の SHA が手元の HEAD と一致することを確かめ、その SHA を報告する。

## クリーンルームの規則

- R と照合先のパッケージ (forecast、tseries、stats、urca、meta、netmeta、metafor、lme4) のソースは、読まない、思い出して書かない、写さない。関数の本体の表示、ミラー、引用も同じ。
- 使ってよいのは、リポジトリの英文 (`en`)、公開のヘルプ、論文、用語集だけ。
- ウェブ検索は関数名だけで行わない。ソースの抜粋が見えたら使わず、報告に書く。
- 報告の最後に、クリーンルームを守ったことの確認を 1 行書く。

## 作業 1: API リファレンス (229 件)

- 対象は `docs/ja/api/time-series.json` の `ja` が空の 168 件と、`docs/ja/api/meta-analysis.json` の `ja` が空の 61 件。
- 訳し方は **`docs/ja/api/TRANSLATING.md` の全節に従う**。用語は `docs/ja/api-glossary.md` に従う。
- 変えるのは `ja` の値だけ。`en`、`hash`、キー、順序は変えない。
- 書いたあと、`node scripts/api-ja-extract.mjs` を実行する (Node 22.18 以上、`npm ci` の後)。
  - 2 つのファイルの untranslated と stale が 0 になることを確かめる。
  - `en` と `hash` が変わっていないことを、`git diff` で確かめる。
- TRANSLATING.md の自己チェック (`⟦codeN⟧`、`{@link}`、インラインコードの個数と内容) を通す。

## 作業 2: 関数索引の説明 (103 件)

- `docs/ja/r-functions.json` に、`node scripts/r-index.mjs --ja` が「has no description of <関数名>」と報告する関数の説明を足す。全部で 103 件。
- 1 件は「関数名: 短い日本語の名詞句」。既存の項目の書き方に合わせる (例: `"dlnorm": "対数正規分布の密度関数"`)。
- 英語の説明は、`docs/r-functions.md` の該当行の 3 列目にある。
- 「(forecast's `accuracy()`)」のようなパッケージ名の注記は入れない (R の関数名は別の列に出るため)。
- 既存の項目の並びの規則 (区分の見出しと順序) に従う。
- 書いたあと、次の 2 つを実行する。
  - `node scripts/r-index.mjs --ja > docs/ja/r-functions.md`
  - `npx vitest run test/rIndexDoc.test.ts`
  - 「has no description」が 0 件になり、テストが通ることを確かめる。
- **`docs/ja/r-functions.md` の生成結果は、4 つ目の変えてよいファイルとして含めてよい。**

## 訳の注意 (この版に固有のもの)

- 分野は時系列 (ARIMA、指数平滑化、季節分解、単位根検定) とメタ分析 (共通効果・変量効果、ネットワーク・メタアナリシス) です。
- 用語集にない語は、日本語の統計学の標準的な訳語を使う。
  - 例: common effect = 共通効果、random effects = 変量効果、prediction interval = 予測区間、seasonal adjustment = 季節調整、unit root = 単位根、heterogeneity = 異質性。
  - 決められないものは「(要確認)」を付けて残し、報告に一覧する。
- 「**This departs from R:**」は「**R との違い:**」と訳す。`log 89` などの番号は、そのまま残す。
- 数値、条件、既定値、式 (`t(k - 1)`、`1/(n - 3)` など) は、言い換えず、丸めない。

## 報告

次のものを書く。

- push した SHA
- 2 つの作業の件数
- `node scripts/api-ja-extract.mjs` の 2 ファイルの行
- テストの結果
- 「(要確認)」の一覧
- 自己チェックで一致しなかったもの
- クリーンルームの確認
