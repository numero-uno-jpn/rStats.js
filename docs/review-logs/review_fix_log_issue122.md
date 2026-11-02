# Issue #122 対応ログ: integrate が区間を半分の座標にするとき、正の absTol を 0 に落とす

GitHub Issue #122。エラーの種類を R と同じにする修正 (docs は不要)。計画は承認済み。

## 確認 (main `ed4986a`)

`src/numerics/integrate.ts` は、端点の 2 倍が溢れる有限区間を u = x/2 の座標で解き、absTol も半分にする。absTol = MIN では MIN × 0.5 = 0 になり、dqagse が入力を不正 (ier 6) とみなしていた。issue の指摘どおり。

| integrate(() => 1e-308, −1e308, 1e308, relTol = 0) | R 4.5.2 | 修正前 | 修正後 |
|---|---|---|---|
| absTol = MIN | "roundoff error was detected" | "the input is invalid" | "roundoff error was detected" |
| absTol = 2 MIN | | "roundoff error was detected" | 同じ |
| absTol = 1e-10 | | 2.0000000000000004 | 同じ |

issue の「期待値 2」にはならない。MIN は達成できない精度で、正しいのは R と同じ丸め誤差のエラー (有限の区間 (0, 2) の absTol = MIN も同じエラー)。

## 修正

半分にした absTol が 0 に落ちる (absTol > 0) ときは Number.MIN_VALUE にする。それ以外は以前と同じ。

## テスト

- `test/issue122.test.ts`: absTol = MIN と 2 MIN が "roundoff error was detected"、absTol = 1e-10 で 2 (1e-10 以内)。stash で、修正前に 2 件中 1 件が失敗することを確かめた (最初は積分値を厳密に 2 としていたが、求積の丸めで 2.0000000000000004 になるので許容誤差で比べた)
- 全体テスト `npx vitest run`: 2497 passed / 38 skipped、失敗 0。`npx tsc --noEmit -p .`: エラーなし
