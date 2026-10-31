# 外部レビュー (12 回目) 対応ログ

レポート: ユーザーがチャットに貼り付けた追加監査 (RNG-10〜16、SURV-01)。

## R 4.5.2 で実行して確かめた結果

| 項目 | R 4.5.2 | rStats.js (修正前) | 判定・対応 |
|---|---|---|---|
| `rwilcox(6, 2.5, 4)`、`rsignrank(6, 2.5)`、`rhyper(8, 2.5, 4, 3)`、`rhyper(8, 5, 4.5, 3)`、`rhyper(8, 5, 4, 2.5)`、`rwilcox(6, 3, 4.5)` | .5 は偶数に丸める (2.5 → 2、4.5 → 4)。乱数列は 2 や 4 の場合と同じ | `Math.round` で 2.5 → 3 | **RNG-11/14 修正**: `roundHalfEven` を使う |
| `rsignrank(1, Inf)` | (未実行。C の `(int)Inf` は未定義の動作) | ループが終わらない | **RNG-12 修正**: 非有限の n は NaN (乱数は引かない) |
| `rwilcox(1, Inf, 5)`、`rwilcox(1, 2147483648, 5)` | エラー "'R_Calloc' could not allocate memory" | エラー "Invalid typed array length" | **RNG-13 修正**: m + n > 2147483647 は "m + n must be at most 2147483647" |
| `rf(5, 0, 10, ncp = 2)` | NaN と Inf が混在 (df1 = 0 で割る) | 同じ | **RNG-10 修正 (ユーザー判断: 統計学的に正しい方向)**: df ≤ 0 なら NaN。非心でない rf と同じ扱い。R と同じ乱数を引くので、次の `runif(1)` は R と同じ (0.38238795707002282) |
| MT の状態で位置 = −1 | 1 個目 0.437013385817409 (位置の欄自体を状態語として読む)、2 個目以降は rStats.js と一致 | 1 個目 1.16e-10 | **RNG-16 修正 (ユーザー判断)**: 位置が負または整数でない状態、状態語が整数でない状態は拒否する。位置 > 624 は R と同じく次で再生成 (位置 1000 のとき R と一致: 0.2655086631421) |
| `survdiff(Surv(c(1,1), c(1,1)) ~ c("A","B"))` | エラー "Lapack routine dgesv: system is exactly singular" | エラー "the system is exactly singular" | SURV-01: R と一致。変更なし |
| `sample.int(5e15, 1, TRUE)` | エラー "invalid first argument" | エラー (上限 4.5e15) | RNG-15: R と一致 (R の上限も 2^52)。指摘は誤り |
| `rbinom(4, 2.5, 0.5)` | NA | NaN | 一致 |

## 変更したファイル

- `src/random/hyper.ts`、`src/random/rank.ts`: `roundHalfEven`、rsignrank の非有限値、rwilcox の上限
- `src/random/gamma.ts`: 非心 rf の df ≤ 0 は NaN (乱数は R と同じく引く)
- `src/random/mt.ts`: `setRandomSeed` の状態の検査
- テスト: `test/locationScaleExtremes.test.ts` (R の値を直接比べる)
- docs (英・日): 「Where R fails」の表に rf と rsignrank、「Deliberate differences」に setRandomSeed と rwilcox
