# Issue #35 対応ログ: データフレームの `__proto__` 列

GitHub Issue #35。計画は承認済み。

## 再現 (main `5aa1533`)

`JSON.parse` で作った、自前の `__proto__` 列を持つデータフレーム:

| 呼び出し | 修正前 | 修正後 |
|---|---|---|
| `aggregate(x, { __proto__: [...] }, f)` | 結果の列は `y` だけ。`__proto__` 列が消え、結果のプロトタイプが変わる | `__proto__` 列と `y` 列。プロトタイプは Object.prototype のまま |
| `split(x, f)` の各グループ (Map の値) | `__proto__` 列が消える | 残る |
| `naOmit(x)` | `__proto__` 列が消える (完全なケースの判定には使われていた) | 残る |

## 原因と修正

列名を `{}` にブラケットで書いていた (`out[name] = ...`)。`__proto__` は旧来のプロトタイプの setter を呼ぶので、自前の列にならない。merge・rbindFrames・cbindFrames・fromRows・pivot は、すでに `addColumn` (`src/descriptive/dataFrames.ts`、defineProperty で自前の列を作る) を使っていた。

- `src/data/grouping.ts`: `rowsOf` (split) とアグリゲートのグループの列・結果の列を `addColumn` にした。結果の列名の重複は、今と同じ RangeError を先に出す。
- `src/descriptive/missing.ts` (`naOmit`): `addColumn` にした。

ほかのデータフレームを作る箇所 (dataFrames.ts、pivot.ts) は、すでに `addColumn` を使っている。aovEz の被験者間データ (内部で lm に渡す) は列名を式の変数名としても使うので、今回の範囲の外とした。

## テスト

- `test/issue35.test.ts`: 3 つの関数で、自前の `__proto__` 列が残り、値が正しく、プロトタイプが変わらない。ふつうの列名は今と同じ
- stash で、修正前に失敗することを確かめた
- 全体テスト `npx vitest run`: 2325 passed / 34 skipped、失敗 0。`npx tsc --noEmit -p .`: エラーなし
