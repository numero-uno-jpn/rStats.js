# Issue #127 対応ログ: ginv で縮小した単位の特異値の逆数が溢れる

GitHub Issue #127。#131・#132 と同じ 1 コミットで直した。共通の部分 (全体の縮小の目標を 2^256 にしたこと、掃引、テスト全体の結果) は **review_fix_log_issue131.md** を参照。ユーザー判断は案 B (2026-11-03 朝): 目標を 2^256 に + ginv の 1/d の受け皿。

## 計画

- 意図: `ginv` (#56 で `svdScaled` を使う形にした) は、2^-s 倍した単位の特異値 d の逆数 1/d を取り、最後に ldexp(…, −s) で戻す。issue の例 diag(1e308, 1e-15) では s = 1023 で d = 1e-323 (サブノーマル) になり、1/d が溢れ、0 × Inf の NaN も入る
- 方法: (1) 全体の縮小を 2^256 までにする (#131。この例では d が 1e-15 × 2^-767 ≈ 1.3e-246 になり、1/d は溢れない)。(2) それでも割った単位で 1/d が溢れる特異値 (d < 2^-1024 程度) だけ、1/(d 2^600) を使い、項 v u^T/(d 2^600) を ldexp(…, 600 − s) で元の単位に戻してから、最後に足す。1/d が有限な項は今と同じ計算 (同じビット)
- 選んだ理由: issue の案 (指数を意識した割り算、0 × Inf を避ける) を、今の値が有限な場合を変えない形で入れた

## 確認 (main `cf369c8`、R 4.5.2 の MASS::ginv。R には 16 進の浮動小数点で渡した)

| 呼び出し | R 4.5.2 | 修正前 | 修正後 |
|---|---|---|---|
| issue の `ginv(diag(1e308, 1e-15), tol = 0)` | [1e-308, 0; 0, 0x1.c6bf52633fffep+49 (1e15 の 2 単位下)] | [NaN, NaN; NaN, Inf] | [1e-308, 0; 0, 999999999999999.9 (1 単位下)] |
| `ginv(diag(1e308, 1e-5), tol = 0)` | 99999.99999999999 | NaN・Inf | [1e-308, 0; 0, 99999.99999999999] |
| `ginv(diag(1e300, 1e-10), tol = 0)` | — | NaN・Inf | [1e-300, 0; 0, 1e10] |
| `ginv(diag(1e308, 1e-80), tol = 0)` (受け皿の経路: 2^767 で割ると d がサブノーマルで 1/d が溢れる) | 1e80 (1 単位) | [1e-308, 0; 0, 0] | [1e-308, 0; 0, 1.0000000000000545e80] (相対 5e-14) |
| `ginv(diag(1, 1e-320), tol = 0)` (範囲内の行列。真の 1e320 は表せない) | — | [NaN, NaN; NaN, Inf] | [1, 0; 0, Inf] |
| `ginv(diag(1e308, 1e-308), tol = 0)` | [1e-308, 0; 0, 0] | 同じ | 同じ (特異値が 0 になる。#131 と同じ) |
| `ginv(diag(1e308, 1e-15))` (既定の tol) | — | [1e-308, 0; 0, 0] | 同じ |

- 1e-80 の値は R の方が正確 (R は約 2^459 まで縮める)。docs のアルゴリズムの節に書いた (review_fix_log_issue131.md)
- 掃引 (review_fix_log_issue131.md): ginv (既定の tol) と縦長の行列の ginv (tol 0) の 4200 件ずつで、修正前とビット一致

## 修正

- `src/linalg/kappa.ts` の `ginv`: 1/d が有限でない特異値を `extra` に積み、他の項を戻したあと、ldexp(v u (1/(d 2^600)), 600 − s) で足す
- 全体の縮小は review_fix_log_issue131.md

## テスト

- `test/issue131.test.ts` の「gives ginv of the issue's matrix (#127)」: issue の例 (1e15 に相対 3e-16 以内、他の成分は厳密)、1e-5、1e-80 の受け皿 (相対 1e-13)、diag(1, 1e-320) が NaN を含まない、既定の tol。修正前は失敗する (stash で確認)

## close comment

Fixed in <commit of #131, see git log --grep='#127'> (together with #131 and #132; details in review_fix_log_issue131.md and review_fix_log_issue127.md): the SVD behind ginv now divides a matrix beyond 2^256 only down to 2^256, so for the issue's diag(1e308, 1e-15) the scaled singular value is about 1.3e-246 instead of the subnormal 1e-323, and its reciprocal no longer overflows. Where 1/d still overflows in the scaled units, ginv now inverts that singular value as 1/(d 2^600) and adds its terms in the original units, ldexp(..., 600 - s), after the others, so no 0 * Inf enters. ginv(diag(1e308, 1e-15), tol = 0) is now [[1e-308, 0], [0, 999999999999999.9]] (was NaN and Inf; R gives 1e15 two units below), and diag(1e308, 1e-80) gives 1.0000000000000545e80 (was 0). Terms with a finite reciprocal are computed as before, and results that were finite keep their bits. Test: test/issue131.test.ts. (Not pushed yet.)
