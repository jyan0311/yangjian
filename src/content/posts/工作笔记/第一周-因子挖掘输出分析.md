这次运行目录是：

[bandit_evolve_v1_1d_hs300_stock_fs_500](/data/yangjian/SchemaEvolve_framework_snapshot_20260616/SchemaEvolve/experiments/bandit_evolve_v1/runs/bandit_evolve_v1_1d_hs300_stock_fs_500)

当前没有相关 Python 进程，说明昨天那次已经结束。它不是异常中断，而是达到了目标后停止：配置 `target_valid=500`，最终 `valid_count=502`。

**1. 输出位置**
核心输出都在：

```text
SchemaEvolve/experiments/bandit_evolve_v1/runs/bandit_evolve_v1_1d_hs300_stock_fs_500/
```

主要文件/目录：

```text
config.resolved.json
factor_profile.json
progress.json
dashboard.html
seen_plan_keys.txt
selections/
rounds/
models/
```

产物规模：

```text
progress.json      672K
dashboard.html      16K
seen_plan_keys.txt 100K
selections/        193M
rounds/            371M
models/            106M
```

具体数量：

```text
完成 round 数：42 轮，round_0000 ~ round_0041
候选选择文件：42 组
batch_summary.json：42 个
reward_buffer.jsonl：42 个
driver_stdout/stderr：各 42 个
reward model：36 个 ensemble 模型目录
seen plan keys：504 条
```

几个最重要的文件：

```text
progress.json
```

总进度、最终 summary、每轮 selection/batch/model 状态。

```text
factor_profile.json
```

本次实际使用的数据和评估窗口。

```text
selections/round_xxxx_summary.json
selections/round_xxxx_tasks.jsonl
selections/round_xxxx_candidate_scores.jsonl
```

每轮候选池打分、选择结果、送去生成的任务。

```text
rounds/round_xxxx/batch_summary.json
rounds/round_xxxx/reward_buffer.jsonl
rounds/round_xxxx/driver_stdout.txt
rounds/round_xxxx/driver_stderr.txt
```

每轮生成、静态检查、物化、健康检查、回测、reward 结果和日志。

```text
models/ensemble_round_xxxx/ensemble.joblib
models/ensemble_round_xxxx/ensemble_summary.json
models/ensemble_round_xxxx/training_rows.csv
```

每轮训练出来的 reward model。最新模型是：

```text
models/ensemble_round_0041/ensemble.joblib
```

注意：因为配置里 `cleanup_after_reward=true`，每轮结束后删除了大体积 `factors/` 和 `healthy_factors/`。所以 reward、metrics、代码和日志保留了，但很多因子 parquet 本体没有保留；如果要复用某个最佳因子，需要从对应 round 的代码重新物化。

**2. 运行过程和结果**
本次使用的数据窗口实际是：

```text
bar_data_root: 2016-01-01 ~ 2025-12-26 数据目录
label_root:    2016-01-01 ~ 2025-12-26 标签目录
实际 reward/backtest 窗口: 2016-01-01 ~ 2020-12-31
```

实际生效配置来自 [factor_profile.json](/data/yangjian/SchemaEvolve_framework_snapshot_20260616/SchemaEvolve/experiments/bandit_evolve_v1/runs/bandit_evolve_v1_1d_hs300_stock_fs_500/factor_profile.json)：

```json
"begin_date": "2016-01-01",
"end_date": "2020-12-31"
```

这里有个小不一致：配置 notes 里写了 “Train 2016-2020, Valid 2021”，但实际代码使用的是 `factor_profile.begin_date/end_date`，所以这次 reward 只评估到 `2020-12-31`，没有用 2021。

运行总体结果：

```text
completed_rounds: 42
target_valid: 500
total_rows: 504
valid_count: 502
invalid_count: 2
valid_rate: 99.60%
real_reward_count: 488
failure_penalty_count: 14
transient_failure_count: 2
reward_mean: 0.1003
reward_median: 0.0970
reward_max: 0.3242
```

每轮大致流程是：

