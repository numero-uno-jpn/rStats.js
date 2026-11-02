# Issue #142 対応ログ: jonckheereTest の正確分布の畳み込み (誤りでない、変えない)

GitHub Issue #142。夜間の自律対応。判定: issue の主張が誤り (not planned)。コードの変更なし。全数列挙で確かめるテストを足した。

## 計画

- 意図: issue の主張 (群 i と後ろの全群の Mann–Whitney 分布を独立として畳み込むのは誤りで、3 群 1 例ずつの両側 p は 1/3 のはずが 1/4 になる) を実行して確かめる。issue は実行していない
- 方法: npx tsx で issue の例と群の大きさがそろわない例を計算し、並べ替えの全列挙と R 4.5.2 (DescTools・clinfun) と比べる
- 選んだ理由: 正しい値なら変えない。全数列挙のテストは、3 群以上の正確な経路を R の fixture とは独立に確かめるので有益と考えて足した

## 確認 (main `472f615`)

| 呼び出し | 全列挙 | R 4.5.2 DescTools (exact) | clinfun | rStats.js |
|---|---|---|---|---|
| x = (1, 2, 3)、g = (1, 2, 3)、両側 (issue の例) | 1/3 | 0.3333333 | 0.3333333 | 0.3333333333333333 |
| 同、increasing・decreasing | 1/6、1 | | | 0.16666666666666666、0.9999999999999999 |
| x = (3, 1, 4, 2, 6, 5, 9, 7, 8)、群の大きさ 2・3・4、両側 | 0.012698412698412698 | 0.01269841 | 0.01269841 | 0.012698412698412697 |
| 同、increasing | 0.006349206349206349 | 0.006349206 | | 0.006349206349206348 |

issue の例の正しい値 1/3 (issue 自身が導いた値) を返す。issue の言う 1/4 (Binomial(3, 1/2)) にはならない。

issue の前提が誤り: 帰無仮説の下で、群 i..k に入る値の集合を与えたとき、群 i がその中で取る順位は一様で、後ろの群どうしの並びとは独立。だから「群 i 対 後ろの全群」の Mann–Whitney 統計量は互いに独立で、その分布の畳み込みは正確な JT の分布になる (DescTools・clinfun と同じ方法)。issue が「独立な 3 個のベルヌーイ」と見たのは、群 1 対 (群 2 と 3) が 0〜2 の値を取る 1 対 2 の Mann–Whitney (確率 1/3 ずつ) で、ベルヌーイ 2 個ではない。

## テスト

- `test/issue142.test.ts`: issue の例 (両側 1/3、increasing 1/6) と、群の大きさ (2, 3, 4)、(1, 2, 3, 2)、(3, 3, 3) の 3 例で、正確な p (increasing・decreasing・両側) を並べ替えの全列挙と比べる。コードは変えていないので、修正前に失敗することの確認は該当しない
- 全体テスト `npx vitest run`: 2545 passed / 38 skipped、失敗 0。`npx tsc --noEmit -p .`: エラーなし

## 判定

変えない。issue の主張が誤りで、R (DescTools・clinfun) とも一致する。

## close comment

Not a bug: the convolution is exact. Under the null, given the set of values in groups i..k, the ranks of group i among them are uniform and independent of how the later groups are arranged, so the Mann-Whitney statistics of each group against all later groups are independent and their convolution is the exact JT distribution (the method DescTools and clinfun use). The issue's example jonckheereTest([1, 2, 3], [1, 2, 3], { exact: true }) gives the two-sided p = 0.3333333333333333, the 1/3 the issue derives (the first component is a 1-vs-2 Mann-Whitney statistic, uniform on 0..2, not two Bernoulli terms). With unequal groups (sizes 2, 3, 4) the exact p-values match full enumeration of the permutations and R 4.5.2 (DescTools and clinfun: 0.01269841 two-sided). Test: test/issue142.test.ts (against enumeration). See review_fix_log_issue142.md. (Not pushed yet.)
