# Issue #154 対応ログ: pAdjust BY で q n が溢れる

GitHub Issue #154。夜間の自律修正 (Plan モードの代わりに計画をここに書く)。

## 計画

- 意図: BY の調整値 ((q n)/i) p で、調和数 q と n の積が n ≳ 2.5e305 で溢れ、極小の p でも 1 になる (p = 0 は Inf × 0 で NaN)。有限の正しい値にする
- 方法: q n が有限ならこれまでどおり。溢れたときだけ、同じ順の積を 2^10 単位で作る: ((q (n/1024))/i) p × 1024 (q は n ≤ 最大の double でも 711 未満 < 2^10)
- 選んだ理由: issue の案 q (n p/i) は積の順が変わり丸めが変わる。2 の冪の単位にすれば、溢れない範囲では元の順の積と同じ丸めになる (途中の値はサブノーマルより十分大きい: n ≥ 2.5e305 なので (q n/1024/i) p ≥ 1e-21 程度)。q n が有限な通常の入力は同じビット。R は n が大きいと sum(1/(1:n)) のベクトルが作れずエラーで、docs に記録済み (differences-from-r.md の `p.adjust(p, "BY", n = Inf)` の行) なので docs は変えない

## 確認 (main `31b0412`)

issue の指摘どおり。

| 呼び出し | 修正前 | 修正後 | 参照 (Rmpfr、H_n = log n + γ + 1/(2n)) |
|---|---|---|---|
| pAdjust([2^-1074], BY, n = 1e306) | 1 | 3.4839940889907547e-15 | 3.483994088990754201e-15 |
| pAdjust([2^-1074, 1e-310, 0, 0.5], BY, n = 1e306) | [1, 1, NaN, 1] | [1.7419970444953774e-15, 0.023505608470702585, 0, 1] | 1 番目 1.741997044495377101e-15 |
| pAdjust([2^-1074, 1e-300], BY, n = 1.7976931348623157e308) | [1, 1] | [6.309263587651918e-13, 1] | |
| pAdjust([1e-305, 1e-306], BY, n = 1e300) | 同じ | [0.0034567637178155764, 0.0006913527435631153] | |

1 番目の差 (相対 1.3e-16) は q の double の丸め (漸近展開を double で足す) から。

## 修正

`src/htest/pAdjust.ts` の BH・BY の枝。q n が有限なら unit = 1 で以前と同じ式 ((q n)/i) p。

## テスト

- `test/issue154.test.ts`: 上の表 (相対 1e-15)、p = 0 が 0、BH と q n が有限な BY は以前の値。stash で、修正前に 2 件中 1 件が失敗することを確かめた
- 全体テスト `npx vitest run`: 2505 passed / 38 skipped、失敗 0。`npx tsc --noEmit -p .`: エラーなし

## close comment

Fixed in <commit of #154, see git log --grep='#154'>: where q n overflows (n above about 2.5e305), BY forms the same products in units of 2^10 (q < 2^10), ((q (n/1024))/i) p times 1024, which rounds the same way; elsewhere the bits are unchanged. pAdjust([Number.MIN_VALUE], { method: "BY", n: 1e306 }) is now 3.4839940889907547e-15 (Rmpfr H_n n p: 3.4839940889907542e-15), and a p-value of 0 gives 0 instead of NaN. Test: test/issue154.test.ts. (Not pushed yet.)
