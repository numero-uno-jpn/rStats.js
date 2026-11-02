# Issue #135 対応ログ: 非心 F で m/n がアンダーフローして log が -Inf

GitHub Issue #135。夜間の自律修正 (Plan モードの代わりに計画をここに書く)。

## 計画

- 意図: 非心 F の `pnfTiny`・`dnfCore` (q が小さい級数の初項) が `Math.log(m / n)` を取り、有限の正の自由度で m/n が 0 にアンダーフローすると -Inf になる。さらに、級数に入る判定 `(m / n) * q < 1e-306` も 0 になった比で判定するので、x = m q/(n + m q) が小さくない q (issue の例 q = 1e100 では x = 1e-300、q = 1e300 では 1e-100) まで級数に送っていた。どちらも正しくする
- 方法: `logRatio(m, n)` (m/n が正規化数なら今の `Math.log(m / n)`、それより下なら `log m − log n`) と `tinyFx(q, m, n)` (m/n が正規化数なら今の `(m / n) * q < 1e-306`、それより下なら log で判定) を足し、`dnfCore`・`pnfTiny`・`pnfRaw`・`pnf1` の 4 か所で使う
- 選んだ理由: issue の案 (log m − log n) に、判定の側の同じ原因を加えた。m/n が正規化数の範囲では式が同じで、通常の入力はビットが変わらない (方針)。サブノーマルの比も log の差にしたが、サブノーマルは精度が落ちるのでこの方が正確 (下の表の m/n = 1e-310 の例は同じビットだった)

## 確認 (main `b05ad93`)

issue の指摘どおり -Inf。ただし issue の例の q = 1e100 は x = 1e-300 で級数の範囲ではなく、正しい値は一般の経路で出る (級数の初項 j = 0 だけでは、j = 1 の項が支配する密度を誤る)。

参照: df2 = 1e200 では F は χ²(df1, ncp)/df1 (ずれは double の精度よりはるかに小さい)。R の `dchisq(df1 q, df1, ncp = 1, log = TRUE) + log(df1)` と `pchisq(df1 q, …)`。

| 呼び出し (ncp = 1、log) | R | 修正前 | 修正後 | 参照 |
|---|---|---|---|---|
| pf(1e100, 1e-200, 1e200) | -0.49999999999999933 | -Inf | -0.5 | -0.49999999999999964 |
| pf(1e100, 1e-200, 1e200, upper) | -0.9327521295671891 | -0 | -0.9327521295671886 | -0.93275212956718914 |
| df(1e100, 1e-200, 1e200) | Inf | -Inf | -462.403312959929 | -462.40331295992905 |
| pf(1e300, 1e-200, 1e200) | -0 | -Inf | 0 | 0 |
| pf(1e300, 1e-200, 1e200, upper) | -Inf | -0 | -5e99 | 約 -m q/2 = -5e99 |
| df(1e300, 1e-200, 1e200) | Inf | -Inf | -5e99 | 約 -5e99 (R の dchisq は -2.5e99 で、R の dchisq の遠い裾の既知の誤り) |
| pf(1e-100, 1e-200, 1e200) | -0.49999999999999933 | -Inf | -0.5 | -0.49999999999999964 |
| df(1e-100, 1e-200, 1e200) | NaN (警告) | -Inf | -231.45165647996453 | -231.45165647996456 |
| pf(1e100, 1e-200, 1e200, ncp = 0) | -1.151872204075315e-198 (中心の pf) | -Inf | -1.151872204075315e-198 | |
| pf(1e100, 1e-300, 1e10) (m/n = 1e-310) | | -0.500000000000006 | 同じ | |

## 修正

`src/distributions/nbeta.ts` に `logRatio`・`tinyFx` を足し、上の 4 か所で使う。docs (英・日) の differences-from-r の非心分布の表に、R が Inf を返す df の行を 1 行。

## テスト

- `test/issue135.test.ts`: 上の表 (相対 1e-14、-5e99 の行は 1e-10)、ncp = 0 が中心の pf と一致、m/n が 0 にならない入力は以前のビット。stash で、修正前に 2 件中 1 件が失敗することを確かめた
- 全体テスト `npx vitest run`: 2509 passed / 38 skipped、失敗 0。`npx tsc --noEmit -p .`: エラーなし

## 範囲外として記録

q が小さい級数 (`pnfTiny`・`dnfCore` の初項) そのものの適用範囲の問題。m/n のアンダーフローとは別で、修正前からある。初項は Poisson の j = 0 の項だけで、(1 − x)^b ≈ e^(−m q/2) と不完全ベータ関数の内側の級数も落としている。落とした項の比は、密度で約 λ q/2、分布関数で約 λ m q/4 と m q/2 で、x < 1e-306 でも q や m q が小さいとは限らない (df2 が巨大か、df1 が極小のとき)。

| 呼び出し (ncp = 1、log) | rStats.js | 参照 |
|---|---|---|
| pf(50, 2, 1.7e308) | 3.412023005428182 (P > 1) | -3.6353106140325111e-19 (R の pchisq(100, 2, ncp = 1)) |
| df(50, 2, 1.7e308) | -0.49999999999996403 | -42.623943633089773 (R の dchisq(100, 2, ncp = 1) + log 2) |
| df(1e10, 1e-200, 1e200) | -484.7360167093096 (修正前は -Inf) | -462.40331295972908 (χ² 極限) |
| df(1, 1e-100, 1e207) (m/n は正規化数、修正の前後で同じ) | -231.45165647996453 | j = 1 以降の項が j = 0 と同じ規模 |

直すには、級数に入る条件に落とした項の大きさ (λ q、m q) を加え、df2 が巨大な場合は既存の "chisq" の方法 (y = −2b log(1 − x) ≈ m q n/(n + m q)) に、そうでない場合は j の和をとる形にする必要がある。経路の設計の変更になるので、別の issue として扱うのがよい。

ほかに、`dnf1` の `negligibleNcp` の引数 `(1 + n / m) / (1 + n / (m * x))` は n/m が溢れると NaN (判定が偽になり、非心の経路に進むので値は誤らない)。`fOdds` の `n / m / q` も n/m が溢れうるが、x が 1 に近いときだけ使い、log の側 (`lk`) は log の差で作っている。

## close comment

Fixed in <commit of #135, see git log --grep='#135'>: where df1/df2 is below the normal range (it underflows to 0 for finite positive degrees of freedom), log(df1/df2) is now log df1 - log df2, and the switch to the tiny-q series tests df1 q/df2 from that log instead of from the underflowed ratio (which also sent q = 1e100 and 1e300 to the series, though x = 1e-300 and 1e-100 there). Elsewhere the bits are unchanged. With df1 = 1e-200, df2 = 1e200, ncp = 1: pf(1e100, logP) is -0.5, df(1e100, log) -462.403312959929 (the χ² limit from R's dchisq: -462.40331295992905; R's df gives Inf, recorded in docs/differences-from-r.md), and pf(1e300, logP) is 0 (all were -Inf). Test: test/issue135.test.ts. The tiny-q series itself keeps only the first term and is inaccurate where df2 is huge or df1 tiny with q not small (e.g. pf(50, 2, 1.7e308, ncp = 1) > 1, as before); recorded in review_fix_log_issue135.md for a separate issue. (Not pushed yet.)
