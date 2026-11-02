# Issue #78 対応ログ: cor の定義されない対角を 1 にしない (#16 の判断を覆す)

GitHub Issue #78。ユーザー判断: 数学的に正しいほう (定義されない対角は NaN)。同じ点を Issue #16 で「R のまま (対角 1)」と決めていたので、それを覆すことも確認した。計画は承認済み。

## 確認 (main `64520d5`)

`cor(x)` (y なし) は、use が pairwise 以外で 2 行以上なら、対角を一律に 1 にしていた (`src/descriptive/cov.ts` の compute)。issue の「R は NA を返す」は誤りで、R 4.5.2 も 1 を返す (#16 のレビュアーと同じ誤り)。

| 呼び出し | R 4.5.2 | 修正前 | 修正後 |
|---|---|---|---|
| `cor([[1, 2], [1, 3], [1, 4]])` (1 列目が定数) | [[1, NA], [NA, 1]] | [[1, NaN], [NaN, 1]] | [[NaN, NaN], [NaN, 1]] |
| `cor([[1, 2], [NaN, 3], [4, 4]])` (everything) | [[1, NA], [NA, 1]] | 同上 | [[NaN, NaN], [NaN, 1]] |
| spearman・kendall で 1 列目が定数 | [[1, NA], [NA, 1]] | 同上 | [[NaN, NaN], [NaN, 1]] |
| `use: "complete.obs"` で NA の行を除く | 対角 1 | 1 | 1 (除いた後に定数の列なら NaN) |

定数の列の自分自身との相関は 0/0、NA を含む列は NA で、どちらも定義されない (numpy の corrcoef も nan)。

## 修正

対角を 1 にするのは、計算した自己相関が NaN でないときだけにした。分散が正の列は今と同じく 1 (丸めで 0.9999999999999998 になる値を R と同じく 1 にそろえる)。pairwise は今どおり計算した値。

- docs (英・日) の Deliberate differences の General に 1 項目足した
- `review_fix_log_issue16_17.md` に、#78 で覆したことを追記した

## テスト

- `test/issue78.test.ts`: 3 つの方法の定数の列、everything の NaN、complete.obs (1 と、除いた後に定数なら NaN)、通常の対角 1。stash で、修正前に 2 件が失敗することを確かめた
- `test/issue16_17.test.ts`: #16 の期待値を NaN に変えた
- `test/descriptive.test.ts`: R の fixture (corMatrix) の 12 件 (R 1、rStats.js NaN の対角) を、理由つきの既知の違いにした。既知の違いの関数に期待値と実際の値も渡すようにした
- 全体テスト `npx vitest run`: 2417 passed / 38 skipped、失敗 0。`npx tsc --noEmit -p .`: エラーなし
