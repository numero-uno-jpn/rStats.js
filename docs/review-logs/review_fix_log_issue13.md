# Issue #13 対応ログ: coxph の Cholesky で落とした pivot の列に下三角の要素が残る

GitHub Issue #13 (監査ラウンド #70)。計画は承認済み。

## 再現 (main `fc39dc5`)

40 行のデータ (R の `set.seed(13)`。`test/helpers/issue13Data.ts`)。x2 = x1 + d e、x3 は e の成分を含む。x2 は、Cholesky の許容誤差 (tolerChol) より小さな残差になって落とされる。

| d | rStats.js (修正前): x2 を除いた当てはめとの差 (x1・x3 の係数) | R 4.5.2 + survival | 修正後 |
|---|---|---|---|
| 1e-6 | −5.0e-13、−4.3e-12 | −5.0e-13、−4.3e-12 (同じ実装) | 0、0 |
| 3e-7 | −4.5e-14、−3.8e-13 | 同じ | 0、0 |
| 1e-8 | 0、−5.0e-16 | 同じ | 0、0 |

分散 (標準誤差) も同じ程度ずれていた。影響は許容誤差の水準だが、落とした方向が解に入っていた。

## 原因と修正

`cholFactor` (survival の cholesky2 と同じ) は、pivot を落とすとき対角だけを 0 にし、その列の下の要素 (残差の積) を残していた。`cholSolve` の前進代入と `cholInverse` は、それを因子の要素として使っていた。

`src/models/coxph.ts` (`cholFactor`): pivot を落とすとき、その列の下の要素も 0 にした。これで、その列を除いた当てはめとビットまで一致する。厳密に共線な場合 (d = 0) も同じ。

## テスト

- `test/issue13.test.ts`: d = 1e-6・3e-7・1e-8・0 で、係数と分散 (x1・x3 の部分) が x2 を除いた当てはめとビット一致。x2 の係数は NaN
- stash で、修正前に失敗することを確かめた
- coxph・survival の R の fixture のテストはそのまま通った
- 全体テスト: #12 のログを参照

## docs

- 「R が不正確な場合」: ほぼ共線な列のある coxph
