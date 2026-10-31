# 外部レビュー (44 回目) 対応ログ

レポート: ユーザーがチャットに貼り付けた数値線形代数の監査 (`src(3).zip`。expm・qr・lu・balance・solve・matrix・norm・ops)。確定指摘は 1 件で、コードの変更はない。

## 判定

| ID | 確認した内容 | 判定 |
|---|---|---|
| LIN-001 (`rcond` の `triangular: true` で非正方行列をエラーにしない) | `A = rbind(c(1,0,99), c(0,2,88))` に、`triangular` なし・U・L・norm I、`t(A)` に `triangular = TRUE` | **R 4.5.2 と同じ (誤検出)。** R の `rcond` は、`triangular` を見る前に `d[1L] != d[2L]` を判定し、`rcond(qr.R(qr(...)), triangular = TRUE, uplo = "U", norm = norm)` を返す。R の値はどれも 0.011703797227103658 で、エラーにならない。レビュアーが根拠とした `La_dtrcon` の正方行列の検査には、`rcond` からは到達しない。rStats.js (`src/linalg/solve.ts:471-476`) も同じ順序で、0.011703797227103595 (QR の実装の差で相対 5e-15)。非正方行列に「三角行列として」の条件数はなく、R 因子の条件数を返すのは数学的にも筋が通る。変更しない |
| 正方行列の triangular (確認用) | `[[2,5],[0,3]]` の U・L | R 0.1071429 / 0.6666667、rStats.js 0.10714285714285715 / 0.6666666666666666 で一致 |
| expm・qr・lu・balance (3 節) | ― | レビュアーの判定も確定バグなし |
| 要再現の一覧 (5 節: expm の CGS の収束、非正規行列の balancing、非正規化数での Householder、NaN を含む LU のピボット、ノルムが溢れる行列のスケーリング) | ― | 具体的な誤答の例がないので、記録だけ。expm の CGS の未収束は 30 回目の記録 (HANDOFF の「記録だけにしたもの」) に含まれる。ノルムが溢れる行列は、eigen・svd・schur・rcond で 2 の冪の正規化を済ませてある (HANDOFF の共通基盤) |
