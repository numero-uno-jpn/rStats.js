# 外部レビュー (52 回目) 対応ログ

レポート: ユーザーがチャットに貼り付けた継続監査 (共通基盤 dpq・discrete・invert・vectorize・integer・extremes・summary、特殊関数の数値基盤 dd・log1p・erf・gamma、lgammaDiff・igam・incbet・ndtri、Bessel)。新しい指摘は SPEC-006・007・008 の 3 件。ほかの節は「新規不具合なし」で、再確認として挙げられた SPEC-001・005 は 45・50 回目に修正済み (レビュアーの zip `src(3).zip` が古い)。ユーザーの指示で SPEC-006・007 を直した。SPEC-008 は記録だけ。

## 判定と修正

| ID | 入力 | R 4.5.2 | 正しい値 (MPFR) | rStats.js (修正前) | 修正後 |
|---|---|---|---|---|---|
| SPEC-006 | `besselJ(1e308, 0)` | 0 (警告 "value out of range") | −2.4706564120790082e-155 | −0 | −2.4706564120790085e-155 |
| | `besselY(1e308, 0)` | ― | 7.5866879552418034e-155 | 0 | 7.586687955241802e-155 |
| | `besselJ(1e307, 0)` | 0 (警告) | −9.4897500033447795e-155 | −9.489750003344774e-155 | 同じ |
| SPEC-007 | `besselI(1e308, 0, scaled)` | 0 | 1/sqrt(2πx) = 3.98942280401433e-155 | 0 | 3.989422804014327e-155 |
| | `besselK(1e308, 0, scaled)` | 1.2533141373155001e-154 | 1.2533141373155001e-154 | 0 | 同じ値 |
| 追加 | `besselI(1e12, 0)`、`besselK(1e12, 0)`、`besselI(1e300, 2)`、`besselI(1e12, −0.3, scaled)` | (I は Inf、K は 0) | Inf、0、Inf、有限 | 終わらない (修正前から) | すぐに返る |
| SPEC-008 | `besselJ(1e8 − 1, 1e8)` (転回点の直下) | ― | ― | 正しい値、471 ms (3e8 で約 1.6 秒) | 変えない (下の「記録だけ」) |

### レビュアーの参照値について

レビュアーの表 (J0(10^308) ≈ −7.9200e-155、Y0 ≈ −9.6718e-156) は、double の 1e308 ではなく、厳密な 10^308 で計算したものと思われる。2 つは約 1e292 違い、振動の位相がまったく異なるので、参照値として使えない。

### 参照値の作り方 (この環境の注意)

- Windows 版 R は数値リテラルを正しく丸めない (R_strtod)。R の `1e100`・`1e307`・`1e308` は、JS の同じリテラルと数 ulp 違う double になる。`sin(1e100)` は JS が −0.38063773100502868 (正しい)、R の値で計算した Rmpfr は 0.033007100024592093 だった。`mpfr(1e308, prec)` も R の double を受け取るので同じ。`sprintf("%.0f", 1e100)` も正しい桁を出さない
- 単調な関数 (gamma、lbeta、分布関数など) では数 ulp の違いはほとんど影響しないが、sin・cos・Bessel の振動のように 1 ulp で値が変わる関数では、R 側の参照値が使えない
- 今回は、JS で double を仮数 (2^53 未満の整数) と指数に分け、文字列で `mpfr("仮数", 1400) * mpfr(2, 1400)^指数` として渡した。`sin(1e100)` が既知の値と一致することで確かめた

## 原因と修正

- SPEC-006: 漸近形の振幅 `Math.sqrt((s * 2) / (Math.PI * x))` (`asymAmplitude`) の `Math.PI * x` が x > 5.7e307 で溢れ、振幅が 0 になった。besselJYPos の Wronskian `2 / (x * Math.PI)` も同じ
- SPEC-007: `iPos` の漸近形 `s / Math.sqrt(2 * x * Math.PI)` と `kPos` の `(s * Math.sqrt(Math.PI)) / Math.sqrt(2 * x)` が溢れた
- 修正 (`src/special/besselJY.ts`、`src/special/besselIK.ts`): 積が溢れるときだけ、`Math.sqrt((s * 2) / Math.PI) / Math.sqrt(x)` のように因子ごとに平方根を取る。通常の範囲は同じビット
- 追加 (SPEC-007 を直して見つかった): `mulExp` (m 2^e2 e^y) は e^y を 700 ずつ掛けるループで、|y| / 700 回まわる。y = 1e12 では終わらず、y = −2e308 では 700 を引いても y が変わらないので、まったく終わらない。修正前は K の値が 0 だったので、このループの手前で返っていた (besselI(1e308, −0.3, scaled))。尺度なしの besselI(1e12, 0) などは修正前から終わらなかった。結果の log2 (log2 abs(m) + e2 + y log2 e) が ±1100 の外なら、ループに入らずに 0 か Inf を返す

## 記録だけ

- SPEC-008: 転回点の近く (x が ν よりわずかに小さい) では、besselJ・besselY の時間が次数に比例する。値は正しい (レビュアーが SciPy と照合)。47 回目に記録した制約で、大きな次数用の一様漸近展開 (Debye、Airy 型) は HANDOFF の将来の課題にある

## テスト

- `test/review52.test.ts`: SPEC-006・007 を MPFR の値と比べる。範囲外の結果がすぐに返ること。通常の範囲 (besselJ(1e307, 0)、besselI(700, 0)) は修正前と同じ値
- stash で、SPEC-006・007 のテストが失敗することを確かめた (範囲外のテストは修正前に止まるので除いた)
- 確認中に `timeout` で打ち切った tsx の子の node が残った。ユーザーに終了を頼んだ
- 全体テスト `npx vitest run`: 2228 passed / 34 skipped、失敗 0。`npx tsc --noEmit -p .`: エラーなし

## docs

- `docs/differences-from-r.md`、`docs/ja/differences-from-r.md` の Where R fails: besselJ・besselY・besselI(scaled) の 1e308 (R は 0)。besselK(scaled) は R が正しい。範囲外の結果 (Inf・0) は R も正しく返すので書いていない
