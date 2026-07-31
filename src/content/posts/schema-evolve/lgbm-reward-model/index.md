---
title: "SchemaEvolve｜LGBM Reward Model 在算法中的定位"
description: "说明 SchemaEvolve 中 LGBM 不是收益预测模型，而是面向 schema plan 的 reward scorer；系统梳理其输入、标签、输出、训练方式与 bandit 选择链路。"
date: "2026-06-16"
category: "SchemaEvolve"
series: "SchemaEvolve 框架理解"
status: "polished"
tags: ["SchemaEvolve","LightGBM","Reward Model","Bandit"]
source: "Obsidian/【科研】量化交易/THU量化交易实习/4_完整的理解LGBM在这个算法的定位.md"
featured: false
draft: false
---
## 1. LGBM 是干什么的？

它 **不是因子模型**，也 **不直接预测收益**。  
它是 **Schema Plan 的 Reward Scorer（奖励预测器）**，用来回答：

> 「这个 `event + context + quality + direction + output` 组合，如果交给 LLM 实现并回测，**大概能拿多少 reward？**」

**算法目的：**

1. **压缩搜索空间**：名义 ~1.83 亿 plan，不可能全做回测；先用 LGBM  cheap 打分，再选 top batch 给 LLM。
2. **Bandit 的 exploit**：高 `reward_pred_mu` 的 plan 优先进 batch（配合 explore / mutation）。
3. **不确定性估计**：ensemble 多个子模型的标准差 → `reward_pred_sigma`，供 Thompson / UCB 策略用。

```text
历史 plan + 真实 reward  →  训练 LGBM
候选 plan（仅 schema 特征） →  LGBM 预测 μ、σ
                          →  Bandit 选下一批 20 个 plan 给 Implementation Agent
```

实现文件：`SchemaEvolve/experiments/bandit_evolve_v1/reward/ensemble_reward_model.py`

---

## 2. 输入是什么？

输入 **只有 schema 语义特征**，**没有**价格、因子值、代码文本。

从 `plan_key` 解析并编码，例如：

```text
event.gap_fill_or_hold|context.range_upper_boundary|quality.volume_confirmation|direction.reversal|output.event_decay_signal
```

### 2.1 原始特征

| 类型 | 字段 | 说明 |
|------|------|------|
| 类别 OneHot | `event`, `context`, `direction`, `output` | 各维 schema_id |
| 类别 OneHot | `quality_1`, `quality_2`, `quality_3` | 最多 3 个 quality（空则 ""） |
| 数值 | `quality_count` | quality 个数 0~3 |

### 2.2 交互特征（MultiLabelBinarizer）

| 交互 | 示例 |
|------|------|
| `event\|context` | `event.gap_fill_or_hold\|context.range_upper_boundary` |
| `event\|quality` | 每个 quality 一条 |
| `event\|output` | |
| `context\|quality` | |
| `event\|direction` | |

LGBM 实际吃的是 **稀疏矩阵**（OneHot + 交互项拼接），特征维数随训练集里出现过的 schema 组合增长。

### 2.3 训练标签（y）

每条样本来自 `reward_buffer.jsonl` 里 **一个 task 的最终 reward**：

| 样本类型 | 条件 | 标签 y |
|----------|------|--------|
| **real_reward** | 回测成功，`valid_for_reward_training=True` | 真实 reward（如 Sharpe 版 0~6 分） |
| **failure_penalty** | 静态/leak/物化/回测失败（非 transient） | **0** |
| **排除** | API 429、timeout 等 transient 失败 | 不进训练集 |

Ranker 模式下还会把 y 映射成 **0~4 的 relevance**（按 reward 分位数），并按 `batch_id` 分组做 lambdarank。

---

## 3. 输出是什么？

对 **候选 plan**（尚未实现）调用 `predict_ensemble()`：

| 输出字段 | 含义 |
|----------|------|
| `reward_pred_mu` | ensemble 各成员预测值的 **均值** → 主排序分 |
| `reward_pred_sigma` | 各成员预测的 **标准差** → 不确定性 |
| `reward_pred_members` | 每个子模型的原始预测（调试用） |

Bandit 再转成 `bandit_score`（`selector/policies.py`）：

| policy | 公式 |
|--------|------|
| `mean`（常用） | `score = μ` |
| `thompson` | `score = μ + N(0,1) × σ × scale` |
| `ucb` | `score = μ + β × σ` |

**注意**：LGBM 输出的是 **reward 预测值**，不是最终因子 signal，也不是 IC。

---

## 4. 具体模型参数

### 4.1 两种目标（config 里 `selector.model_objective`）

| 模式 | LightGBM 类 | objective | 树数量 | 训练方式 |
|------|-------------|-----------|--------|----------|
| **`ranker`**（默认） | `LGBMRanker` | `lambdarank` | **360** | 按 `batch_id` 分组，label 为 relevance 0~4 |
| **`regressor`**（当前多数 config） | `LGBMRegressor` | `regression` | **450** | 直接回归 reward 数值 |

