# 外部レビュー (10 回目) 対応ログ

レポート: ユーザーがチャットに貼り付けた追加監査「乱数生成・GLM・因子分析」(RNG-03、RNG-04、OMEGA-02)。

## R 4.5.2 / psych 2.6.9 で実行して確かめた結果

| 呼び出し | R | rStats.js (修正前) |
|---|---|---|
| `r2dtable(1, c(m, m), c(m, m))`、m = 2147483647 | エラー "cannot allocate memory block of size 134217728 Tb" | 4.3e9 要素の配列を確保しようとし、120 秒で終わらなかった |
| `omega(R, nfactors = 3)` (2 変数)、`nfactors = 5` (4 変数) | エラー "subscript out of bounds" | エラー "the matrix contains NaN or infinite values" (原因が分からない) |
| Thurstone (9 変数) の omega_h、q = 1, 2, 3 | 0.8914554、0.7139072、0.7360709 | 一致 (`omega(null, { covmat })` で計算) |

## 修正

- **RNG-03 `r2dtable`:** 周辺度数の総計が 2147483647 を超えたら、"the sum of 'r' must be at most 2147483647" のエラーにする (総計 + 1 個の対数階乗の表を作るため)
- **OMEGA-02 `omega`:** nfactors が変数の数を超えたら、"'nfactors' (q) must not exceed the number of variables (p)" のエラーにする。psych もエラー (subscript out of bounds) になるので、結果の扱いは変わらない
- **テスト:** `test/locationScaleExtremes.test.ts` に追加した

## 判定

| ID | 判定 |
|---|---|
| RNG-04 | RNG-01 と同じ。修正済み (`a2a3fa8`) |
| RNG-02 | 不具合ではない (R も n 個の表を作る) |
| CPH-03 | 撤回のまま (`review_fix_log_20261031_9.md` で R と一致を確認済み) |

## 調べたが対応不要だったもの (私の誤報の訂正)

途中で「omega の ωh が、因子数が変数の数に近いと psych と大きく違う (p = 4・q = 3 で 0.74 と 0.16)」と報告した。これは、私が相関行列を生データとして `omega(R)` に渡していた誤りによるものだった。`omega(null, { covmat: R })` で比べ直すと、Thurstone では psych と一致した。

等相関の行列で q ≥ 2 にしたときの差は、群因子の回転が一つに決まらない (識別できない) ためで、psych 自身も因子数によって 0.01〜0.84 と大きくばらつく。psych の「too many factors ... 1s are used instead」の警告は q > p のときだけ出て、q ≤ p の初期値は SMC のまま。rStats.js と同じなので、変更はしていない。
