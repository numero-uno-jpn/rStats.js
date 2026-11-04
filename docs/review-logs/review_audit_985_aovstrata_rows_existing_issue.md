# Audit #985 — aov(Error()) の treatment/error 行対応を再確認

- 対象: `src/models/aovStrata.ts`
- 監査時 HEAD: `f0e0d0c3e92b32ebabae32000174d881087d0904`
- 対象ソース blob: `2a7a37613d82b4aa15ae260b7baa791704faad5c`
- 判定: 既存Issue #353 と同一原因。新規Issueなし
- 既存Issue: [#353](https://github.com/numero-uno-jpn/rStats.js/issues/353)（closed / not_planned）

## 確認内容

`aovStrataFit()` は treatment design `dt` を先に作り、その `dt.y` の長さを `n` とする。その後、Error() 変数と treatment 変数を含む `de` を別途作る。`de.frame.rows` は Error() 変数の欠損も除外する一方、`dt.frame.rows` は treatment と response の欠損だけを除外するため、両者が不一致になり得る。

これは既存Issue #353 に記載された原因・再現条件と一致する。現在のソースにも同じ二段階の design 構築が残っているため、Issueが closed / not_planned であることと、コード上の経路が残っていることを区別して記録する。再オープンや重複Issue作成は行わない。

## 再現データ（既存Issueの入力を再確認）

```ts
aov(
  "y ~ treatment + Error(subject)",
  {
    y: [1, 2, 3, 4, 5, 6],
    treatment: ["A", "A", "B", "B", "A", "B"],
    subject: ["s1", "s1", null, null, "s2", "s2"],
  },
);
```

response/treatment は6行すべて完全だが、subject は3・4行目が欠損する。treatment design は6行、Error design は4行となる。

## 検証範囲・制約

- `src/models/aovStrata.ts`、`src/models/modelMatrix.ts`、`src/models/modelFrame.ts` を確認。
- `design()` の frameNames、`extraVariables`、`modelFrame()` の complete-case row selection を追跡。
- Issue #353 の本文と現在のソース経路を照合。
- ソースレベルの静的監査。Vitest、Node、R 実行は未実施。
- ソースコード変更なし。
