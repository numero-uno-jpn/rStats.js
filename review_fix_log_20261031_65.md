# 外部レビュー (65 回目) 対応ログ

レポート: ユーザーがチャットに貼り付けた継続監査 (glm の IRLS、AIC、残差、glmAnova)。11 件 (MOD-029〜038、MOD-024 の再確認) を今のコード (`a4febe3`) と R 4.5.2 で確かめた。レビュアーは古いソースを見ていて、6 件は対応済みだった。ユーザーが計画を承認し、3 件を直した。

ユーザーの判断:
- MOD-031: 重み 0 の行は AIC に入れない (正の重みの行で計算する)
- MOD-037: deviance 残差は、自由度 0 でも各行の寄与から計算する (62 回目の MOD-011 は「今のまま」としたが、未収束の例で理由が成り立たないことが分かった)

## 判定

| ID | 内容 | 判定 |
|---|---|---|
| MOD-029 | 重み 1000 で偽の収束 (= MOD-007) | 61 回目に修正済み (重み 1、1000、1e6 で係数が一致) |
| MOD-030 | 完全分離を収束と報告 (= MOD-009) | 62 回目に警告を追加済み |
| MOD-031 | 重み 0 の行がある gaussian の AIC が Inf (R も Inf)。レビュアーは R 互換かどうかを理由に撤回 | 直す (ユーザー判断) |
| MOD-032 | `etastart` の長さを確かめていない | 記録だけ (内部の `refit` だけが渡す。公開 API にはない) |
| MOD-033 | 重み Inf が内部の行列のエラー "the matrix contains NaN or infinite values" で止まる (R: "NA/NaN/Inf in 'x'") | エラーの文言を直す |
| MOD-034 | dispersion を指定したときの "t value" (= MOD-022) | 63 回目に修正済み |
| MOD-035 | Rao の切片 (= MOD-025) | 64 回目に修正済み (例の 0.08205 はレビュアーの正しい値と一致) |
| MOD-036 | 推定できない予測に有限の値 | レビュアーが撤回 (R の `rankdeficient = "warnif"` と同じ) |
| MOD-037 | 自由度 0 の deviance 残差が 0 (R も)。maxit 1 の未収束の例で、deviance 0.337 なのに残差 [0, 0] | 直す (ユーザー判断) |
| MOD-038 | ハット値の行のずれ (= MOD-023) | 64 回目に修正済み (レビュアーが正しいとした 4 値と一致) |
| MOD-024 再確認 | offset の違うモデルの比較 | 対応済み。offset の差 (0,0,0,0,1,1,1,1) は z (0,1,0,1,…) と違い、大きいモデルの列空間に入らないので検定しない (p は NaN) |

## 修正の内容

- `src/models/glmFamily.ts` (`familyAic`): すべての family で、重み 0 の行を和から除く
  - gaussian は n と Σ log w を正の重みの行で数える
  - Poisson・Gamma・inverse.gaussian も、重み 0 の行を足さない (0 × 無限大の NaN を防ぐ)
  - 有限の値の行だけなら、和は同じビット
- `src/models/glm.ts`
  - `unscaledResult` の AIC の尺度の補正 2 n k log 2 で、n を正の重みの行の数にした (gaussian は応答を 2^-k 倍して当てはめるので、familyAic の n と合わせる必要がある。最初の実装では、fixture の重み 0 の行がある gaussian の AIC が、その行を除いた当てはめと合わないことで見つかった)
  - deviance 残差の自由度 0 の特別扱いを外した
  - 重みが有限でなければ "non-finite weights not allowed"

## テスト

- `test/review65.test.ts`
  - MOD-031: gaussian・Poisson・Gamma (log)・inverse.gaussian (log) で、重み 0 の行を含む当てはめの AIC が、その行を除いた当てはめの AIC と一致する。例の 5.8425
  - MOD-037: 未収束の例で、残差の二乗和が deviance と一致し、符号が y − μ と同じ
  - MOD-033: エラーの文言
- fixture: `test/glm.test.ts` の #96 (重み 0 の行がある gaussian、R の AIC は Inf) を `knownDifference` に記録した。テストの中で、その行を除いて当てはめ直した AIC と相対 1e-12 で一致することを確かめる。自由度 0 の deviance 残差の fixture は、今ある許容誤差の下限の範囲で通った
- stash で、修正前に 3 件とも失敗することを確かめた
- 全体テスト `npx vitest run`: 2276 passed / 34 skipped、失敗 0。`npx tsc --noEmit -p .`: エラーなし (テストの型を直したあとにも流した)

## docs

- 「R が不正確な場合」: 重み 0 の行がある gaussian の AIC、自由度 0 の deviance 残差

## 外部レビュアーの次の予定

glmAnova の未収束のモデルの扱い、Rao の統計量が丸めで負になる場合、glmConfint のプロファイルの探索範囲と境界、ランク落ちしたモデルの係数と共分散の対応。binomial・Gamma・inverse.gaussian の AIC の定義、offset つきの null deviance
