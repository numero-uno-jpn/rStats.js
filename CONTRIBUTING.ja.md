# 貢献の手引き

[English](CONTRIBUTING.md) | 日本語

> この文書は [英語版](CONTRIBUTING.md) の訳です。内容が食い違うときは英語版が正です。

rStats.js に関心を持っていただきありがとうございます。この文書では、このプロジェクトで結果を R と
どう照合しているか、関数を追加・変更するときに何が必要かを説明します。

## 準備

- Node.js 22 以降
- `npm ci`
- `npm run typecheck`、`npm test`、`npm run build`

テストスイートの実行には R もネットワーク接続も要りません。R から得た期待値は
`test/fixtures/*.json` に保存してあります。

## R との照合の仕組み

すべての関数を R の出力と比べています。関数を 1 つ追加するには、次の 3 つのファイルを追加します。

1. `oracle/<name>.R`: 入力のグリッド (典型的な値、p = 1e-300 のような裾、境界、NaN/Inf、
   巨大なパラメータ) を作り、R の結果を `test/fixtures/<name>.json` に書き出す。1 ケースにつき
   1 行で、数値は `%.17g` で書式化した文字列にする。
2. `src/` に置く実装。その分野の `src/entries/<area>.ts` (サブパスの export) から export する
   (`src/index.ts` はすべての分野を再 export します)。
3. `test/<name>.test.ts`: フィクスチャに対して実装を実行し、相対誤差を確かめる。

フィクスチャを生成し直すには、Docker 上の R が必要です。

```sh
npm run oracle -- <oracle name>     # 例: npm run oracle -- gamma
```

`scripts/oracle.sh` は、使い捨てのコンテナ (`docker run --rm --network none`) で `Rscript` を
実行します。イメージは既定で `rstats-oracle` です (`RSTATS_ORACLE_IMAGE` で変更できます)。
このイメージは `oracle/Dockerfile` から作ります。R 4.5.2 と、oracle が読み込むパッケージ
(`jsonlite`、`Rmpfr`、`gmp`、`MASS`、`Matrix`、R にない関数のための `extraDistr`、`e1071`、
`DescTools`、`pracma`、`deSolve`、`numDeriv`、`BSDA`、`lawstat`、`car`、`afex`) が入ります。パッケージは日付で固定した
スナップショットから取るので、作り直しても同じ版になります。作るときだけネットワークが要り、
oracle の実行には要りません。

```sh
docker build -t rstats-oracle oracle
docker build --platform linux/amd64 -t rstats-oracle-amd64 oracle
```

R のメッセージは `LANGUAGE=en` で英語に固定しているので、フィクスチャに記録されるエラー
メッセージはロケールに左右されません。新しい oracle には、既存のフィクスチャと同じ名前を
使わないでください (`write_fixture` は黙って上書きします)。実行したら `git status` で
確かめてください。

乱数のフィクスチャは、x86_64 版のイメージ (`--platform linux/amd64` の `rstats-oracle-amd64`。
oracle には `# oracle-platform: amd64` と印を付ける) で生成します。arm64 版では一部の関数で
最後のビットが異なるためです。線形代数のフィクスチャには、R が使った LAPACK と BLAS の
バージョンを `info` ブロックに記録します (現在のフィクスチャは OpenBLAS 0.3.26 と
LAPACK 3.12.0 で作成)。BLAS が違うと最後の数ビットが変わることがあるためです。

mpmath による高精度の値とも照合できます。`scripts/mpmath/<name>.py` が
`test/fixtures/<name>.mpmath.json` を書き出します (`python3 -I scripts/mpmath/<name>.py`。
`pip install mpmath` が必要)。R のない環境での作業はこれから始め、`oracle/<name>.R` を実行すると
テストは自動的に R との照合も行います。フィクスチャの数値は、先に倍精度に直して読みます
(`mp.mpf(float(s))`)。`mp.mpf(s)` は十進の文字列をそのまま取るので、関数が受け取った入力とは
違う値になります。R のフィクスチャに Rmpfr の参照関数が無い特殊関数では、
`scripts/mpmath/mismatch_ref.py` が R と合わないケース (`RSTATS_WRITE_MISMATCH=1` で書き出す) の
mpmath の参照値を計算し、`<name>.ref.json` に統合します。

