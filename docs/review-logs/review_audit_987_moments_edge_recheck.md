# Audit #987 — moment/shape summaries の境界条件を再確認

- 対象: `src/descriptive/moments.ts`
- 監査時 HEAD: `a424c121644dc2dba660f63c8a271a0654e078c1`
- 対象ソース blob: `740c02eaceadd6f1454ecd7564bcd6f09f563b5b`
- 判定: 今回確認した範囲で新規不具合なし

## 確認内容

`skewness()` / `kurtosis()` の n=0、n=1、定数列、type 2 の最小標本数、type 3 補正、中心モーメントのスケーリングを確認。空標本・定数列での0除算はNaNとなり、type 2は必要標本数未満を明示的に拒否する。
`geometricMean()` の負値・ゼロ・空標本、`modes()` の空標本と全値一意、`meanAD()` の中心指定、`cv()` の n とスケール不変性、`scale()` の center/scale の各組合せを確認した。

Rの `scale.default` がRMS分母に `max(1, n-1)` を使うことも公式マニュアル・実装と照合し、単一観測での分母処理は現行コードと整合していた。

## 検証範囲・制約

- `src/descriptive/moments.ts`、`src/descriptive/basic.ts`、`test/descriptive.test.ts`、`test/fixtures/scale.json` を確認。
- Rの `scale` の定義を公式ドキュメントと実装で照合。
- ソースレベルの静的監査。Vitest、Node、R実行は未実施。
- ソースコード変更なし.