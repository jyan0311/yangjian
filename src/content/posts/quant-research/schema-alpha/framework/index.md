---
title: "SchemaEvolve｜框架算法逻辑整理"
description: "从 LLM agent、Bandit Selector、Leak Checker、Backtest Engine 与 reward buffer 的协作关系出发，整理 SchemaEvolve 的完整算法框架与数据流。"
date: "2026-06-16"
category: "量化研究"
series: "Schema Alpha"
status: "polished"
tags: ["SchemaEvolve","LLM","Alpha","Bandit","Backtest"]
source: "Obsidian/【科研】量化交易/THU量化交易实习/3_完整的算法框架搭建.md"
featured: false
draft: false
---
# SchemaEvolve 框架算法逻辑整理

> 文档来源：`SchemaEvolve_framework_snapshot_20260616` 快照  
> 整理日期：2026-06-16  
> 用途：快速理解框架核心算法、数据流与关键公式

---

## 0. High Level 理解

我们可以从LLM角色的角度出发理解这个完整的项目，这个项目一共有4个agent，然后其中的两个是可选的 `agent`

| # | 名称 | 是否 LLM | 干什么 |
|---|------|----------|--------|
| 1 | **Factor Implementation Agent**（因子实现） | ✅ | 把 schema plan 写成 Python 因子代码 |
| 2 | **Factor Repair Agent**（因子修复） | ✅ | 静态检查 / 泄露 / 物化 / 回测失败时改代码 |
| 3 | **Manifold Opt Agent**（流形优化） | ✅ 可选 | 从稳定 schema 流形的正负样本里总结 extra prompt |
| 4 | **Manifold Aggregate Agent**（流形合并） | ✅ 可选 | 合并 positive/negative opt 输出（文档里有，在线 hook 目前偏 negative-only） |

然后从整体模块的角度，可以报考三个模块，**预测**、**检查** 和**回测** ：

| 模块 | 类型 | 作用 |
|------|------|------|
| **Bandit Selector** | LGBM Ensemble | 预测哪个 schema plan 更可能有高 reward，选下一批任务 |
| **Leak Checker** | 数值因果测试 | 合成数据上做 prefix replay / future mutation |
| **Backtest Engine** | 确定性计算 | IC、Sharpe、ERS20 等指标 |


### 0.1 他们之间的协作关系

```text
┌─────────────────────────────────────────────────────────────┐
│  run_bandit_training.py  （主控，普通 Python 循环，非 LLM）   │
│  读 config JSON + .env                                       │
└─────────────────────────────────────────────────────────────┘
         │
         │ 每轮 round：
         ▼
  ① LGBM Bandit Selector 选 batch（20 个 schema plan）
         │  输出 selections/round_XXXX_tasks.jsonl
         ▼
  ② run_batch.py  并行跑 Implementation Pipeline
         │
         ├─ LLM #1 Implementation Agent  → 生成代码
         ├─ 静态检查 + 数值 Leak Check（非 LLM）
         ├─ LLM #2 Repair Agent（失败时，最多 max_repairs 次）
         ├─ 物化 / Health Check / Backtest（非 LLM）
         └─ 写 reward_buffer.jsonl
         │
         ▼
  ③ 累积 reward_buffer → 训练 LGBM Reward Model
         │
         ▼
  ④ 下一轮选择（exploit / explore / mutation）
         │
         └─（可选）⑤ Manifold Opt Agent shadow repair
              不污染主 reward_buffer，单独 shadow rerun
```


### 0.2 关键的配置文件


| 文件 | 内容 |
|------|------|
| `.env.example` → `.env` | `FACTOR_IMPL_BASE_URL`、`FACTOR_IMPL_API_KEY`、`FACTOR_IMPL_MODEL`、`FACTOR_REPAIR_MODEL` |
| `SchemaEvolve/env_config.py` | 加载 `.env`，提供 `impl_base_url()` / `impl_api_key()` |
| Opt Agent 额外可选 | `FACTOR_OPT_BASE_URL`、`FACTOR_OPT_API_KEY`、`FACTOR_OPT_MODEL` |



### 0.3 

## 1. 框架定位

SchemaEvolve 是一个 **面向 Alpha 因子自动挖掘的语义进化框架**。其核心思路是：

1. 不在低层算子空间里盲目遗传/随机搜索；
2. 也不让 LLM 从空白 prompt 自由生成因子；
3. 而是先构造 **可解释、可组合、可搜索的交易语义空间（Schema）**；
4. 再用 **真实回测 reward** 训练 **LGBM Scorer**，在巨大组合空间中引导下一轮采样；
5. 通过 **Implementation Agent** 将语义 plan 落地为可执行代码，并经过静态检查、数值泄露检查、物化、回测后写入 reward buffer。

与 GP/RL 公式搜索相比，每个候选都有明确交易含义；与纯 LLM agent 相比，搜索方向由可训练的 scorer 持续修正，而非完全依赖 prompt 反思。

---

## 2. 总体 Pipeline

```text
Schema 库
  ↓ 随机采样 + LGBM 打分
Bandit Selector（exploit / explore / mutation）
  ↓ plan → task JSON
Implementation Agent（LLM 生成代码）
  ↓
静态检查（AST / 禁 future 模式 / 契约校验）
  ↓
数值 Leak Checker（合成数据因果检验）
  ↓
物化（多 period 因子值 parquet）
  ↓
Health Check（常数 / 高 NaN / 零覆盖）
  ↓
Backtest Engine（IC / PnL / ERS20 / Sharpe 等）
  ↓
Reward 计算 → 写入 reward_buffer
  ↓
训练 LGBM Ensemble Scorer
  ↓
下一轮选择（可选：Shadow Manifold Repair）
```
**主入口**：`SchemaEvolve/experiments/bandit_evolve_v1/run_bandit_training.py`

**每轮产物目录**（`runs/<run_name>/`）：

| 路径 | 内容 |
|------|------|
| `selections/round_XXXX_tasks.jsonl` | 本轮选中的 schema plan 任务 |
| `models/ensemble_round_XXXX/` | 本轮训练的 LGBM ensemble |
| `rounds/round_XXXX/reward_buffer.jsonl` | 本轮有效 reward 样本 |
| `progress.json` + `dashboard.html` | 训练进度与可视化 |

---
