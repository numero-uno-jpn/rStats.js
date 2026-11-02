# Issue #158 対応ログ: 非心 F の fPair で m q ≈ n のとき x = 0

GitHub Issue #158。夜間の自律修正 (Plan モードの代わりに計画をここに書く)。#135 (`731b15c`) で同じ nbeta.ts の `logRatio`・`tinyFx` が変わった後の main で確かめた。

## 計画

- 意図: 非心 F のベータの座標 x = m q/(n + m q) を作る `fPair` は、m q ≥ 1e290 (または溢れる) なら一律に 1 − x = zc = n/m/q、x = 1 − zc とする。zc が小さいという前提だが、判定していない。m q と n が同じ規模だと誤る (zc = 1 で x = 0、正しくは 1/2)
- 方法: zc < 2^-106 (1 − x = zc の相対誤差が double-double の精度より小さい) のときだけ今の近道。それ以外は r = n/(m q) を double-double で作り、x = 1/(1 + r)、1 − x = r/(1 + r) (issue の案)。r は m と q の大きい方で先に割る (m q ≥ 1e290 なので n/max(m, q) は double の範囲に収まり、r ≤ 1.8e18)
- 選んだ理由: issue の案どおり。近道に入る入力 (zc < 2^-106) はビットが変わらない。近道の外は今まで誤った x を使っていた

## 確認 (main `4e9677d`)

参照: n が巨大で ncp が小さいとき、裾は e^-1e289 規模で、ncp の寄与は log で相対 1e-280 程度。中心 F (#116 で直した経路) の値と一致するはず。x = 1/2 の上側の log の主要項は −n log(2)/2 (B ≈ n t の t を最適化した大偏差)。

| 呼び出し (log) | R 4.5.2 | 修正前 | 修正後 | 参照 (中心 F) |
|---|---|---|---|---|
| pf(1e290, 1, 1e290, ncp = 1, upper) | -Inf | 0 | -3.4657359027997267e289 | -3.4657359027997267e289 |
| df(1e290, 1, 1e290, ncp = 1) | NaN | NaN | -3.4657359027997267e289 | -3.4657359027997267e289 |
| pf(2e290, 1, 1e290, ncp = 5, upper) (x = 2/3) | -Inf | -3.4657e289 (x = 1/2 の値) | -5.4930614433405495e289 | -5.493061443340549e289 |
| pf(1e289, 10, 1e290, ncp = 3, upper) | -Inf | 0 | -3.4657359027997267e289 | 同じ |
| pf(1e295, 1, 3e295, ncp = 2, upper) (x = 1/4) | | | -4.315231086776713e294 | -4.315231086776714e294 |

## 修正

- `src/distributions/nbeta.ts` の `fPair`: 上の近道の判定と r/(1 + r) の形
- docs (英・日) の非心分布の表に 1 行 (R は -Inf と NaN)

## テスト

- `test/issue158.test.ts`: 上の 4 例で上側の log と log 密度が中心 F と相対 1e-14、下側が 1、x = 1/2 の主要項。stash で、修正前に失敗することを確かめた
- 全体テスト `npx vitest run`: 262 files、2526 passed / 38 skipped、失敗 0。`npx tsc --noEmit -p .`: エラーなし (テストの型を直してから流し直した)

## 範囲外として記録 (issue の例はまだ誤り)

issue の例 `pf(1e200, 1e100, 1e300, ncp = 1e300)` は、fPair の x は正しくなった (1/2) が、値はまだ誤り。両方の形状 (a = 5e99、b = 5e299) と ncp が巨大な非心ベータの計算 (`pnbetaRaw`・`densitySum`) が、この規模で働いていない。

- issue の「約 1/2」は正確でない。分布は相対 2e-150 の幅に集中し、中心 (m + λ)/m と q の double の値の差は相対 -6.7e-17 (Python の Fraction で m q − (m + λ))。z ≈ -2.7e133 で、下側の log は約 −z²/2 ≈ −3.7e266、上側の log は約 −0
- rStats.js: 修正前は下側 log −Inf、上側 log −5e299、log 密度 NaN。修正後は下側 log −5e299 (≈ −λ/2、Poisson の j = 0 の重みだけ)、上側 log −4.5e286、log 密度 −1.36e287。どちらも誤り (両側の和が 1 にならない)
- 同じ種類: pf(1, 1e290, 1e290, ncp = 1) (正しくは約 0.5、R は 0.5) と pf(1, 1e300, 1e300, ncp = 1e150) (正しくは Φ(−0.5) ≈ 0.3085) が、修正の前後とも下側・上側とも 0
- 直すには、a と b がともに巨大な非心ベータに、正規近似か鞍点近似の経路が要る (経路の設計の変更)。この issue は close せずに残すか、別の issue にするかはユーザーの判断

## close comment

Fixed in <commit of #158, see git log --grep='#158'>: fPair now keeps 1 - x = n/(m q) only where that ratio is below 2^-106 (bits unchanged there); otherwise x = 1/(1 + r) and 1 - x = r/(1 + r) with r = n/(m q) in double-double, dividing by the larger of m and q first. Where df1 is moderate this gives the right tails: pf(1e290, 1, 1e290, ncp = 1, lowerTail = false, logP) is now -3.4657359027997267e289 (was 0; the central F gives the same, -n log(2)/2 to leading order) and df(..., log) the same (was NaN); R gives -Inf and NaN, recorded in docs/differences-from-r.md. Test: test/issue158.test.ts. The issue's own example, pf(1e200, 1e100, 1e300, ncp = 1e300), is still wrong: x is now 1/2, but the noncentral beta with both shapes and ncp near 1e300 is not handled (log lower -5e299, log upper -4.5e286; the answer is about -3.7e266 and -0, since q lies 6.7e-17 relative below the center (m + ncp)/m, far beyond the 2e-150 spread). Likewise pf(1, 1e290, 1e290, ncp = 1) is 0 (about 0.5). Recorded in review_fix_log_issue158.md for a separate issue. (Not pushed yet.)
