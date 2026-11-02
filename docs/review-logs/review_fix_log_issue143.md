# Issue #143 対応ログ: cohensD・hedgesG の区間で非心 t の初期区間が潰れる

GitHub Issue #143。夜間の自律修正 (Plan モードの代わりに計画をここに書く)。

## 計画

- 意図: 効果量の区間の `ncpOfT` は非心度を uniroot の [t − 1, t + 1] から探す (extendInt "downX")。t が 2^54 規模で t ± 1 が両方 t に丸まると区間が空で、uniroot が "lower < upper is not fulfilled" を投げる (区間を広げる前に)
- 方法: t − 1 < t + 1 のときは今のまま 1、そうでないときだけ刻みを |t| ε (t の 1〜2 ulp) にする。広げる処理は uniroot の extendInt (初めの刻み 0.01 |u|、倍々) に任せる
- 選んだ理由: issue の案 (尺度に合わせた刻み・隣の double) どおり。今までの入力では区間が同じで、ビットが変わらない

## 確認 (main `a3b476f`)

| 呼び出し | effectsize (R 4.5.2) | 修正前 | 修正後 |
|---|---|---|---|
| cohensD([1, 1 + ε], mu = −1) | エラー (optim: "function cannot be evaluated at initial parameters") | RangeError "lower < upper is not fulfilled" | d 12738103345051544、区間 [399186453614300.06, 28551219582112220] |
| hedgesG(同) | 同じエラー | 同じ RangeError | g 0 (df 1 の Hedges の J は Γ(0) の逆数で 0)、区間 [0, 0] |
| cohensD([1, 1 + ε, 1 + 2ε], mu = −1) | | [1433186871003179, 17299637460575152] | 同じビット |

限界の確かめ: pt(2^54, 1, ncp = 限界/√(1/2)) が 0.975 と 0.025000000000000012。

## 修正

- `src/htest/effectSize.ts` の `ncpOfT`: 刻み h = (t − 1 < t + 1 ? 1 : |t| ε)
- docs (英・日) の「R が失敗する」表に 1 行 (effectsize はエラー)

## テスト

- `test/issue143.test.ts`: issue の例で限界が pt の 0.975・0.025 を満たす、hedgesG が投げない、ほかの入力は修正前のビット。stash で、修正前に 2 件中 1 件が失敗することを確かめた
- 全体テスト `npx vitest run`: 261 files、2525 passed / 38 skipped、失敗 0。`npx tsc --noEmit -p .`: エラーなし

## 範囲外として記録

なし (ncpOfF の初期区間は [0, max(10, 4 F df1)] で、空にならない)

## close comment

Fixed in <commit of #143, see git log --grep='#143'>: where t - 1 and t + 1 both round to t, ncpOfT now starts the search for the noncentrality from t ± |t| eps (1 to 2 ulp of t), and uniroot's extendInt widens it as before; elsewhere the step is 1 and the bits are unchanged. cohensD([1, 1 + Number.EPSILON], undefined, { mu: -1 }) now gives d = 1.2738e16 with the interval [3.9919e14, 2.8551e16] (pt(2^54, 1, ncp) at the limits is 0.975 and 0.025), and hedgesG no longer throws. effectsize's cohens_d fails there too (optim cannot start), recorded in docs/differences-from-r.md. Test: test/issue143.test.ts. (Not pushed yet.)
