# Issue #144 対応ログ: distSummary triang の歪度が広い台で NaN

GitHub Issue #144。夜間の自律修正 (Plan モードの代わりに計画をここに書く)。

## 計画

- 意図: `distSummary("triang")` の歪度 √2 (a+b−2c)(2a−b−c)(a−2b+c) / (5 q^1.5) をパラメータそのもので作るので、3 乗の規模 (分子と q^1.5) が溢れるかアンダーフローすると NaN になる。対称な (−1e308, 1e308, 0) の歪度は 0 のはず
- 方法: 歪度は尺度によらないので、最大の |パラメータ| が [2^-300, 2^300] の外のときだけ、sd のために既にある 2 の冪で割った as・bs・cs・qs から作る
- 選んだ理由: 範囲内では分子の 3 つの積も q^1.5 も正規化数の範囲に収まり (差は 0 か ulp(最大値) 以上)、式も入力も同じなのでビットが変わらない。常に割った値で作ると `**1.5` の丸めで通常の値が変わりうる。issue の案 (既存の as・bs・cs・qs を使う) に、境界の判定を加えた

## 確認 (main `8828e38`)

| a, b, c | 修正前 | 修正後 |
|---|---|---|
| -1e308, 1e308, 0 | NaN | 0 |
| 0, 3e200, 1e200 | NaN | 0.30544141932848506 |
| 0, 3e120, 1e120 (q^1.5 が溢れて Inf/Inf) | NaN | 0.3054414193284852 |
| 0, 3e-120, 1e-120 (3 乗がアンダーフローして 0/0) | NaN | 0.305441419328485 |
| 0, 3e-200, 1e-200 | NaN | 0.30544141932848506 |
| 0, 1.5e308, 1e308 | NaN | -0.30544141932848495 |
| 0, 3, 1 | 0.305441419328485 | 同じ |

参照: (0, 3, 1) の歪度 √2 · 1 · (−4)(−5) / (5 · 7^1.5) = 0.305441419328485 (R の閉じた式も同じ)。1e200 などは 10 進のリテラルの比が厳密に 3:1 でないので最下位が違う。2^k 倍 (k = −1072 … 1022) の入力は (0, 3, 1) と相対 1e-15 以内。

## 修正

- `src/distributions/summary.ts` の triang: 最大の |パラメータ| の指数 e が [−300, 300) の外なら、歪度を as・bs・cs・qs から
- docs (英・日) の distSummary の行に追記 (R の閉じた式も NaN)

## テスト

- `test/issue144.test.ts`: 対称で 0、2^k 倍で尺度によらない、範囲内は以前のビット (1e50 の値は修正前の実装の値)。stash で、修正前に 3 件中 2 件が失敗することを確かめた
- 全体テスト `npx vitest run`: 259 files、2520 passed / 38 skipped、失敗 0。`npx tsc --noEmit -p .`: エラーなし

## 範囲外として記録

- 同じ triang の分散 `q / 18` は、q の項 (a²、b² など) が溢れると Inf − Inf で NaN になる。(0, 3e200, 1e200) と (0, 1.5e308, 1e308) で variance が NaN (真の値は溢れるので Inf が正しい)。(−1e308, 1e308, 0) は Inf。sd は sdDirect で正しい。issue は「分散は Inf に溢れてよい」としているが、NaN は Inf ではない。直すなら、q が有限でないときは ldexp(qs / 18, 2e) とする (溢れれば Inf)

## close comment

Fixed in <commit of #144, see git log --grep='#144'>: the skewness of distSummary("triang") is scale-free, so where the largest absolute parameter is outside [2^-300, 2^300] (where the cubes could overflow or underflow) it is now formed from the parameters divided by a power of 2 (the as, bs, cs, qs already used for sd); inside, the bits are unchanged. distSummary("triang", { a: -1e308, b: 1e308, c: 0 }).skewness is now 0, and (0, 3e120, 1e120), (0, 3e-120, 1e-120), (0, 3e200, 1e200) give 0.3054414193284852, 0.305441419328485, 0.30544141932848506 as (0, 3, 1) does (all were NaN). Recorded in docs/differences-from-r.md (R's closed form gives NaN too). Test: test/issue144.test.ts. Recorded for later: the variance q/18 is NaN rather than Infinity where the squares in q overflow, e.g. (0, 3e200, 1e200); sd is correct there. (Not pushed yet.)
