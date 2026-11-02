# Issue #52 対応ログ: mulDD の大きな因数の積の誤差の項

GitHub Issue #52。計画は承認済み。

## 再現 (main `9e7ee74`)

`mulDD` (`src/internal/ddexp.ts`) は、どちらかの因数が 1e300 を超えると、積が有限でも `[a * b, 0]` を返していた。`locationScale` (location + scale · t を double-double で作る。cauchy・laplace・logistic が使う) で積と location が打ち消すと、捨てた誤差の項がそのまま結果の誤差になる。

| 呼び出し | 修正前 | 修正後 |
|---|---|---|
| `mulDD(1e308, 1e-308)` | [0.9999999999999999, 0] | [0.9999999999999999, 3.132799142920457e-17] (`twoProd` と同じ) |
| `locationScale(-1, 1e308, 1e-308)` | −1.1102230246251565e-16 | −7.969431103331108e-17 (issue の高精度の値と一致) |
| `locationScale(1, -1e308, 1e-308)` | 1.1102230246251565e-16 | 7.969431103331108e-17 |
| `locationScale(-1, 1e300, 1e-300)` (判定のすぐ下) | 7.756385209041318e-17 | 同じ |

## 原因と修正

`twoProd` (`src/special/dd.ts`) は、Veltkamp の分割が溢れる因数でも、2 の冪で縮めて分割する `prodErrScaled` で誤差の項を返す。`mulDD` の 1e300 の判定は、これが入る前のものとみられる。`mulDD` を `twoProd` に任せるようにした (積が有限でないときは `twoProd` も `[p, 0]` を返す)。値が変わるのは、因数のどちらかが 1e300 を超え、積が有限の場合だけ。R との違いではないので docs は変更しない。

## テスト

- `test/issue52.test.ts`: 上の locationScale の 2 例。1e300 の上下と最大の double を含む 5 組で、積 + 誤差の項が厳密な積に等しいこと (BigInt で仮数と指数から確かめる)。積が溢れる場合は [Inf, 0] のまま
- stash で、修正前に 2 件が失敗することを確かめた
- 全体テスト `npx vitest run`: 2356 passed / 34 skipped、失敗 1。失敗は `test/distributionProperties.test.ts` の signrank の実行時間の上限 (`dsignrank(302775, 1100)` が 1278 ms)。HANDOFF にある負荷による既知の失敗。`npx tsc --noEmit -p .`: エラーなし
