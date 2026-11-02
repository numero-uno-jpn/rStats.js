# Issue #137 対応ログ: 非心 t の Laplace 経路で二乗が溢れる (再現しない、変えない)

GitHub Issue #137。夜間の自律対応。判定: 再現しない (not planned)。コードの変更なし。

## 計画

- 意図: issue の主張 (df = 200002、ncp = 1e200、t = T0 で `laplace()` の v² が溢れ、NaN か崩れた台形和になる) を実行して確かめる。issue は静的な追跡だけで、実行していない
- 方法: npx tsx で dt (log) と pt (上側、log) を T0 とその前後で計算し、参照値と比べる。参照値は、δ が Z より 200 桁大きいので P(T > t) = P(S < δ/t) (S = sqrt(V/df)、V ~ χ²_df) の R の `pchisq(df (δ/t)², df, log.p = TRUE)`。この規模では冪の裾 P ∝ t^(−df) なので密度は log P + log(df/t)
- 選んだ理由: 有限の正しい値が返れば変えない

## 確認 (main `a44741a`)

issue の T0 の値 (約 3.1623e217) は誤り。`1e10 * (1e200 + 10) * Math.sqrt(100002)` は 3.1623092827868684e212 (issue の式どおりに計算した値)。両方の t で確かめた。

| t | 参照 log P(T > t) | rStats.js pt (上側、log) | 参照 log 密度 | rStats.js dt (log) | R 4.5.2 pt / dt |
|---|---|---|---|---|---|
| 3.1623092827868684e212 (issue の式の T0) | −5656527.9725195384 | −5656527.972519538 | −5657005.0657791542 | −5657005.065779153 | −0.6931472 / −Inf |
| T0 の 1 ulp 下・上 | | 同じ値 | | 同じ値 | |
| 3.1623e217 (issue に書かれた値) | −7959135.5042686611 | −7959135.504268662 | −7959624.1104508061 | −7959624.110450806 | −0.6931472 / −Inf |
| 1e200 (分布の中心) | | −0.6923064940203811 | | −454.9863430520054 | |

どれも 1 ms 以内に有限の値を返し、参照と相対 1e-16 程度で一致する。NaN も、崩れた台形和による誤った値も出ない。R はこの規模で pt が log(1/2) 近く、dt が −Inf (どちらも誤り)。

非心 t の遠い裾は #66 で作り直した (HANDOFF の共通基盤「非心 t の遠い裾」: `farLogEstimate` > 2^30 か |δ| > 2^32 で `zTail` → `laplace` (ピークが外なら undefined) → `laplaceWide` (2^(2k) の尺度、u を double-double で) → …)。|δ| = 1e200 > 2^32 で t δ > 0、t/sqrt(2a) ≈ 7e209 ≥ 2^12 なので、`integrate` (`src/distributions/nt.ts` 397 行目) は `laplace()` の手前で `zTail` を返す。issue の追跡した `laplace()` の v² には届かない。

## 判定

再現しない。issue の T0 の値も誤り (式の値は 3.16e212)。#66 で作り直した経路で、どちらの t でも正しい値を返す。

## close comment

Not reproducible on the current main. With df = 200002 and ncp = 1e200, the issue's formula gives T0 = 3.1623092827868684e212 (not 3.16e217 as written); at that t, dt(..., log) is -5657005.065779153 and pt(..., upper, log) is -5656527.972519538, matching the reference -5657005.0657791542 and -5656527.9725195384 (P(T > t) = P(S < ncp/t) from R's pchisq, exact here since ncp is 200 orders above Z), and the same at 1 ulp either side; at 3.1623e217 the values -7959624.110450806 and -7959135.504268662 also match. All are finite and return within a millisecond. With |ncp| > 2^32 and t/sqrt(df) far beyond 2^12, integrate returns from zTail (the far-tail path added in #66) before laplace(), so the squaring traced in the issue is not reached. R 4.5.2 gives -0.693 and -Inf here. See review_fix_log_issue137.md. (Not pushed yet.)
