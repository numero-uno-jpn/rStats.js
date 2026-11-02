# Issue #56 対応ログ: kappa (exact) と ginv で、特異値が溢れる行列

GitHub Issue #56。計画は承認済み。

## 再現 (main `bbc21ea`、R 4.5.2)

`svd` (`src/linalg/svd.ts`) は、極端な大きさの行列を 2 の冪 2^−s で縮めて分解し、特異値を 2^s 倍して返す。特異値が最大の double を超えると Inf になり、それを使う `kappa` (exact、norm "2") と `ginv` が壊れていた。

a = 1.7e308、m = [[a, a], [a, −a]] (直交行列の定数倍。特異値は sqrt(2) a が 2 つ):

| 呼び出し | 修正前 | 修正後 | R 4.5.2 |
|---|---|---|---|
| `kappa(m, { exact: true })` | NaN (Inf/Inf) | 1.0000000000000002 | NaN |
| `ginv(m)` | 零行列 (閾値 tol · Inf = Inf で、すべての成分を捨てる) | ±2.941176470588236e-309 (1/(2a)) | 零行列 (MASS::ginv) |
| `svd(m).d` | [Inf, Inf] | 同じ (特異値そのものは溢れる) | [Inf, Inf] |
| `kappa([[1e-300, 3e-300], [2e-300, 4e-300]], { exact: true })` | 14.933034373659245 | 同じ | 14.933034373659265 |

## 修正

- `svd.ts` に内部用の `svdScaled` を置いた。縮めた尺度の特異値 `d` と指数 `s` (と u、v) を返す。公開の `svd` はこれを使い、今どおり d を 2^s 倍して返す
- `kappa` (exact、"2"): 縮めた特異値の比
- `ginv`: 縮めた特異値で閾値と 1/d_k を作って和を取り、最後に 2^−s 倍する (1 回だけ丸める。サブノーマルの結果も表せる)
- s = 0 (通常の大きさ) では今と同じ計算。s ≠ 0 でも、溢れ・アンダーフローがなければ縮尺は厳密なので値は変わらない
- docs (`docs/differences-from-r.md` と `docs/ja/`) の「R が失敗し、rStats.js が値を返す場合」の表に 1 行足した

## テスト

- `test/issue56.test.ts`: 上の表の値 (kappa は 1 と相対 1e-15、ginv は 0.5/a と相対 1e-14)。通常の大きさと 1e-300 の大きさの kappa、通常の ginv、`svd(m).d` は今と同じ
- 途中で、テストの期待値の `1 / (2 * a)` が溢れて 0 になる誤りを直した (`0.5 / a`)
- stash で、修正前に 2 件が失敗することを確かめた
- 全体テスト `npx vitest run`: 2366 passed / 34 skipped、失敗 2。失敗はどちらも `test/distributionProperties.test.ts` の実行時間の上限 (nchisq の qchisq が 1027 ms、`dsignrank(302775, 1100)` が 2180 ms)。負荷によるもので、ファイル単独では 33 件すべて通る。`npx tsc --noEmit -p .`: エラーなし
