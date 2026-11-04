# Audit #981 — wilcoxTest の mu 差し引き・加算による信頼区間データの精度喪失

- 対象: `src/htest/wilcoxTest.ts`
- 監査時 HEAD: `6a89d88316fc0b53d85a08a662cddb0bb973866a`
- 判定: signed-rank の信頼区間・Hodges–Lehmann 推定値における決定的な浮動小数点精度喪失
- Issue: [#502](https://github.com/numero-uno-jpn/rStats.js/issues/502)

## 要約

`signedRank()` は検定統計量計算のために `x0` の各値から `mu` を減算する。その後 `confInt: true` の場合、元データを復元する目的で `x.map(v => v + mu)` を実行する。しかし IEEE-754 binary64 では減算後の加算は一般に元の値を復元しない。結果として Walsh averages の順序統計量とその中央値を、入力データとは異なる値から計算する。

## 再現データ

```ts
const x = [8841848152503256, 8841848152503264];
const mu = -5054035322351469;
wilcoxTest(x, { mu, confInt: true, exact: true });
```

この入力では `x[i] - mu` は有限であり、half-unit の代替経路には入らない。一方、現行の復元式は次の値になる。

```ts
[(x[0] - mu) + mu, (x[1] - mu) + mu]
// [8841848152503255, 8841848152503263]
```

両方の観測値が 1 ずつ小さくなる。n=2、差分にゼロ・同順位がない exact signed-rank 区間では Walsh averages の両端が区間端点となるため、期待される区間は `[8841848152503256, 8841848152503264]`、Hodges–Lehmann 推定値は `8841848152503260`。復元値を使う現行経路ではそれぞれ 1 小さくなる。

## 影響範囲

- signed-rank 検定の `confInt: true` における exact CI と Hodges–Lehmann 推定値。
- 同じ復元値が normal-approximation CI にも渡されるため、その経路にも同種の影響。
- 検定統計量・p値は差し引き後の値から計算されるため、この問題の直接の影響対象ではない。

## 検証範囲・制約

- `signedRank()` の差し引き、zero 除外、CI用データ再構築、Walsh averages の順にソースを追跡。
- 既存 Issue を検索し、同一原因の報告がないことを確認して Issue #502 を登録。
- 再現用のbinary64値は演算を追って確認。Vitest・Rの実行は未実施。
- ソースコード変更なし。
