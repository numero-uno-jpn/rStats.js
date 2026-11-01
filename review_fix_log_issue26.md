# Issue #26 対応ログ: chisq が負の非正規化数の df を受け付ける

GitHub Issue #26 (監査ラウンド #100)。計画は承認済み。

## 再現 (main `addab42`)

df = −5e-324 (最小の負の非正規化数) のとき:

| 呼び出し | rStats.js (修正前) | R 4.5.2 | 修正後 |
|---|---|---|---|
| `dchisq(0, df)` | Infinity | Inf | NaN |
| `dchisq(1, df)` | 0 | 0 | NaN |
| `pchisq(1, df)` | 1 | 1 | NaN |
| `qchisq(0.5, df)` | 0 | 0 | NaN |

df = −1e-310、非心度つき、`rchisq` は修正前から NaN。レビュアーは「R は NaN」としたが、R 4.5.2 も同じ値を返す。df < 0 は定義されない入力なので、方針 (R が誤っている場合も正しい値を返す) どおり NaN にした。

## 原因と修正

中心の dchisq・pchisq・qchisq は df/2 をガンマ分布の shape として渡す。df = −5e-324 では df/2 が −0 に丸められ、shape 0 (0 の 1 点分布) として扱われていた。

`src/distributions/chisq.ts`: df < 0 なら shape を NaN にしてから渡す。df ≥ 0 は今と同じ (同じビット)。

## テスト

- `test/issue26.test.ts`: df = −5e-324 で 4 つとも NaN。df = 0 (1 点分布) とふつうの df は今と同じ
- stash で、修正前に失敗することを確かめた
- 全体テスト `npx vitest run`: 2314 passed / 34 skipped、失敗 0。`npx tsc --noEmit -p .`: エラーなし

## docs

- 分布の引数の扱いの表に、df = −5e-324 の行を足した
