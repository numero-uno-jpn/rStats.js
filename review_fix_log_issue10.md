# Issue #10 対応ログ: Satterthwaite の自由度が応答の単位で変わる

GitHub Issue #10 (監査ラウンド #69)。以前からの残課題 No.120 と同じ。#9 の残り (応答 1e±200 倍で lmerSummary・lmerAnova がエラー) も、ここで直した。オーナーの判断: #9〜#11 を順に直す。計画は承認済み。

## 再現 (main `9b33273`)

#11 と同じデータで、`lmerSummary(lmer("y ~ x + (1 | g)", ...))` の Satterthwaite の自由度を比べた (REML)。

| 応答の倍率 | rStats.js (修正前) | R 4.5.2 + lmerTest 3.2.1 | 修正後 |
|---|---|---|---|
| 1e-6・1e-3・1・1e3 | 7.0004、31.0062 | 1: 同じ。1e-6: 0.1834、0.1885 | 同じ |
| 1e6 | 7.0004、**739844738.9** (x の p 値 1.6e-14 → 1.7e-41) | 7.0004、**739844620** (警告 "1 eigenvalue close to zero") | 7.0004、31.0062 |
| 1e±200 | (#9 の修正前は当てはめ自体が失敗。#9 のあとは "the matrix contains NaN or infinite values") | ― | もとのデータと同じ |

ML でも同じ (R は 1e6 倍で x の df 689791728)。

## 原因と修正

`satterthwaiteAt` は、(θ, σ) についての deviance のヘッセ行列の固有値を、絶対値 1e-8 で切ってから A = 2 H⁺ を作っていた。σ の方向の曲率は応答の単位とともに 1/σ² で変わり、θ の方向の曲率は Z の列の単位で変わる。そのため、単位だけで方向が捨てられ、df が無限大に向かった。

`src/models/lmerTest.ts` (`satterthwaiteAt`):
- 尺度をそろえた座標でヘッセ行列を扱う。D = diag(θ_k に 2^-e_k (#11 の `thetaColumnExponents`)、σ に 2^round(log2 σ̂)) として、H' = D H D (2 の冪なので正確) の固有値を、同じ閾値 1e-8 で切る。A' = 2 H'⁺ を作り、vcovVarpar = D A' D とする。ヘッセ行列の警告も H' の固有値から出す。
- #9 の残り: 応答 (y − X β₀) の最大の絶対値が 2^500 を超えるか 2^-500 を下回るときは、2^scale で割った構造で導関数を計算する。`LmerSatterthwaite.scale` を加え、量は割った単位のまま持つ。`tTestOf` は推定値と標準誤差を戻し、rhs を割る。`fTestOf` は rhs を割り、`fRowOf` は平方和を 4^scale 倍で戻す。df・t・F・p は尺度によらない。scale = 0 なら今までと同じ。
- ふつうのデータでも、σ̂ が [0.71, 1.41) にないと D が単位行列でなくなるので、固有値分解の丸めが変わる (vcovVarpar は同じ値に丸めの差だけ)。lmerTest の fixture のテスト (varpar、vcovVarpar、警告、summary、contest、ANOVA) はすべてそのまま通った。

## テスト

- `test/issue10.test.ts`
  - 応答を 1e-200・1e-6・1e-3・1e3・1e6・1e200 倍したとき、REML と ML で、summary の df・t・p、推定値と標準誤差 (倍率どおり)、ANOVA の F と DenDF、rhs つきの contest の t と df が、もとのデータと相対 1e-8 で一致する
  - ランダム傾きで x を 1e-5・1e6 倍したときの df と t
- stash で、修正前に失敗することを確かめた
- 全体テスト `npx vitest run`: 2287 passed / 34 skipped、失敗 0。`npx tsc --noEmit -p .`: エラーなし (終了コード 0)

## docs

- Where R fails: 応答の単位が違う lmerTest の Satterthwaite の自由度
