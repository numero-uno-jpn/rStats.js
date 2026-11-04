# Audit ledger 2

このファイルを Audit #969 以降の監査台帳として使用する。
従来の docs/audit-ledger.md は変更せず、以後の監査記録は本ファイル末尾へ追記する。
各監査の詳細な再現手順・根拠は docs/review-logs/ の個別記録を参照。

---

## Audit #968 — Richardson 微分で負の eps を拒否する不整合

- 対象: src/numerics/deriv.ts
- 監査時 HEAD: 86bcea46d1c5923071fac9eae7a7f5f2f6d8ef07
- 対象ソース blob: df9a324746a0f194c3fb60461b14535bf16b58b2
- 判定: 再現条件をソース上で確認した不具合
- Issue: [#499](https://github.com/numero-uno-jpn/rStats.js/issues/499)
- 詳細: [review_audit_968_deriv_negative_eps.md](review-logs/review_audit_968_deriv_negative_eps.md)

### 要約

checkEps() は有限かつ非ゼロの負の eps を受理し、ステップ生成部のコメントも負のステップを反対方向に取る仕様を示している。しかし steps() が後段で h > 0 を要求するため、座標がゼロ付近にある場合に負の eps が拒否される。

```ts
grad((x) => x[0]! * x[0]!, [0], { eps: -1e-4 });
jacobian((x) => [x[0]! * x[0]!], [0], { eps: -1e-4 });
hessian((x) => x[0]! * x[0]!, [0], { eps: -1e-4 });
```

上記はいずれも現状では正の有限ステップを要求する RangeError になる。中心差分では分子・分母がともに符号反転するため負のステップでも計算可能であり、期待値は順に [0]、[[0]]、[[2]]。

### 検証範囲・制約

- src/numerics/deriv.ts、test/numerics.test.ts、oracle/numerics.R を確認。
- 既存 Issue を検索し、負の eps に関する同一原因の Issue がないことを確認。
- ソースの制御フローと差分式に基づく確認。Vitest、実行時再現、R/numDeriv の実行は未実施。
- ソースコード変更なし。

### 記録コミット

5d8d5a3c3d7832416484bcfbb138f1f236ba1a8d（個別監査ログの追加）
