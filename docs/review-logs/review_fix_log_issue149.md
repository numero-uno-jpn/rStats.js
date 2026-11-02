# Issue #149 対応ログ: perm(Infinity, k) が NaN

GitHub Issue #149。夜間の自律修正 (Plan モードの代わりに計画をここに書く)。

## 計画

- 意図: n = Infinity で有限の k の perm を極限の値にする。perm(n, k) = Γ(n + 1)/Γ(n − k + 1) ~ n^k (n → ∞) なので、k > 0 で Infinity、k = 0 で 1
- 方法: `perm` の非有限値の分岐 (`permLgamma`) の前に n === Infinity を扱う。両方が Infinity は不定なので NaN のまま。有限の n で k = Infinity は今の `permLgamma` (0 を返す) に残す
- 選んだ理由: lgamma の差 Infinity − Infinity を避けるには入口で極限を返すのが最も単純で、有限の引数の経路には触れない (値は 1 ビットも変わらない)。R に perm はない (jStat の permutation) ので R との違いの記録は不要

## 確認 (main `078a4a4`)

issue の主張は一部違った。issue は perm(Infinity, 0) = 1 と、k ≤ 1000 の整数は階乗の積の経路を通ると書いていたが、n が有限でない判定が先にあるので、有限の k はすべて `permLgamma` に入り NaN だった。

| 呼び出し | 修正前 | 修正後 |
|---|---|---|
| perm(Infinity, 0) | NaN | 1 |
| perm(Infinity, 0.5) | NaN | Infinity |
| perm(Infinity, 5) | NaN | Infinity |
| perm(Infinity, 1000.5) | NaN | Infinity |
| perm(Infinity, 1001) | NaN | Infinity |
| perm(Infinity, Infinity) | NaN | NaN |
| perm(5, Infinity)、perm(5.5, Infinity) | 0 | 0 |

## 修正

`src/special/extra.ts` の `perm`: n === Infinity なら k === Infinity で NaN、k === 0 で 1、それ以外は Infinity。`permLgamma` は有限の n と無限の k だけになった (コメントを直した)。

## テスト

- `test/issue149.test.ts`: 上の表。stash で、修正前に 2 件中 1 件が失敗することを確かめた
- 全体テスト `npx vitest run`: 2501 passed / 38 skipped、失敗 0。`npx tsc --noEmit -p .`: エラーなし

## close comment

Fixed in <commit of #149, see git log --grep='#149'>: perm now returns the limit for n = Infinity and a finite k (Infinity for k > 0, 1 for k = 0) before the lgamma ratio; Infinity with Infinity stays NaN. Note that perm(Infinity, 0) and integer k <= 1000 were NaN too (the non-finite branch comes before the falling-factorial path). Test: test/issue149.test.ts. (Not pushed yet.)
