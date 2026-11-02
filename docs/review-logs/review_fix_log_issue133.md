# Issue #133 対応ログ: matMul の rescaledDot で打ち消しの後に残る小さな項が 0 に落ちる (記録済みの制約、変えない)

GitHub Issue #133。夜間の自律対応。判定: 既知の制約として記録済み (not planned)。コードの変更なし。

## 計画

- 意図: issue の主張 (`matMul([1e308, 1e308, 1], [1e308, -1e308, 1])` が真値 1 でなく 0) を今の main と R 4.5.2 で確かめ、HANDOFF の既存の方針に当たるかを見る
- 方法: npx tsx と Rscript で同じ積を計算する
- 選んだ理由: HANDOFF の「記録だけにしたもの」と 49 回目のログに同じ制約がある。それに当たれば変えない

## 確認 (main `b1a6945`)

| 呼び出し | 真値 | R 4.5.2 (`%*%`、`crossprod`) | rStats.js |
|---|---|---|---|
| matMul([1e308, 1e308, 1], [1e308, −1e308, 1]) (issue の例) | 1 | NaN | [[0]] |
| 同じ積を 1×3 と 3×1 の行列で | 1 | NaN | [[0]] |
| [1e308, 1e308, 1e-300] · [1e308, −1e308, 1e300] (49 回目のログの例) | 1 | | [[0]] |

issue の説明 (2^-1023 倍で 1 × 1 の項が 1.24e-616 になり 0 に落ちる) のとおり再現する。

## 判定

変えない (記録済みの制約)。HANDOFF「記録だけにしたもの (誤答の具体例が見つかれば検討する)」に次のとおりある。

> 1e308 近くの積和: nonEstimableRows の内積 (27・40 回目)、lm の predict の積和 (27 回目)。matMul は 49 回目に、結果が有限でない要素を 2 の冪で割って取り直すようにしたが、大きな項が厳密に打ち消し、最大の積の 2^-1074 倍未満の項だけが残る場合は失われる

49 回目のログ (`review_fix_log_20261031_49.md`) の「matMul の積和の制約」も、[1e308, 1e308, 1e-300] · [1e308, −1e308, 1e300] (真値 1) が 0 になることを例に挙げている。issue の例は小さな項が 1 で、同じ性質 (最大の積 1e616 に対し 1 は 2^-1074 倍より小さい)。R は NaN を返す (49 回目の修正前の rStats.js も NaN)。

直すには、積和を厳密に取る (各積を double-double か指数を分けた形で持ち、打ち消しの後の和を正確に作る) 必要があり、通常の範囲の積和の経路に手を入れることになる。issue は誤答の具体例だが、49 回目の記録の例と同じ形で、新しい種類の入力ではない。この方針を変えるかはユーザーの判断に残す (朝の確認で「直す」となれば別に扱う)。

## close comment

Confirmed, and already recorded as a known limitation in review 49: matMul's rescaledDot (used only where the ordinary sum of products is not finite) divides each vector by a power of 2, so a term below 2^-1074 times the largest product is lost; when the large products cancel exactly and only such a term remains, the result is 0. The issue's example matMul([1e308, 1e308, 1], [1e308, -1e308, 1]) gives [[0]] (exact 1); R 4.5.2 gives NaN for the same product. Review 49 records the same case with [1e308, 1e308, 1e-300] . [1e308, -1e308, 1e300]. Recovering it needs an exact (error-free) sum of products; left as recorded. See review_fix_log_issue133.md. (Not pushed yet.)
