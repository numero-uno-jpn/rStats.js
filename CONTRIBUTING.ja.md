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
2. `src/` に置く実装。`src/index.ts` から export する。
3. `test/<name>.test.ts`: フィクスチャに対して実装を実行し、相対誤差を確かめる。

フィクスチャを生成し直すには、Docker 上の R が必要です。

```sh
npm run oracle -- <oracle name>     # 例: npm run oracle -- gamma
```

`scripts/oracle.sh` は、使い捨てのコンテナ (`docker run --rm --network none`) で `Rscript` を
実行します。イメージは既定で `rstats-oracle` です (`RSTATS_ORACLE_IMAGE` で変更できます)。
このイメージには、R 4.5.2 とパッケージ `jsonlite`、`Rmpfr`、`gmp`、`MASS` が必要です。R の
メッセージは `LANGUAGE=en` で英語に固定しているので、フィクスチャに記録されるエラーメッセージは
ロケールに左右されません。

乱数のフィクスチャは、x86_64 版の R (`--platform linux/amd64` の `rocker/r-ver:4.5.2`。
oracle には `# oracle-platform: amd64` と印を付ける) で生成します。arm64 版では一部の関数で
最後のビットが異なるためです。線形代数のフィクスチャには、R が使った LAPACK と BLAS の
バージョンを `info` ブロックに記録します (現在のフィクスチャは OpenBLAS 0.3.26 と
LAPACK 3.12.0 で作成)。BLAS が違うと最後の数ビットが変わることがあるためです。

R のフィクスチャがまだ生成されていない関数 (R のない環境で作業したもの) は、mpmath による高精度の
値と照合します。`scripts/mpmath/<name>.py` が `test/fixtures/<name>.mpmath.json` を書き出し
(`python3 -I scripts/mpmath/<name>.py`。`pip install mpmath` が必要)、`oracle/<name>.R` を実行すると
テストは自動的に R との照合も行います。

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

- **R や GPL のパッケージのコードを、コピーも翻訳もしないこと。** R は oracle として
  (出力を観察するために) だけ使います。R の `src/nmath`、推奨パッケージ、TOMS 708 も
  これに含みます。
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
- 公開 API のドキュメント (export するシンボルの TSDoc)、内部のコメント、`docs/` の文書は英語で
  書きます。
- エラーは、型や形が誤っているときは `TypeError`、値が範囲外のときは `RangeError`、数値計算が
  失敗したときは `Error` にします。メッセージは英語です。

## リリース

1. `NOT_IN_DEMO_YET` (`test/demo.test.ts`) に挙げた export のデモ例を追加して、このリストを空に
   します (`npm run demo:r` が必要)。`package.json` の `version`、`CHANGELOG.md` の日付、`demo/app.js` の `VERSION` (デモが
   jsDelivr から読み込むタグ) を更新してコミットし、タグを付けて push します:
   `git tag v0.5.0 && git push origin v0.5.0`。
2. `.github/workflows/release.yml` がテストを実行してビルドし、`dist/` も含むコミットへタグを
   移します。これで jsDelivr が
   `https://cdn.jsdelivr.net/gh/numero-uno-jpn/rStats.js@v0.5.0/dist/rstats.js` を配信できる
   ようになります (ワークフローが終わったら、`git fetch --tags --force` でローカルのタグを
   更新してください)。main ブランチには `dist/` を一切含めません。
3. 続いて、provenance 付きで npm に公開します。トークンは使いません。npmjs.com のパッケージ設定で、
   このリポジトリと `release.yml` を trusted publisher として指定しているためです。

バージョン 0.5.0 は手作業で公開しました (provenance には CI が必要なので
`npm publish --provenance=false`)。以降のバージョンはワークフローが公開します。ローカルの
マシンから公開するには、npm アカウントの二要素認証が必要です。jsDelivr が配信できるように、
リポジトリは公開のままにしておく必要があります。
