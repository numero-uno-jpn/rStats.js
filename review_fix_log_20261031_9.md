# 外部レビュー (9 回目) 対応ログ

レポート: ユーザーがチャットに貼り付けた追加監査 (CPH-03、OMEGA-01)。

| ID | 判定・対応 |
|---|---|
| CPH-03 (coxph の整数ケース重みと Efron) | レビュアーの撤回が正しい。R 4.5.2 + survival で、重み付き (係数 −0.3769812) と行の複製 (−0.4264666) は一致しない (R も重みを複製として扱わない)。rStats.js は −0.37698123583291737 で、R と一致。変更なし |
| OMEGA-01 (omega の minres が optim の収束を確認しない) | psych 2.6.9 の `fa` も `convergence` を確認しない (R 互換としては一致)。ユーザー判断で、`fit.convergence !== 0` のとき `warnings` に "minres did not converge (optim convergence code N): examine the results carefully" を追加した。値は変えない。docs (英・日) の Deliberate differences に記載 |

テスト: 収束しない入力を作るのが難しいため、警告そのもののテストは追加していない。既存のテストは全件成功。
