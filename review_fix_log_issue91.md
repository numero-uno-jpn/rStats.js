# Issue #91 対応ログ: rweibull の尺度 0 と不正な形状 (変えない)

GitHub Issue #91。判定: 変えない (not planned、以前の判断どおり)。コードの変更なし。

## 確認 (main `79343aa`)

issue の主張: R 4.5 の rweibull は、パラメータが不正でも scale == 0 なら 0 を返す。rStats.js は形状が正でないと NaN を返すので、R の順序に合わせるべき。

R 4.5.2 の挙動は issue のとおり (乱数は引かない)。

| 呼び出し | R 4.5.2 | rStats.js | 乱数 |
|---|---|---|---|
| `rweibull(1, -1, 0)`、`rweibull(1, -1, -0)` | 0 | NaN | どちらも引かない |
| `rweibull(1, 0, 0)` | 0 | NaN | 同上 |
| `rweibull(1, NaN, 0)` | 0 | NaN | 同上 |
| `rweibull(1, Inf, 0)`、`rweibull(1, 2, 0)` | 0 | 0 | 同上 |
| (参考) `dweibull(0, -1, 0)`、`pweibull`、`qweibull` | NaN | | |

## 判定

19 回目のレビュー (`review_fix_log_20261031_19.md`) で、`rgamma(1, -1, scale = 0)` をユーザー判断で NaN にし、`rweibull(1, -1, 0)`・`rweibull(1, NaN, 0)` も同じ理由で NaN にした。形状が正でなければ分布が定義されないので、尺度 0 でも値を持たない (R 自身の d・p・q も NaN を返す)。乱数は R と同じく引かないので、乱数列は R とそろう。docs の Deliberate differences (Random numbers、"Random generators with parameters that define no distribution") に記録済み。

issue が指摘した差は、この意図した違いそのもので、以前の判断どおり変えない (#29 の rgamma の NaN と同じ扱い)。docs の記述は「負 (か NaN) の形状」だが、形状 0 も同じく NaN (`shape > 0` で判定)。
