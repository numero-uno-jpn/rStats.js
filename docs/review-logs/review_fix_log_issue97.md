# Issue #97 対応ログ: split・aggregate の __proto__ 列 (再現しない)

GitHub Issue #97。判定: 再現しない (not planned)。コードの変更なし。

## 確認 (main `d7c4035`)

issue の主張: `src/data/grouping.ts` の `rowsOf` (split)、`aggregateRows` のグループ列と `setColumn` (集計の列) が、列名を普通のオブジェクトに代入するので、`__proto__` という列が自分自身の列にならず、結果のプロトタイプが変わる。

今のコードは、3 か所とも `addColumn` (`Object.defineProperty` で自分自身の列にする) を使っている。Issue #35 で直してある (`9616caf`、2026-11-02)。issue の行番号のコードは修正前のものと思われる (#67・#88 と同じ)。

issue の再現手順 (`Object.defineProperty` で `__proto__` 列を作ったデータ) を実行した結果:

| 呼び出し | 結果 |
|---|---|
| `split(data, ["a", "b"]).get("a")` | キー ["__proto__"]、自分自身の列 [10]、プロトタイプは Object.prototype のまま |
| `aggregate({ y: [1, 2] }, by, (v) => v.length)` (グループ列が `__proto__`) | キー ["__proto__", "y"]、`__proto__` = ["a", "b"]、y = [1, 1]、プロトタイプは変わらない |
| 集計の関数が `__proto__` という名前の結果を返す場合 | 列 "y.__proto__" (列名は値の列名との連結で、`__proto__` 単独にはならない) |

回帰テストは `test/issue35.test.ts` にある (aggregate・split・naOmit)。

## 判定

修正済み。変えない。
