# Issue #57 対応ログ: qr のノルムの更新と、閾値の近くの列

GitHub Issue #57。計画は承認済み。R の判定 (t < 1e-6) を入れることはユーザー判断。

## 再現 (main `673060f`、R 4.5.2)

`linpackQR` (`src/linalg/qr.ts`) は、各変換のあとに残りの列のノルムを LINPACK の dqrdc の方法で更新し (qraux · sqrt(t)、t = 1 − (|x|/qraux)²)、`1 + 0.05 t (qraux/work)² == 1` のときだけ計算し直していた。t の桁落ちで残りのノルムがずれ、閾値 (元のノルム × tol) の近くで列の判定が R と違った。

| 入力 | 修正前 | 修正後 | R 4.5.2 |
|---|---|---|---|
| `qr([[0.3, 0.3], [0, 3.00000003e-8], [0, 0]])` (issue の例) | rank 1、pivot [0, 1] (2 列目を従属とする) | rank 2、pivot [0, 1] | rank 2、pivot 1 2 |
| R で作った閾値の近くの 41 例 (下記) | 7 例で rank が R と違う (rank 3 を 2、rank 2 を 3、rank 2 を 1 の両方向) | 41 例すべてで rank と pivot が R と一致 | — |

41 例は、6 × 3 の行列で x3 = x1 + 2 x2 + e · 1e-7 · |x1 + 2 x2| · d (d は x1、x2 に直交する単位ベクトル、e は 0.9〜1000 の 9 通り × 4 個) と、issue の行列の 3e-8 を 0.5〜3 倍した 5 例。R の `qr` の rank・pivot を `%.17g` で書き出して比べた。

## 修正

issue の説明によれば、R の dqrdc2 は t < 1e-6 なら残りのノルムを直接計算し直す。R のコードは移植せず、この規則を実装して、R の出力 (上の 41 例) で確かめた。冒頭のコメントにも、この規則が issue #57 と R の出力によることを書いた (「R's source was not read」の方針は保つ)。

- t < 1e-6 なら `qraux[j] = nrm2(残りの部分)`、そうでなければ `qraux[j] *= sqrt(t)`
- 元の判定にだけ使っていた `work` (前回計算し直したときのノルム) を消した

R に合わせる修正なので docs は変更しない。

## テスト

- `test/issue57.test.ts`: issue の例と、修正前に R と違った 7 例 (R の rank を期待値に)
- stash で、修正前に 2 件とも失敗することを確かめた
- 既存の `test/qr.test.ts` (R の fixture) と、qr を使う lm・glm などの fixture は全部通る
- 全体テスト `npx vitest run`: 2370 passed / 34 skipped、失敗 0。`npx tsc --noEmit -p .`: エラーなし
