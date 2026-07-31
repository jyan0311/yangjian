---
title: "SchemaEvolve｜Bandit 挖掘因子样本外泛化诊断"
description: "复盘一次 target_valid=500 的 bandit 因子挖掘实验：流程正常但 2021 valid 与 2022-2025 test 泛化偏弱，问题集中在样本内 reward 与样本外筛选口径不一致。"
date: "2026-06-18"
category: "量化研究"
series: "Schema Alpha"
status: "draft"
tags: ["SchemaEvolve","Alpha","Experiment","Generalization","Backtest"]
source: "Obsidian/【科研】量化交易/THU量化交易实习/项目内容和进度/跑实验/【分析】挖掘出来的因子表现差.md"
featured: false
draft: false
---
检查结果：这次 bandit 挖掘流程本身基本正常，不是数据集缺失或程序大面积失败。真正的问题更像是：挖掘阶段在 2016-2020 内样本表现还可以，但到 2021 valid / 2022-2025 test 后泛化明显变弱。

**1. 这个命令如何运行、输出什么**
你的命令会启动：

```bash
SchemaEvolve.experiments.bandit_evolve_v1.run_bandit_training
```

实际 run 目录是：

```text
SchemaEvolve/experiments/bandit_evolve_v1/runs/bandit_evolve_v1_1d_hs300_stock_fs_500/
```

主要输出：

```text
config.resolved.json                 # 实际解析后的配置
factor_profile.json                  # 实际挖掘数据窗口、label、reward 公式
progress.json                        # 总进度、每轮 selection/batch/model summary
dashboard.html                       # 可视化 dashboard
seen_plan_keys.txt                   # 已尝试 schema plan
rounds/round_xxxx/                   # 每轮生成代码、日志、回测结果
rounds/round_xxxx/reward_buffer.jsonl
rounds/round_xxxx/batch_summary.json
selections/round_xxxx_tasks.jsonl    # 每轮选中的候选 schema 任务
models/ensemble_round_xxxx/          # bandit reward model
```

打开 dashboard：

```bash
cd /data/yangjian/SchemaEvolve_framework_snapshot_20260616
python -m http.server 8899
```

浏览器打开：

```text
http://服务器IP:8899/SchemaEvolve/experiments/bandit_evolve_v1/runs/bandit_evolve_v1_1d_hs300_stock_fs_500/dashboard.html
```

**2. 流程是否正常、数据是否缺失**
我检查到：

```text
completed_rounds = 42
target_valid = 500
valid_count = 502
total_rows = 504
real_reward_count = 488
failure_penalty_count = 14
transient_failure_count = 2
valid_rate = 0.996
```

所以它是达到 `target_valid=500` 后正常停止，不是中途崩溃。

数据也存在：

```text
bar_data: 627 files, 2016-01-04 ~ 2025-12-26
label_data: 5 parquet files, 2016-01-04 ~ 2025-12-26
```

每轮统计也正常：

```text
generation_ok      503
static_ok          497
materialize_ok     496
backtest_ok        488
valid_reward_count 488
invalid_reward     16
```

stderr 里主要是 pandas `FutureWarning`，不是致命错误。

一个重要发现：配置 notes 写了 “Train 2016-2020, Valid 2021”，但实际 `factor_profile.json` 是：

```json
"begin_date": "2016-01-01",
"end_date": "2020-12-31"
```

也就是说 bandit 挖掘奖励实际只在 2016-2020 上计算，没有把 2021 valid 纳入 reward。后面你用 qlib 在 2021 valid 重新筛选时发现衰减，这是合理的。

**3. 因子分布和表现**
我已经生成了诊断报告和 CSV：

[bandit_run_diagnostics.md](/data/yangjian/SchemaEvolve_framework_snapshot_20260616/SchemaEvolve/experiments/bandit_evolve_v1/runs/bandit_evolve_v1_1d_hs300_stock_fs_500/bandit_run_diagnostics.md)

[bandit_reward_rows.csv](/data/yangjian/SchemaEvolve_framework_snapshot_20260616/SchemaEvolve/experiments/bandit_evolve_v1/runs/bandit_evolve_v1_1d_hs300_stock_fs_500/bandit_reward_rows.csv)

[bandit_top100_by_reward.csv](/data/yangjian/SchemaEvolve_framework_snapshot_20260616/SchemaEvolve/experiments/bandit_evolve_v1/runs/bandit_evolve_v1_1d_hs300_stock_fs_500/bandit_top100_by_reward.csv)

[bandit_top100_by_ric.csv](/data/yangjian/SchemaEvolve_framework_snapshot_20260616/SchemaEvolve/experiments/bandit_evolve_v1/runs/bandit_evolve_v1_1d_hs300_stock_fs_500/bandit_top100_by_ric.csv)

挖掘阶段 2016-2020 内样本表现：

```text
RIC mean   = 0.01137
RIC median = 0.01120
RIC max    = 0.04260
RICIR mean = 0.08325
reward max = 0.32422
```

但 qlib 重新在 2021 valid 上评估后，之前我们看到：

```text
300 个候选 valid_RIC mean = 0.00092
最终 150 个 valid_RIC mean = 0.00405
只有 13 个因子 valid_RIC >= 0.01
```

这说明因子不是“完全无效”，但样本外稳定性偏弱，强行选 150 个会混入不少弱因子甚至负 valid RankIC 因子。

你之后可以反复运行这个总诊断命令：

```bash
cd /data/yangjian/SchemaEvolve_framework_snapshot_20260616

/data/yangjian/conda_envs/backtest/bin/python \
  SchemaEvolve/experiments/bandit_evolve_v1/analyze_bandit_run.py \
  --run-dir SchemaEvolve/experiments/bandit_evolve_v1/runs/bandit_evolve_v1_1d_hs300_stock_fs_500 \
  --qlib-output-dir SchemaEvolve/qlib_mining/runs/mined_top150_factor_library_quantaalpha_select
```

建议下一步不要继续固定 150，先做 `top_n=20/50/100/150` 敏感性测试，并加 `min_valid_ric=0` 或 `min_valid_ric=0.005`，看是否选不满。如果选不满，就说明当前候选池质量确实不足。
