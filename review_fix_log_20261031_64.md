# 外部レビュー (64 回目) 対応ログ

レポート: ユーザーがチャットに貼り付けた継続監査 (glm の診断関数、glmAnova、共分散、null deviance)。6 件 (MOD-023〜028) を今のコード (`e58680b`) と R 4.5.2 で確かめた。MOD-024 は対応済み (レビュアーのコードが古い)。ユーザーが計画を承認し、5 件を直した。

ユーザーの判断:
- MOD-026: glm と lm の両方を直す (lm も同じ原因で、x × 1e-200 で標準誤差 Inf になることを確かめた)

## 判定と修正

| ID | 入力 | R 4.5.2 | rStats.js (修正前) | 修正後 |
|---|---|---|---|---|
| MOD-023 | gaussian・inverse、y = (2e-150, 2, 4)、offset (1e150, 1, 1)、start −0.25 のハット値 | ― | [0, 0, 0.027] | [0, 0.027027, 0.972973] |
| MOD-024 | offset の違うモデルの anova | p 0.0624 | 検定しない (NaN) | 変えない (対応済み) |
| MOD-025 | `anova(glm(y ~ x - 1), glm(y ~ x), test = "Rao")` | 1.8513 | 1.4953 | 1.8513 |
| MOD-026 | gaussian・binomial の glm と lm、x × 1e-200、1e200 | 標準誤差 Inf (と 0) | 同じ。glmConfint は NaN | t、p、区間が x × 1 と同じ (区間は倍率どおり) |
| MOD-027 | gaussian、重み 1e308 × 4 の null deviance | NaN | NaN | 5e306 |
| MOD-027 | 重み 0 の行の y が Inf の null deviance | ― | NaN | 4.667 |
| MOD-028 | 重み 0 の行だけで z = x1 + x2 が崩れる入れ子の比較 | 入れ子かどうかを判定しない | 検定しない | χ² 1、df 1、p 0.31731 |

### MOD-023 の原因

IRLS の最後の最小二乗では、行を `w > 0 && muEta ≠ 0` で選んで QR に入れる。結果の作業重みには、QR に入れた √w の二乗を保存する。√w が 1e-162 より小さいと、二乗が 0 に落ちる。glmHatvalues は `weights > 0` で QR の行と元の行を対応させていたので、その行より後のハット値が 1 行ずれた。irls の `used` を、結果をキーにした WeakMap に記録し、それを使うようにした。glmRstandard と glmCooksDistance はハット値から計算するので、これで直る。

### MOD-025

R の anova.glmlist は、残差の回帰 (glm.fit) に小さい方のモデル (m1) の切片を渡す。rStats.js は大きい方の切片を渡していた。そのため、切片のないモデルの残差を中心化してしまい、加えた切片の説明する分が消えていた。逐次表では小さい方と大きい方の切片が同じなので、値は変わらない。

### MOD-026 の直し方

`src/internal/scaledInverse.ts` の `chol2invColumns`: R の列の最大の |R_ij| が [2^-400, 2^400] の外にあるとき、その列を 2^e_j で割ってから `chol2inv` を計算する。

- 標準誤差は ldexp(√(inv_jj × 分散), −e_j) で戻す。
- covUnscaled は ldexp(inv_jk, −e_j − e_k) (範囲外なら今まで通り Inf か 0)。
- 範囲内の列では計算は今と同じ。

## 修正の内容

- `src/internal/scaledInverse.ts` (新規): `chol2invColumns`
- `src/models/glm.ts`
  - `unscaledCovariance` と glmSummary の標準誤差・共分散
  - null deviance の加重平均 (重みを最大の重みの 2 の冪で割る、重み 0 の行を除く)
  - `USED_ROWS` と glmHatvalues
- `src/models/lm.ts`: 標準誤差の (R'R)^-1 を `chol2invColumns` で
- `src/models/glmAnova.ts`
  - Rao の切片
  - 入れ子の判定を、両方のモデルで正の重みの行だけで行う (offset の差も同じ)

## テスト

- `test/review64.test.ts`
  - MOD-023: ハット値を w_i x_i² / Σ w_j x_j² と比べる。rstandard もそのハット値から計算した値と一致する
  - MOD-025: R の値
  - MOD-026: x × 1e-200、1e200 で、glm (gaussian・binomial) と lm の t・p と、glmConfint の区間が x × 1 と一致する
  - MOD-027: 2 つの例
  - MOD-028: p 0.31731
- stash で、修正前に 5 件とも失敗することを確かめた
- R の fixture のテストは、すべてそのまま通った
- 全体テスト `npx vitest run`: 2273 passed / 34 skipped、失敗 0。`npx tsc --noEmit -p .`: エラーなし

## docs

- Where R fails: x の列が 1 から遠いときの標準誤差・区間、null deviance の重み
- 入れ子でない比較の項目に、正の重みの行で判定することを書き足した

## 外部レビュアーの次の予定

GLM の IRLS そのもの (初期値、ステップの半減、収束判定、境界の判定)
