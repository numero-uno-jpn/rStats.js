# 外部レビュー (5 回目) 対応ログ

レポート: ユーザーがチャットに貼り付けた 2 本

- 1 本目: 古い src.zip を見たレビュー (問題 1〜9)。問題 1・5 は R と一致 (fixture で確認)、2・3 は修正済み、9 は意図的な差。現行のコードにも残っていた 4・6・7・8 をここで直した
- 2 本目: 正規分布の極端値 (pnorm/dnorm/qnorm)

計画は `~/.claude/plans/quirky-questing-giraffe.md`。

## 1 本目の判定 (修正しなかったもの)

| No. | 指摘 | 判定 |
|---|---|---|
| 1 | pAdjust の n に NA を含めるべき | 誤り。R の `n = length(p)` は遅延評価で、NA を除いた後の長さになる。`pAdjust.json` の NA を含む 80 件で確認 |
| 2 | covariance の指数復元 | 修正済み (`ce85a83`) |
| 3 | isCount の相対許容誤差 | 修正済み (`ce85a83`) |
| 5 | quadeTest のブロック数 | 誤り。`quadeTest.json` の NA 行を含むケースで、R の denom df は除外前のブロック数を使っている |
| 9 | Monte Carlo の小数の B | 意図的な差 (docs の「Where R fails」に記載済み) |

## 修正

| 対象 | 内容 |
|---|---|
| `standardizeDD` (ddexp.ts) | x − location が溢れたら (両方有限)、半分の値で計算して 2 倍する。logistic、laplace、invgamma、pareto に効く |
| `locationScale` (ddexp.ts) | scale·t が溢れたら、location と scale を 2^-k (k = ⌈log2 scale⌉) で割ってから計算し、戻す。cauchy、laplace、logistic の分位点に効く |
| 新設 `standardizeValue`、`affine` (ddexp.ts) | 通常の範囲では従来の double の式と同じ値を返し、溢れたときだけ上の方法を使う。normal.ts の pnorm1、dnorm1、qnorm1 がこれを使う (R 一致を保つため dd の精度にはしない) |
| `dlaplace` | log(2σ) と e/(2σ) の 2σ が溢れる場合を分けた |
| `fisherTest` | 丸めた後に 2^31 − 1 を超える度数は R と同じ "'x' has entries too large to be integer" にする |
| `integrate` | relTol、absTol が非有限または負ならエラー (docs の既存の記述にコードを合わせた) |
| `distSummary` | `central()` が QUADPACK の ier/abserr を検査する (ier ≠ 0 かつ abserr > 1e-8·\|result\| なら失敗)。Weibull と Kumaraswamy は、失敗したときに解析的な原点モーメントの log から計算する (`fromLogRawMoments`。比 ρ_r を log で扱うので、重い裾でも溢れない) |
| Dunnett (`dunnett.ts`) | 外側の積分 (p 値そのもの) で、ier 1・3・5 かつ abserr > 1e-6·\|result\| なら NaN。ier 2・4 (丸め誤差の検出) は使える (実際に ier 2・abserr NaN で R と一致する例があった)。内側の積分は検査しない |
| Dunnett の両側 (glhtDunnett) | **既存の不具合**: w が極小のとき、区間 (b, a) の確率 Φ̄(b) − Φ̄(a) が丸め誤差で負になり、log が NaN、p 値も NaN になっていた (例: 3 群各 5、t = 1.55)。0 で下限を取る |

## テスト

- `test/locationScaleExtremes.test.ts`:
  - norm、logis、cauchy、laplace を、溢れる値と 2^-1000 倍した値で比べる (p は完全一致、log d と q は相対誤差で確認)
  - レビューの値の確認
  - fisher、integrate、distSummary (Weibull 0.1、0.5、Kumaraswamy 0.1/100)、glhtDunnett の両側
  - src を修正前に戻すと 10 件すべて失敗する
- 結果: `npx tsc --noEmit -p .` エラーなし。`npx vitest run` 全件成功 (2077 passed / 34 skipped)

## 補足

- レビューの dnorm の期待値 0.1997 は、標準正規の密度 φ(z) で、1/sd を掛け忘れている。正しくは φ(z)/sd ≈ 1.1747e-309
- R も同じ式で計算するので、R も 1、Inf、0 を返すはず (R 突合で確認する)

## R 突合が必要

- `pnorm(1e308, -1e308, 1.7e308)` などで、R が本当に 1、Inf、0 を返すか (docs には「予想。要確認」と記載)
- glhtDunnett の両側のケース (3 群各 5、データは test を参照) で、R の `glht` (mvtnorm) の p 値と一致するか
