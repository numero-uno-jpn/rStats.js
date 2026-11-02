# Issue #63 対応ログ: 非心ベータの ncp/2 が 0 にアンダーフローすると NaN

GitHub Issue #63。計画は承認済み。

## 再現 (main `91814ed`)

`pbeta(0.5, 1e14, 2, { ncp: Number.MIN_VALUE })` が NaN。`method` は "gamma" を選び、`pnbetaRaw` は先に `leftTailLog` (`src/distributions/nbeta.ts`) を呼ぶ。そこで mu = ncp/2 が 0 になり、lmu = log(0) = −Inf、j = 0 の項の `j * lmu` が 0 × −Inf = NaN になる。NaN は undefined ではないので、そのまま結果になる。issue の説明どおり。

同じ `pnbetaRaw` を通る pf・qbeta・qf も誤っていた。

| 呼び出し (ncp = 5e-324) | 修正前 | 修正後 | 中心分布 | R 4.5.2 |
|---|---|---|---|---|
| `pbeta(0.5, 1e14, 2)` | NaN | 0 | 0 | 0 |
| `pbeta(0.5, 1e14, 2, upper, log)` | NaN | −0 | −0 | 0 |
| `pbeta(1 − 1e-13, 1e14, 2)` | NaN | 0.0004979895119127487 | 0.0004979895119127488 | 0.00049798951191275034 |
| `pf(1, 2e14, 4)` | NaN | 0.4060058497098408 | 0.4060058497098408 | 0.40600584970984137 |
| `qbeta(0.5, 1e14, 2)` | 0.9999999999999999 | 0.9999999999999832 | 0.9999999999999832 | 0.99999999999998366 |
| `qf(0.5, 2e14, 4)` | 1.7976931348623157e308 | 1.191648694755391 | 1.191648694755391 | 1.2171890884784926 |

ncp = 5e-324 の真の値と中心分布の値の違いは e^(−2.5e-324) の程度なので、正しい値は中心分布と同じ double。R も NaN を返さず、中心分布の値に近い (末尾の違いは R の非心の算法の誤差)。qf だけは R の非心の値 1.2171890884784926 が誤りで、R の中心の `qf(0.5, 2e14, 4)` は 1.191648694755395 (rStats.js の中心の qf 1.191648694755391 と相対 3e-15 の違い。中心の qf の比較はこの issue の範囲外)。

ほかの非心分布 (pchisq・qchisq・dchisq・pt・qt・dt)、dbeta・df、小さな形状で "mixture" を通る pbeta では NaN にならなかった (dnbeta・dnf は先に `negligibleNcp` で中心に回る)。

## 修正

`leftTailLog` で、`Math.log(mu)` の前に `mu === 0` なら `betaIncDD(a, b, xd, xcd, true, true)` (log I_x(a, b)) を返す。S = Σ_j (λ/2)^j/j! I_x(a + j, b) は mu = 0 で第 1 項だけになり、log P = −0 + log I_x(a, b) なので厳密。入口 (pnbeta1・pnf1・qnbeta1) で中心分布に回すより、pbeta・pf・qbeta・qf の全経路を 1 か所で直せる。mu > 0 (サブノーマルを含む) では lmu が有限なので、計算は以前と同じ。R との違いではないので docs は変更しない。

## 精度について

非心の経路は log I_x(a, b) を exp するので、中心の pbeta と最後の 1 ビット違うことがある。`pbeta(1 − 1e-13, 1e14, 2)` を Rmpfr で I_x(a, 2) = x^a (1 + a(1 − x)) (x は double の値そのもの) から求めると 0.0004979895119127488702…。中心の pbeta (…488) の相対誤差は 4.1e-17、非心の経路 (…487) は 2.6e-16。修正前から ncp = 2 × 5e-324 (mu > 0) でも同じ …487 で、非心の経路のふだんの精度の範囲。

## テスト

- `test/issue63.test.ts`: pbeta の lower/upper × log × 2 点、pf の 2 通りが中心分布と相対 1e-15 以内 (NaN でない)。qbeta・qf が中心の分位点と一致。ncp = 5e-324 と 2 × 5e-324 の結果が同じ
- stash で、修正前に 4 件すべてが失敗することを確かめた
- 全体テスト `npx vitest run`: 2382 passed / 34 skipped、失敗 0。`npx tsc --noEmit -p .`: エラーなし
