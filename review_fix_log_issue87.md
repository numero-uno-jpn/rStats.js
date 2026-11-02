# Issue #87 対応ログ: coxph の共変量の中心化・尺度化が溢れる

GitHub Issue #87。R も正しくない場合の修正 (R が失敗する場合)。計画は承認済み。

## 確認 (main `9a8d652`)

`src/models/coxph.ts` の 2. は、列ごとに m = Σ w x / W、s = W / Σ w |x − m| を元の単位のまま作っていた。issue の指摘どおり。

- 1e308 規模: Σ w |x − m| (または Σ w x) が溢れ、s = 0 か m = ±Inf になって列が消える。issue の `coxph([1, 2, 3], [1, 0, 1], [[1e308], [-1e308], [0]])` も、同符号の 1e308 の列も、係数・se が NaN
- サブノーマル規模 (issue にない): s 自体が Inf に溢れ、同じく NaN

x = (1, 1.5, 0.5, 1.75)、time 1..4、status (1, 0, 1, 1) を 2^k 倍した場合:

| k | R 4.5.2 | 修正前 | 修正後 |
|---|---|---|---|
| 0 | coef −1.550270482443556、se 1.670010535782863 | 同じ | 同じ |
| 1020 | coef は正しい (× 2^1020 で −1.5503)、se 0 | 正しい (和が溢れない) | 正しい |
| 1022 | "Loglik converged before variable 1; coefficient may be infinite" | NaN | k = 0 と同じ検定・対数尤度、coef・se は 2^-1022 倍 |
| −1060 | 同上 | NaN | k = 0 と同じ検定・対数尤度、coef −Inf・se Inf (−1.55 × 2^1060 は double の範囲外) |

後段の係数・分散・検定は、43 回目に、各共変量の尺度の 2 の冪 2^e_j を単位として作るようにしてある。溢れるのは入口の中心化・尺度化だけだった。

## 修正

- 列を今のとおり計算し、平均が有限でないか、尺度 s が [2^-1022, ∞) の外のときだけ、列を 2^-c (c は列の最大の絶対値の指数、`scaleToUnit`) 倍した座標でやり直す。2 の冪の割り算は厳密で、内部の列 (x' − m') s' は (x − m) s と同じ値。通常の範囲は以前と同じビット
- 尺度を s'_j (有限) と指数 shift_j に分けて持つ (真の尺度 s'_j 2^-shift_j)。means は ldexp(m', shift)、init の内部座標は ldexp(init / s', shift)、出力の単位 expo は floor(log2 s') − shift
- docs (英・日) の「R が失敗する場合」に 1 行

## テスト

- `test/issue87.test.ts`: 2^1022 倍・2^-1060 倍が k = 0 の当てはめと、loglik・z・p・wald・score・3 つの検定・iter・warnings で厳密に一致し、coef・se・means が 2 の冪倍であること。R の k = 0 の値 (1e-12)。issue の ±2^1023 の列 (±2 の列と比べる。−1, 0, 1 だけの列は R の nocenter で中心化・尺度化しない別の経路)。巨大な列と普通の列の 2 列で init も与えた場合。stash で、修正前に 5 件中 4 件が失敗することを確かめた
- 全体テスト `npx vitest run`: 2433 passed / 38 skipped、失敗 1 (`distributionProperties.test.ts` の signrank の実行時間の上限。既知の揺れで、ファイル単独では 33 件すべて通る)。`npx tsc --noEmit -p .`: エラーなし

## 範囲外として記録

- サブノーマルの共変量では、係数 (〜1/x) が double の範囲を超えて ±Inf になる。そこから作る `linearPredictors` (x × 係数 − 中心) は NaN、`upper` (exp(係数 + q se)) は NaN になる。lp の真の値は有限だが、出力の係数そのものが表せないので、そのままにした (検定・対数尤度・z・p は正しい)
