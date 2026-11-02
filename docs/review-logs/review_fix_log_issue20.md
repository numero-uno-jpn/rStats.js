# Issue #20 対応ログ: 特異行列の determinant の sign (変更なし、R と同じ)

GitHub Issue #20 (監査ラウンド #80)。オーナーの判断: R のまま。計画は承認済み。

## 確認 (main `a4193f6`)

| 入力 | rStats.js | R 4.5.2 |
|---|---|---|
| `determinant([[1, 2], [2, 4]])` | modulus −Inf、sign 1 | modulus −Inf、sign 1 |
| 同、logarithm = false | modulus 0、sign 1 | modulus 0、sign 1 |
| すべて 0 の 2 × 2 | modulus −Inf、sign 1 | 同じ |
| `det([[1, 2], [2, 4]])` | 0 | 0 |

レビュアーは sign 0 を期待しているが、R の `determinant()` も sign 1 を返す。R のドキュメントは sign を「+1 か −1 の整数」と定めている。det = sign × exp(modulus) は 0 で正しい。コードは変えていない。

## テスト

- `test/issue20.test.ts`: 上の値が R と同じであることの確認 (変更なし)
- `npx tsc --noEmit -p .`: エラーなし
