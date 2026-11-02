# Issue #54 対応ログ: logAddExp(Infinity, Infinity)

GitHub Issue #54。計画は承認済み。

## 再現 (main `d0b429c`)

`logAddExp` (`src/internal/ddexp.ts`) は m = max(a, b) を引いて m + log1p(exp(min − m)) を返す。a = b = Infinity では Inf − Inf = NaN。m = −Infinity の判定はあったが、+Infinity の判定がなかった。

| 呼び出し | 修正前 | 修正後 |
|---|---|---|
| `logAddExp(Infinity, Infinity)` | NaN | Infinity |
| `logAddExp(Infinity, 3)`、`(Infinity, -Infinity)` | Infinity | 同じ |
| `logAddExp(-Infinity, -Infinity)` | −Infinity | 同じ |
| `logAddExp(NaN, 1)` | NaN | 同じ |

呼び出し元 (binomial・negbinomial・poisson の log の分布関数の和) は log の確率 (0 以下) を渡すので、公開関数からは届かない。内部関数の約束 (log(e^a + e^b)) の誤りとして直した。docs は変更しない。

## 修正

m が −Infinity か +Infinity なら m を返す。

## テスト

- `test/issue54.test.ts`: 上の表の値と、(log 2, log 3) が log 5
- stash で、修正前に失敗することを確かめた
- 全体テスト `npx vitest run`: 2362 passed / 34 skipped、失敗 0。`npx tsc --noEmit -p .`: エラーなし

## 範囲外 (記録だけ)

`src/distributions/nt.ts` のモジュール内の `logAddExp` も同じ形 (Inf, Inf で NaN)。外から呼べず、log の確率だけを受け取るので変えていない。
