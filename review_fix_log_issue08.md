# Issue #8 対応ログ: 混合モデルの監査 (親の Issue) の残り

GitHub Issue #8 (監査ラウンド #69 の親の Issue)。個別の Issue #9〜#12 は対応済み。オーナーの指示: レビュアーへの報告は不要、解決したら閉じてよい。計画は承認済み。

## 「追加の懸念」の確認

| 懸念 | 確認 | 判定 |
|---|---|---|
| `compareFits()` の入れ子の判定 (名前による) | 同じ因子を `contr.sum` と treatment の対比で表した `y ~ f3 + (1 | g)` と `y ~ f3 + x + (1 | g)` (ML) は、列空間として入れ子なのに検定されなかった (Chisq・p が NaN)。名前が同じで列空間が違う誤判定は起きない (同じデータ・同じ行) | 直した |
| `tTestOf()` の分母が 0・負・非有限 | 特異な当てはめ (`y ~ x + (1 | g)`、`y ~ x + (x | g)`、群の効果なし) で、自由度 22 と p 0.0053 が R の lmerTest と一致。分母は正の固有値だけで作る A の二次形式なので負にならない (丸めを除く) | 問題なし |
| 境界・特異な共分散での `satterthwaiteAt()` | 同上。尺度依存は #10 で直した | 問題なし |
| lmer・lmerTest の尺度不変性の回帰テストがない | `test/issue09.test.ts`〜`issue11.test.ts` で追加済み | 対応済み |

## 修正

`src/models/lmerAnova.ts` (`compareFits` の `nestedIn`): 固定効果を、名前の包含ではなく列空間の包含 (`nestedColumns`、glmAnova と同じ判定) で比べる。X は `lmerInternals(fit).structure.x`。ランダム効果の項の判定 (グループ因子と列の名前) は今のまま。名前で入れ子だった比較は列空間でも入れ子なので、今まで検定していた比較の結果は変わらない。

## テスト

- `test/issue08.test.ts`: contr.sum と treatment の比較が検定され、Chisq と p が両方 treatment の比較と一致する。入れ子でない比較は検定しない
- stash で、修正前に失敗することを確かめた
- lmerCompare (lme4 の anova の fixture) を含め、全体テスト `npx vitest run`: 2301 passed / 34 skipped、失敗 0。`npx tsc --noEmit -p .`: エラーなし
