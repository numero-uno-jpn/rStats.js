# Issue #41 対応ログ: pkolmogorovLimit のサブノーマルの x

GitHub Issue #41。計画は承認済み。

## 再現 (main `d66cc88`)

issue の例 `pkolmogorovLimit(1e-200)` は再現しない。今も下側 0・上側 1 を返す (x² が 0 になり、指数が Inf で級数は 0。前の係数 sqrt(2π)/x = 2.5e200 は有限なので、積は 0)。NaN になるのは、前の係数が溢れる x < 約 1.4e-308 (サブノーマル) のとき。

| x | 修正前 (下側, 上側) | 修正後 |
|---|---|---|
| 5e-324、1e-310、1e-308 | NaN, NaN (Inf × 0) | 0, 1 |
| 1e-200 | 0, 1 | 同じ |
| 0.05 / 0.5 / 1.5 | 2.42e-213 / 0.03605… / 0.97778… | 同じ (ビット単位) |

`pkolmogorovLimit` は package の index から公開されていない。ksTest から呼ぶ x は、0 (先に分岐) か sqrt(n) D (D は 0 か 1/(2n) 以上) なので、公開関数からは届かない。内部関数の値の誤りとして直した。R との違いではないので docs は変更しない。

## 修正

`src/htest/core/kolmogorov.ts` の x < 1 の枝で、級数 (first + s) が 0 にアンダーフローしたときは、前の係数を掛けずに下側 0・上側 1 を返す。級数が 0 になるのは x < 約 0.0407 で、そこでは今も 0 を返していたので、値が変わるのはサブノーマルの x だけ。

## テスト

- `test/issue41.test.ts`: サブノーマルの x で 0 と 1。1e-200 と通常の範囲の値は今と同じ
- stash で、修正前に失敗することを確かめた
- 全体テスト `npx vitest run`: 2336 passed / 34 skipped、失敗 1。失敗は `test/distributionProperties.test.ts` の signrank の実行時間の上限 (`dsignrank(302775, 1100)` が 1496 ms)。HANDOFF にある負荷による既知の失敗で、ファイル単独では 33 件すべて通る。`npx tsc --noEmit -p .`: エラーなし
