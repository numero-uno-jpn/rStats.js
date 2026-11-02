# Issue #115 対応ログ: dnchisq・pnchisq のサブノーマルの x の補正で 0 × Inf = NaN

GitHub Issue #115。NaN を R と同じ 0 に直す修正 (docs は不要)。計画は承認済み。

## 確認 (main `5f3bdc8`)

`src/distributions/nchisq.ts` は、x/2 が丸められるサブノーマルの x で、x2 = 2 (x/2) の値に (x/x2)^(df/2 − 1) (密度) や (x/x2)^(df/2) (下側確率) を掛けて補正する (`subnormalHalf`)。df が大きいと係数が Infinity に溢れ、0 に落ちた x2 の値と掛けて NaN になっていた。issue の指摘どおり (dnchisq と pnchisq の両方)。

| 呼び出し (x = 5 MIN、df = 8000、ncp = 1) | R 4.5.2 | 修正前 | 修正後 |
|---|---|---|---|
| dchisq | 0 | NaN | 0 |
| pchisq (下側) | 0 | NaN | 0 |
| pchisq (上側) | | 1 | 1 (既存の判定のまま) |
| dchisq (log) | −3003418 | −3002525.7646189737 | 同じ |
| pchisq (log) | | −3003276.8893026225 | 同じ |

参考: log 密度は、中心 χ² の式 (df/2 − 1) log x − x/2 − (df/2) log 2 − lgamma(df/2) − ncp/2 で約 −3002524 と見積もれる。rStats.js の値に近く、R の −3003418 は 900 ほど違う (R が x/2 の丸めなどの影響を受けているものと思われる。記録だけ、未調査)。

## 修正

- 密度: 係数 exp((a − 1) lt) が有限なら以前の式 (同じビット)。溢れるときは log の値の exp
- 下側確率: 1 + e が有限なら以前の式。溢れるときは lin を exp(log)
- 上側確率は変えない (既存の判定で、r が有限でなければ up を返す)

## テスト

- `test/issue115.test.ts`: 上の表の値 (log は以前と同じ)、係数が有限の場合 (df = 3・1.5) は以前と同じ値。stash で、修正前に 2 件中 1 件が失敗することを確かめた
- 全体テスト `npx vitest run`: 2484 passed / 38 skipped、失敗 0。`npx tsc --noEmit -p .`: エラーなし