```text
生成 6000 个候选组合
-> reward model / coverage / mutation 选择 12 个
-> LLM 生成因子代码
-> 静态检查
-> 数值/泄漏检查
-> 因子物化
-> 健康检查
-> SchemaEvolve.backtest 回测
-> 计算 reward
-> 写入 reward_buffer
-> 训练下一轮 ensemble reward model
```

停止原因：不是跑满 `max_rounds=60`，而是已经超过目标 `target_valid=500`。最终收集到 `502` 条可训练 reward 样本。

最好的因子 reward：

```text
reward: 0.32421696562079294
round: round_0037
task: round_0037_impl_008
best_factor: round_0037_impl_008_F_some_factor_name_p96
```

它的指标：

```text
IC:    0.0324288161
ICIR:  0.3085610864
RIC:   0.0348005090
RICIR: 0.3160135243
```

对应 plan：

```text
event.cross_section_price_oscillator_divergence_rank
context.cross_section_reference_distance_rank
quality.cross_section_volume_confirmation_rank
quality.efficiency_filter
direction.reversal
output.event_decay_signal
```

整体判断：这次运行是成功的，产出了足够多的有效因子样本，并成功训练到了最新的 ensemble reward model。结果上看，最高 reward 达到 `0.3242`，有效率接近 100%，说明生成、检查、物化、回测链路整体跑通且稳定。

后续如果你要看 dashboard：

```bash
cd /data/yangjian/SchemaEvolve_framework_snapshot_20260616

python -m http.server 8899 \
  --directory SchemaEvolve/experiments/bandit_evolve_v1/runs/bandit_evolve_v1_1d_hs300_stock_fs_500
```

然后浏览器打开：

```text
http://服务器IP:8899/dashboard.html
```



# 因子筛选和回测


我已经补好了“从挖掘结果选出 top 150 因子，并用 qlib/LGBM/TopkDropout 做 factor library 级别回测”的入口。

新增文件：

[run_mined_factor_library_reproduction.py](/data/yangjian/SchemaEvolve_framework_snapshot_20260616/SchemaEvolve/qlib_mining/run_mined_factor_library_reproduction.py)

配置文件：

[mined_top150_factor_library_qlib.json](/data/yangjian/SchemaEvolve_framework_snapshot_20260616/SchemaEvolve/qlib_mining/configs/mined_top150_factor_library_qlib.json)

我已经做过 `--dry-run`，确认可以从昨天的挖掘结果里选出 150 个可用因子，manifest 已生成：

[selected_top_factors.csv](/data/yangjian/SchemaEvolve_framework_snapshot_20260616/SchemaEvolve/qlib_mining/runs/mined_top150_factor_library/selected_top_factors.csv)

**关键提醒**
你描述的 `valid=2020-2021`、`test=2021-2025` 有重叠。我这里按 QuantaAlpha 更严格的非重叠口径设置为：

```text
train: 2016-01-01 ~ 2020-12-31
valid: 2021-01-01 ~ 2021-12-31
test/backtest: 2022-01-01 ~ 2025-12-26
```

**挖掘完成后的 Checklist**
1. 固化挖掘结果：确认 `progress.json`、`reward_buffer.jsonl`、`batch_code/`、`models/` 已保留。
2. 只用 train 阶段 reward 选因子：从昨天 run 中按 reward 选择 top 150，不能看 test 表现。
3. 重新物化 top 150：因为 `cleanup_after_reward=true` 删除了原始 parquet，需要用保留代码重新生成 2016-2025 因子矩阵。
4. 构造 qlib Dataset：150 个挖掘因子作为 feature，qlib label 为 `Ref($close, -2) / Ref($close, -1) - 1`。
5. 固定 LGBM 参数：和 Table 1 Factor Libraries 复现配置一致。
6. valid 早停：使用 2021 年验证集。
7. test 回测：只在 2022-2025 做 IC/RIC 和 TopkDropout 回测。
8. 对比基线：和 `Alpha158(20)`、`Alpha158`、`Alpha360` 的结果放在同一张表。
9. 做稳健性检查：top 50/100/150/200、去高相关因子、不同成本、不同 topk。
10. 最终论文汇报：报告 IC、ICIR、RIC、RICIR、AER/ARR、IR、SR、MDD、Calmar、累计超额曲线。

