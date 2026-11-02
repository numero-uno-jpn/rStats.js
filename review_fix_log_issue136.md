# Issue #136 対応ログ: 非心 t の分位点で farLimit が溢れる (issue の例は再現しない。近い入力の誤答は判断待ち)

GitHub Issue #136。夜間の自律対応。判定: issue の例は再現しない。ただし確認中に、同じ関数の近い入力 (分位点が最大の double を超える場合) で誤答を見つけた。**判断待ち** (コードの変更なし)。

## 計画

- 意図: issue の主張 (`qt(0.9, 2, { ncp: 1e299 })` で `farLimit` が Inf に溢れ、分位点の反転が壊れる) を確かめる
- 方法: issue の例と、p・df・ncp を変えた例を npx tsx で計算し、pt で戻して p に一致するか、df = 2 の解析的な近似 ncp / sqrt(−log p) (ncp が大きいときの P(T ≤ t) ≈ exp(−ncp²/t²)) と比べる。R 4.5.2 の qt も見る
- 選んだ理由: 有限の正しい値が返れば変えない。誤答が見つかったら、直し方を選ぶ判断が要るかを見る

## 確認 (main `f389330`)

| 呼び出し | 近似 ncp/sqrt(−log p) | R 4.5.2 | rStats.js | pt(rStats.js の値) |
|---|---|---|---|---|
| qt(0.9, 2, ncp = 1e299) (issue の例) | 3.080782624761102e299 | Inf (誤り) | 3.0807826247611014e299 | 0.9 |
| qt(0.1, 2, ncp = 1e299) | 6.5901022898226085e298 | 9.48075190810903e153 (誤り) | 6.5901022898226085e298 | 0.09999999999999998 |
| qt(0.5, 2, ncp = 1e299) | 1.2011224087864499e299 | | 1.2011224087864497e299 | 0.4999999999999999 |
| qt(0.9, 1, ncp = 1e299) | | Inf | 7.957896561090548e299 | 0.9 |
| qt(0.9, 10, ncp = 1e299) | | | 1.433674141138895e299 | 0.9 |
| qt(0.9, 2, ncp = 1e200) | 3.080782624761102e200 | Inf | 3.0807826247611006e200 | 0.9 |
| qt(0.1, 2, ncp = 1e308) | 6.590102289822609e307 | 9.4807519081087683e153 | 6.590102289822609e307 | 0.09999999999999998 |
| qt(0.9, 2, ncp = 5e307) | 1.5403913123805511e308 | | 1.5403913123805503e308 | 0.9 |

issue の例は有限の正しい値を返す (2 ms)。`farLimit(1, 1e299)` は issue のとおり Inf になり、p = 0.9 (小さい方の裾は上側) では `qnt1` の `!lowerY` の枝で `farTailLog(Infinity, …)` が `pntBoth(Infinity, …)` に落ちる。しかしその値は上側の log 確率 −Inf で、「目標がそれより小さいなら冪の裾で解く」の判定は偽になり、上限 hi = T0 = Inf のまま通常の解法で正しく解ける (冪の裾の近道を使わないだけ)。R はこの規模で Inf か誤った値を返す。

### 見つけた誤答 (判断待ち)

分位点の真値が最大の double (1.797e308) を超える場合に、Inf でなく 1 などの誤った有限値を返す。

| 呼び出し | 近似 | R 4.5.2 | rStats.js | pt(rStats.js の値) |
|---|---|---|---|---|
| qt(0.9, 2, ncp = 6e307) | 1.85e308 (> 最大の double) | Inf | **1** | 0 |
| qt(0.9, 2, ncp = 1e308) | 3.08e308 | Inf | **1** | 0 |
| qt(0.95, 2, ncp = 5e307) | 2.2e308 | | **1** | 0 |
| qt(0.5, 2, ncp = 1.5e308) | 1.80e308 | Inf | **2.2844135865397565e222** | 0 |
| qt(0.9, 1, ncp = 1e308) | | Inf | **1** | 0 |
| qt(0.99, 10, ncp = 1e308) | | Inf | **1** | 0 |

pt(1.7e308, 2, ncp = 1e308) = 0.7074977984184172 < 0.9 なので、qt(0.9, …) は Inf が正しい (R も Inf)。

原因: `qnt1` (`src/distributions/nt.ts` 1184 行目) は、最大の double での分布関数が目標に届かないときに s × Inf を返す検査を `df < 1e-3` のときだけ行う (近い裾が 1 − c |t|^(−2a) でしか増えない小さな a の場合のコメント)。ncp が最大の double に近いと、df が大きくても分位点が最大の double を超え、その後の解法が区間の外で崩れて 1 などを返す。

## 判断待ち

R が正しく (Inf) rStats.js が誤る範囲なので、直すこと自体は方針に沿う。ただし #136 の issue の例とは別の入力で、修正は `qnt1` の分岐 (通常の範囲の経路の手前) に触れるので、朝の判断を待つ。

- 案 A (推奨): 1184 行目の検査を、`lowerY` の側ではすべての df で行う (`cdfY(Number.MAX_VALUE, true, true) < logTarget` なら s × Inf)。ただし毎回 pntBoth を 1 回余分に呼ぶので、ncp が大きいとき (例: |ncp| > 1e300 か、正規近似の x0 が溢れる・1e300 を超えるとき) だけ行う。利点: 局所的、通常の範囲のビットは変わらない (条件で分ける場合)。欠点: 条件の閾値の選び方 (分位点が最大の double を超えうるのは |ncp| ≳ 1.797e308 × sqrt(−log p) / … で、p が 1 に近いと ncp 1e307 でも超える。安全には x0 が非有限か 1e300 超、または |ncp| > 1e290 程度)
- 案 B: 解法の後で、得た y が pt で目標と合わない (区間の外で崩れた) とき Inf にする。利点: どの経路にも効く。欠点: 「合わない」の判定の許容幅が要り、別の不具合を隠しうる
- 案 C: この issue は再現しないとして閉じ、見つけた誤答は別の issue として扱う (修正は案 A)

推奨: 案 A を #136 の続きとして直す (issue の題「large finite ncp で非心 t の分位点が壊れる」に当たる)。テストは上の表の 6 件 (Inf) と、issue の例を含む有限の 8 件 (修正前と同じビット)。

## close comment

(案 C、または直さない場合の文面。案 A で直すときは修正のコミットに合わせて書き直す。)

Not reproducible as described: qt(0.9, 2, ncp = 1e299) returns 3.0807826247611014e299, and pt at that value is 0.9 (the analytic limit ncp / sqrt(-log p) for df = 2 is 3.080782624761102e299; R 4.5.2 returns Inf). farLimit(1, 1e299) does overflow and farTailLog(Infinity, ...) falls to pntBoth(Infinity, ...), as the issue traces, but that gives the upper log probability -Infinity, so the power-law shortcut is skipped and the ordinary solver, with the upper bound Infinity, finds the quantile. The lower quantile qt(0.1, 2, ncp = 1e299) is also correct (6.5901022898226085e298; R gives 9.48e153). While checking, a different failure was found: where the quantile exceeds the largest double (qt(0.9, 2, ncp = 1e308), true value about 3.1e308), qt returns 1 instead of Inf; this is recorded in review_fix_log_issue136.md and will be handled separately. (Not pushed yet.)
