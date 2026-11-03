# Issue #120 対応ログ: distSummary("lnorm") の sd・歪度が小さな sdlog で σ² のアンダーフローを受ける

GitHub Issue #120。R の関数ではないので docs は不要。計画は承認済み。

## 確認 (main `d489c7e`)

`src/distributions/summary.ts` の lnorm は s2 = σ²、em1 = expm1(s2) から sd = √em1 e^(μ + s2/2)、歪度 (w + 2) √em1 を作る。σ² が 0 やサブノーマルに落ちると √em1 が 0 や不正確になる。issue の指摘どおり。

| sdlog (meanlog = 0) | 真値 sd、歪度 | 修正前 | 修正後 |
|---|---|---|---|
| 1e-200 | 1e-200、3e-200 | 0、0 | 1e-200、3e-200 |
| 1e-160 | 1e-160、3e-160 | 9.99994433575849e-161、2.999983300727547e-160 (σ² がサブノーマル、相対 5.6e-6) | 1e-160、3e-160 |
| 1e-150、1e-8、0.5 | | 正しい | 同じ |

分散 (≈ σ²) と尖度 (≈ 16 σ²) は表せないほど小さいので、0 (やサブノーマル) のままでよい。

## 修正

√em1 を、s2 < 1e-280 なら sdlog そのもの (expm1(s2)/s2 は double の精度で 1)、それ以外は Math.sqrt(em1) (以前と同じビット) にして、歪度と sd に使う。

## テスト

- `test/issue120.test.ts`: sdlog = 1e-200・1e-160・1e-150、meanlog = 0・2 で sd = σ e^μ、歪度 = 3σ (相対 1e-15)、σ = 1e-200 の分散は 0。σ = 0.5・1e-8 は以前と同じ。stash で、修正前に 2 件中 1 件が失敗することを確かめた
- 全体テスト `npx vitest run`: 2493 passed / 38 skipped、失敗 0。`npx tsc --noEmit -p .`: エラーなし

## Reopened (session 12, 2026-11-03)

### Plan

- Intent: the reviewer reopened #120 with new reproductions after bc3af1f. The variance was still `em1 * exp(2 meanlog + s2)`: with `s2` underflowing and the exponential overflowing it is 0 * Inf = NaN, with a subnormal `s2` it is Inf, and with `expm1(s2)` overflowing (s2 > 709.78) it is Inf although the variance is e^458. The sd took the same route there (`rootEm1 * exp(meanlog + s2 / 2)` with `rootEm1` Inf).
- Method: a fallback only where the product is not in [2^-1022, Inf): log sd = meanlog + s2 / 2 + log(em1) / 2 in double-double (`twoProd` for s2; log(em1) as 2 log sdlog for s2 < 1e-280, `ddLog(em1)` for s2 <= 1, s2 + log(1 - e^-s2) above), then `ddExp`. The variance is exp(2 log sd); the sd keeps the old value where both of its factors (rootEm1 and exp(meanlog + s2 / 2)) are finite and normal, otherwise exp(log sd). Where the product is in range nothing changes (same bits).
- Why log coordinates: the factors over- and underflow on opposite sides, so no single power-of-2 rescaling covers all cases; the double-double argument keeps the relative error of exp at the rounding level (an argument of 800 rounded to double would cost about 1e-13).

### Check (main `5bbb956`)

References: Rmpfr at 400 bits from the exact binary64 inputs (hex floats; Windows R misrounds the literals 1e-160 and 1e-200).

| meanlog, sdlog | before: variance, sd | after: variance, sd | reference |
|---|---|---|---|
| 400, 1e-200 | NaN, 5.2214696897641445e-27 | 2.7263745721125664e-53, same sd | 0x1.4e40a71d38483p-175, 0x1.9daffcaac6e19p-88 |
| 400, 1e-160 | Infinity, 52214696897641.445 | 2.7263745721125665e27, same sd | 0x1.19e688b68cc5bp+91, 0x1.7be973af634b8p+45 |
| -500, 27 | Infinity, Infinity | 8.069984706534065e198, 2.840771850489593e99 | 0x1.afd52cae8b9e7p+660, 0x1.4c7d46b30e5bp+330 (both exact) |
| -1100, 26 | 0, 0 | 0, 7.230022902708112e-185 | 5.2e-369 (0), 0x1.3a9591d939844p-612 (exact) |
| 0, 1e-200; 0, 1e-160; 300, 20; 0, 0.5 | | unchanged | |

The kept sds are 1 ulp from the reference (the old product). The last row of the first table (-1100, 26) was found while checking: exp(meanlog + s2 / 2) underflows while the sd is normal.

### Fix

- `src/distributions/summary.ts`, `case "lnorm"`: the fallback above.

### Tests

- `test/issue120.test.ts`: block "issue #120 (reopened)" with the four rows (relative 1e-15). With `src/` stashed it fails; the earlier blocks pass on both.
- distSummary tests (21 files) and `npx tsc --noEmit -p .`: pass, no errors.

### Out of scope (recorded)

- None.

## close comment

Reopened case fixed in <commit of #120, see git log --grep='#120'>: where the variance `expm1(sdlog^2) * exp(2 meanlog + sdlog^2)` is not finite or falls below the normal range, distSummary('lnorm') now rebuilds it (and the sd, where its factors over- or underflowed) from log sd = meanlog + sdlog^2/2 + log(expm1(sdlog^2))/2 in double-double. meanlog 400, sdlog 1e-200 gives variance 2.7263745721125664e-53 (was NaN), meanlog 400, sdlog 1e-160 gives 2.7263745721125665e27 (was Inf), meanlog -500, sdlog 27 gives variance 8.069984706534065e198 and sd 2.840771850489593e99 (were Inf), all correctly rounded against Rmpfr. Values in the normal range are unchanged. Test: test/issue120.test.ts. (Not pushed yet.)
