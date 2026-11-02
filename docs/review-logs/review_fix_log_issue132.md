# Issue #132 対応ログ: schur の全体の縮小で小さな固有値が消える

GitHub Issue #132。#131 (svd) と同じ原因 (`rangeExponent` が最大の要素を 1 の近くまで割る) で、#131・#127 と同じ 1 コミットで直した。計画・確認・掃引・テストの詳細は **review_fix_log_issue131.md** を参照。ユーザー判断は案 B (2026-11-03 朝)。

## 計画

- 意図・方法・理由は review_fix_log_issue131.md と同じ。schur は `decompositionExponent` で、2^256 を超える行列を 2^256 までだけ割る。T と固有値は 2^k 倍で戻し、Q は単位がない (今までどおり)

## 確認 (main `cf369c8`、R 4.5.2)

| 呼び出し | R 4.5.2 | 修正前 | 修正後 |
|---|---|---|---|
| `schur(diag(1e308, 1e-15))` の固有値 | (eigen で) 1e-15 | 8.881784197001252e-16 | 1e-15 |
| `schur(diag(1e300, 1e-10))` | — | 1.000000000000009e-10 | 1e-10 |
| `schur(diag(1e308, 1e-80))` | — | 0 | 9.999999999999455e-81 |
| issue の `schur(diag(1e308, 1e-308))` | (eigen・svd で) **0** | 0 | 0 (変わらない) |

- issue の例 diag(1e308, 1e-308) は 0 のまま。比 2^-2045 は、全体を 1 つの尺度で扱う分解では 2^256 まで割っても 0 になる (R の LAPACK も 0、1e-308 は入力自体がサブノーマル)。issue の言う「対角行列なら変換は要らない」は、対角・ブロック対角を検出して別の尺度で扱う案 C にあたり、ユーザー判断で採らなかった
- 夜の試作で目標を 2^459 (LAPACK) にしたとき、schur だけ 1500 件中 371 件でビットが変わった。2^256 では変わらない (今回の掃引でも schur の 4200 件はビット一致)

## 修正

- `src/linalg/schur.ts`: `rangeExponent` → `decompositionExponent` (残りは review_fix_log_issue131.md)

## テスト

- `test/issue131.test.ts` に schur の例 (1e-15・1e-10・1e-5、1e-80、diag(1e308, 1e-308) は 0、範囲外の 3 × 3 の値のビット)

## 範囲外として記録

- schur は一般行列でもバランス調整をしない。`schur([[1, 1e100], [1e-100, 2]])` の固有値は 1、2 (真は 2.618、0.382)。修正の前後で同じ。review_fix_log_issue131.md の範囲外を参照

## close comment

Fixed in <commit of #131, see git log --grep='#132'> (together with #131 and #127; details in review_fix_log_issue131.md): schur now divides a matrix whose largest entry is beyond 2^256 only down to 2^256 (the top of the range already decomposed as given) instead of down to 1, so entries down to 2^-1278 of the largest stay in the normal range; T and the eigenvalues are scaled back as before. schur(diag(1e308, 1e-15)) now gives 1e-15 (was 8.9e-16), and 1e-80 gives 9.999999999999455e-81 (was 0). Results that were finite and correct keep their bits (a sweep of 4200 random matrices at every scale). The issue's own example diag(1e308, 1e-308) still gives 0, as R's eigen does: the ratio 2^-2045 is beyond one scale for the whole matrix even at 2^256, and 1e-308 is itself subnormal; treating a diagonal or block-diagonal matrix with separate scales was considered and not taken. Test: test/issue131.test.ts. (Not pushed yet.)
