# Issue #148 対応ログ: pbeta の両方の形状がサブノーマルで NaN

GitHub Issue #148。夜間の自律修正 (Plan モードの代わりに計画をここに書く)。

## 計画

- 意図: 両方の形状が 1e-300 (`SUB_SHAPE`) 未満だと、`subShapeTail` (もう一方が 1e-280 超のときだけ) を通らず、級数の 1/a が溢れ、前因子の a b/(a + b) が 0 に落ちて、`pbeta(0.5, 2^-1074, 2^-1074)` が NaN になる。確かめると、両方がサブノーマル程度だと線形の値が −Infinity、log が NaN の場合も多く、有限の値でも相対 4e-6 ずれていた
- 方法: `betaIncUncapped` の冒頭 (x の端の判定の直後) で、両方の形状が `SUB_SHAPE` 未満なら閉じた式 I_x(a, b) = b/(a + b)、1 − I_x(a, b) = a/(a + b) を返す (`bothSubShape`)。級数 I_x(a, b) = x^a b/(a + b) Γ(a+b+1)/(Γ(a+1) Γ(b+1)) (1 + a S) で、abs(S) は約 −log(1 − x) 以下 (double の x < 1 では 37 未満)、abs(a log x) は 745 a 以下なので、どの x ∈ (0, 1) でも相対誤差は 1e-297 未満。上側も I_{1-x}(b, a) で同じ
- 選んだ理由: issue の案 (両方が極小の領域を級数の前に扱う) と同じ。R (toms708) も max(a, b) < 1e-3 ε で同じ極限を使う (R の値は正しい)。形状を 2^1000 倍 (厳密) して正規化数にし、a + b を double-double で持って割る (a = b は厳密に 1/2。R の b/(a + b) は 2 回丸める)。log は値が 1/2 以下なら log(値)、超えるなら log1p(−反対側)。範囲は R の 1e-3 ε でなく今の `SUB_SHAPE` 未満に限った (1e-300 以上は今の経路が正しく、ビットを変えない)

## 確認 (main `cae13fe`)

| 呼び出し | R 4.5.2 | 修正前 | 修正後 |
|---|---|---|---|
| pbeta(0.5, 2^-1074, 2^-1074) | 0.5 | NaN | 0.5 |
| 同、logP | log 0.5 | NaN | −0.6931471805599453 |
| pbeta(0.1, 2^-1074, 2^-1074, 上側) | 0.5 | NaN | 0.5 |
| pbeta(0.5, 1e-322, 1e-315) | | −Infinity | 0.9999999011868804 |
| pbeta(0.5, 20 · 2^-1074, 2^-1074) | 1/21 | −Infinity | 1/21 |
| pbeta(1e-300, 2.2055098275636e-311, 1.8e-322) | | 8.064549028574675e-12 | 8.064513260314713e-12 |

掃引: 形状を 2^U(−1074, −998) (10 件に 1 件は a = b)、x を 7 点 (2^-1074、1e-300、1e-10、0.1、0.5、0.9、1 − 2^-53) で 300 件 × 4 値 (下側・上側・各 log)。参照は Rmpfr (300 ビット) の b/(a + b)、a/(a + b) とその log。

- 修正前: 1200 値のうち 604 が参照と違う (NaN 128 件、±Infinity 96 件、有限でも相対 1e-12 超が 102 件、最大 4.4e-6)
- 修正後: 線形の 600 値はすべて参照と同じビット。log の 70 値が 1 ulp 違う
- R: 線形の 72 値、log の 193 値が 1 ulp 違う

`sweep.ts` (形状 12 個 × 12 個 × x 6 点、下側 + 上側 = 1 と NaN の検査) も修正後は 0 件。

## 修正

- `src/special/incbet.ts`: `bothSubShape` を足し、`betaIncUncapped` で両方の形状が `SUB_SHAPE` 未満のときに使う
- R と同じ値 (R は正しい) なので docs は変えない

## テスト

- `test/issue148.test.ts`: 等しいサブノーマルの形状 (2^-1074、3e-310) で 6 点の x とも厳密に 0.5 と −log 2、等しくない極小の形状 6 件で線形は Rmpfr と同じビット、log は相対 3e-16。stash で、修正前に 2 件とも失敗することを確かめた
- 全体テスト `npx vitest run`: 266 files、2534 passed / 38 skipped、失敗 0。`npx tsc --noEmit -p .`: エラーなし

## 範囲外として記録

- `qbeta(0.3, 2^-1074, 2^-1074)` は 0 (R は 5.56e-309)。分布関数は (0, 1) で 1/2 一定なので、p < 1/2 の分位点の下限は 0 で、こちらが正しいと思われる。確かめていない

## close comment

Fixed in <commit of #148, see git log --grep='#148'>: where both shapes are below 1e-300, pbeta now returns the limit I_x(a, b) = b/(a + b) and 1 - I_x(a, b) = a/(a + b) for every x in (0, 1). From the series, the corrections are of relative order 745 max(a, b), below 1e-297. The ratio is formed from the shapes scaled exactly by 2^1000, with a + b in double-double, so equal shapes give exactly 1/2. pbeta(0.5, 2^-1074, 2^-1074) is now 0.5 (was NaN), with log -log 2; for two subnormal shapes the linear values had also been -Infinity (pbeta(0.5, 1e-322, 1e-315)), and some finite values were off by up to 4e-6 relative. In a sweep of 300 shape pairs and 7 values of x, the lower and upper tails now match Rmpfr b/(a + b) and a/(a + b) to the bit, and their logs to 1 ulp. R takes the same limit, so its values agree up to its rounding. Shapes from 1e-300 on keep their bits. Test: test/issue148.test.ts. (Not pushed yet.)
