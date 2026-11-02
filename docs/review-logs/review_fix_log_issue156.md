# Issue #156 対応ログ: power リンクの muEta が 1/λ の溢れで NaN

GitHub Issue #156 (と、その追加コメント)。夜間の自律修正 (Plan モードの代わりに計画をここに書く)。

## 計画

- 意図: power リンクの微分 `inv * e ** (inv - 1)` (inv = 1/λ) が、1/λ が溢れると NaN (Inf × 0)、1/λ が極小で e^(inv − 1) が溢れると Infinity (追加コメント) になる。正しい値 (範囲外なら最小の double か Infinity) にする
- 方法: `powerMuEta` に分け、今の式が有限ならそのまま (クランプも同じ)。有限でないときだけ、e = 1 なら 1/λ、それ以外は e^inv/(λ e) (どちらも正規の範囲なら) か、その log (inv log e − log λ − log e) から作る
- 選んだ理由: issue の案 (log の座標) を、有限の結果は今のままにして、桁が保てる e^inv/(λ e) を先に試す形にした。今の式が有限の入力はビットが変わらない
- 同じ原因 (1/λ の溢れ) で `linkinv` も e = 1 で NaN になる (JavaScript の `1 ** Infinity` は NaN。R は 1)。同じ関数の同じ原因なので、e = 1 なら 1 にする (他の e ではビットは同じ)

## 確認 (main `923e323`)

issue の指摘どおり。R 4.5.2 の `power(lambda)` も NaN・Inf。

| λ | η | R mu.eta | 修正前 | 修正後 | 参照 |
|---|---|---|---|---|---|
| 5e-324 | 0.5 | NaN | NaN | 5e-324 | 0.5^(2e323) は 0 |
| 5e-324 | 1 | Inf | NaN | Infinity | 1/λ |
| MAX | 5e-324 | Inf | Infinity | 1125899906842624.2 | e^inv/(λ e) = (1 − 4e-306)/(2^-50 (1 − 2^-53)) ≈ 2^50 (1 + 2^-53) |
| 5e-324 | 2 | | Infinity | Infinity | 範囲外 |
| 0.5 | 2 | 4 | 4 | 4 | |
| 3 | 1e-300 | | 3.3333333333335038e199 | 同じ | |

linkinv: λ = 5e-324、η = 1 で R は 1、修正前は NaN、修正後は 1。

## 修正

`src/models/glmFamily.ts` の `powerLink` (linkinv の e = 1) と `powerMuEta` を追加。docs (英・日) の differences-from-r の glm の表に、R が NaN・Inf になる微分の行を 1 行。

## テスト

- `test/issue156.test.ts`: 上の表と linkinv(1)、以前の値。stash で、修正前に 2 件中 1 件が失敗することを確かめた
- 全体テスト `npx vitest run`: 2513 passed / 38 skipped、失敗 0。`npx tsc --noEmit -p .`: エラーなし

## 範囲外として記録

なし。

## close comment

Fixed in <commit of #156, see git log --grep='#156'>: where eta^(1/lambda - 1)/lambda is not finite in the plain form (1/lambda overflows, giving Infinity * 0, or eta^(1/lambda - 1) overflows against a tiny 1/lambda, as in the added comment), the power link's muEta is now 1/lambda at eta = 1, else eta^(1/lambda)/(lambda eta) or its logs, clamped to the least double as before; finite results keep their bits. makeFamily({ family: "quasi", link: { power: Number.MIN_VALUE } }).muEta(0.5) is now Number.MIN_VALUE (was NaN), and with power Number.MAX_VALUE, muEta(Number.MIN_VALUE) is 1125899906842624.2 (was Infinity); R's power() gives NaN and Inf, recorded in docs/differences-from-r.md. The inverse link at eta = 1 had the same cause (1 ** Infinity is NaN in JavaScript) and is now 1, as in R. Test: test/issue156.test.ts. (Not pushed yet.)