**先检查选出的 150 个因子**
```bash
cd /data/yangjian/SchemaEvolve_framework_snapshot_20260616

/data/yangjian/conda_envs/backtest/bin/python \
  SchemaEvolve/qlib_mining/run_mined_factor_library_reproduction.py \
  --config SchemaEvolve/qlib_mining/configs/mined_top150_factor_library_qlib.json \
  --dry-run
```

**正式运行 qlib factor library 回测**
```bash
cd /data/yangjian/SchemaEvolve_framework_snapshot_20260616

export PYTHONPATH="$PWD"
export GIT_PYTHON_REFRESH=quiet

/data/yangjian/conda_envs/backtest/bin/python \
  SchemaEvolve/qlib_mining/run_mined_factor_library_reproduction.py \
  --config SchemaEvolve/qlib_mining/configs/mined_top150_factor_library_qlib.json
```

**运行后输出位置**
```text
SchemaEvolve/qlib_mining/runs/mined_top150_factor_library/
```

主要产物会包括：

```text
selected_top_factors.csv
selected_top_factors.json
selected_code/
materialized_factors/1d/
selected_factor_parquets/
materialize_status.csv
preflight_qlib_data.json
mined_top150_metrics.json
mined_top_factors_cumulative_excess.csv
```

如果后面你想改成 top 50 或 top 100，可以直接：

```bash
/data/yangjian/conda_envs/backtest/bin/python \
  SchemaEvolve/qlib_mining/run_mined_factor_library_reproduction.py \
  --config SchemaEvolve/qlib_mining/configs/mined_top150_factor_library_qlib.json \
  --top-n 100
```

这个流程和 QuantaAlpha 的核心思想一致：挖掘阶段只产生候选因子，最终评估阶段把选出的因子库作为一个整体输入 LGBM，在固定 train/valid/test 切分和固定 qlib 回测参数下比较表现。



# 如何选择 L2.5 可用的因子


这次任务是正常完成的，不是失败。最终 `status: ok`，150 个因子成功进入 LGBM + qlib 回测，结果文件已写到：

[metrics](/data/yangjian/SchemaEvolve_framework_snapshot_20260616/SchemaEvolve/qlib_mining/runs/mined_top150_factor_library/mined_top150_metrics.json)  
[selected factors](/data/yangjian/SchemaEvolve_framework_snapshot_20260616/SchemaEvolve/qlib_mining/runs/mined_top150_factor_library/selected_top_factors.csv)

那些输出里：

`CatBoostModel/XGBModel/PyTorch skipped`：无害，当前用的是 `LGBModel`，不需要装这些包。  
`Gym unmaintained`：无害，是 qlib 依赖链提示，不影响本次回测。  
`git: not found`：无害，只是 qlib/MLflow 试图记录 git diff/status 失败，不影响训练和回测。

我已经做了两类修改：

1. 修复/降噪  
   修改了 [run_mined_factor_library_reproduction.py](/data/yangjian/SchemaEvolve_framework_snapshot_20260616/SchemaEvolve/qlib_mining/run_mined_factor_library_reproduction.py)，现在默认会压住 qlib、Gym、MLflow、git 子进程的非关键输出。复跑验证结果仍然 `ok`，指标基本一致。

2. 实现论文调研里的选因子逻辑  
   新增支持：
   - `topk`：原始方式，按 reward/指定指标取前 150。
   - `FactorEngineFS`：支持 `FS=(IC*10+ICIR+RIC*10+RICIR)/4` 排序。
   - `selection_filters`：支持 `min_ric`、`min_ic`、`min_ricir`、`min_factorengine_fs` 等门槛。
   - `quantaalpha_greedy_corr`：先取更大的候选池，再按相关性阈值贪心去冗余，类似 QuantaAlpha/MCTS-Alpha 的 `|corr| < 0.7` 思路。

我还新增了一个 QuantaAlpha 风格配置：

