# Issue #108 対応ログ: 無限の尺度の中央値の分位点 (意図した違い、変えない)

GitHub Issue #108。判定: 変えない (not planned、24 回目の方針どおり)。コードの変更なし。

## 確認 (main `423fab7`)

issue の主張: qnorm(0.5, mean = 3, sd = Inf)、qlogis(0.5, 3, Inf)、qlnorm(0.5, 3, Inf) は R では NaN (Inf × 0) なのに、rStats.js は位置パラメータ (3、exp(3)) を返す (`affine`・`locationScale` の中央値の扱い)。

R 4.5.2 の値は issue のとおり。

| 呼び出し | R 4.5.2 | rStats.js |
|---|---|---|
| qnorm(0.5, 3, Inf)、qlogis(0.5, 3, Inf)、qlnorm(0.5, 3, Inf) | NaN、NaN、NaN | 3、3、exp(3) |
| pnorm(3, 3, Inf)、pnorm(4, 3, Inf) | 0.5、0.5 | 0.5、0.5 |

## 判定

24 回目のレビューの方針「無限の尺度は極限として扱う: d/p が極限の値を返す分布では、q も極限の値 (中央値より下で −Inf、中央値で位置パラメータ、上で Inf)」(HANDOFF) のとおりで、docs の「R が失敗し、rStats.js が値を返す場合」の表に記録済み (qnorm・qlnorm・qlogis の中央値。R は Inf × 0 で NaN だが、ほかの p は極限を返し、pnorm(3, 3, Inf) は 0.5)。以前の判断どおり変えない。
