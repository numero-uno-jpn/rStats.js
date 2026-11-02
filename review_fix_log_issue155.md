# Issue #155 対応ログ: pwr2p2nTest で n1 n2 が溢れる

GitHub Issue #155。夜間の自律修正 (Plan モードの代わりに計画をここに書く)。

## 計画

- 意図: 実効的な標本サイズ n1 n2 / (n1 + n2) の積 n1 n2 が有限の巨大な標本サイズ (≳ 1e154) で溢れ、検出力が 1 になる。正しい値にする
- 方法: 積が有限なら今の式のまま。積が溢れ、n1・n2 がともに有限のときだけ、a = min、b = max として a / (1 + a/b)。無限の標本サイズは今のまま (pwr と同じ NaN)
- 選んだ理由: issue の案どおり。溢れたときだけにして通常の入力は同じビット (方針)。pwr も 1 を返すので R と違う値になるが、方針「正しい値を優先」と、pwr の非心度の溢れ (`pwr.chisq.test(w = 1e200)` など、docs 記録済み) と同じ種類の扱い。無限の n は極限 (n2) を返す案もあるが、範囲外なので変えない

## 確認 (main `570fc9f`)

issue の指摘どおり。pwr 1.3-0 (R 4.5.2) も 1。

| 呼び出し | pwr | 修正前 | 修正後 | 参照 |
|---|---|---|---|---|
| pwr2p2nTest(h = 1e-100, n1 = n2 = 1e200) | 1 | 1 | 0.10895461755061556 | 0.10895461755061557 (R の pnorm で、ずれ sqrt(0.5) の両側の検出力) |
| pwr2p2nTest(h = 1e-150, n1 = n2 = 1e300) | 1 | 1 | 0.10895461755061556 | 同上 |
| pwr2p2nTest(h = 0.3, n1 = 1e300, n2 = 100) (積は有限) | 0.85083876832705627 | 0.8508387683270562 | 同じ | |
| pwr2p2nTest(h = 0.3, n1 = Inf, n2 = 100) | NaN | NaN | NaN | |

## 修正

`src/htest/pwr.ts` の `pwr2p2nTest` に `effectiveN` を足し、`powerOf` が使う (検出力、sigLevel などを解く場合も同じ関数を通る)。docs (英・日) の differences-from-r の pwr の溢れの行の下に 1 行。

## テスト

- `test/issue155.test.ts`: 上の表 (相対 1e-14)、sigLevel を解く場合、積が有限な場合と無限の n は以前の値。stash で、修正前に 2 件中 1 件が失敗することを確かめた
- 全体テスト `npx vitest run`: 2507 passed / 38 skipped、失敗 0。`npx tsc --noEmit -p .`: エラーなし

## 範囲外として記録

- h を解く場合は区間 [1e-10, 10] (pwr と同じ) なので、n1 = n2 = 1e200 で power = 0.5 の h (約 2.3e-100) は区間の外で "f() values at end points not of opposite sign" (pwr も同じ区間)
- 無限の標本サイズ (n1 = Inf) は NaN のまま (極限は n2 の 1 群の検出力)

## close comment

Fixed in <commit of #155, see git log --grep='#155'>: where n1 n2 overflows (finite sizes above about 1e154), the effective size n1 n2 / (n1 + n2) is formed as a / (1 + a/b) with a = min, b = max; elsewhere the bits are unchanged, and an infinite size stays NaN as in pwr. pwr2p2nTest({ h: 1e-100, n1: 1e200, n2: 1e200 }).power is now 0.10895461755061556 (the two-sided power for a shift of sqrt(1/2): 0.10895461755061557 from R's pnorm); pwr gives 1, recorded in docs/differences-from-r.md. Test: test/issue155.test.ts. (Not pushed yet.)