Ranker 在 relevance 全相同或只有 1 个 batch 时会 **fallback 到 regressor**。

### 4.2 固定 / 共享超参

| 参数 | 值 |
|------|-----|
| `subsample_freq` | 1 |
| `n_jobs` | 1 |
| `verbose` | -1 |

### 4.3 每个 ensemble 成员略有不同（`diversity_mode=mild`）

8 组预设网格轮换（`num_leaves`, `learning_rate`, `subsample`, `colsample_bytree`, `reg_lambda`），例如：

```text
num_leaves:     11 ~ 21
learning_rate:  0.032 ~ 0.038
subsample:      0.86 ~ 0.95
colsample_bytree: 0.84 ~ 0.94
reg_lambda:     0.9 ~ 2.2
min_child_samples: 约 max(3, min(30, n_rows//10 ± jitter))
```

### 4.4 由 config 控制的 ensemble 参数

路径：`configs/*.json` → `selector` 段

| 配置项 | 典型值 | 含义 |
|--------|--------|------|
| `ensemble_size` | 4~8 | 子模型个数 |
| `bootstrap_fraction` | 0.7~0.92 | 每个成员 bootstrap 采样比例 |
| `ensemble_diversity` | `mild` | 是否用多组超参（非 mild 则只用一组） |
| `model_objective` | `regressor` / `ranker` | 回归 vs 排序 |
| `policy` | `mean` | 如何用 μ、σ 选 plan |
| `seed` | 全局 seed | 第 r 轮训练 seed = `seed + round` |

标准 1d 配置示例（`bandit_evolve_1d_regressor_deepseek_sharpe_v1_40b.json`）：

```json
"selector": {
  "policy": "mean",
  "model_objective": "regressor",
  "ensemble_size": 8,
  "bootstrap_fraction": 0.7,
  "ensemble_diversity": "mild"
}
```

### 4.5 训练后保存

每轮写入：

```text
runs/<run_name>/models/ensemble_round_XXXX/
  ├── ensemble.joblib      # 模型 + preprocessor + MLB
  ├── ensemble_summary.json
  └── training_rows.csv
```

---

## 5. 每次从 0 训练，还是增量？

**每轮都是「从 0 重新训练」**，不是在线增量、也不是 load 上一轮权重 warm-start。

流程（`run_bandit_training.py`）：

```text
Round r 开始
  ↓
加载「至今所有 round」的 reward_buffer.jsonl（累积数据）
  ↓
若需要 scorer（exploit > 0 或 mutation > 0）
  → train_ensemble_reward_model(全部历史 rows)   # 全新 fit
  → 保存 ensemble_round_r
  ↓
用该模型给候选 pool 打分 → 选 batch
  ↓
跑 LLM + 回测 → 新 reward_buffer 追加到列表
  ↓
Round r+1 再对「更长的历史」完整重训
```

要点：

| 问题 | 答案 |
|------|------|
| 是否 incremental / warm-start？ | **否**，每轮全新 `fit()` |
| 训练数据范围？ | **当前 run 内累积的全部 reward_buffer**（`--resume` 会恢复历史 buffer 路径） |
| 是否跨 run 继承？ | **默认不继承**；除非手动 `--seed-reward-buffer` 注入外部 buffer |
| 上一轮 `ensemble.joblib` 是否加载？ | **不加载**，只作存档；下一轮用新数据重训新模型 |

**Cold start（前几轮可能没有 LGBM）：**

- `coverage_schedule` 里早期 `reward_top=0` → `exploit_count=0` → **`reward_model_required=False`**
- 此时 **跳过训练**，纯按 coverage novelty 随机探索
- 例如 valid < 150 时 often 100% coverage 探索

---

## 6. 一轮里的位置（串起来）

```text
                    ┌─────────────────────────┐
  累积 reward_buffer │  LGBM Ensemble (重训)    │
  (plan 特征 → y)    │  输入: schema 特征       │
                    │  输出: μ, σ              │
                    └───────────┬─────────────┘
                                │
                    候选 pool ~10000 plans
                                │
                                ▼
                    exploit: top μ  (如 14 个)
                    explore: coverage (如 6 个)
                    mutation: top plan 变异 (如 0~6 个)
                                │
                                ▼
                    LLM 实现 → 回测 → 新 reward
                                │
                                └──► 写入 buffer，下轮再重训 LGBM
```

---

## 7. 和「因子模型」的对比（避免混淆）

| | LGBM Scorer | 最终挖出的因子 |
|--|-------------|----------------|
| 预测对象 | plan 的 **预期 reward** | 未来收益 / label |
| 输入 | schema id 组合 | OHLCV、OI 等 |
| 输出 | μ, σ（选 plan 用） | 每日/每截面 **signal** |
| 谁用 | Bandit Selector | 回测引擎、组合 |

---

如果你需要，我可以把这一节写进 `SchemaEvolve_算法逻辑整理.md`，作为独立的「LGBM Reward Model」章节。
