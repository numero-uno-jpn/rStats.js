# rStats.js 1.21.0 の日本語訳 (API リファレンスと文書): ChatGPT への入口

## 書き込んでよい場所 (これ以外には書き込まない)

- リポジトリ: `numero-uno-jpn/rStats.js` (https://github.com/numero-uno-jpn/rStats.js)
- 土台: ブランチ `dev/plot-1.21` の先頭 (依頼文に書いた SHA)。作業の前に、`git log -1 --format=%H origin/dev/plot-1.21` が依頼文の SHA と一致することを確かめる。
- 作業ブランチ: **`work/ja-1.21`** を土台から作り、ここにだけ push する。`main`、`dev/plot-1.21`、ほかのブランチ、タグには push しない。
- PR・Issue・リリースは作らない。コメントもしない (PR を作ると CI が走る)。
- 変えてよいファイルは次の 7 つだけ。
  - `docs/ja/api/plot-data.json`
  - `docs/ja/api/descriptive-statistics.json`
  - `docs/ja/api/linear-models-and-anova.json`
  - `docs/ja/api/meta-analysis.json`
  - `docs/ja/plotting.md` (新しく作る)
  - `docs/ja/differences-from-r.md`
  - `docs/ja/api-reference.md`
- push の後、`git ls-remote origin work/ja-1.21` の SHA が手元の HEAD と一致することを確かめ、その SHA を報告する。

## クリーンルームの規則

- R と照合先のパッケージ (stats、grDevices、graphics、survival、meta、netmeta、metafor、pROC、cmprsk、forecast) のソースは、読まない、思い出して書かない、写さない。関数の本体の表示、ミラー、引用も同じ。
- 使ってよいのは、リポジトリの英文、公開のヘルプ、論文、用語集だけ。
- ウェブ検索は関数名だけで行わない。ソースの抜粋が見えたら使わず、報告に書く。
- 報告の最後に、クリーンルームを守ったことの確認を 1 行書く。

## 作業 1: API リファレンス (未訳 157 件、stale 3 件)

- 対象は次のとおり。
  - `docs/ja/api/plot-data.json` の `ja` が空の 81 件
  - `docs/ja/api/descriptive-statistics.json` の `ja` が空の 65 件 (density・qqnorm・boxplotStats・lowess など)
  - `docs/ja/api/linear-models-and-anova.json` の `ja` が空の 11 件 (lmHatvalues など)
  - `docs/ja/api/meta-analysis.json` の `stale` が true の 3 件 (英文が変わったもの。`ja` を新しい `en` に合わせて直し、`stale` を消す)
- 訳し方は **`docs/ja/api/TRANSLATING.md` の全節に従う**。用語は `docs/ja/api-glossary.md` に従う。
- 変えるのは `ja` の値 (と stale の印) だけ。`en`、`hash`、キー、順序は変えない。
- 書いたあと、`node scripts/api-ja-extract.mjs` を実行する (Node 22.18 以上、`npm ci` の後)。
  - 4 つのファイルの untranslated と stale が 0 になることを確かめる。
  - `en` と `hash` が変わっていないことを、`git diff` で確かめる。
- TRANSLATING.md の自己チェック (`⟦codeN⟧`、`{@link}`、インラインコードの個数と内容) を通す。

## 作業 2: 文書の日本語版

- `docs/plotting.md` を訳して `docs/ja/plotting.md` を作る。
  - コードの部分は、コメントも含めて英語版と同じにする (値のコメントはテストで検査されている)。
  - 他の日本語の文書 (`docs/ja/guide-for-js-developers.md` など) の書き方に合わせる。
- `docs/differences-from-r.md` の末尾の節「Plot data (1.21.0)」を訳し、`docs/ja/differences-from-r.md` の末尾に足す。見出しは「描画用のデータ (1.21.0)」とする。
- `docs/api-reference.md` で 1.21.0 に足した 3 か所を、`docs/ja/api-reference.md` の対応する場所に足す。
  - 「Start here」の「Plotting the results」の項目 (日本語版のリンク先は `docs/ja/plotting.html`)
  - CDN の段落の `dist/plot.js`
  - 「Plot data」の節 (「因果推論」の節の前に、見出し「描画用のデータ」)

## 訳の注意 (この版に固有のもの)

- 分野は描画用のデータです (生存曲線、ROC、forest plot、funnel plot、Q-Q プロット、カーネル密度、箱ひげ図、回帰診断、樹形図、バイプロット)。
- 用語集にない語は、日本語の統計学の標準的な訳語を使う。
  - 例: risk table = リスク表、censoring mark = 打ち切りの印、confidence band = 信頼帯、prediction band = 予測帯、leverage = てこ比、standardized residual = 標準化残差、studentized residual = スチューデント化残差、Cook's distance = Cook の距離、bandwidth = 帯域幅、kernel = 核 (カーネル)、hinge = ヒンジ、whisker = ひげ、notch = ノッチ、layer = 層、row = 行、smooth = 平滑線。
  - 図の名前 (forest plot、funnel plot、Q-Q プロット、biplot) は、カタカナか原語のままにする。
  - 決められないものは「(要確認)」を付けて残し、報告に一覧する。
- 関数名・欄の名前 (`layers`、`steps`、`ymin` など) と Observable Plot・Plotly の API 名は訳さない。
- 「This departs from R:」は「R との違い:」と訳す。`experiment 3` などの番号は、そのまま残す。
- 数値、条件、既定値、式 (`1.58 IQR / sqrt(n)`、`[from − 4 bw, to + 4 bw]` など) は、言い換えず、丸めない。

## 報告

次のものを書く。

- push した SHA
- 2 つの作業の件数
- `node scripts/api-ja-extract.mjs` の 4 ファイルの行
- `npx vitest run test/docExamples.test.ts test/rIndexDoc.test.ts` の結果
- 「(要確認)」の一覧
- 自己チェックで一致しなかったもの
- クリーンルームの確認
