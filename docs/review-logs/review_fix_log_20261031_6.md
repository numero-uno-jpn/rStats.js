# 外部レビュー (6 回目、第 16 段階) 対応ログ

レポート: ユーザーがチャットに貼り付けた「rStats.js 継続監査: 第 16 段階」。その前の追加レビュー (P-01 BY の小数の n、F-01 fisher) への判定もここに記録する。

## 判定

| ID | 指摘 | 判定・対応 |
|---|---|---|
| N-01〜03 | normal の極端値 | 修正済み (`f223097`)。レビュアーは push 前のコードを見ている |
| P-01 | pAdjust の BY で小数の n | 誤り (レビュアーも撤回)。R の `1:2.5` は `1 2` なので、`Math.floor(n)` 個の和と同じ (R 4.5.2 で `p.adjust(0.01, "BY", n = 2.5)` = 0.0375 を確認) |
| F-01 | fisher の整数上限 | `f223097` の修正のまま。R の fisher.test は丸めた後に 1 セルずつ `.Machine$integer.max` と比べる (レビュアーの撤回のほうが誤り。R 4.5.2 で実行して確認: `review_fix_log_20261031_7.md`)。丸めたときの警告は付けない (ユーザー判断) |
| W-01 | wilcoxTest の順位和検定で、同順位があると正確検定をしない | **将来の R バージョンへの追従として記録 (ユーザー判断)**。R 4.5.2 は同順位があると正規近似を使う (fixture `wilcoxTest.json` の小標本・同順位ありの 169 件がすべて "with continuity correction")。同順位ありの正確検定 (Streitberg–Röhmel) は新しい R の変更と思われる。ansariTest の No.93 (R 4.6.0 の変更) と同じ扱い |
| B-01 | binomTest の両側 p 値が O(n) | **修正** (下記) |
| B-02 | isCount が 2^53 を超える値を受け付ける | 不具合ではない。2^53 以上の double はすべて整数で、R も double で同じ計算をする |
| P-02 | propTest に期待度数 < 5 の警告がない | **このままでよい (ユーザー判断)**。chisqTest と同じく、R の "Chi-squared approximation may be incorrect" は出さない方針 (結果に警告を返す仕組みがない) |

## B-01 の修正

- `src/internal/discrete.ts` に、境界を探す共通関数を新設した
  - `firstTrue(pred, lo, hi)`: false から true に一度だけ切り替わる述語の、最初に true になる整数。lo から歩幅を倍にしていき、その後で二分探索する。hi は Infinity でもよい
  - `lastTrue(pred, lo, hi)`: true から false に切り替わる述語の、最後に true になる整数 (二分探索)
- **binomTest の `twoSidedP`:** 反対側の裾を 1 つずつ数えるのをやめ、この 2 つで境界を求める (O(log n))。二項分布の確率は ceil(np) から上で単調に減り、floor(np) までは単調に増える (比 f(i+1)/f(i) = (n−i)p/((i+1)(1−p)) が 1 未満になるのは i > (n+1)p − 1 のときだけ)。数え上げた結果と数学的に同じになる
- **poissonTest の `twoSidedP`:** 既存の探索 (歩幅の倍化 + 二分探索) を同じ共通関数に置き換えた (動作は同じ)

## テスト

`test/locationScaleExtremes.test.ts` に追加した。

- n = 1, 2, 3, 7, 20, 101、p を 5 通り、すべての x について、全数の総当たりと一致することを確かめる
- n = 1e9 が 1 秒未満で終わることを確かめる。修正前のコードでは、このテストが終わらない (n 回の密度計算のため)
