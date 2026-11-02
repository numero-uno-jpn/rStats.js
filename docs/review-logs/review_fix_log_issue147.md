# Issue #147 対応ログ: dnchisq の df = 0 でサブノーマル補正の指数が誤り

GitHub Issue #147。夜間の自律修正 (Plan モードの代わりに計画をここに書く)。

## 計画

- 意図: 非心 χ² の密度は、x/2 が丸まるサブノーマルの x (2^-1074 の奇数倍) で、x2 = 2 (x/2) の密度に (x/x2)^(df/2 − 1) を掛ける (`subnormalHalf`)。これは混合の j = 0 の成分 (y^(a−1)) が支配するという前提で、df = 0 (j = 0 の成分がない。j = 1 の成分は y^a ≈ 1) では誤り。`dchisq(3 · 2^-1074, 0, ncp = 1)` が 0.2022 (正しくは 0.1516)
- 方法: j = 0 と j = 1 の 2 成分を両方入れる。x2 での比 ρ = a/(μ y2) から、x の密度 = x2 の密度 × r^(a−1) (ρ + r)/(ρ + 1)、r = x/x2。df = 0 では ρ = 0 で係数 r^a = 1。ρ > 2^60 では補正が double の精度より小さいので掛けない (今までのビット)
- 選んだ理由: issue の案 (df = 0 で指数を 0) は df = 0 だけを直すが、確かめるとサブノーマルの df (a が μ y と同じ規模) でも同じ前提が崩れていた (df = 4 · 2^-1074、x = 3 · 2^-1074 で 0.6065、正しくは 0.5560)。2 成分の式は両方を同じ形で直し、df = 0 では issue の案と同じになる。j ≥ 2 の成分は j = 1 に対して μ y 程度 (1e-15 以下) で無視できる。ρ は a/(x2/2)/μ の順に割る (log の差で作ると log 2^-1073 の丸めで ρ が 1e-13 ずれ、結果が 3e-15 ずれた)

## 確認 (main `d94b9a7`)

参照: Rmpfr (300 ビット) で Σ_j dpois(j, λ/2) dchisq(x, df + 2j)、x と df は 2^-1074 の整数倍として厳密に。

| 呼び出し (ncp = 1) | R 4.5.2 | 修正前 | 修正後 | 参照 |
|---|---|---|---|---|
| dchisq(3 · 2^-1074, 0) | 0 | 0.2021768865708778 | 0.15163266492815836 | 0.15163266492815836 |
| dchisq(5 · 2^-1074, 0) | 0 | 0.1213061319425267 | 0.15163266492815836 | 同上 |
| dchisq(7 · 2^-1074, 0) | 0 | 0.17329447420360955 | 0.15163266492815836 | 同上 |
| dchisq(1001 · 2^-1074, 0) | 0 | 0.1514811837444139 | 0.15163266492815833 | 同上 |
| dchisq(3 · 2^-1074, 4 · 2^-1074) | 0.6065306597126334 | 0.6065306597126333 | 0.5559864380699139 | 0.55598643806991397 |
| dchisq(5 · 2^-1074, 4 · 2^-1074) | 0.36391839582758007 | 0.36391839582758 | 0.3942449288132117 | 0.3942449288132117 |
| dchisq(1001 · 2^-1074, 4 · 2^-1074) | | 0.15269303321436928 | 0.15284451439811367 | 0.15284451439811367 |
| dchisq(7 · 2^-1074, 1e-310) | | 876879801613.1185 | 876879801613.0969 | 876879801613.05359 |
| dchisq(3 · 2^-1074, 1e-300)、df = 1、3、0.5 | | | 修正前と同じビット | |

R は df = 0 で x > 0 の密度を 0 にする (既に docs に記録済みの違い)。

## 修正

- `src/distributions/nchisq.ts` の `dnchisqRaw`: サブノーマルの補正に `mix = log1p((x − x2)/x2/(ρ + 1))` を足す (ρ < 2^60 のときだけ)
- docs (英・日) の非心分布の表: df = 0 の行に x = 1.5e-323 を追記、サブノーマルの df の行を 1 行

## テスト

- `test/issue147.test.ts`: df = 0 で極限 e^-1/2/4、df = 4 · 2^-1074 で Rmpfr の値 (相対 2e-15、線形と log)、j = 0 が支配する入力は修正前のビット。stash で、修正前に 3 件中 2 件が失敗することを確かめた
- 全体テスト `npx vitest run`: 260 files、2523 passed / 38 skipped、失敗 0。`npx tsc --noEmit -p .`: エラーなし

## 範囲外として記録

- `a = df / 2` が丸まるサブノーマルの df (2^-1074 の奇数倍)。df = 2^-1074 では a = 0 になり (偶数丸め)、`dchisq(2 · 2^-1074, 2^-1074, ncp = 1)` が 0.15163 (正しくは 0.30327)。df = 405 · 2^-1074 で a = 202 · 2^-1074、`dchisq(3 · 2^-1074, df)` が 40.99 (正しくは 41.09)。密度の j = 0 の成分が a/y に比例するので、a の丸めがそのまま出る。直すには a を使わずに df/x の形で j = 0 の成分を作る必要がある (経路の変更)
- `dchisq(8 · 2^-1074, 1e-310, ncp = 1)` が 767269826411.4788 (参照 767269826411.44085、相対 5e-14)。x2 での混合そのものの精度で、今回の補正とは別。上の表の 1e-310 の行の残りの誤差もこれ

## close comment

Fixed in <commit of #147, see git log --grep='#147'>: for a subnormal x whose x/2 rounds, the noncentral chi-square density at x now comes from that at x2 = 2 (x/2) with both the j = 0 and j = 1 terms of the Poisson mixture: the factor r^(a - 1) (rho + r)/(rho + 1), r = x/x2, rho = a/(mu y2) their ratio at x2. For df = 0 (no j = 0 term) the factor is 1, as the issue suggests; it also fixes a subnormal df, where the j = 1 term is comparable (dchisq(3 * 2^-1074, 4 * 2^-1074, ncp = 1) was 0.6065306597126333, now 0.5559864380699139; Rmpfr 0.55598643806991397). Where rho > 2^60 the bits are unchanged. dchisq(3 * 2^-1074, 0, ncp = 1) is now 0.15163266492815836 (was 0.2021768865708778), the limit e^-1/2/4. R gives 0 for df = 0 and 0.6065 for the subnormal df, recorded in docs/differences-from-r.md. Test: test/issue147.test.ts. Recorded for later: a = df/2 itself rounds for odd multiples of 2^-1074 (df = 2^-1074 gives a = 0), which the density reflects. (Not pushed yet.)
