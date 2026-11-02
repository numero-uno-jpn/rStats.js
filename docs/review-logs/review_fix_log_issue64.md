# Issue #64 対応ログ: 非心 χ² の mixture の添字が 2^53 を超えると止まる (再現しない)

GitHub Issue #64。判定: 再現しない。コードは変更しない (not planned)。

## 主張

`pchisq(9e-301, 1, { ncp: 1e308 })` で、`sumLower` の出発点 J が μ = 5e307 の近く (2^53 を大きく超える) になり、`for (let j = J; j >= 0; j--)` の `j--` で j が変わらず止まる、という主張。レビュアーはソースを読んだだけで、実行していない。

## 確認 (main `bdfd058`)

issue の例は止まらない。

| 呼び出し | rStats.js | 時間 | R 4.5.2 |
|---|---|---|---|
| `pchisq(9e-301, 1, ncp = 1e308)` | 0 | 1ms | 0 |
| 同 `log.p = TRUE` | −5.000000000000001e307 | 7ms | −Inf |
| 同 `lower.tail = FALSE` | 1 | | 1 |
| 同 `lower.tail = FALSE, log.p = TRUE` | 0 | | 0 |

線形の lower は Chernoff の上界 (`chisqTailBound`) が 0 と判定し、mixture に入らない。log の lower は `sumLower` に入るが、出発点は μ の近くではない。

- `upperStart(μ)` (`startSearch`) が返す J は μ の近くの巨大な値だが、J > `LONG_WALK` (3000) なので、`sumLower` は項 w_j P_j の log のピークを `argmax` (反復 3000 回で打ち切り) で探し、`farEdge` でその少し上から始める
- 項は (μy)^j / (j! Γ(a + j + 1)) のように振る舞い、ピークは j ≈ z/2 (z = √(λx) は Bessel の引数)。mixture を使うのは `asymptoticMethod` が undefined のとき (z ≤ 1e6、ν ≤ 1e4) だけなので、ピークは高々 5e5 程度で、2^53 よりはるかに小さい
- 上側 (log を含む) は、μ > 1e8 では `pnchisqBoth` が下側の和から作る (`sumUpper` は μ ≤ 1e8 でだけ使う)
- 密度 (`mixtureDensity`) も j* ≤ z/2 から始まり、上向きのループは MAX_TERMS で打ち切る

実行でも確かめた (scratchpad で 1 件ごとにファイルに記録し、timeout 付きの `npx tsx`)。

- ncp ∈ {1e16, 1e17, 1e20, 1e100, 1e308}、z ∈ {9.9e7 の平方根 (Bessel の閾値 1e4 の直下), 1e3, 1, 1e-3}、df ∈ {1, 3, 100}、両側 × log の pchisq と dchisq、qchisq、非心の pbeta・pf・dbeta・qbeta: 411 件、すべて 200ms 未満、NaN なし
- 乱数で ncp ∈ [2^53, 2^1023)、z ∈ [1e-6, 1.6e6]、df ∈ {0.5, …, 2e4}、両側 × log の pchisq・dchisq: 3000 件、NaN なし、最長 11ms
- qchisq (ncp = 1e16, 1e100, 1e308): すべて 8ms 以下

非心ベータ・F の mixture は μ ≤ `MU_MIXTURE` (1e6) でだけ使い、それより大きい μ は積分などの別の方法になるので、添字が 2^53 に届かない。

## 記録だけ (この issue の範囲外)

- log の lower の値 −5.000000000000001e307 は、−μ = −5e307 (JS の `-1e308 / 2`) より 1 ulp 小さい。真の値は −μ + log S (log S は数千程度で、ulp(5e307) ≈ 1e292 の半分よりはるかに小さい) なので、正しく丸めると −5e307。ScaledSum の log (指数 × LN_UNIT) の丸めによる相対 2e-16 の誤差と思われる。R は −Inf (誤り)
- R の `-1e308 / 2` も −5.000000000000001e+307 と表示されるが、これは Windows 版 R がリテラル 1e308 を正しく丸めないため (52 回目のログ)
