# Issue #99 対応ログ: isSymmetric と checkCovmat を R の isSymmetric と同じ判定に

GitHub Issue #99。ユーザー判断: R どおり元の単位で判定する (eigen の自動判定の正規化は意図した違いのまま)。計画は承認済み。

## 確認 (main `1945bf8`)

- `src/linalg/eigen.ts` の `isSymmetric` は「R の isSymmetric と同じ」とコメントにあったが、平均 |差| と平均 |要素| を全要素で取っていた。R の all.equal は既定 (countEQ = FALSE) で、転置と等しい要素を平均から除く。対角などの等しい要素が分母を薄め、R より緩かった
- `src/internal/covmat.ts` の `checkCovmat` は、判定の前に行列全体を最大の要素で 2 の冪に正規化していた (48 回目、「和が溢れないように」。isSymmetric 自身が溢れを扱うので不要だった)。issue の例は、正規化で差が絶対差の判定に回って受け付けられていた

R 4.5.2 の isSymmetric と比べた。

| 行列 | R | 修正前 | 修正後 |
|---|---|---|---|
| [[1e308, 1e-10], [0, 1]] (issue) | FALSE | TRUE | FALSE |
| [[1e6, 1e-10], [0, 1]] | FALSE | TRUE | FALSE |
| [[4, 1], [1 + 1e-13, 4]] | FALSE | TRUE | FALSE |
| [[1, .5], [.5 + 2e-14, 1]] | FALSE | TRUE | FALSE |
| [[4, 1], [1 + 1e-15, 4]]、[[1, .5], [.5 + 1e-14, 1]] | TRUE | TRUE | TRUE |
| [[1, 1e-300], [0, 1]]、[[1, 2e-14], [0, 1]] (絶対差) | TRUE | TRUE | TRUE |
| [[1, 1e-7], [0, 1]]、[[1, 1e-13], [0, 1]]、3 × 3 の 1 組 (1e-12) | FALSE | FALSE | FALSE |
| 和が溢れる 4 例 (1.5 × 2^1023 の 1 ulp 違い、差が溢れる ±2^1023 など) | TRUE, FALSE, FALSE, TRUE | | 同じ |

## 修正

- `isSymmetric`: 転置と異なる要素だけで、平均 |差| と平均 |要素| を取る。異なる要素がなければ true。和が溢れるときだけ、異なる要素の最大の絶対値の 2 の冪で割って取り直す (そのとき平均は大きいので相対の判定で、結果は変わらない)。判定 (平均 |要素| > 100ε なら相対、それ以外は絶対) は以前と同じ
- `checkCovmat`: 正規化をやめ、元の行列で判定する
- `eigen` の自動判定は、今までどおり最大の要素で正規化した行列で判定する (意図した違い: R の絶対差の判定は小さな非対称行列を対称とみなす)。等しい要素を除く点は R と同じになった。`eigen([[4, 1], [1 + 1e-13, 4]])` は R と同じく非対称の経路で、値は R と 1e-16 程度で一致
- R と同じ判定にするだけなので docs は追記しない (docs の "as R's isSymmetric" が正しくなった)

## テスト

- `test/issue99.test.ts`: 上の 15 個の行列の isSymmetric と checkCovmat (対角が正のもの)、eigen の値。stash で、修正前に 3 件とも失敗することを確かめた
- 全体テスト `npx vitest run`: 2457 passed / 38 skipped、失敗 1 (既知の揺れの signrank の実行時間。ファイル単独では 33 件すべて通る)。`npx tsc --noEmit -p .`: エラーなし

## 範囲外として記録

- checkCovmat を元の単位で判定するので、R と同じく、平均 |要素| が 100ε 以下の小さな単位の行列 (1e-20 規模など) の非対称は絶対差で受け付ける (R の isSymmetric と同じ。ユーザー判断)
