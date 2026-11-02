# Issue #169 対応ログ: glmCooksDistance の二乗が溢れる

GitHub Issue #169。夜間の自律修正 (Plan モードの代わりに計画をここに書く)。

## 計画

- 意図: `glmCooksDistance` は (r/(1 − h))^2 を先に作るので、距離が有限でも二乗が溢れ、最後の有限性の検査で NaN になる
- issue の例 (`glm([[], []], [0, 1e308], { family: "poisson" })`) は、当てはめ自体が「the matrix contains NaN or infinite values」で落ちる (#168、作業重みの溢れ。朝の判断待ち)。そこで、当てはめが通る再現を探した
  - gaussian (identity) は `scaledView` で応答と重みを正規化するので溢れない (重み 1e308、応答 1e300 倍でも正しい)。gaussian の log リンク、poisson、Gamma は、残差が大きくなる規模では当てはめが落ちる (#168 と同じ)
  - **binomial に大きな事前の重みを付けると通る。** Pearson 残差は sqrt(重み) の規模で、てこ比の大きな行 (h = 0.977) で r/(1 − h) が 1e154 を超える。xs = (1, 2, 3, 4, 5, 38)、y = (1, 1, 1, 0, 0, 1)、重み 1.5e306 (収束) で 6 行目の距離が NaN (正しくは 1.35e308)。重み 4e306・dispersion 100 でも NaN (正しくは 3.61e306)
  - 確かめる途中で、大きな dispersion (1e308) では h/(dispersion p) がサブノーマルに落ち、距離がすべて 0 になることも見つけた (R も 0)
- 方法: 今の式で距離が有限でないか、h/(dispersion p) が正規化数の下 (< 2^-1022) のときだけ、残差と dispersion をそれぞれ 2 の冪 (2^er、2^ed) を単位にして計算し、最後に ldexp(…, 2 er − ed) で 1 回で戻す (`cookScaled`)。それ以外は今と同じ式・同じビット
- 選んだ理由: Cook の距離の式だけで局所的に直る (#168 の作業重みとは独立)。共通基盤の「必要なときだけ正規化」と同じ形。有限性の検査 (h = 1 などで NaN) はそのまま残した

## 確認 (main `75bb949`)

| 呼び出し (binomial、上の xs・y) | R 4.5.2 | 修正前 | 修正後 | 参照 |
|---|---|---|---|---|
| 重み 1.5e306、6 行目 | 当てはめられない ("NA/NaN/Inf in 'y'") | NaN | 1.353207492516757e308 | 2^-600 単位の同じ式と相対 1e-15 以内。重み 1e300 の当てはめの 1.5e6 倍と相対 1e-13 (収束の差) |
| 重み 4e306、dispersion 100、6 行目 | 当てはめられない | NaN | 3.608553313378049e306 | 同上 |
| 重み 1、dispersion 1e308 | すべて 0 | すべて 0 | 1.39550757584855e-309、…、9.028561204180879e-307 | dispersion 1 の距離 / 1e308 (サブノーマルは 2^-1074 以内) |
| 重み 1、dispersion 1・1e-300、重み 4e306 の 1〜5 行目 | | | 修正前と同じビット | |

R と違う値 (R は 0 か、当てはめられない) なので、docs の「R が失敗する所」の表に 1 行足した。

## 修正

- `src/models/glm.ts`: `cookScaled` を足し、`glmCooksDistance` で距離が有限でないか h/(dispersion p) が正規化数の下のときに使う
- docs (英・日) の「R が失敗する所」の表に 1 行

## テスト

- `test/issue169.test.ts`: 重み 1.5e306 (dispersion 1) と 4e306 (dispersion 100) の距離を 2^-600 単位の参照と比べる、重みへの比例、dispersion 1e308 の距離、範囲内の値は修正前のビット。stash で、修正前に 3 件中 2 件が失敗することを確かめた
- 全体テスト `npx vitest run`: 268 files、2541 passed / 38 skipped、失敗 0。`npx tsc --noEmit -p .`: エラーなし

## 範囲外として記録

- issue の例 (poisson の y = (0, 1e308)) は当てはめで落ちる。#168 (作業重みの溢れ) の判断の後で、この例の Cook の距離も確かめる (式は今回の修正で溢れない)
- 真の距離が double の範囲を超える場合 (重み 4e306、dispersion 1 の 6 行目、真の値 3.6e308) は、今までどおり有限性の検査で NaN (R の式なら Inf)。Inf にするかは別の判断
- binomial の当てはめは重み 3e307 程度から「no valid set of coefficients has been found」で落ちる (6 行の例。deviance の和の溢れと思われる。未調査、#168 と同種の可能性)

## close comment

Fixed in <commit of #169, see git log --grep='#169'>: where (r/(1 - h))^2 h/(dispersion p) is not finite, or h/(dispersion p) falls below the normal range, glmCooksDistance now computes it with the residual and the dispersion in units of powers of 2, scaled back once at the end; elsewhere the bits are unchanged. The issue's Poisson example does not fit yet (the working weights overflow, #168), so the reproduction is a binomial fit with prior weights 1.5e306, xs = (1, 2, 3, 4, 5, 38), y = (1, 1, 1, 0, 0, 1): the high-leverage row (h = 0.977) has r/(1 - h) = 1.6e154, and its distance is now 1.353207492516757e308 (was NaN). With dispersion 1e308, where h/(dispersion p) is subnormal, the distances were all 0 (as in R), now 1.4e-309 ... 9.0e-307, the distances for dispersion 1 divided by 1e308. Recorded in docs/differences-from-r.md. Test: test/issue169.test.ts. Recorded for later: the issue's example once #168 is settled; a true distance beyond the largest double is still NaN. (Not pushed yet.)
