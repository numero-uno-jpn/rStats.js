# Issue #43 対応ログ: fisherTest の confLevel 0 と 1 (判定のみ、コード変更なし)

GitHub Issue #43。指摘は誤り。not planned で close する。

## 確認 (main `3a01776`、R 4.5.2)

issue は「R 4.5.2 の fisher.test は `< 0 || > 1` だけを拒否し、閉区間 [0, 1] を受け付ける」としている。ローカルの R 4.5.2 (2025-10-31 ucrt) の `deparse(stats::fisher.test)` の検査は次のとおりで、開区間 (0, 1) だけを受け付ける:

```r
if (!((length(conf.level) == 1L) && is.finite(conf.level) &&
    (conf.level > 0) && (conf.level < 1)))
    stop("'conf.level' must be a single number between 0 and 1")
```

実行しても、`fisher.test(matrix(c(1, 3, 2, 4), 2), conf.level = 0 / 1)` は、alternative の 3 通りのすべてでこのエラーになる。端の表 (a = 0、c = 0) でも同じ。

rStats.js の `fisherTest` (`src/htest/fisherTest.ts`) も、0 と 1 は RangeError ("confLevel must be a single number between 0 and 1")。R と一致している。

ライブラリの検査は、関数ごとに R に合わせる作り (`src/htest/types.ts` のコメント。今回は fisherTest 以外を R と照らしていない)。閉区間は `checkConfLevel` (tTest、cor、brunnerMunzel、poissonTest の 1 標本)、開区間は `checkConfLevelOpen` (binomTest、propTest、varTest、mantelhaenTest など) と fisherTest。

## 判定

変更なし。
