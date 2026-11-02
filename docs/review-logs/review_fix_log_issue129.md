# Issue #129 対応ログ: eigen の固有ベクトルの正規化で二乗が溢れる (再現しない、変えない)

GitHub Issue #129。夜間の自律対応。判定: 再現しない (not planned)。コードの変更なし。ただし確認中に別の不具合を見つけた (下の「範囲外として記録」、朝の判断のため)。

## 計画

- 意図: issue の主張 (`normalizeVectors` が |v_i|^2 を直接足すので、gebak で 1e154 を超えた成分の二乗が溢れ、固有ベクトルが 0 になる) が今の main で起きるかを確かめる
- 方法: issue の例 `[[1, 1e200], [0, 2]]` と、規模を変えた三角行列、gebal が実際に大きな尺度を付ける非三角の行列 (`[[1, 1e200], [1e-200, 2]]` など) を npx tsx と R 4.5.2 で比べる
- 選んだ理由: 再現しなければ変えない。再現すれば正規化だけの局所的な修正になるはず

## 確認 (main `59aa388`)

固有ベクトルは列で書く (λ の順)。

| 行列 (行ごと) | R 4.5.2 | rStats.js |
|---|---|---|
| [1, 1e200; 0, 2] (issue の例) | 2, 1。(1, 1e-200)、(1, 0) | 同じ (1e-200 は 0x1.87e92154ef7a9p-665 で R と同じ値) |
| [1, 1e300; 0, 2]、[1, 1e308; 0, 2] | (1, 1e-300)、(1, 1e-308) | 同じ |
| [2, 1e200; 0, 1] | (1, 0)、(−1, 1e-200) | (1, 0)、(1, −1e-200) (符号だけ違う) |
| [1, 1e200, 0; 0, 2, 1e200; 0, 0, 3] | λ=3 は (1, 2e-200, 0) | 同じ |
| [1, 1e100; 1e-100, 2] (gebal が 1e100 の尺度を付ける) | 2.618034、0.381966。(1, 1.618034e-100) | 2.618033988749895、0.3819660112501051。(1, 1.618033988749895e-100) |

どの例でも固有ベクトルは 0 にならない。三角行列では gebal は置換だけで尺度を付けないので、gebak の後の成分は 1 程度で二乗は溢れない。非三角の行列で尺度が付いても、溢れる前に下の「全体の正規化」で行列が割られるので、この経路で 1e154 を超える成分は作れなかった。

`normalizeVectors` (`src/linalg/eigen.ts` 386 行目) が二乗を直接足すのは issue のとおりだが、届く入力が見つからないので変えない (共通基盤の「必要なときだけ正規化」。誤答の具体例が見つかれば直す)。

## 判定

再現しない。issue の例は R と同じ正しい値 (単位長、0 でない)。

## 範囲外として記録

1. **(新しい不具合、朝に判断を) 全体の正規化で小さな要素が 0 に落ち、固有値が誤る。** `eigen` は要素の最大値が [2^-256, 2^256] の外なら `rangeExponent` で 2^-k 倍してから分解する (`src/linalg/eigen.ts` 91 行目、共通基盤「eigen・svd・schur」)。このとき 1e-200 などの小さな要素がアンダーフローして 0 やサブノーマルになり、行列が変わる

   | 行列 | 真の値 | R 4.5.2 | rStats.js |
   |---|---|---|---|
   | [1, 1e200; 1e-200, 2] | 2.618034、0.381966 | 2.618034、0.381966 | **2、1** (1e-200 が 0 に落ちて三角行列になる) |
   | [0, 1e200; 1e-200, 0] | 1、−1 | 1、−1 | **0、0** |
   | [1, 1e160; 1e-160, 2] | 固有ベクトル (1, 1.618034e-160) | (1, 1.618034e-160) | (0.9999999999999999, 1.618006792591244e-160)、相対 1.7e-5 の誤差 (サブノーマルに落ちて桁を失う) |
   | [1, 1e300; 1e-300, 2] | 2.618034、0.381966 | **2、1** (R も誤り) | 2、1 |

   #73 (kappa) で「割ると 0 でない要素が正規化数の下に落ちる行列は割らない」とした判断と同じ種類。svd・schur・rcond・solve の同じ正規化も同じ穴があるかもしれない (未確認)。R と違う値 (R が正しい範囲で誤る) なので、直すべきと考えるが、方法 (割らない / 要素ごとの尺度 = 対角相似変換を先に掛ける / 2^-k の座標でもサブノーマルを避ける) は判断が要る
2. 分類者が報告した `eigen([[1, 1e-300], [0, 2]])` の λ = 2 の固有ベクトル: rStats.js は (0, 1)、R 4.5.2 も (0, 1)。真の単位ベクトルは (1e-300, 1)。[1, 1e-200; 0, 2]・[1, 1e-320; 0, 2] も同じく (0, 1) (R も)。最大要素が 2 なので全体の正規化は入らず、LAPACK 型の dhseqr・dtrevc の経路で落ちている (成分の誤差 1e-300 は ‖A‖ ε より小さく、後退誤差としては安定)。R と同じで誤差も後退安定の範囲なので記録だけ
3. 3×3 の [1, 1e200, 0; 0, 2, 1e200; 0, 0, 3] で R の最大の固有値は 3.0000000000000004 (0x1.8000000000001p+1)、rStats.js は 3 (正しい)

## close comment

Not reproducible on the current main. The issue's matrix [[1, 1e200], [0, 2]] gives values 2, 1 and the eigenvector (1, 1e-200) for 2 (unit length, not zero), the same doubles as R 4.5.2; so do 1e300 and 1e308 in place of 1e200, and a 3x3 chain with 1e200. For a triangular matrix gebal only permutes, so gebak does not produce components near sqrt(Number.MAX_VALUE); where it does scale (for example [[1, 1e100], [1e-100, 2]]), the matrix is first divided by a power of 2 when its largest entry is beyond 2^256, so no input found reaches an overflowing sum of squares in normalizeVectors. Recorded for later in review_fix_log_issue129.md: that overall power-of-2 scaling flushes small entries to zero (eigen([[1, 1e200], [1e-200, 2]]) gives 2, 1 instead of 2.618, 0.382, which R gets right); this will be handled separately. (Not pushed yet.)
