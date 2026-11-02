# Issue #95 対応ログ: dnbinom (mu) で p か q が double の範囲より下に落ちる

GitHub Issue #95。ユーザー判断: dnbinom だけ直す (pnbinom・qnbinom は範囲外として記録)。計画は承認済み。

## 確認 (main `62fb86a`)

`src/distributions/negbinomial.ts` の `fromMu` は、p = size/(size + mu) と q = mu/(size + mu) を double-double で作る。比が 2^-1074 より小さいと 0 になり、`dbinomRawDD` (`src/special/loader.ts`) が p = 0 / q = 0 を見て確率 0 を返していた。issue の指摘 (p 側と q 側の両方) は正しい。

参照値は Rmpfr (3000 ビット) の log P = lgamma(x + n) − lgamma(n) − lgamma(x + 1) + n log(n/(n + mu)) + x log(mu/(n + mu))。入力の double は、Windows 版 R のリテラルの丸めを避けるため、厳密な仮数と指数で渡した。

| 呼び出し (log) | 真値 | R 4.5.2 | 修正前 | 修正後 |
|---|---|---|---|---|
| dnbinom(1, 1e-200, mu = 1e200) | −460.517018598809137 | −Inf | −Inf | 一致 |
| dnbinom(0, 1e-200, mu = 1e200) | −9.21034037197618e-198 | | −Inf (確率はほぼ 1) | 一致 |
| dnbinom(5 / 1e5, 1e-200, mu = 1e200) | −462.126…、−472.029… | | −Inf | 一致 |
| dnbinom(1, MAX, mu = MIN) | −744.440071921381 | −744.4401 | −Inf | 一致 (線形 MIN) |
| dnbinom(1, 1e300, mu = 1e-300) | −690.775527898214 | | −Inf | 一致 |

比がサブノーマル (0 ではない) か 1e-290 程度の 13 件 ((1e-160, 1e160)、(1, MAX)、(1e300, 1e10) など) は、修正前から 2.3e-15 以内で正しかった。

## 修正

`bd0Prod` (loader.ts) は、もともと n p が 1e-290 未満の場合を log n + log p で扱う。足りなかったのは、p (か q) そのものを 0 にせずに渡す手段だけだった。

- `dbinomRawDD` に省略可能な引数 `shift` を足した: p・q はそれぞれ 2^shift 倍して渡す (既定 [0, 0] で、計算は以前と同じビット)。`bd0Prod` の n p (k > 0 では n を [1, 2) に寄せてから掛ける。仮数は最大 2^78 なので、そのままでは積が溢れうる)、log p (− k ln 2)、x = 0 と n − x = 0 の枝の n p・n log p が、この倍率を扱う
- `fromMuDensity` (dnbinom の mu の経路だけ): 小さいほうの比が 2^-1022 未満 (0 かサブノーマル) なら、比 × 2^1100 = (小さいほう × 2^550)/((size + mu) × 2^-550) (2 の冪の掛け算は厳密) を正規化数で持ち、shift に 1100 を入れる。pnbinom・qnbinom は今の `fromMu` のまま
- docs (英・日) の「R が不正確な場合」(分布) に 1 行

## テスト

- `test/issue95.test.ts`: 上の 20 件 (修正前に 0 / −Inf だった 6 件と、もとから正しかった 14 件) の log と線形の値、dnbinom(1, MAX, mu = MIN) = MIN。stash で、修正前に 3 件中 2 件が失敗することを確かめた
- 掃引 (scratchpad の i95sweep.mjs): 比が 2^-1022 未満になる (size, mu, x) を対数一様に 300 組選び、Rmpfr の log と比べて最大 2.1e-16 (相対、|log| が 1 未満では絶対)
- 全体テスト `npx vitest run`: 2448 passed / 38 skipped、失敗 1 (既知の揺れの signrank の実行時間。ファイル単独では 33 件すべて通る)。`npx tsc --noEmit -p .`: エラーなし

## 範囲外として記録 (ユーザー判断)

- pnbinom・qnbinom の同じ比: `fromMu` の p か q が 0 になり、不完全ベータ関数が端点として扱う。issue の `pnbinom(0, MAX, mu = MIN, lowerTail: false, logP: true)` は −Inf のまま (真値 −744.44、R も −Inf)。`pnbinom(1, 1e-200, mu = 1e200, logP: true)` も −Inf (真値はほぼ 0)。直すには分布関数を対数の級数などで組み直す必要があり、q 側で size が mu よりはるかに大きい場合は Poisson に近い和を扱う必要もある