[quantaalpha config](/data/yangjian/SchemaEvolve_framework_snapshot_20260616/SchemaEvolve/qlib_mining/configs/mined_top150_factor_library_qlib_quantaalpha_select.json)

运行原始 top150 方式：

```bash
cd /data/yangjian/SchemaEvolve_framework_snapshot_20260616

/data/yangjian/conda_envs/backtest/bin/python \
  SchemaEvolve/qlib_mining/run_mined_factor_library_reproduction.py \
  --config SchemaEvolve/qlib_mining/configs/mined_top150_factor_library_qlib.json
```

运行 QuantaAlpha 风格“候选池 300 + RIC 排序 + 2021 valid 相关性去冗余”：

```bash
cd /data/yangjian/SchemaEvolve_framework_snapshot_20260616

/data/yangjian/conda_envs/backtest/bin/python \
  SchemaEvolve/qlib_mining/run_mined_factor_library_reproduction.py \
  --config SchemaEvolve/qlib_mining/configs/mined_top150_factor_library_qlib_quantaalpha_select.json
```

先快速检查候选选择：

```bash
/data/yangjian/conda_envs/backtest/bin/python \
  SchemaEvolve/qlib_mining/run_mined_factor_library_reproduction.py \
  --config SchemaEvolve/qlib_mining/configs/mined_top150_factor_library_qlib_quantaalpha_select.json \
  --dry-run
```

一个重要说明：目前新增的 QuantaAlpha 风格版本是“按 reward buffer 里的 `RIC` 排序，再用 2021 valid 因子值做相关性去冗余”。如果要做到和论文更严格一致，下一步应当在 materialize 后对候选池重新计算 `Valid 2021 RankIC`，再按这个 valid RankIC 贪心选因子。当前版本已经把最关键的去冗余框架接好了。



# 更新，添加2021年的数据验证和 RankIC

已实现“materialize 后重算 2021 Valid RankIC，再按 Valid RankIC 贪心低相关选因子”。

改动位置：

[run_mined_factor_library_reproduction.py](/data/yangjian/SchemaEvolve_framework_snapshot_20260616/SchemaEvolve/qlib_mining/run_mined_factor_library_reproduction.py)  
[quantaalpha select config](/data/yangjian/SchemaEvolve_framework_snapshot_20260616/SchemaEvolve/qlib_mining/configs/mined_top150_factor_library_qlib_quantaalpha_select.json)

现在流程是：

1. 先从 reward buffer 预筛 `candidate_pool_n=300` 个候选。
2. materialize 这 300 个候选因子。
3. 在 `2021-01-01` 到 `2021-12-31` valid 段，用 qlib label 重新计算每个候选因子的 `valid_RIC`。
4. 按 `valid_RIC` 降序排序。
5. 贪心选择，与已选因子的 `|corr| < 0.7` 才入池。
6. 选满 150 个后，用这 150 个训练 LGBM，并在 2022-2025 test/backtest。

完整运行命令：

```bash
cd /data/yangjian/SchemaEvolve_framework_snapshot_20260616

/data/yangjian/conda_envs/backtest/bin/python \
  SchemaEvolve/qlib_mining/run_mined_factor_library_reproduction.py \
  --config SchemaEvolve/qlib_mining/configs/mined_top150_factor_library_qlib_quantaalpha_select.json
```

会新增/更新这些关键输出：

```text
SchemaEvolve/qlib_mining/runs/mined_top150_factor_library_quantaalpha_select/
├── valid_rankic_candidate_scores.csv
├── correlation_selection_diagnostics.csv
├── selected_top_factors.csv
├── selected_factor_parquets/
├── mined_top150_metrics.json
└── mined_top_factors_cumulative_excess.csv
```

我已验证：

```bash
/data/yangjian/conda_envs/backtest/bin/python -m py_compile \
  SchemaEvolve/qlib_mining/run_mined_factor_library_reproduction.py
```

并做了小样本真实 smoke test：前 10 个候选重算 Valid RankIC 后成功选出 5 个，核心逻辑可运行。完整 300→150 会更久，因为需要 materialize 300 个候选并逐个计算 2021 valid RankIC。