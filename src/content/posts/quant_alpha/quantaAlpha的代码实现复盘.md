---
title: "QuantaAlpha｜Qlib 在 LLM 因子挖掘框架中的定位与调用全景"
description: "从「三层数据、三层消费、Merit–Test 双层评估」框架出发，系统梳理 QuantaAlpha 代码中 Qlib 的使用环节、主实验设计、双通路调用链路与工程口径。"
date: "2026-06-24"
tags: ["QuantaAlpha", "Qlib", "Alpha", "Backtest", "Literature Review", "Experiment Design"]
featured: false
draft: false
---

# QuantaAlpha｜Qlib 在 LLM 因子挖掘框架中的定位与调用全景

> **整理日期**：2026-06-24  
> **代码参照**：[QuantaAlpha/QuantaAlpha](https://github.com/QuantaAlpha/QuantaAlpha)（本地：`QuantaAlpha_repo/`）  
> **文档性质**：将 QuantaAlpha 的 Qlib 用法嵌入「D1–L3 消费层 + Merit–Test 分野 + 双层优化」统一坐标系，并说明 **主实验 Stage A/B 中 Qlib 各自承担什么**

---

## 〇、在整体框架中的坐标（先读本节）

### 0.1 QuantaAlpha 的研究问题（与 Qlib 的分工）

QuantaAlpha 属于 **流派 A（依靠 LLM 进化）**，并带有 **流派 B 式 Merit**（轨迹 Reward $R(\tau)$）：

$$
f^* = \arg\max_{f \in \mathcal{F}} \underbrace{L(f(\mathbf{X}), y)}_{\text{预测力}} - \lambda \underbrace{R(f)}_{\text{正则/门控}}
$$

轨迹级目标：

$$
R(\tau) = L(f_\tau(\mathbf{X}), y) - \lambda R(f_\tau)
$$

| 子问题 | QuantaAlpha 由谁做 | Qlib 是否参与 |
| :--- | :--- | :--- |
| **Q1：Merit**（什么是好因子/好轨迹） | 进化控制器 + 一致性/复杂度/冗余 gate；**主排序指标 RankIC** | **参与**：挖掘内回测产出 IC/RankIC 等 |
| **Q2：Search**（如何找到好因子） | Planning → Mutation → Crossover；LLM 不微调 | **不参与** |
| **Q3：组合验收**（能否赚钱） | ~150 因子 + 统一 LightGBM + Top50/Drop5 | **参与**：主表 L2.5 全链路 |

### 0.2 双层优化：理解 Qlib 为何出现两次

$$
\mathcal{F}^* = \arg\max_{\mathcal{F}} \mathcal{L}\bigl(g^*(\mathcal{F}), \mathbf{Y}\bigr), \quad \theta_g^* = \arg\max_{\theta_g} \mathcal{L}\bigl(g(\mathcal{F}; \theta_g), \mathbf{Y}\bigr)
$$

- **外层**：Agent 搜索因子集 $\mathcal{F}$（进化、门控、因子池 ~150）
- **内层**：Qlib `LGBModel` 学非线性组合 $g$

因此 Qlib 在 QuantaAlpha 里承担的是 **内层 $g$ 的训练 + L2/L2.5 的标准化评估**，而不是外层搜索本身。

### 0.3 一句话定位

> **Agent 负责发现因子，Qlib 负责在统一协议下「证明」这些因子是否有预测力、能否组成可交易策略。**

### 0.4 主实验在 Qlib 视角下回答什么

论文 §5.1–5.2（Table 1, CSI300）的核心对比问题是：

> 在 **相同数据划分、相同因子池规模（约 150）、相同下游 LightGBM、相同 Top50/Drop5 组合规则** 下，QuantaAlpha 挖出的因子库，是否在 **因子预测力（IC 系）** 与 **可交易策略表现（IR/ARR/MDD）** 上优于 ML/DL/静态因子库/RD-Agent/AlphaAgent？

因此 Qlib 在主实验里 **不是** 搜索工具，而是 **锁定评估壳**：所有 Table 1 行共享同一套 split、label、预处理、组合与成本，只替换 **输入特征 $\mathbf{X}$** 或 **下游模型 $\mathcal{M}$**。

| 实验阶段 | Agent 做什么 | Qlib 做什么 |
| :--- | :--- | :--- |
| **Stage A 挖矿** | Planning → Mutation → Crossover；门控；因子池 ~150 | **通路 A**：每轮 `qrun` → RankIC 等 Merit |
| **Stage B 主表** | 导出 `all_factors_library.json` | **通路 B**：`BacktestRunner` → Table 1 全部数字 |

**关键结论**：主表 **不是**「每个因子各建一棵树」，而是 **~150 因子 → 一次 `LGBModel.fit` → 组合预测 $\hat{y}$ → IC + TopkDropout**。

---

## 一、全景概览（一句话总结）

| 维度 | QuantaAlpha | Qlib 在本项目中的角色 |
| :--- | :--- | :--- |
| **论文定位** | 轨迹级 mutation/crossover；~150 因子公平 LGBM 对比 | **L2 + L2.5 实证引擎** |
| **数据层** | 从 OHLCV 现场挖因子（非 Alpha158 宽表依赖） | **D1 价量数据提供者**（`cn_data`） |
| **消费层** | L1 自研 DSL → L2 挖掘反馈 → L2.5 主表 | **L2/L2.5 训练、IC、组合回测** |
| **Merit** | $R(\tau)$；进化主指标 **RankIC** | 挖掘通路 A 产出 Merit 分量 |
| **Test 主表** | IC 0.0472；ARR 4.68%；MDD 11.8%（GPT-5.2） | 独立通路 B 产出 P1–P4 + T3/T4/T7 |
| **主实验市场** | CSI300（Table 1）；CSI500/SP500 用于跨市场 §5.4 | `market: csi300` in `backtest.yaml` |
| **Baseline 四类** | ML / DL / Factor Libraries / LLM Agent | 仓库 **完整实现** Factor Lib + LLM；ML/DL 需 Qlib benchmark |

---

## 二、三层数据 × 三层消费：Qlib 落在哪一层

### 2.1 三层数据（存储职能）

| 层 | 平台/文献概念 | QuantaAlpha 实现 | Qlib 关系 |
| :--- | :--- | :--- | :--- |
| **D1** | 价量、label、mask、基准 | `~/.qlib/qlib_data/cn_data`；`QLIB_DATA_DIR` | **核心依赖**：`qlib.init` + `D.features` |
| **D2** | 预计算宽表、Alpha158/360 | 仅作 **种子/基线**（`alpha158_20`），非挖掘输入 | 基线回测时 `QlibDataLoader` 读表达式 |
| **D3** | Barra、风险模型 Optimizer | **未使用** | 无 |

学术与工程含义：挖掘仍从 **最小原始字段**（OHLCV + 算子）出发；Qlib 提供 D1，不替代 Agent 的搜索。

### 2.2 三层消费（流水线职能）

| 层 | 职能 | QuantaAlpha + Qlib | 典型指标 | 对应论文表 |
| :--- | :--- | :--- | :--- | :--- |
| **L1 物化** | 公式/code → $f_{i,t}$ | `expr_parser` + `function_lib` 读 `daily_pv.h5`；**多数不经 Qlib 表达式引擎** | 可执行率 | — |
| **L2 回测验收** | 因子 + label → fitness | **通路 A**：`qrun` + `SigAnaRecord`；进化用 **RankIC** | P1–P4 | 进化反馈、案例附录 |
| **L2.5 轻组合** | LGBM + Top-$k$ + 成本 | **通路 B**：`BacktestRunner`；~150 因子统一 LGBM | T3 AER, T4 IR, T7 MDD | **Table 1 主表** |
| **L3 组合优化** | Barra + Optimizer | **无** | — | — |

**读表规则**：

1. 论文 Table 1 的 **IC/RankIC** = L2.5 上 **LGBM 组合预测 $\hat{y}$** 的因子层指标，不是单因子 IC 平均。  
2. Table 1 的 **ARR/IR/MDD** = L2.5 组合层，Top50/Drop5（**C1** 范式）。  
3. 进化中的 RankIC ≈ 0.02 属于 **通路 A / 不同 Test 段**，不可与主表 0.047 直接比。

### 2.4 主实验数据与预处理（Qlib 侧）

| 项目 | 论文 / 代码设定 | Qlib 组件 |
| :--- | :--- | :--- |
| **标的池** | CSI300（~300 只大盘 A 股） | `D.instruments(market='csi300')` |
| **原始字段** | `open, high, low, close, volume, vwap`（6 列） | `D.features` / `QlibDataLoader` |
| **Label** | $y_t = P_{t+2}^c / P_{t+1}^c - 1$（次日 close-to-close） | `Ref($close,-2)/Ref($close,-1)-1` |
| **预处理链** | Fillna → ProcessInf → DropnaLabel → **CSRankNorm**（特征 + label） | `learn_processors` / `runner` 手动 rank |
| **Test 长度** | 2022-01-01 ~ 2025-12-26（**966 交易日**） | `dataset.segments.test` |
| **数据获取** | 官方 `get_data cn_data` 或 HF `QuantaAlpha/qlib_csi300` | `QLIB_DATA_DIR` → `qlib.init` |

**与 CogAlpha 不可混表的关键差异**：

| 维度 | QuantaAlpha（本文） | CogAlpha |
| :--- | :--- | :--- |
| Label | **次日** $P_{t+2}/P_{t+1}-1$ | **10 日**持有期收益 |
| Train 起点 | 2016-01-01 | 2011-01-01 |
| 因子池规模 | **~150** validated | **~20** top factors |
| 主表组合 | Top50/Drop5 + LightGBM | 同族 C1，但 split/label 不同 |

### 2.5 论文其他实验与 Qlib 关系（非 Table 1 主表）

| 实验 | 论文位置 | Qlib 角色 |
| :--- | :--- | :--- |
| **Table 1 主表** | §5.2 | 通路 B 全链路（IC + TopkDropout） |
| **Fig.4 年度 IC** | §5.3 | 通路 B Test 段按年切分 IC 序列 |
| **Fig.5 迭代 IC 曲线** | §5.3 | 通路 A Merit 随进化轮次变化（非主表 Test） |
| **跨市场 zero-shot** | §5.4 | 通路 B 换 `market` + 因子库迁移 |
| **消融** | §5.5 | 关 Planning/Messages Mutation / Crossover 等；Merit 仍走通路 A |
| **成本敏感性** | Appendix A.6 | 通路 B 改 `open_cost` / `close_cost` 倍数 |
| **多 seed / t-stat** | Table 4–5, A.5 | 通路 B 多次 `BacktestRunner` + `ic.pkl` 统计 |

### 2.3 双层评估在 QuantaAlpha 中的具体形态

| 评估层 | 经济问题 | Qlib 如何算 | 输入信号 |
| :--- | :--- | :--- | :--- |
| **因子层 L2** | 截面排序能否预测收益？ | `SigAnaRecord` → `calc_ic(pred, label)` | **$\hat{y}$**（LGBM 预测）或单轨迹回测时的组合输出 |
| **组合层 L2.5** | 按信号建仓能否跑赢基准？ | `qlib.backtest` + `risk_analysis` | 同上 $\hat{y}$ → Top50 持仓 |

**IC 标准定义（P1）**：

$$
\text{IC}_t = \mathrm{Corr}_{\text{cross}}\bigl(\hat{y}_t,\, y_{t+1}\bigr), \quad \text{IC} = \frac{1}{T}\sum_t \text{IC}_t
$$

**IR 标准定义（T4）**：

$$
r_t = r_t^{\text{port}} - r_t^{\text{bench}} - \text{cost}_t, \quad \text{IR} = \frac{\mu}{\sigma}\sqrt{252}
$$

---

## 三、统一符号与 QuantaAlpha 实证设定

| 符号 | QuantaAlpha 含义 | 代码/配置 |
| :--- | :--- | :--- |
| $\mathbf{X}$ | 日频面板 $T \times N \times M$ | `daily_pv.h5` 或 `D.features` |
| $y_{i,t}$ | 标签：次日收益 | `Ref($close,-2)/Ref($close,-1)-1` |
| $f_{i,t}$ | 单因子截面值 | L1 物化输出 |
| $\hat{y}_{i,t}$ | LGBM 组合预测 | `model.predict(dataset)` |
| $\tau$ / 轨迹 | 一次完整挖掘 run | `StrategyTrajectory` |
| $\mathcal{F}_{pool}$ | 全局高质量因子池 | ~150，Valid 2021 RankIC 贪心准入 |

### 3.1 时序划分（两套通路对照）

| 阶段 | 通路 A（挖掘内 / Merit） | 通路 B（主表 / Test） | 论文 §5.1 |
| :--- | :--- | :--- | :--- |
| **Train** | 2016-01-01 ~ 2019-12-31 | 2016-01-01 ~ 2020-12-31 | 2016–2020 |
| **Valid** | 2020-01-01 ~ 2020-12-31 | 2021-01-01 ~ 2021-12-31 | 2021 |
| **Test** | **2021 全年** | **2022-01-01 ~ 2025-12-26** | 2022–2025 |
| **配置文件** | `conf_combined_factors.yaml` | `configs/backtest.yaml` | Appendix A.2 |

### 3.2 组合范式

QuantaAlpha 主实验采用 **C1：Top-$k$ Dropout**（与 CogAlpha、AlphaAgent 同族）：

| 参数 | 值 | 代码 |
| :--- | :--- | :--- |
| topk | 50 | `TopkDropoutStrategy` |
| n_drop | 5 | 每日最多换 5 只 |
| deal_price | open | `exchange_kwargs.deal_price` |
| 成本 | 买 0.05% / 卖 0.15% | `open_cost` / `close_cost` |
| 基准 | SH000300 | `benchmark: SH000300` |
| 涨跌停 | limit_threshold = 9.5% | `exchange_kwargs.limit_threshold` |

### 3.3 主实验两阶段：Stage A → Stage B

| 阶段 | 目的 | Qlib 通路 | 主要输出 |
| :--- | :--- | :--- | :--- |
| **Stage A** | 进化挖矿（Train + Valid 反馈） | 通路 A | ~150 validated factors → `all_factors_library.json` |
| **Stage B** | 统一下游评估（Test 2022–2025） | 通路 B | Table 1：IC 系 + IR / ARR / MDD |

| Stage A 参数 | 值 | 代码/论文 |
| :--- | :--- | :--- |
| Planning 并行方向 | **10** | `configs/experiment.yaml` |
| 主进化迭代 | **5** | 1 初始 + Mutation/Crossover |
| 每 hypothesis 因子数 | **3** | 论文 §4.1 |
| 初始种子 | **Alpha158(20)** 低相关子集 | 挖矿种子；Table 1 基线另跑 |
| 符号长度 | ≤ **250** 字符 | 复杂度 gate |
| 基础特征数 | ≤ **6** | OHLCV + vwap |
| free arguments ratio | **< 50%** | 参数化约束 |
| 典型算力 | ~**20 h**/次，~**1.8M tokens** | API + CPU 回测 |

**轨迹奖励**（搜索优化，非主表报告）：

$$
R(\tau) = L\bigl(f_\tau(\mathbf{X}), \mathbf{y}\bigr) - \lambda R(f_\tau)
$$

主表数字 **只来自 Stage B 的 Test 段**，避免直接优化 Test。

### 3.4 Table 1 公平对比协议（Stage B 不变量）

论文 §5.1 强调：所有 **LLM 类方法** 各提交约 **150** 个 validated factors 到 **同一 downstream LightGBM**，确保 **因子池级** 公平对比。

| 协议项 | 设置 | Qlib 配置锚点 |
| :--- | :--- | :--- |
| 因子池规模 | LLM 三方法各 **~150** | `all_factors_library.json` |
| 下游模型 | **同一 LightGBM 超参** | `configs/backtest.yaml` §model |
| 评估对象 | **组合预测 $\hat{y}$**，非单因子 | `SigAnaRecord` on `pred.pkl` |
| LLM backbone | RD/AlphaAgent/QA 各测 **5 个模型** | 挖矿换 API；评估协议不变 |
| ML/DL 行 | 各自模型结构，**非** 150 因子池 | Qlib `examples/benchmarks/*` |
| Factor Libraries | Alpha158(20) / Alpha158 / Alpha360 | `--factor-source alpha158_*` |

**LLM 三方法对比流程（代码意图）**：

1. 各自 Agent **独立挖矿** → 各自因子 JSON；  
2. **分别**调用同一 `configs/backtest.yaml` 跑通路 B；  
3. **不是** 三方法共用一个因子池，也 **不是** 每因子一个 LGBM。

### 3.5 LightGBM 超参：通路 A vs 通路 B

主表数字以 **通路 B** 为准；进化反馈用 **通路 A**，二者 **learning_rate 等不一致**：

| 参数 | 通路 A（`conf_combined_factors.yaml`） | 通路 B（`configs/backtest.yaml`） |
| :--- | :--- | :--- |
| `learning_rate` | **0.05** | **0.1** |
| `max_depth` | 8 | 8 |
| `num_leaves` | 210 | 210 |
| `num_boost_round` | 500 | 500 |
| `early_stopping_round` | 50 | 50 |
| `random_state` | 42 | 42 |
| Train / Valid / Test | 2016–2019 / 2020 / **2021** | 2016–2020 / 2021 / **2022–2025** |
| 输入特征 | 4 工程特征 + **当轮** parquet | **整库** ~150 因子（或 Alpha158/360） |

`BacktestRunner._train_and_backtest` 当前 **仅支持** `model.type: lgb`；ML/DL baseline 不在此 runner 内。

---

## 四、Merit 链路 vs Test 链路：Qlib 的两套用法

这是理解整个项目的**核心分野**（Merit 与 Test 的关系）。

### 4.1 关系矩阵

| 关系 | QuantaAlpha 中的体现 |
| :--- | :--- |
| **同构** | Merit 与主表均用 Qlib `SigAnaRecord` 算 IC/RankIC，但 **Test 时间段不同** |
| **引导** | 进化 RankIC ↑ → 因子池质量 ↑ → 主表 IC ↑（Fig.5 迭代曲线） |
| **脱钩** | 进化主指标 **RankIC**（通路 A）；因子池准入也用 Valid RankIC；主表报 **全 Test IC**（通路 B） |
| **门控** | 一致性 / 复杂度 / 冗余 **不经过 Qlib**，在 L1 之前过滤 |
| **正交** | 搜索 Merit 无 IR；**Test IR 仅在 L2.5 组合层** |

### 4.2 Merit 使用链路（QuantaAlpha 七步）

| 步骤 | 环节 | Qlib 是否参与 |
| :---: | :--- | :---: |
| 1 | Planning / Mutation / Crossover（LLM） | 否 |
| 2 | L1 物化：`factor.py` / `expr_parser` → $f_{i,t}$ | 否 |
| 3 | 通路 A：`qrun` + LGBM + SigAna → IC, RankIC, ICIR, ARR… | **是** |
| 4 | 合成轨迹 Reward $R(\tau)$；主排序 `get_primary_metric()` = RankIC | 否 |
| 5 | 更新搜索：选父代、交叉、变异下一轮 | 否 |
| 6 | 因子池准入（Valid 2021 RankIC 贪心 + \|corr\|<0.7） | 否 |
| 7 | 通路 B：~150 因子 + 统一 LGBM → Table 1（Test 2022–2025） | **是** |

### 4.3 进化阶段 Qlib 反馈什么

`EvolutionController._extract_metrics()` 从 `qrun` 结果 DataFrame 解析：

| 字段 | 用途 |
| :--- | :--- |
| `IC`, `ICIR` | 轨迹诊断、日志 |
| **`RankIC`, `RankICIR`** | **`get_primary_metric()` 主排序** |
| `annualized_return`, `information_ratio`, `max_drawdown` | 策略层辅助、案例附录 |

代码锚点：`quantaalpha/pipeline/evolution/trajectory.py` → `get_primary_metric()` 返回 `RankIC`。

### 4.4 Table 1 四类 Baseline 与 Qlib 入口

Table 1 所有行共享 **统一 Qlib 评估壳**（split、label、CSRankNorm、Top50/Drop5、成本）；各路线产出预测分 $\hat{y}$ 后，先算 IC / Rank IC，再经 TopkDropout 算 IR / ARR / MDD。

| Table 1 区块 | 代表方法 | 仓库内 Qlib 实现 | 复现入口 |
| :--- | :--- | :--- | :--- |
| **Machine Learning** | Linear, MLP, LGBM, XGBoost, CatBoost, DoubleEnsemble | **未实现** | Qlib `examples/benchmarks/*` |
| **Deep Learning** | GRU, LSTM, Transformer, TRA | **未实现** | 同上 |
| **Factor Libraries** | Alpha158(20), Alpha158, Alpha360 | **`BacktestRunner`** | `--factor-source alpha158_20/alpha158/alpha360` |
| **LLM Agent** | RD-Agent, AlphaAgent, QuantaAlpha | **`BacktestRunner`** | `--factor-source custom --factor-json ...` |

**Baseline 选择逻辑**：ML/DL/因子库建立 **非 Agent 下界**；RD-Agent / AlphaAgent 建立 **同赛道、同 ~150 因子、同 LGBM** 的核心对照，以 isolate「轨迹级进化」贡献。

### 4.5 两条 CLI 勿混淆（读 Table 1 最常见坑）

| 命令 | 代码路径 | Test 段 | 对应 Table 1？ |
| :--- | :--- | :--- | :---: |
| `quantaalpha mine` / `./run.sh` | `factors/runner.py` → `qrun` | **2021** | **否**（Merit 通路 A） |
| `quantaalpha backtest --factor_path ...` | `pipeline/factor_backtest.py` → `BacktestLoop` | **2021** | **否**（旧 RD-Agent loop） |
| **`python -m quantaalpha.backtest.run_backtest -c configs/backtest.yaml`** | **`backtest/runner.py` → `BacktestRunner`** | **2022–2025** | **是** |

**读 Table 1、跑 Factor Libraries / 自定义因子库 baseline，请只用第三条。**

---

## 五、系统架构：模块分层与 Qlib 边界

| 层级 | 模块路径 | 职责 | Qlib |
| :--- | :--- | :--- | :--- |
| 研究层 | `pipeline/`, `evolution/` | 假设、轨迹、进化 | 否 |
| 表达层 | `factors/coder/` | DSL、因子代码生成 | 否 |
| 门控层 | `factors/regulator/` | 一致性、复杂度、冗余 | 否 |
| **数据层** | `data_template/generate.py`, `qlib_utils.py` | D1 → `daily_pv.h5` | **是** |
| **Merit 评估** | `factors/runner.py` → `qrun` | 通路 A | **是** |
| **Test 评估** | `backtest/runner.py` | 通路 B | **是** |
| 环境层 | `utils/env.py`, `run.sh` | `QLIB_DATA_DIR` 校验 | **是** |

---

## 六、两条 Qlib 回测通路（代码级对照）

| 对比项 | **通路 A：挖掘内回测（Merit）** | **通路 B：独立回测（Test / 主表）** |
| :--- | :--- | :--- |
| **框架角色** | L2 搜索反馈 + 部分 L2.5 | **正式 L2.5 Test 验收** |
| **CLI** | `quantaalpha mine` / `./run.sh` | **`python -m quantaalpha.backtest.run_backtest`** |
| **代码入口** | `QlibFactorRunner.develop()` | `BacktestRunner.run()` |
| **执行方式** | `QlibFBWorkspace.execute()` → **`qrun conf.yaml`** | **Python 直接 import qlib** |
| **配置** | `conf_baseline.yaml` / `conf_combined_factors.yaml` | `configs/backtest.yaml` |
| **特征** | 4 工程特征 + 当轮 `combined_factors_df.parquet` | 全库 JSON（~150）或 Alpha158/360 |
| **`learning_rate`** | **0.05** | **0.1** |
| **Test 段** | **2021** | **2022–2025** |
| **输出消费方** | `EvolutionController`, 因子库 JSON | `backtest_v2_results/*.json`, 论文 Table 1 |

### 6.1 通路 A 数据加载（NestedDataLoader）

`conf_combined_factors.yaml` 结构：

```yaml
data_loader:
  class: NestedDataLoader
  dataloader_l:
    - class: qlib.contrib.data.loader.QlibDataLoader    # OPEN_RET, VOL_RATIO, RANGE_RET, CLOSE_RET
    - class: qlib.data.dataset.loader.StaticDataLoader  # combined_factors_df.parquet
```

四轮工程特征（仅挖掘通路 A，主表通路 B 默认**不含**此四列）：

| 名称 | 表达式 |
| :--- | :--- |
| OPEN_RET | `($close-$open)/$open` |
| VOL_RATIO | `$volume/Mean($volume, 20)` |
| RANGE_RET | `($high-$low)/Ref($close, 1)` |
| CLOSE_RET | `$close/Ref($close, 1)-1` |

### 6.2 通路 B 因子来源分支

| `factor_source` | 特征进入 Qlib 的方式 |
| :--- | :--- |
| `alpha158` / `alpha158_20` / `alpha360` | `QlibDataLoader` 直接算表达式 |
| `custom` | `CustomFactorCalculator` → `PrecomputedDataHandler` |
| `combined` | 官方因子 + 自定义因子合并 |

### 6.3 Factor Libraries 代码链路（Table 1 第三子块）

| 顺序 | 模块 | 作用 |
| :---: | :--- | :--- |
| 1 | `configs/backtest.yaml` | 主表协议（split / label / LGBM / TopkDropout） |
| 2 | `backtest/run_backtest.py` | CLI 入口 |
| 3 | `backtest/runner.py` | `BacktestRunner`：fit LGBM → IC → `qlib_backtest` |
| 4 | `backtest/factor_loader.py` | `ALPHA158_20_FACTORS` / `ALPHA158_FACTORS` / `_load_alpha360()` |
| 5 | `_create_dataset()` | `QlibDataLoader` 物化因子值 |

| Table 1 行 | `--factor-source` | 因子定义 | 下游 |
| :--- | :--- | :--- | :--- |
| Alpha158(20) | `alpha158_20` | `factor_loader.py` 内嵌 20 条表达式 | 同 `backtest.yaml` LGBM |
| Alpha158 | `alpha158` | 项目内嵌子集（非官方 handler 全集） | 同上 |
| Alpha360 | `alpha360` | 动态多窗口表达式 | 同上 |

**注意**：Alpha158(20) 在 **挖矿** 里还作 Planning **种子**（Appendix A.5），与 Table 1 Factor Libraries 行是 **不同代码路径**。

### 6.4 自定义因子 JSON 格式（LLM 行复现）

通路 B 读 `all_factors_library.json`，结构示意：

```json
{
  "metadata": { "total_factors": 150 },
  "factors": [
    {
      "name": "factor_xxx",
      "expression": "RANK(TS_MEAN($return, 20), ...)",
      "valid_rank_ic": 0.03
    }
  ]
}
```

非 Qlib 原生语法的表达式由 `CustomFactorCalculator` + `function_lib` 预计算，再经 `PrecomputedDataHandler` 接入 `DatasetH`。

---

## 七、分环节详解：Qlib 如何被调用

### 7.1 环节 ① D1 数据准备 → `daily_pv.h5`

| 项目 | 内容 |
| :--- | :--- |
| **文件** | `quantaalpha/factors/data_template/generate.py` |
| **调用** | `qlib.init` → `D.instruments()` → `D.features(..., freq="day")` |
| **字段** | `$open,$high,$low,$close,$volume` + 派生 `$return` |
| **输出** | `daily_pv_all.h5` → 拷贝为各 workspace 的 `daily_pv.h5` |
| **触发** | `qlib_utils.generate_data_folder_from_qlib()` 在数据目录缺失时自动跑 |

**定位**：对齐 D1 口径，供 L1 **非 Qlib** 表达式执行；与论文「从 OHLCV 现场挖因子」一致。

### 7.2 环节 ② L1 物化（Qlib 不执行表达式）

| 项目 | 内容 |
| :--- | :--- |
| **文件** | `factors/coder/`, `template.jinja2` |
| **输入** | `daily_pv.h5`（来自 Qlib D1） |
| **执行** | `eval(expr_parser(...))` + `function_lib` |
| **输出** | `result.h5` / 合并为 `combined_factors_df.parquet` |

大量 LLM 因子使用 `RANK(TS_MEAN($return,20),...)` 等 **QuantaAlpha 自有算子**，不走 Qlib 表达式引擎。

### 7.3 环节 ③ 通路 A — `qrun` 工作流

| 步骤 | Qlib 组件 |
| :--- | :--- |
| 1 | `DataHandlerLP` + `learn_processors`（Fillna, DropnaLabel, CSRankNorm） |
| 2 | `LGBModel.fit` / `predict` |
| 3 | `SignalRecord` → `pred.pkl`, `label.pkl` |
| 4 | `SigAnaRecord` → `ic.pkl`, `ric.pkl` |
| 5 | `PortAnaRecord` → 组合超额（挖掘内 Port 回测段多为 2021） |

编排代码：`quantaalpha/factors/runner.py` 第 164–175 行选择 `conf_baseline` vs `conf_combined_factors`。

### 7.4 环节 ④ 通路 B — `BacktestRunner` 程序化 API

核心流程（`quantaalpha/backtest/runner.py`）：

```python
qlib.init(provider_uri=..., region=...)
dataset = _create_dataset(...)          # QlibDataLoader 或 PrecomputedDataHandler
model = LGBModel(**params)
model.fit(dataset)
pred = model.predict(dataset)           # 默认 segment=test

SignalRecord(...).generate()
SigAnaRecord(...).generate()
# metrics['IC'] = ic_series.mean()
# metrics['ICIR'] = ic_series.mean() / ic_series.std()

qlib_backtest(strategy=TopkDropoutStrategy(signal=pred, topk=50, n_drop=5), ...)
risk_analysis(excess_return_with_cost)  # ARR, IR, MDD
```

### 7.5 环节 ⑤ 自定义因子桥接

| 步骤 | 模块 | 说明 |
| :--- | :--- | :--- |
| 判定兼容性 | `FactorLoader._is_qlib_compatible()` | 能转 Qlib 语法则走 `D.features` |
| 非兼容计算 | `CustomFactorCalculator` | `get_qlib_stock_data()` 拉 D1 → `function_lib` 算因子 |
| 格式对齐 | `to_qlib_format()` / `PrecomputedDataHandler` | MultiIndex `(datetime, instrument)` |
| 预处理 | 手动 rank 或 `CSRankNorm` | 与论文 Appendix A.2 一致 |

### 7.6 环节 ⑥ 环境与部署

| 组件 | 文件 | 说明 |
| :--- | :--- | :--- |
| 数据路径 | `.env` → `QLIB_DATA_DIR` | `run.sh` 校验 `calendars/features/instruments` |
| 本地 Qlib | `QlibLocalEnv` | 默认 `qrun conf.yaml` |
| Docker（可选） | `QlibDockerConf` | 挂载 `~/.qlib/` |
| 自动下载 | `python -m qlib.run.get_data` | 数据缺失时 `LocalEnv.prepare()` |

---

## 八、Qlib 模块清单与指标产出映射

| Qlib 模块 | 在 QuantaAlpha 中的用途 | 产出指标 |
| :--- | :--- | :--- |
| `qlib.init` | 初始化 cn/us 数据 | — |
| `qlib.data.D` | 行情、标的列表、标签 | D1 |
| `QlibDataLoader` | Alpha158 基线、4 工程特征 | L2 特征 |
| `DatasetH` + `DataHandlerLP` | Train/Valid/Test 切分 | — |
| `Fillna` / `ProcessInf` / `DropnaLabel` / `CSRankNorm` | 预处理 | — |
| `LGBModel` | 内层组合器 $g$ | $\hat{y}$ |
| `SignalRecord` | 保存预测与标签 | `pred.pkl` |
| `SigAnaRecord` | `calc_ic` | **P1–P4** |
| `qlib.backtest` + `TopkDropoutStrategy` | C1 组合仿真 | **T3, T4, T7** |
| `risk_analysis` | 超额收益统计 | ARR, IR, MDD |

**未使用**：Qlib RL、MetaModel、高频、在线服务、L3 Optimizer。

---

## 九、Qlib 与 RD-Agent 的关系

QuantaAlpha 继承 RD-Agent 的 Qlib 场景脚手架，并做项目级覆盖：

| 组件 | 来源 | QuantaAlpha 定制 |
| :--- | :--- | :--- |
| `QlibFactorExperiment` | `rdagent.scenarios.qlib` | 换 `QlibFBWorkspace` 模板目录 |
| `QlibFBWorkspace` | rdagent | 注入 `factor_template/`；空 git 抑制 recorder 警告 |
| `qrun` 工作流 | rdagent | conf 覆盖（去 ProcessInf 等） |
| **独立 backtest_v2** | **自研** | **主表可脱离 workspace 复现** |

三者分工：

| 层 | 作用 |
| :--- | :--- |
| **RD-Agent** | 场景编排、`qrun` 模板、`read_exp_res` |
| **Qlib** | D1 数据、LGBM、IC、组合回测 |
| **QuantaAlpha** | 轨迹进化、门控、因子 DSL、主表批量回测 |

---

## 十、与相关方法的横向对照

| 论文 | 平台 | Universe | 标签 $H$ | 组合 | Test 因子层 | Test 组合层 | Merit | Qlib 通路 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| QuantaAlpha | Qlib | CSI300/500/SP500 | $P_{t+2}^c/P_{t+1}^c-1$ | C1 | P1–P4（**$\hat{y}$**） | T3,T4,T7 | $R(\tau)$, RankIC | A→Merit, B→Test |
| CogAlpha | Qlib | CSI300 | **10-day** 持有期 | C1 | P1–P4 | T3,T4,T7 | 多层 Agent + 进化 | 单通路 locked eval |
| AlphaAgent | Qlib | CSI300 | next-day 同族 | C1 | P1–P4 | T3,T4,T7 | anti-decay 正则 | 单通路 |

| 消费层 | QuantaAlpha | Qlib 参与 |
| :---: | :--- | :---: |
| L1 | ✓ | △（仅 D1 来源） |
| L2 | ✓** | ✓ |
| L2.5 | ✓** | ✓ |
| L3 | ✗ | ✗ |

**写论文实验节时的定位建议**：

- **主战场对齐 QuantaAlpha**：CSI300、~150 因子、vs AlphaAgent/RD-Agent、多 backbone、通路 B 评估壳；  
- **广谱 baseline**：至少 ML（LightGBM）、因子库（Alpha158）、Agent 竞品各一行；  
- **标签与 split 全文统一**：不可与 CogAlpha 的 10-day / 2011 起点混在同一主表。

---

## 十一、常见误区（框架视角）

| # | 误区 | 正确理解 |
| :---: | :--- | :--- |
| 1 | 项目只有一套 Qlib 回测 | **通路 A（Merit）** 与 **通路 B（Test）** 时间段、特征集均不同 |
| 2 | Table 1 的 IC 是单因子平均 | **LGBM $\hat{y}$** 的截面 IC（双层优化内层） |
| 3 | Qlib 负责挖因子 | Qlib 是 **L2/L2.5 评估引擎**；搜索在 Agent |
| 4 | 进化 RankIC 0.02 ≈ 主表 IC 0.047 | **不同 Test 段、不同因子池规模** |
| 5 | 挖掘与主表特征完全一致 | 通路 A 多 **4 工程特征**；通路 B `custom` 通常仅因子库 |
| 6 | Merit = Test IR | 进化优化 **RankIC**；主表才报 **Test IR**（几乎全部 Qlib 系论文共性） |
| 7 | `quantaalpha backtest` = Table 1 | **否**；旧 loop，Test=2021；主表用 **`run_backtest`** |
| 8 | ML/DL 行可用 `BacktestRunner` 跑 | **否**；runner 仅 `model.type: lgb`；ML/DL 走 Qlib benchmark |
| 9 | 三 LLM 方法共用一个因子池 | **否**；各自挖矿、各自 JSON、**同一评估壳** |
| 10 | Alpha158(20) 种子 = Table 1 基线 | **否**；种子在 Stage A；基线在 Stage B `--factor-source alpha158_20` |

---

## 十二、防泄漏与口径对齐（QuantaAlpha + Qlib）

| 机制 | 实现 | Qlib 相关 |
| :--- | :--- | :--- |
| 严格时序切分 | Train/Valid/Test 不混用 | `dataset.segments` |
| 因子池门控仅用 Valid 2021 | Appendix E：RankIC 准入不看 Test | 进化逻辑，非 Qlib |
| 标签 CSRankNorm | 截面秩归一化 | `learn_processors` / `runner` 手动 rank |
| 跨 seed 方差 | Table 4–5；IC 均值 0.0443 | 通路 B 多次 `BacktestRunner` |
| 966 日 daily IC t-stat | Appendix A.5 | `ic.pkl` 序列统计 |
| LLM 不微调 | 推理 + 反馈 | — |

---

## 十三、复现与读代码清单

### 13.0 主实验复现检查表（14 项）

| # | 检查项 | 期望值 | Qlib 锚点 |
| :---: | :--- | :--- | :--- |
| 1 | 市场 | CSI300 | `market: csi300` |
| 2 | Train / Valid / Test | 2016–2020 / 2021 / **2022–2025** | `dataset.segments` |
| 3 | Label | $P_{t+2}/P_{t+1}-1$ | `label` in yaml |
| 4 | 预处理 | Fillna, ProcessInf, DropnaLabel, CSRankNorm | `learn_processors` |
| 5 | 因子池 | ~150 validated | JSON metadata |
| 6 | LGBM 输入 | **全池因子**，非单因子 | 一次 `fit` |
| 7 | IC 对象 | **$\hat{y}$** 截面 IC | `SigAnaRecord` |
| 8 | 组合 | Top50, Drop5, open, 等权 | `TopkDropoutStrategy` |
| 9 | 成本 | 买 0.05% + 卖 0.15% | `exchange_kwargs` |
| 10 | 基准 | SH000300 | `benchmark` |
| 11 | 主表入口 | **`run_backtest`**，非 `quantaalpha backtest` | `backtest/run_backtest.py` |
| 12 | Merit 入口 | `quantaalpha mine` | `factors/runner.py` |
| 13 | Factor Lib | `--factor-source alpha158_*` | `factor_loader.py` |
| 14 | ML/DL | Qlib benchmarks + 对齐上述 1–10 | 仓库外 |

### 13.1 环境

```bash
# .env
QLIB_DATA_DIR=/path/to/qlib/cn_data

# 校验（run.sh 同款）
ls $QLIB_DATA_DIR/{calendars,features,instruments}

# 可选：HuggingFace 预打包数据（与 README 一致）
# hf download QuantaAlpha/qlib_csi300 --repo-type dataset --local-dir ./hf_data
```

### 13.2 主表口径（通路 B）

```bash
# Factor Libraries baseline（Table 1 第三子块，仓库可直接跑）
python -m quantaalpha.backtest.run_backtest -c configs/backtest.yaml --factor-source alpha158_20
python -m quantaalpha.backtest.run_backtest -c configs/backtest.yaml --factor-source alpha158
python -m quantaalpha.backtest.run_backtest -c configs/backtest.yaml --factor-source alpha360

# LLM 因子库（QuantaAlpha / 自研方法）
python -m quantaalpha.backtest.run_backtest \
  -c configs/backtest.yaml \
  --factor-source custom \
  --factor-json /path/to/all_factors_library.json
```

输出：`data/results/backtest_v2_results/*_backtest_metrics.json`、`batch_summary.json`

**主表结果快照（CSI300, Test, GPT-5.2，摘自论文 Table 1）**：

| 方法 | IC | ICIR | Rank IC | IR | ARR(%) | MDD(%) |
| :--- | ---: | ---: | ---: | ---: | ---: | ---: |
| **QuantaAlpha** | **0.0472** | **0.2691** | **0.0459** | **0.6453** | **4.68** | **11.80** |
| AlphaAgent | 0.0347 | 0.2122 | 0.0334 | 0.1587 | 1.11 | 13.89 |
| RD-Agent | 0.0286 | 0.1995 | 0.0250 | 0.5321 | 3.58 | 16.76 |
| TRA (DL) | 0.0421 | 0.3402 | 0.0511 | 1.0502 | 6.81 | 8.51 |
| Alpha158(20) | 0.0051 | 0.0329 | 0.0184 | 0.5044 | 4.63 | 22.19 |

### 13.3 挖掘口径（通路 A）

```bash
./run.sh "价量因子挖掘"
# 或
quantaalpha mine --direction "..." --config_path configs/experiment.yaml
```

回测结果进入 `experiment.result` → `EvolutionController._extract_metrics`。

### 13.4 ML/DL baseline（仓库外，对齐评估壳）

Table 1 的 Linear / XGBoost / TRA 等 **不在** `QuantaAlpha_repo` 内。复现路径：

1. 使用 Qlib **`examples/benchmarks/`** 下对应 workflow；  
2. 手动对齐 §13.0 检查表 1–10（split、label、Top50/Drop5、成本、基准）；  
3. 因子层 IC 仍来自 **模型预测 $\hat{y}$**，非原始特征直接算 IC。

**ML-LightGBM（IC≈0.0247）与 Factor Libraries-Alpha158（IC≈0.0131）数值不同**，说明二者 **特征 handler 不同**——对比时需注明特征来源，不可混为「同一 LGBM 行」。

### 13.5 自研算法接入 Qlib 的最小路径

若你的方法产出新因子池，与 QuantaAlpha **可比** 的最小步骤：

1. **Stage A（可选）**：用你的搜索器挖因子；Merit 可自建，或临时借用通路 A 的 `qrun` 反馈 RankIC；  
2. **导出 JSON**：格式对齐 `all_factors_library.json`（name + expression）；  
3. **Stage B（必须）**：`run_backtest --factor-source custom --factor-json yours.json`；  
4. **报告**：Test 段 IC 四列 + IR/ARR/MDD；搜索阶段指标与 Test **分表**。

公平对比审稿清单：

- [ ] Label 与竞品一致（next-day vs 10-day 不可混表）  
- [ ] Train/Valid/Test 无泄漏；Test 仅最终表  
- [ ] 因子池规模一致（~150 vs ~20 需分表）  
- [ ] 同一 combiner（LGBM 超参写清）  
- [ ] 同一 Top50/Drop5 与成本  
- [ ] LLM backbone、temperature、seed 注明  

### 13.6 建议阅读顺序（代码）

1. `configs/backtest.yaml` → 主表协议  
2. `backtest/runner.py` → `_train_and_backtest`  
3. `backtest/factor_loader.py` → Factor Libraries baseline  
4. `factors/runner.py` → `develop` + `conf_combined_factors.yaml`  
5. `pipeline/evolution/trajectory.py` → `get_primary_metric`  
6. `factors/data_template/generate.py` → D1 与 `daily_pv.h5`

---

## 十四、训练本质：LLM 与 Qlib 谁被「训练」

| 维度 | QuantaAlpha | Qlib |
| :--- | :--- | :--- |
| **LLM 微调** | **否**（API 推理 + Prompt 反馈） | — |
| **被优化对象** | 轨迹池、因子库、进化父代选择 | **每轮回测重新 `LGBModel.fit`**（内层 $g$） |
| **环境反馈** | Qlib 回测 → RankIC 等 → $R(\tau)$ | IC 序列、组合超额收益 |
| **先验** | Alpha158(20) 种子方向 | Qlib `cn_data` 标准价量 |

**共性**：LLM 是推理引擎；**Merit + 搜索状态**是迭代载体；**Qlib 提供可复现的 L2/L2.5 度量尺**。

---

## 十五、终极总结

### 15.1 领域一句话（嵌入 QuantaAlpha）

> QuantaAlpha = 在 **D1 Qlib 价量面板**上，用 **轨迹进化（流派 A + B 式 Merit）** 搜索因子，在 **L2 通路 A** 用 RankIC 驱动迭代，在 **L2.5 通路 B** 用统一 LightGBM + C1 组合报告 Test IC/IR——**不涉及 L3 Optimizer**。

### 15.2 Qlib 四问（读代码/读论文时用）

1. **哪条通路？** Merit（A）还是 Test（B）？  
2. **哪一层？** L1 物化、L2 IC、还是 L2.5 IR？  
3. **信号是谁？** 单因子 $f$ 还是 LGBM $\hat{y}$？（主表均为后者）  
4. **哪段 Test？** 2021 还是 2022–2025？

### 15.3 工程结论

**Agent 负责发现，Qlib 负责证明**——Qlib 不是创新来源，而是 **Merit 与 Test 共用的可信度基础设施**。

### 15.4 实验设计 × Qlib 定位（给写论文/复现用）

| 你要回答的问题 | 看哪段实验 | 用哪条 Qlib 通路 |
| :--- | :--- | :--- |
| 进化是否有效？ | Fig.5 迭代曲线 | **A**（RankIC vs 轮次） |
| 主方法是否 SOTA？ | Table 1 CSI300 | **B**（IC + IR/ARR/MDD） |
| 是否优于静态因子库？ | Table 1 Factor Libraries 行 | **B** + `--factor-source alpha158_*` |
| 是否优于传统 ML/DL？ | Table 1 ML/DL 行 | Qlib benchmark + 对齐评估壳 |
| 是否优于 RD/AlphaAgent？ | Table 1 LLM 三行 | **B** + 各自 JSON，同 LGBM |
| alpha decay？ | Fig.4 年度 IC | **B** Test 按年切分 |
| 框架是否依赖单 LLM？ | 5 backbone 子表 | 挖矿换 API；**B** 不变 |
| 跨市场泛化？ | §5.4 CSI500/SP500 | **B** 换 market |

---

## 附录 A：指标编号与 Qlib 产出对照

| 编号 | 指标 | Qlib 产出路径 |
| :--- | :--- | :--- |
| P1 | IC | `SigAnaRecord` → `ic.pkl` → `mean` |
| P2 | Rank IC | `ric.pkl` → `mean` |
| P3 | ICIR | `mean(ic)/std(ic)` |
| P4 | Rank ICIR | `mean(ric)/std(ric)` |
| T3 | AER | `risk_analysis` 年化超额 |
| T4 | IR | `risk_analysis` information_ratio |
| T7 | MDD | `risk_analysis` max_drawdown |
| C1 | Top50/Drop5 | `TopkDropoutStrategy` |

## 附录 B：关键代码与配置索引

| 文件 | 作用 |
| :--- | :--- |
| `configs/backtest.yaml` | 通路 B：主表切分、LGBM、C1 |
| `configs/experiment.yaml` | Stage A：Planning 方向数、进化轮次等 |
| `factors/factor_template/conf_combined_factors.yaml` | 通路 A：parquet + 4 特征 |
| `factors/factor_template/conf_baseline.yaml` | 通路 A 首轮：仅 4 特征 |
| `quantaalpha/backtest/run_backtest.py` | 通路 B CLI（**Table 1 正确入口**） |
| `quantaalpha/backtest/runner.py` | 通路 B 实现 |
| `quantaalpha/backtest/factor_loader.py` | Alpha158/360 因子定义 |
| `quantaalpha/factors/runner.py` | 通路 A 编排 |
| `quantaalpha/factors/library.py` | 因子库 JSON 读写 |
| `quantaalpha/pipeline/factor_mining.py` | `quantaalpha mine` 入口 |
| `quantaalpha/pipeline/factor_backtest.py` | 旧 `quantaalpha backtest`（非主表） |
| `data/factorlib/all_factors_library.json` | 默认 ~150 因子库 |
| `quantaalpha/factors/data_template/generate.py` | D1 → daily_pv.h5 |
| `quantaalpha/utils/env.py` | QlibLocalEnv / Docker |
| `quantaalpha/pipeline/evolution/trajectory.py` | Merit 主指标 RankIC |

## 附录 C：Table 1 主表 vs 辅助实验 — Qlib 用法速查

| 实验 | 改什么 | 不改什么（评估壳） | Qlib 入口 |
| :--- | :--- | :--- | :--- |
| Table 1 主表 | 因子源 / 模型类 | split, label, Top50/Drop5, 成本 | 通路 B |
| Fig.4 年度 IC | 按年切片 IC 序列 | 同上 | 通路 B + 后处理 |
| Fig.5 迭代曲线 | 进化轮次 | Merit 协议（通路 A） | 通路 A 日志 |
| 跨市场 §5.4 | `market` + 数据目录 | 组合规则 | 通路 B |
| 消融 §5.5 | 关 Mutation/Crossover 等 | 评估壳 | A 挖矿 + B 主表 |
| 成本敏感性 A.6 | cost 倍数 | 其余 | 通路 B yaml |
| 多 seed Table 4–5 | `random_state` / 多次 run | 其余 | 通路 B 批跑 |
