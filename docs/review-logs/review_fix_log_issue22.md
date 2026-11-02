# Issue #22 対応ログ: hist に有限な観測がない場合 (変更なし、R と同じ)

GitHub Issue #22 (監査ラウンド #93)。レビュアーはソースを読んで、密度が NaN になると判断していたが、実行すると R と同じエラーになった。コードは変えていない。

| 入力 | rStats.js | R 4.5.2 |
|---|---|---|
| `hist([])` | エラー "invalid number of 'breaks'" | `hist(numeric(0))`: エラー "invalid number of 'breaks'" |
| `hist([NaN, Infinity, -Infinity])` | 同じエラー | `hist(c(NA, Inf, -Inf))`: 同じエラー |

区切りの数を決める段階 (密度を計算する前) で、R と同じエラーにしている。

## テスト

- `test/issue22.test.ts`: 上の 2 例が R と同じエラーになることの確認 (変更なし)
