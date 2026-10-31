# 外部レビュー (35 回目) 対応ログ

レポート: ユーザーがチャットに貼り付けた追加監査 (偏 ω² の分母の再掲、aovEz の自由度、aovStrata の誤差層・subject 層・警告・QR・射影の溢れ、ddLeastSquares)。R 4.5.2 (effectsize) と比べた。

## 判定

| ID | 確認した内容 | 判定 |
|---|---|---|
| EFFECTSIZE-PARTIAL-OMEGA-DENOMINATOR-01 (123、120〜122 の再掲) | ― | 34 回目に確認済み。R の effectsize と同じ定義・同じ値。記録だけ |
| aovEz の効果量の自由度 (124) | ― | レビュアーが撤回 |
| EFFECTSIZE-AOVEZ-CI-SPHERICITY-CORRECTION-01 (125) | ― | 統計的な定義の問題 (レビュアーも仕様確認とする)。effectsize と同じく補正前の自由度。記録だけ |
| EFFECTSIZE-STRATA-ZERO-RESIDUAL-DF-01 (126) | `aov(y ~ W + Error(id/W))` (1 セル 1 観測) | **誤検出。** id:W の層に W と残差 (自由度 10) があり、η² 0.07808 は R と一致 |
| AOV-STRATA-SUBJECT-STRATUM-ORDER-01 (127・129) | ― | **誤検出。** QR は LINPACK の限定ピボット (R と同じ) で、従属な列を末尾に送るだけ。独立な列の順序は元の項の順のまま |
| AOV-STRATA-SUBJECT-STRATUM-MISSING-01 (128) | ― | R の aov と同じ構成。具体例なし。記録だけ |
| **EFFECTSIZE-STRATA-FIT-WARNINGS-DROPPED-01、AOV-STRATA-SUMMARY-FIT-WARNINGS-DROPPED-01 (130・131)** | fit の "Error() model is singular" | aovSummary と効果量の結果の `warnings` は空だった。R の summary・effectsize も警告を持たない (R は当てはめ時に表示する)。**修正 (B)** |
| AOV-STRATA-DD-QR-RANK-MISMATCH-01、DD-LS-ZERO-DIAGONAL-BACKSUB-01 (132・135) | ― | 具体例なし。内部関数の前提。記録だけ |
| AOV-STRATA-ERROR-QR-NORM-OVERFLOW-01 (133) | `qr` の 4×1 (1e308) | ランク 1 を正しく返す (R も同じ)。誤答の例なし。記録だけ |
| **AOV-STRATA-TREATMENT-PROJECTION-SS-OVERFLOW-01 (134)** | `aov(y ~ x + W + Error(id))`、x を 1e200 倍 | **本物の誤り。** x の行が両方の層から消えていた。R は 1 倍のときと同じ表 (x の F は id の層で 0.317、Within で 0.724)。**修正 (A)** |

## A. 処置の列の正規化 (aovStrataFit)

- **原因:** 各処置列を誤差層へ射影したとき、その層に入るかを「射影の平方和 > 1e-14 × 列の平方和」で判定する。1e200 の共変量では、平方和が両辺とも Inf になり、Inf > Inf が偽で、どの層からも外れていた
- **修正:** 処置の各列を、その列ごとの 2 の冪で割ってから使う (厳密)
  - 層の平方和は、列が張る空間だけで決まる
  - 射影の判定は列ごとの比である
  - よって、列の倍率は結果に影響しない
- 通常の範囲の値は変わらない (R の fixture も通る)。1e200 倍の x で、1 倍のときと同じ表 (相対 1e-13 以内)

## B. 警告の引き継ぎ

- 誤差層付き aov の `aovSummary` に、当てはめの警告 (`fit.warnings`) を引き継ぐ
- 効果量 (etaSquared・omegaSquared・epsilonSquared) は、誤差層付きの当てはめか、その要約を受け取ったとき、その警告を結果の `warnings` に引き継ぐ
- R とは違う (R は当てはめ時に表示するだけ) ので、docs の formula の節の後に書いた

## テスト

- `test/review35.test.ts` を追加した。src を `git stash` で戻すと、2 件とも失敗する
  - 特異な誤差モデルの例は `Error(id + g)` で、g は id をまとめた群 (g の列が id の列空間に入る)
- 全体テスト: 2176 passed / 34 skipped、失敗 0
- `npx tsc --noEmit -p .`: エラーなし