R がいつも正しいとは限りません。一致しないケースがあると、テストはそのケースを高精度の参照値
(Rmpfr または gmp) と比べ、rStats.js のほうが R より真の値に近ければ合格とします。rStats.js が
意図して R と異なるケースは、理由を書いたうえで除外し (`knownDifference`)、ドキュメントに
記録します。[docs/ja/accuracy.md](docs/ja/accuracy.md) と
[docs/ja/differences-from-r.md](docs/ja/differences-from-r.md) を見てください。
[docs/ja/performance.md](docs/ja/performance.md) では、double-double 演算、`scripts/ddgen.py` で
生成したコード、速度の測り方 (`npm run bench`)、double-double によって精度がどれだけ上がるかの
測り方 (`npm run precision-report`) を説明しています。

## ライセンスの決まり

rStats.js は MIT ライセンスです。それを保つために、次のことを守ってください。

- **R や GPL のパッケージのコードを、コピーも翻訳もしないこと。** R は oracle で、rStats.js
  は R の出力と照合します。R が正確にどう振る舞うか (どの入力を拒むか、どの式や約束事を使うか、
  どこで丸めるか) を確かめるために R のソースを読むのはかまいません。不一致を片づけるにはそれが
  早道のことも多いです。ただし、そこから実装を書いてはいけません。R の `src/nmath`、`src/appl`、
  推奨パッケージ、TOMS 708 もこれに含みます。
- 移植してよいのは、寛容なライセンスのソースだけです。SciPy と xsf (BSD-3)、Boost.Math
  (BSL-1.0)、statsmodels (BSD-3)、lifelines (MIT)、LAPACK の参照実装 (修正 BSD)、パブリック
  ドメインのコード (LINPACK、EISPACK、xsf とともに配布されている Cephes)、または公表された論文です。
- 移植した各ファイルの先頭に出典を書き、`THIRD_PARTY_NOTICES.md` に追加してください。

## デモ

`demo/` は、jsDelivr から `dist/rstats.js` を読み込む静的なページです (`?src=local` を付けると
ローカルのビルドを読み込みます)。例は `demo/examples.json` で定義しています。例を変更したら
`npm run demo:r` を実行して、`demo/examples.R` と `demo/r-results.json` の R の値を生成し直して
ください。`test/demo.test.ts` がすべての例を R と照合し、`test/browser/demo.mjs` がページを
操作して確かめます。

## スタイル

- TypeScript、ESM で、1 ファイルに 1 つの関数ファミリーを置きます。省略可能な引数は、camelCase
  のキーを持つオプションオブジェクトで渡します。名前と数値の結果は R に合わせます。
- 公開 API のドキュメント (export するシンボルの TSDoc)、内部のコメント、文書 (`*.md` と `docs/`) は
  英語で書きます。`docs/ja/` と `*.ja.md` のファイルは日本語訳で、英語版が正です。一方を変えたら、
  その訳も同じように変えてください。
- エラーは、型や形が誤っているときは `TypeError`、値が範囲外のときは `RangeError`、数値計算が
  失敗したときは `Error` にします。メッセージは英語です。

## リリース

1. `NOT_IN_DEMO_YET` (`test/demo.test.ts`) に挙げた export のデモ例を追加して、このリストを空に
   します (`npm run demo:r` が必要)。`package.json` の `version`、`CHANGELOG.md` の日付、`demo/app.js` の `VERSION` (デモが
   jsDelivr から読み込むタグ) を更新してコミットし、タグを付けて push します:
   `git tag vX.Y.Z && git push origin vX.Y.Z`。
2. `.github/workflows/release.yml` がテストを実行してビルドし、`dist/` も含むコミットへタグを
   移します。これで jsDelivr が
   `https://cdn.jsdelivr.net/gh/numero-uno-jpn/rStats.js@vX.Y.Z/dist/rstats.js` を配信できる
   ようになります (ワークフローが終わったら、`git fetch --tags --force` でローカルのタグを
   更新してください)。main ブランチには `dist/` を一切含めません。
3. 続いて、provenance 付きでその版を npm の公開待ちに入れます (`npm stage publish`)。トークンは
   使いません。npmjs.com のパッケージ設定で、このリポジトリと `release.yml` を trusted publisher
   として指定しているためです。この trusted publisher には公開待ちに入れることだけを許し、直接の
   公開は許していません。
4. メンテナーが公開待ちの版を確かめて承認すると、公開されます。npmjs.com のパッケージの
   Staged Packages タブで Approve を押すか、`npm stage approve <id>` を実行します。どちらも npm
   アカウントの二要素認証が必要です。

バージョン 0.5.0 は手作業で公開しました (provenance には CI が必要なので
`npm publish --provenance=false`)。以降のバージョンは、ワークフローと上の承認を経て公開します。
ローカルのマシンから公開するときも、npm アカウントの二要素認証が必要です。jsDelivr が配信できるように、
リポジトリは公開のままにしておく必要があります。
