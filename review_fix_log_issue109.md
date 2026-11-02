# Issue #109 対応ログ: dlogis で巨大な有限の scale の分母が溢れて 0

GitHub Issue #109。R も正しくない場合の修正。計画は承認済み。

## 確認 (main `7d91122`)

`src/distributions/logistic.ts` の `dlogis1` は、e = exp(−|z|) が正規化数で scale ≥ MIN_NORMAL のとき e / (scale (1 + e)²) を返していた。scale が MAX/4 程度を超えると分母が溢れて Infinity になり、サブノーマルで表せる密度が 0 になる。issue の指摘どおり (x = 0 でも同じ)。

| 呼び出し (scale = 1.282987806042392e308) | R 4.5.2 | 修正前 | 修正後 |
|---|---|---|---|
| dlogis(scale/2) | 0 | 0 | 1.8317e-309 |
| dlogis(0) | 0 | 0 | 1.9485765867968e-309 (1/(4 scale)) |
| dlogis(0, log = TRUE) | −Inf | −710.8316945846205 | 同じ |

## 修正

分母が有限なら以前と同じ式 (同じビット)。溢れるときは、サブノーマルの scale 用にすでにある e / ((1 + e)²) / scale (割り算を最後に) を使う。docs (英・日) の「R が失敗する場合」に 1 行。

## テスト

- `test/issue109.test.ts`: x = scale/2・0・−scale/3 で、正規化数の範囲で計算して 16 で割った値 (dlogis(x/16, scale/16)/16、丸めは最後の 1 回) と最小のサブノーマル 1 目盛り以内、log とも一致。x = 0 は 1/(4 scale)。通常の scale は以前と同じ。stash で、修正前に 2 件中 1 件が失敗することを確かめた (最初は exp(log 密度) を参照にしたが、log ≈ −711 の丸めで 30 目盛りほどずれるので使わなかった)
- 全体テスト `npx vitest run`: 2473 passed / 38 skipped、失敗 0。`npx tsc --noEmit -p .`: エラーなし
