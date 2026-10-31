# 外部レビュー (50 回目) 対応ログ

レポート: ユーザーがチャットに貼り付けた継続監査 (補間・内部の共通関数、特殊関数の再監査、逆関数、乱数。zip は `src(3).zip`)。13 件を今のコード (`876622a`) と R 4.5.2 で確かめた。5 件は修正済み (レビュアーの zip が古い)。残る 8 件は再現し、ユーザーが計画を承認して全件を直した。

## 判定と修正

| ID | 入力 | R 4.5.2 | rStats.js (修正前) | 修正後 |
|---|---|---|---|---|
| NUM-003 | `approx(c(-1e308, 1e308), c(0, 1), n = 3)` | x [−1e308, 0, 1e308]、y [0, 0, 1] | x [NaN, Inf, 1e308]、y [NaN, NaN, 1] | x [−1e308, 0, 1e308]、y [0, 0.5, 1] |
| | `spline(同)` | x 同上、y [0, 0, NaN] | 同上 (NaN) | x 同上、y [0, 0.5, 1] |
| NUM-004 | `approx(c(-1e308, 1e308), c(0, 1), xout = 0)` | 0 | 0 | 0.5 |
| | `approx(c(0, 1), c(-1e308, 1e308), xout = 0.5)` | Inf | Inf | 0 |
| SPEC-001 | `pbeta(0.5, 1e308, 1e308)`、`qbeta(同)` | ― | ― | 修正済み (45 回目): 0.5、0.5 |
| SPEC-002 | `gammainc(Inf, 1e308)` | pracma は NA (警告) | upper NaN、logUpper NaN | upper 0、logUpper −Inf |
| SPEC-003 | `besselK(1, 1e8)` | ― | ― | 修正済み (47 回目): Inf をすぐに返す |
| SPEC-004 | `erfcinv(MIN)` | ― | ― | 修正済み (47 回目): 27.21329321081295 |
| SPEC-005 | `qgamma(c(0.75, 0.9, 0.99), 1e145)` | 1e145 | 9.99999999999979e144 (151 ulp 下、pgamma は 0) | 1e145 |
| RNG-003 | `rbeta(3, 1e308, 1e308, ncp = 0)` | NaN (中心の rbeta は 0) | NaN | 0.5 |
| RNG-003' | `set.seed(4); rgeom(1, 1e-309)` | NA | Inf | 1.7160061001777616e308 |
| RNG-004 | `set.seed(1); rnbinom(1, 1, prob = 1e-309)` | NA | NaN | 1.5514135657233996e308 |
| | `rnbinom(1, 0.5, mu = 1e308)` (追加) | NaN | NaN | 1.976271328631772e307 |
| RNG-005 | `set.seed(42); rmultinom(3, 2^31 − 1, c(0.5, 0.5, 1e-16))` | 3 番目は常に 0 (2 番目が残りを取る) | 同じ | 2 番目を二項乱数で引く (3 番目の期待値は 2e-7 なので、値はほぼ 0 のまま) |
| RNG-001 | BTPE の符号 | ― | ― | 修正済み (48 回目) |

補足
- RNG-003 で、レビュアーは「ncp = 0 なら中心の rbeta に回す」を提案した。しかし R も ncp を与えると χ² の経路を通り、`rbeta(3, 2, 3)` と `rbeta(3, 2, 3, ncp = 0)` は同じ seed で違う値になる (rStats.js も R と同じ)。R と同じ乱数列を保つため、その案は採らず、2 shape が溢れる場合だけを直した
- RNG-003' の既存のコメント「有限になる確率は 1e-15 未満」は誤りだった。p = 1e-309 では E (1 − p)/p < DBL_MAX となる確率は約 16%
- SPEC-005 の原因: 逆関数のソルバーは log x の座標で解くので、始点 x0 = 1e145 (findInverseGamma の値で、これが答え) が exp(log x0) の丸めで 151 ulp ずれた。そこでは分布関数が 1、密度は 0 にアンダーフローし、Newton 法が進まず反復の上限に達した。仕上げの `bisectX` も値の中点で 64 回しか割らず、1e55 倍以上の幅の区間が縮まりきらなかった

## 修正の内容

- `src/internal/seq.ts` `seqLength`: 両端が有限で to − from が溢れるときだけ、半分の座標で作って 2 倍する
- `src/numerics/interp.ts`
  - `linearAt`: x の差 (分母、v − x_i) が溢れるときは半分の座標で t を作る。y の差が溢れるときは y の半分で作って 2 倍する
  - `spline`: 正規化した節点の間隔が溢れるときだけ、x を 2^-k で割って `cubicSpline` を作り、xout も 2^-k で割って評価する
- `src/special/extra.ts` `gammainc`: 各裾で正則化した値の log が −Inf なら [0, −Inf] を返す (Γ(a) が溢れても)
- `src/internal/invert.ts` `bisectX`: 中点を double のビット表現の中点 (`bitMidpoint`、DataView と BigInt) にした。どんな区間でも約 64 回で隣り合う double まで縮む。上限を 70 回にした
- `src/random/beta.ts`: 形状が有限で 2 shape が溢れるときだけ、χ² の半分を Gamma(shape, 1) で作る (`halfNoncentralChisq`、R の rnchisq と同じ乱数を同じ順に引く)。比は、X + Y が溢れるときだけ半分にしてから取る
- `src/random/poisson.ts`
  - `rgeom`: (1 − p)/p が溢れるときだけ、mu = (E (1 − p))/p
  - `rnbinom`: 尺度が溢れるときだけ、尺度 1 のガンマ乱数から (g (1 − p))/p (mu 版は (g mu)/size) を作る (`poissonOfGamma`)。平均そのものが溢れたら Inf
- `src/random/binomial.ts` `rmultinom`: R と同じ pTot (1 から前の確率を引いたもの) で pk ≥ 1 になり、後ろに正の確率が残るときだけ、後ろから足した確率の和で pk を作り直す

乱数列: 変わるのは、R が NaN・NA を返すところ (rbeta の非心、rgeom、rnbinom) と、rmultinom の上の場合だけ。乱数の fixture (`test/random.test.ts`) はすべてそのまま通る

## 残したもの (記録だけ)

- `splinefun` の節点の間隔の溢れ: 返す関数は導関数も扱い、尺度を変えると導関数の単位も変わるので、今回は `spline` だけを直した

## テスト

- `test/review50.test.ts`: 8 件と、通常の範囲で値・乱数列が変わらないこと
- `git stash push -- src` で 6 件すべてが失敗することを確かめた
- ヘルパー関数を JSDoc と本体の間に挟んだため、doc comment の検査 (categories、rNames、r-index) が失敗した。ヘルパーを JSDoc の前に移して直した
- 全体テスト `npx vitest run`: 2225 passed / 34 skipped、失敗 0。`npx tsc --noEmit -p .`: エラーなし

## docs

- `docs/differences-from-r.md`、`docs/ja/differences-from-r.md` の Where R fails の表: approx・spline の溢れ、rbeta の非心、rgeom・rnbinom の極小の確率、rmultinom の末尾の区分
- qgamma は R が正しく、rStats.js 側の誤りを直しただけなので書いていない。gammainc は R にない
