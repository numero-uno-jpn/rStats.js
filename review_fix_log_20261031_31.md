# 外部レビュー (31 回目) 対応ログ

レポート: ユーザーがチャットに貼り付けた追加監査 (三角ソルバー、matMul、solve の条件数、determinant、qrSolve、qrX、ノルム、kappa、rcond・trcon)。

## 判定

| ID | 呼び出し | R 4.5.2 | 修正前 | 判定 |
|---|---|---|---|---|
| backsolve・forwardsolve の非有限値 (43〜45) | ― | ― | ― | レビュアーも断定せず。LAPACK と同じく NaN を伝える |
| **MATMUL-ZERO-INNER-DIMENSION-01** (46) | `matMul([[], []], [])` | 2×1 のゼロ行列 | TypeError | **修正 (A)** |
| SOLVE-LACN2-NORM-OVERFLOW-01 (47) | ― | ― | ― | B の正規化で防ぐ |
| determinant の溢れ (48) | ― | ― | ― | 表現の限界 (レビュアーも同意) |
| **QR-SOLVE-LAPACK-RANK-UNDETECTED-01** (49) | `qrSolve(qr([[1,2],[2,4]], lapack), [3,6])` | (8, −2.5) | (8, −2.5) | **修正 (C)** (R も誤り) |
| qrX、Frobenius ノルム (50・51) | ― | ― | ― | レビュアーも問題なしと判定 |
| **KAPPA-EXACT-SINGULAR-NON2-01** (52) | `kappa([[1,2],[2,4]], exact, norm = "1")` | エラー | エラー | **修正 (D)** |
| SOLVE-FINITE-NORM-OVERFLOW-SKIPS-CONDITION-01 (53) | `solve([[1e308,1e308],[1e308,9.999999999999998e307]], [1,0])` | エラー (rcond 0) | エラー (exactly singular) | 黙って誤ることはなかった。ただし 1-ノルムが溢れて条件数の検査が飛ばされる経路はあった (2^1023 の行列で確認)。**修正 (B)** |
| 参考 | `solve([[1e308,1e308],[0,1e308]], [1,1])` | **エラー (rcond 0、誤り)** | [0, 1e-308] | 正しい。修正後も同じ |
| **RCOND-FINITE-NORM-OVERFLOW-01** (54) | `rcond` の上記の悪条件の行列 / `rcond([[1e308,1e308],[0,1e308]])` | エラー / エラー | **0** / エラー | **修正 (B)** |
| **TRCON-NORM-OVERFLOW-01** (55) | `rcond([[1e308,1e308],[0,1e308]], triangular)` | **0** | **0** | **修正 (B)** (R も誤り)。正しくは 0.3 |

## A. matMul の内側の次元 0

- 内側の次元が 0 (n×0 の行列と空のベクトル、または 2 つの空のベクトル) なら、n×1 のゼロ行列を返す (R と同じ)。修正前は `b[0]` を読んで落ちていた
- b が空になるのは、内側の次元が 0 で適合している場合だけ (不適合は直前の検査で止まる)

## B. rcond と solve の条件数の検査

- 逆条件数は行列の尺度によらないので、要素の最大値が [2^-256, 2^256] の外にある行列は、2 の冪で割った複製 (厳密) で計算する (eigen・svd・schur と同じ `rangeExponent`)
  - rcond: 正方・三角・非正方 (QR の R) のすべての経路で
  - solve: 解には元の行列の LU を使い、条件数の検査だけを複製の LU で行う。複製の LU で、極小な要素がアンダーフローして厳密に特異になれば、逆条件数を 0 とする (NaN で検査をすり抜けないように)
- 範囲内の行列は、従来とまったく同じ計算

| 呼び出し | 修正前 | 修正後 |
|---|---|---|
| `rcond([[1e308,1e308],[0,1e308]])` | エラー | 0.30000000000000004 |
| 同 `triangular: true` | 0 | 0.30000000000000004 |
| `rcond([[1e308,1e308],[1e308,9.999999999999998e307]])` | 0 | 4.99e-17 (2^1023 で割った行列と同じ値) |
| `solve([[s, s], [s, s(1 − 2^-52)]], [1, 0])`、s = 2^1023 | 検査が飛ばされ、解を返す | computationally singular |

- 1e308 で割った行列の rcond (5.55e-17) と少し違うのは、1e308 での割り算が要素を丸めて、別の行列にしているため

## C. qrSolve と LAPACK の QR

- LAPACK の分解はランクを判定しない (常に min(n, p))。列ピボットで R の対角は減少するので、abs(R_kk) ≤ tol·abs(R_11) (tol は qrSolve の既定値 1e-7) ならランク落ちとして "singular matrix in qrSolve"
- R は (8, −2.5) という意味のない解を返す

## D. kappa(exact) の特異な行列

- 2 以外のノルムで、厳密に特異 (LU の対角が 0) なら Inf を返す (ファイル冒頭のコメント、2-ノルムの場合と同じ)
- **ご承認の案から絞った点:** 当初は `solve(z, { tol: 0 })` で逆行列を作る案だったが、R の fixture にあるほぼ特異な 6×6 の行列 (2-ノルムの条件数 1.5e17) で、精度の乏しい有限値を返すことになる。そこで、計算上特異な行列は従来どおり R と同じく "computationally singular" で止めることにした
- R の fixture で、R が "exactly singular" で止まる 4 件 (ゼロ行列) を、期待値 Inf に置き換えた (`test/svd.test.ts` の `substitute`)

## テスト

- `test/review31.test.ts` を追加した。src を `git stash` で戻すと、5 件すべてが失敗する
- 全体テスト: 2159 passed / 34 skipped。ほかに `distributionProperties.test.ts` の signrank が、実行時間の上限で 1 回失敗した (1067 ms)。23 回目と同じ負荷による一時的なもので、ファイル単独では 33 件すべて通った
- `npx tsc --noEmit -p .`: エラーなし
- docs (英・日) の「Where R fails」の表に、rcond・solve、qrSolve、kappa を書いた
