# Issue #126 対応ログ: optimize の tol = 0 で止まらない (#74 で修正済み、変えない)

GitHub Issue #126。夜間の自律対応。判定: 再現しない (not planned)。コードの変更なし。

## 計画

- 意図: issue の主張 (`optimize((x) => x * x, -1, 1, { tol: 0 })` が止まらない、`optimize()` は tol ≥ 0 を受け付ける) が今の main で成り立つかを確かめる
- 方法: 目的関数に評価回数の上限 (10^6 回で例外) を入れて npx tsx で流す (止まりうる呼び出しなので vitest では流さない)。R 4.5.2 でも同じ呼び出しを確かめる
- 選んだ理由: HANDOFF の Issue #67〜#78 の結果に「#74 修正: optimize の tol = 0 を R と同じく拒否。localMin はステップで点が動かなければ終える (tol = 5e-324 では R も止まらない)」とある。同じ指摘なら変えない

## 確認 (main `ebc3047`)

| 呼び出し | R 4.5.2 | rStats.js |
|---|---|---|
| optimize(x², −1, 1, tol = 0) | エラー "invalid 'tol' value" | RangeError "'tol' must be a positive finite number" (`src/numerics/integrate.ts` 156 行目) |
| 同、tol = 5e-324 | (#74 のログ: R は止まらない) | optimum 0、objective 0 (上限に達せず終わる) |
| 同、tol = 1e-320 | | optimum 6.695e-321、objective 0 |
| 同、tol = 1e-300 | | optimum 7.739512542591296e-301、objective 0 |

issue の「`optimize()` explicitly accepts `tol >= 0`」は #74 (`eb90fe6`) より前のソースの記述。今の検査は `tol > 0` で、tol = 0 は R と同じく拒否する。止まらない終端の状態 (d = 0、u = x) は、#74 で足した「ステップで点が動かなければ終える」で抜ける (tol = 5e-324 で確かめた)。

テストは `test/issue74.test.ts` (tol = 0 の拒否と、極小の tol で終わること) にすでにあるので足さない。

## 判定

再現しない。#74 で修正済み (HANDOFF「Issue #67〜#78 の結果」の #74)。レビュアーが古いソースを見ていた例 (#67・#88・#97 と同じ)。

## close comment

Not reproducible on the current main: since #74 (eb90fe6), optimize rejects tol = 0 as R does (RangeError "'tol' must be a positive finite number"; R 4.5.2: "invalid 'tol' value"), and localMin stops where a step no longer moves the point. With the issue's objective x^2 on [-1, 1], tol = 5e-324 returns optimum 0, objective 0, and tol = 1e-320 returns 6.695e-321 (checked with an evaluation cap). The issue's "accepts tol >= 0" describes the source before #74. Covered by test/issue74.test.ts. See review_fix_log_issue126.md. (Not pushed yet.)
