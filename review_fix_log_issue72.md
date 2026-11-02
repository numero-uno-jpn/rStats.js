# Issue #72 対応ログ: expm の巨大な order で止まらない

GitHub Issue #72。計画は承認済み。

## 確認 (main `dd59747`)

`expm` (`src/linalg/expm.ts`) は order を `Number.isInteger(order) && order >= 1` だけで検査していた。"Taylor"・"TaylorO" (`taylorScaled`) と "Pade"・"PadeO" (`padeHorner`) は `for (let j = order; j >= 1; j--)` で回すので、2^53 を超える order では j − 1 === j となって止まらない (1e16 − 1 === 1e16)。issue の主張どおり。止まる呼び出しなので、コードを読んで確かめ、実行はしていない。

R 4.5.2 (expm 1.0) は order を整数に変換するので、2^31 − 1 を超えると NA になり、"NAs in foreign function call" のエラー (Taylor・Pade とも)。

## 修正

order の上限を R の整数の範囲 (2147483647) にした。超えれば RangeError "order must be a positive integer at most 2147483647" (R もエラー)。範囲内の値は今の計算のまま (2^31 − 1 以下では j の減算は厳密)。オプションの説明にも範囲を書いた。Higham08 の方法は order を使わないので、今どおり検査しない (R と同じ)。R と同じくエラーなので docs は変えない。

## テスト

- `test/issue72.test.ts`: 4 つの方法で order 2^31・1e16・1e308 が RangeError。通常の order 2・8 の値と、Higham08 が order を無視すること
- 修正前のコードでは止まる呼び出しなので、stash での失敗の確認は行っていない (HANDOFF の注意どおり、止まりうる呼び出しは流さない)
- 既存の `test/review30.test.ts` (order 0 のエラー文言) は部分一致で通る
- 全体テスト `npx vitest run`: 2407 passed / 38 skipped、失敗 0。`npx tsc --noEmit -p .`: エラーなし

## 記録だけ

- 2^31 − 1 以下でも、order が 1e9 のように大きいと、行列の積を order 回行うので時間がかかる (R も同じ)
