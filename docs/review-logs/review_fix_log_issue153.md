# Issue #153 対応ログ: ptukey の遠い上側の裾で log(k(k − 1)) が溢れる

GitHub Issue #153。夜間の自律修正 (Plan モードの代わりに計画をここに書く)。

## 計画

- 意図: w > 100 の 1 − W = k(k − 1) Φc(w/√2) の log で、組の数 k(k − 1) が溢れる (k ≳ 1.3e154) と log が +Inf になり、上側確率が Inf・下側の log が NaN になる。有限の負の log を返す
- 方法: `logRangeCdfC` で積 k(k − 1) が有限ならこれまでどおり `Math.log(k * (k - 1))`、溢れたときだけ `Math.log(k) + Math.log(k - 1)`
- 選んだ理由: issue の提案どおり log の和にするが、常に和にすると通常の k で最後のビットが変わりうるので、溢れたときだけにする (方針「通常の範囲の値は 1 ビットも変えない」)。漸近形の相対的な補正は約 k e^(−w²/12) で、k が最大の double でも e^(709 − 850) と無視できるので、式はそのまま使える

## 確認 (main `6e8412d`)

issue の指摘どおり。R 4.5.2 は log の上側を log(0) = −Inf で返す (k = 10 でも同じ。この違いは docs の既存の ptukey の行で記録済み)。

| 呼び出し | R | 修正前 | 修正後 | 参照 (下記) |
|---|---|---|---|---|
| ptukey(101, 1e200, Inf, 上側, log) | −Inf | Inf | −1634.4036442253516 | −1634.4036442253516 |
| ptukey(101, 1e200, Inf, 上側) | 0 | Inf | 0 | |
| ptukey(101, 1e200, Inf, log) | 0 | NaN | −0 | |
| ptukey(150, 1e308, Inf, 上側, log) | | Inf | −4212.190671821832 | −4212.1906718218324 (%.17g) |
| ptukey(101, 1e200, 1e6, 上側, log) | | Inf | −1627.9193563928973 | |

参照: R で `log(k) + log(k - 1) + pnorm(w/sqrt(2), lower.tail = FALSE, log.p = TRUE)` (漸近形そのもの。補正は上のとおり無視できる)。

## 修正

`src/distributions/tukey.ts` の `logRangeCdfC` の w > 100 の枝。積が有限な k (≲ 1.3e154) では同じビット。

## テスト

- `test/issue153.test.ts`: 上の表 (相対 1e-15)、有限の df (1e6) の外側の積分が df = Inf の値の近く、k = 10・1e6 は以前と同じビット。stash で、修正前に 2 件中 1 件が失敗することを確かめた
- 全体テスト `npx vitest run`: 2503 passed / 38 skipped、失敗 0。`npx tsc --noEmit -p .`: エラーなし

## 範囲外として記録

確認の掃引 (k = 10〜1e308、q = 50〜1000、df = Inf・1e6・100) で、巨大な k の別の経路の誤りが見つかった。修正していない。
- df = 100 で k ≥ 1e100 は NaN か Inf (例: ptukey(50, 1e100, 100) は上側・log ともに NaN、ptukey(101, 1e200, 100, 上側) は Inf)。外側の積分の側
- w ≤ 100 の積分の経路で k ≈ 1e308: ptukey(61, 1e308, Inf, 上側, log) = 430.8 (正の log。上側確率 1.2e187)。df = 1e6 も同じ
- ptukey(50, 1e155, 1e6, 上側) = 1.0000000000000009 (1 を超える)、下側の log は NaN
- `rangeCdfC` の「w > 60 で 1 − W < k² Φc(w/√2) < 1e-300」は巨大な k では成り立たない (k = 1e200、w = 61 で約 6e-7)。線形が 0 でも log の経路に回るので、見た範囲では結果は正しかった (ptukey(61, 1e200, Inf, 上側) = 6.06e-7)

## close comment

Fixed in <commit of #153, see git log --grep='#153'>: for w > 100 the log of the pair count k(k - 1) is formed as log(k) + log(k - 1) only where the product overflows (k above about 1.3e154); below that the bits are unchanged. ptukey(101, 1e200, Inf, upper, log) is now -1634.4036442253516, equal to log(k) + log(k - 1) + log Phic(101/sqrt(2)) from R; the linear upper tail is 0 and the lower log is 0. Test: test/issue153.test.ts. Other paths with a huge nmeans (finite df such as 100, and w <= 100 near k = 1e308) still go wrong; recorded in review_fix_log_issue153.md. (Not pushed yet.)
