# Issue #164 対応ログ: 逆ガウス分布の deviance の寄与が有限の値で Inf

GitHub Issue #164。夜間の自律修正 (Plan モードの代わりに計画をここに書く)。

## 計画

- 意図: `inverseGaussianDev` の w (y − μ)²/(y μ²) で、(y − μ)² か y μ² が溢れる、または y μ² がアンダーフローすると、有限の寄与が Infinity・NaN (や桁の落ちた値) になる。逆ガウス分布と、分散 "mu^3" の quasi が使う
- 方法: 今の式の結果が有限で、分母 y μ² が正規化数の範囲 (絶対値 ≥ 2^-1022) ならそのまま。それ以外は d = (y − μ)/μ として w (d²/y)
- 選んだ理由: issue の案 (比の形)。今の式が範囲内の入力はビットが変わらない。分母のアンダーフローも同じ式の同じ種類の範囲外 (0 になると Inf か 0/0 の NaN、サブノーマルでは 3e-13 ずれる) なので、条件に含めた

## 確認 (main `3e16abe`)

issue の指摘どおり。R 4.5.2 の `inverse.gaussian()$dev.resids` も NaN・Inf (R は μ^2 を先に作る)。

| y | μ | R | 修正前 | 修正後 | 参照 |
|---|---|---|---|---|---|
| 1e-308 | 1e308 | NaN | Infinity | 1e308 | ≈ 1/y |
| 1e-200 | 1e-200 | NaN | NaN | 0 | 0 |
| 1e-200 | 2e-200 | NaN | NaN | 2.5e199 | 0.25/y |
| 1e-150 | 2e-150 | Inf | Infinity | 2.5e149 | 0.25/y |
| 1e-104 | 2e-104 | 2.500000000000747e103 | 2.5000000000007484e103 | 2.5e103 | 0.25/y |
| 2 | 3 | 0.055555555555555554 | 0.05555555555555555 | 同じ | |
| 1e200 | 3e200 | NaN | NaN | 4.444444444444445e-201 | (4/9)/y |
| 0.5 | 1e300 | NaN | NaN | 2 | ≈ 1/y |
| 1e-308 (w = 0) | 1e308 | NaN | NaN | 0 | |

## 修正

`src/models/glmFamily.ts` の `inverseGaussianDev`。docs (英・日) の differences-from-r の glm の表に 1 行。

## テスト

- `test/issue164.test.ts`: 上の表 (相対 1e-15)、重み 0、quasi の "mu^3"、以前の値。stash で、修正前に 2 件中 1 件が失敗することを確かめた
- 全体テスト `npx vitest run`: 2515 passed / 38 skipped、失敗 0。`npx tsc --noEmit -p .`: エラーなし

## 範囲外として記録

- 逆ガウス分布の AIC (`familyAic`) の `log((2 * Math.PI * dev) / sw)` は、deviance が 1e308 規模だと 2π dev が溢れる (log の差にすれば避けられる)。今回の寄与の修正で、そうした deviance が有限になりうる。誤答の具体例 (当てはめが収束する場合) は確かめていない

## close comment

Fixed in <commit of #164, see git log --grep='#164'>: where w (y - mu)^2 / (y mu^2) is not finite, or y mu^2 is below the normal range, the inverse Gaussian deviance contribution (also used by quasi with variance "mu^3") is now w ((y - mu)/mu)^2 / y; elsewhere the bits are unchanged. makeFamily("inverse.gaussian").devContribution(1e-308, 1e308, 1) is now 1e308 (was Infinity); (1e-200, 2e-200, 1) is 2.5e199 and (0.5, 1e300, 1) is 2 (both were NaN). R's dev.resids gives NaN or Inf there, recorded in docs/differences-from-r.md. Test: test/issue164.test.ts. (Not pushed yet.)
