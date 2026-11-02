# Issue #131 対応ログ: svd・eigen・schur の全体の縮小で小さな特異値・固有値が消える (#132・#127 と共通)

GitHub Issue #131。#132 (schur) と #127 (ginv の 1/d の溢れ) は同じ原因で、同じ 1 コミットで直した。このログが主のログで、`review_fix_log_issue132.md`・`review_fix_log_issue127.md` はここを参照する。夜間に下準備 (scratchpad の decisions_linalg_misc.md の Q1-a)、2026-11-03 朝にユーザー判断で案 B (縮小の目標を 2^256 に + ginv の 1/d の受け皿)。計画は承認済み (Plan モード)。

## 計画

- 意図: `rangeExponent` は要素の最大値が [2^-256, 2^256] の外の行列を、最大の要素が 1 の近くになるまで 2 の冪で割る。最大が 1e308 (2^1023) だと 2 未満の要素はすべてサブノーマルになって桁を失い、2^-51 未満は 0 になる。svd(diag(1e308, 1e-15)) が 8.9e-16 (11% の誤り)、ginv(diag(1e308, 1e-15), tol = 0) が NaN・Inf (サブノーマルの特異値の逆数が溢れる、#127)
- 方法 (案 B): 大きな行列は 2^256 までだけ割る (`decompositionExponent`、src/linalg/matrix.ts)。2^256 は今「範囲内」としてそのまま分解している上限なので、分解の途中の和が溢れないことは今の範囲で保証されている。2 の冪の割り算は厳密なので、結果が有限で正しかった行列はビットが変わらない。小さな行列 (最大が 2^-256 未満) は今までどおり 1 の近くまで上げる (失う桁はない)。ginv は、割った単位で 1/d が溢れる特異値だけ 1/(d 2^600) を使い、その項を ldexp(…, 600 − s) で元の単位で最後に足す
- 選んだ理由: ユーザー判断 (案 B)。夜の試作で 15000 件のビット一致を確かめてあった。案 C (ブロックごとの尺度) は大きく、得をするのは厳密に分かれる行列だけ
- `rangeExponent` 自体は変えず、新しい関数にした。`src/models/lmerTest.ts` (#58) も `rangeExponent` で対比を 1 の近くに割っており、そこを 2^256 にすると l'Vl が溢れうるため
- kappa の LINPACK の推定 (既定の method = "qr" と triangular) は、`scaledCopy` (新しい目標) ではなく、kappa の中で従来どおり 1 の近くまで割った複製を使う (下の「確認」の掃引で分かった。dtrco は e = ±1 と |T_kk| を比べるので尺度に依存し、2^256 にすると 2^256 超の行列の推定値の末尾が変わった)。#73 の規則 (割ると正規化数の下に落ちる行列は割らない) もそのまま

## 確認 (main `cf369c8`、R 4.5.2。R には 16 進の浮動小数点で渡した)

| 呼び出し | R 4.5.2 | 修正前 | 修正後 |
|---|---|---|---|
| `svd(diag(1e308, 1e-15))$d[2]` | 1.0000000000000002e-15 (1 単位) | 8.881784197001252e-16 | 1e-15 |
| `eigen(diag(1e308, 1e-15))`・`schur` | 1e-15 | 8.88e-16 | 1e-15 |
| `svd(diag(1e300, 1e-10))$d[2]` | 1e-10 | 1.000000000000009e-10 | 1e-10 |
| `svd(diag(1e308, 1e-80))$d[2]` (eigen・schur も同じ) | 1e-80 (svd は 1 単位) | 0 | 9.999999999999455e-81 (相対 5e-14。2^767 で割るとサブノーマル) |
| `svd(diag(1e308, 1e-150))$d[2]` | 1.00004e-150 | 0 | 0 |
| issue の `diag(1e308, 1e-308)` (svd・eigen・schur) | **0** | 0 | 0 (変わらない) |
| `ginv(diag(1e308, 1e-15), tol = 0)` (#127) | [1e-308, 0; 0, 1e15 (2 単位)] | [NaN, NaN; NaN, Inf] | [1e-308, 0; 0, 999999999999999.9 (1 単位)] |
| `ginv(diag(1e308, 1e-5), tol = 0)` | 正しい | NaN・Inf | [1e-308, 0; 0, 99999.99999999999] |
| `ginv(diag(1e308, 1e-80), tol = 0)` | 1e80 (1 単位) | [1e-308, 0; 0, 0] | 1.0000000000000545e80 (受け皿の経路) |
| `ginv(diag(1, 1e-320), tol = 0)` (範囲内の行列) | — | [NaN, NaN; NaN, Inf] | [1, 0; 0, Inf] (0 × Inf の NaN が消えた) |
| `rcond(diag(1e300, 1e-10))` | — | 0 | 1e-310 (複製が特異でなくなった) |
| `eigen([[1, 1e160], [1e-160, 2]])` の固有ベクトルの第 2 成分 | 1.618034e-160 | 1.618006792591244e-160 (相対 1.7e-5) | 1.6180339887498944e-160 |

- issue の例 diag(1e308, 1e-308) は 0 のまま。比が 2^-2045 で、全体を 1 つの尺度で扱う分解では、2^256 まで割っても 2^-1789 (0) になる。R (LAPACK、目標は約 2^459) も 0。1e-308 は入力自体がサブノーマル
- 1e-80 の svd・ginv は R の方が正確 (R は約 2^459 まで縮めるので、最大の 2^-1481 倍まで正規化数に残る。rStats.js は 2^-1278 倍まで)。docs のアルゴリズムの節に書いた
- 2^459 にしない理由 (夜の試作): schur が 1500 件中 371 件でビットが変わった

### #128 の solve が追従すること

solve は条件数の検査と、溢れたときの解き直しに `scaledCopy` の複製を使う (75bb949)。`scaledCopy` と solve の中の k の両方を新しい関数に変えたので、同じ複製で検査し・解く。`solve([[1e308, 1e308, 0], [1e308, -1e308, 0], [0, 0, 1e-60]], [1, 0, 1], tol = 0)` は修正前 (1e-308, 0, 1e60) (複製で 1e-60 がアンダーフローして特異になり、溢れる元の LU で解いていた)、修正後 (5e-309, 5e-309, 1e60)。review_fix_log_issue128.md の範囲外の例 (1e-300) は、2^767 で割っても 1e-300 がアンダーフローするので変わらない ((1e-308, 0, 1e300)、tol > 0 なら今までどおり「computationally singular」)。test/issue128.test.ts は通る

### 掃引 (ビットが変わらないこと)

scratchpad の `la3.ts` (結果を書き出す) と `la3cmp.mjs` (比べる)。n = 2〜6 の乱数行列 4200 個 (最大の要素 2^-1060〜2^1015、7 個に 1 個は要素の幅 2^±60、3 個に 1 個は対称)、18 種の呼び出し (svd・縦長の svd・eigen・onlyValues・schur・ginv・縦長の ginv (tol 0)・kappa exact・kappa・縦長の kappa・rcond・縦長の rcond・solve (右辺・逆行列)・qr・縦長の qr・qr (lapack)・lm)。修正前 (`git stash`) と修正後で文字列を比べた

- 最初の版 (kappa も `scaledCopy`): kappa の推定が 2^256 を超える行列で 1097 件、縦長で 709 件、末尾の桁が変わった (例 1180601799010504.8 → 1180601799010505.8)。範囲内 (abs(指数) ≤ 200) は 0 件。kappa の推定を従来の複製に戻した
- 最終版: 75600 件中、変わったのは 1 件だけ (qr の lapack で、修正前が NaN を含んでいた行列。#130 の修正)。範囲内も範囲外も、修正前に有限だった結果はすべてビット一致

## 判断待ち: eigen([[1, 1e200], [1e-200, 2]]) (#129 の範囲外の記録)

review_fix_log_issue129.md の範囲外の記録 1 は「同じ原因なので一緒に直る」想定だったが、**案 B では直らない**。

| 行列 | 真の値 | R 4.5.2 | 修正前 | 案 B (このコミット) | 目標 2^459 (試作) |
|---|---|---|---|---|---|
| [1, 1e200; 1e-200, 2] | 2.618034、0.381966 | 2.618034、0.381966 | 2、1 | **2.60897030279115、0.39102969720884984** (0.3% の誤り) | 2.618033988749895、0.3819660112501051 |
| [0, 1e200; 1e-200, 0] | 1、−1 | 1、−1 | 0、0 (固有ベクトルは [1, 1; 0, −2.2e-16]) | 0.98986、−0.98986、**固有ベクトルが 0** | 1、−1、固有ベクトルが 0 |
| [1, 1e160; 1e-160, 2] | 2.618、0.382 | 正しい | 値は正しく、ベクトルが相対 1.7e-5 | 正しい | 正しい |
| [1, 1e300; 1e-300, 2] | 2.618、0.382 | 2、1 (R も誤り) | 2、1 | 2、1 | 2、1 |

- 原因: 1e200 (2^664) を 2^256 まで割ると、1e-200 は 2^-1072 (サブノーマル、仮数 3 ビット程度) になる。バランス調整 (gebal) はこの縮小の後に行われる。修正前は 0 に落ちて三角行列になっていた (2、1)。案 B では少し桁が残るので、もっともらしいが誤った値になった。どちらも誤り
- [0, 1e200; 1e-200, 0] の固有ベクトルが 0 になるのは、2^459 でも同じ (固有値は正しくなる)。hqr2 の後退代入か gebak 以降の別の問題 (未調査)
- テストには入れていない (直っていないため)
- 案
  - **A (推奨): eigen (一般行列) だけ、目標を 2^459 (LAPACK の dgeev と同じ) にする。** 夜の試作の掃引 (lm5.out、2^1000 規模 1500 件) で eigen はビット一致 (schur は 371 件変わったので schur は 2^256 のまま)。R と同じ範囲 (1e200 まで) が直る。1e300 は R と同じく 2、1。固有ベクトルが 0 になる件は別に調べる。作業量 小 (eigen.ts 1 行 + 掃引をやり直す + テスト)
  - B: バランス調整を全体の縮小より先に (元の尺度で) 行う。1e300 も直りうるが、gebal の行・列のノルムが 1e308 規模で溢れないかの確認が要る。dgeev と順序が違う。作業量 中
  - C: 記録だけ (案 B のまま)。2、1 が 2.609、0.391 に変わっただけで、誤りのまま

## 修正

- `src/linalg/matrix.ts`: `decompositionExponent` (0 なら割らない。2^256 を超える行列は 2^256 まで、2^-256 未満は 1 の近くまで)
- `src/linalg/eigen.ts`・`schur.ts`・`svd.ts` (svdScaled・svdValues)・`solve.ts` (`scaledCopy` と solve の k): `rangeExponent` → `decompositionExponent`。rcond・solve の条件数・kappa exact (svdScaled) もこれで追従する
- `src/linalg/kappa.ts`: ginv の 1/d の受け皿。kappa は LINPACK の推定のために、従来どおり `rangeExponent` で 1 の近くまで割った複製を自分で作る (`scaledCopy` を使わない)
- docs (英・日) の「Algorithms」(eigen・svd・schur の縮小) に、2^256 まで割ること、R (約 2^459) の方が多くの桁を保つ範囲、両方で 0 になる範囲を書いた

## テスト

- `test/issue131.test.ts`: svd・eigen・schur の diag(1e308, 1e-15・1e-10・1e-5) と diag(1e300, 1e-10)、1e-80 (相対 1e-13)、issue の diag(1e308, 1e-308) は 0 (R と同じ)、ginv (#127 の例、1e-5、1e-80 の受け皿、diag(1, 1e-320) が NaN でなく Inf、既定の tol)、solve の tol = 0 の 1e-60 (#128 の追従)、[1, 1e160; 1e-160, 2] の固有ベクトル、範囲外でも有限だった値のビット (修正前の実装の値: 3 × 3 の 1e300 規模の svd・eigen・対称 eigen・schur・ginv・kappa exact・kappa・rcond)
- stash で、修正前に 6 件中 4 件が失敗することを確かめた (ビットの件と diag(1e308, 1e-308) の件は修正前も通る)
- 全体テスト `npx vitest run`: 271 files、2555 passed / 38 skipped、失敗 0 (#130 の修正と合わせて流した)。`npx tsc --noEmit -p .`: エラーなし

## 範囲外として記録

- 上の「判断待ち」(eigen の 1e200)。[0, 1e200; 1e-200, 0] の固有ベクトルが 0 になる件 (目標によらない)
- schur は一般行列でもバランス調整をしない (R の Matrix::Schur の dgees も 'P' の並べ替えだけ)。`schur([[1, 1e100], [1e-100, 2]])` の固有値は 1、2 (真は 2.618、0.382)。修正前も同じ。‖A‖ ε の後退誤差の範囲で、R も同じと思われる (R は確かめていない)
- kappa の LINPACK の推定 (dtrco) は行列の尺度に依存する (e = ±1 と |T_kk| の比較)。範囲外の行列の推定値は、R (元の尺度で計算) と末尾の桁が違いうる。今回は値を変えないことを優先した

## close comment

Fixed in <commit of #131, see git log --grep='#131'> (together with #132 and #127): eigen, schur, svd (and through them rcond, solve's condition check and kappa(exact = TRUE)) now divide a matrix whose largest entry is beyond 2^256 only down to 2^256, the top of the range already decomposed as given, instead of down to 1; a matrix below 2^-256 is still brought up near 1. Division by a power of 2 is exact, so a matrix whose results were finite and correct keeps the same bits: in a sweep of 4200 random matrices at every scale through 18 calls, no finite result changed. svd(diag(1e308, 1e-15)) is now [1e308, 1e-15] (was 8.9e-16), and eigen and schur give the same; 1e-80 in place of 1e-15 gives 9.999999999999455e-81 (was 0; R keeps more bits there because LAPACK scales down to about 2^459, recorded in docs/differences-from-r.md). The issue's own example diag(1e308, 1e-308) still gives 0, as R does: the ratio of its entries, 2^-2045, is beyond what one scale for the whole matrix can hold even at 2^256, and 1e-308 is itself subnormal. Test: test/issue131.test.ts. Recorded for later: eigen([[1, 1e200], [1e-200, 2]]) is still wrong (2.609, 0.391 instead of 2.618, 0.382; R is right), left for a decision. (Not pushed yet.)
