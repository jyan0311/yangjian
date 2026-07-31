---
title: "QuantaAlpha｜主实验算法与多因子回测解析"
description: "结合 arXiv:2602.07085v3 与 QuantaAlpha 代码，回答主实验是否为每个因子单独建树模型；并详解 Table 1 中 ML / DL / Factor Libraries 三类 baseline 的实现、对比框架与主图标注含义。"
date: "2026-06-24"
tags: ["QuantaAlpha", "LightGBM", "Backtest", "Table 1", "Baseline", "Multi-Factor"]
featured: false
draft: false
---

# QuantaAlpha｜主实验算法与多因子回测解析

> **论文**：*QuantaAlpha: An Evolutionary Framework for LLM-Driven Alpha Mining*（arXiv:2602.07085v3）  
> **代码**：[QuantaAlpha/QuantaAlpha](https://github.com/QuantaAlpha/QuantaAlpha)（本地：`QuantaAlpha_repo/`）  
> **配套**：[QuantaAlpha_主实验设置详解](./QuantaAlpha_主实验设置详解.md) · [QuantaAlpha_Qlib使用说明](./QuantaAlpha_Qlib使用说明.md)

---

## 一、核心问题：是否为「每个因子」各建一个树模型？

**不是。** 主实验（Table 1、主图策略曲线）采用的是 **「一个因子池 → 一个 LightGBM → 一个组合预测 $\hat{y}$」**，而不是对每个因子单独训练一棵树或多因子分别回测再平均。

更精确的说法：

| 粒度 | 是否单独训练 LightGBM | 说明 |
| :--- | :---: | :--- |
| **单个因子 $f$** | **否** | 单因子 IC 只用于进化反馈、附录诊断；**不是** Table 1 主 IC 的定义 |
| **一条挖矿轨迹 / 一轮进化** | **是（通路 A）** | 当轮新因子 + 4 个工程特征 → **一次** `LGBModel.fit`，产出 RankIC 等 Merit |
| **一种方法 / 一份因子库（Table 1 每一行 LLM 类）** | **是（通路 B）** | ~150 个 validated 因子作为 **同一模型的输入特征** → **一次** fit → 主表 IC/IR |
| **Table 1 全部对比方法** | **各建一次，但超参相同** | QuantaAlpha / RD-Agent / AlphaAgent 等 **各自因子池各训 1 个 LGBM**；**模型结构、组合规则、数据切分一致** |

论文 §5.1 原文（公平对比协议）：

> For all LLM-based methods, roughly **150 validated factors** are submitted to the **same downstream LightGBM model** for final evaluation, ensuring a **fair factor-pool-level comparison**.

§5.2 进一步强调 Table 1 的数字来自：

> a factor pool of approximately **150 validated factors** synthesized by the **same downstream LightGBM model**, **rather than from a single best factor**.

**结论一句话**：

> 主实验是对 **每种方法挖出的整包因子（~150）** 训练 **一个** 多因子 LightGBM，用 **组合预测分 $\hat{y}$** 算 IC 与 TopkDropout 策略 IR/ARR/MDD——**不是** 150 棵树，也 **不是** 150 次单因子回测取平均。

---

## 二、主实验在代码里的「两条 Qlib 通路」

QuantaAlpha 仓库里 Qlib 出现 **两次**，职责不同；混淆二者是读 Table 1 最常见的误区。

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Stage A：进化挖掘（quantaalpha mine / run.sh）                          │
│  代码：factors/runner.py → qrun conf_combined_factors.yaml               │
│  目的：Merit 反馈（RankIC 选父代、写因子库 JSON）                         │
│  Test 区间：2021（Valid 年）— 与主表不同！                                 │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ 累积 → data/factorlib/all_factors_library.json
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Stage B：主表评估（quantaalpha backtest / BacktestRunner）              │
│  代码：backtest/runner.py + configs/backtest.yaml                        │
│  目的：Table 1 / 主图 的 IC、IR、ARR、MDD                                 │
│  Test 区间：2022-01-01 — 2025-12-26（约 966 交易日）                       │
└─────────────────────────────────────────────────────────────────────────┘
```

| 维度 | **通路 A（挖掘内回测）** | **通路 B（主表回测）** |
| :--- | :--- | :--- |
| 入口 | `quantaalpha mine` | `python -m quantaalpha.backtest.run_backtest -c configs/backtest.yaml` |
| 配置文件 | `factors/factor_template/conf_combined_factors.yaml` | `configs/backtest.yaml` |
| 特征 | 4 工程特征 + **当轮** `combined_factors_df.parquet` | **整库** ~150 LLM 因子（JSON）± 可选 Alpha158 基线 |
| Train / Valid / Test | 2016–2019 / **2020** / **2021** | **2016–2020** / **2021** / **2022–2025** |
| `learning_rate` | **0.05** | **0.1** |
| 组合回测区间 | 2021（Valid 年） | **2022–2025（Test）** |
| 指标用途 | 进化 RankIC、轨迹 $R(\tau)$ | **Table 1 主 IC / IR / ARR / MDD** |

**要点**：进化阶段 **也会** 训练 LightGBM，但那是 **搜索反馈**，时间切分与超参与主表 **不一致**；论文主表数字来自 **通路 B**。

---

## 三、主表（Table 1）完整算法流程

### 3.1 流程图（Stage B）

```
[各方法独立挖矿，得到各自因子池 F_method，约 150 个]
        │
        ▼
L1  计算每个因子 f_{i,t}（LLM 表达式 + function_lib / 缓存 pkl）
        │
        ▼
L2  预处理（与 Appendix A.2 一致）
    · Fillna → ProcessInf → DropnaLabel
    · 特征与 label 均 CSRankNorm
    · label: y_t = Ref($close,-2)/Ref($close,-1) - 1
        │
        ▼
L2.5  【一次】LightGBM.fit
    · Train: 2016-01-01 — 2020-12-31
    · Valid: 2021-01-01 — 2021-12-31（early stopping）
    · 输入 X = 该方法的 ~150 维因子（+ 若 combined 模式则含官方因子）
    · 输出 ŷ_{i,t} = g(X_{i,t})
        │
        ├──────────────────────────────┐
        ▼                              ▼
  因子层指标（Test 2022–2025）      策略层指标（Test 2022–2025）
  · 每日截面 IC(ŷ, y)              · TopkDropout(topk=50, n_drop=5)
  · 时间平均 → IC, ICIR            · 等权、开盘价成交
  · Rank IC / Rank ICIR            · 成本：买 0.05% + 卖 0.15%
                                   · 超额 r_excess = r_port - r_bench - cost
                                   · IR, ARR, MDD
```

### 3.2 LightGBM 超参（通路 B，`configs/backtest.yaml`）

代码中主表口径与论文 Appendix B「LightGBM 作 downstream model」一致，具体数值以仓库为准：

| 参数 | 值 |
| :--- | :--- |
| `loss` | mse |
| `learning_rate` | **0.1** |
| `max_depth` | 8 |
| `num_leaves` | 210 |
| `colsample_bytree` | 0.8879 |
| `subsample` | 0.8789 |
| `lambda_l1` / `lambda_l2` | 205.6999 / 580.9768 |
| `num_boost_round` | 500 |
| `early_stopping_round` | 50 |
| `min_child_samples` | 100 |
| `feature_fraction_bynode` | 0.8 |
| `random_state` / `seed` | 42 |

`BacktestRunner._train_and_backtest` 逻辑：

1. `model.fit(dataset)` — Train+Valid 上训练  
2. `pred = model.predict(dataset)` — 含 Test 段预测  
3. `SigAnaRecord` → 从 `ic.pkl` / `ric.pkl` 读 **Test 段** 日 IC 序列并平均  
4. `qlib_backtest` + `TopkDropoutStrategy(signal=pred)` → IR / ARR / MDD  

### 3.3 IC 到底算的是谁？

Table 1 的 **IC / Rank IC** 是：

$$
\text{IC}_t = \mathrm{Corr}_{\text{cross-section}}\bigl(\hat{y}_t,\, y_t\bigr), \quad \text{IC} = \frac{1}{T}\sum_t \text{IC}_t
$$

其中 $\hat{y}$ 是 **LightGBM 在 ~150 因子上的组合预测**，**不是**：

- 单因子 IC 的平均；  
- 进化阶段 Valid 2021 上的 RankIC；  
- 通路 A 当轮回测的 IC。

### 3.4 组合策略（Table 8 / `backtest.yaml`）

| 参数 | 值 |
| :--- | :--- |
| 策略 | `TopkDropoutStrategy` |
| `topk` | 50 |
| `n_drop` | 5 |
| 权重 | 等权 |
| `deal_price` | open（次日开盘） |
| `limit_threshold` | 0.095 |
| 基准（CSI300） | SH000300 |
| 买/卖成本 | 0.0005 / 0.0015 |

---

## 四、Table 1 各类 baseline 是否都「一池一 LGBM」？

Table 1 分 **四类**，输入特征不同，但 LLM 类遵循 **「一方法一池一 LGBM」**；ML/DL 类是 **各自模型结构**，不是 150 因子池。

| 类别 | 代表行 | 输入特征 | 下游模型 | 与 QuantaAlpha 协议关系 |
| :--- | :--- | :--- | :--- | :--- |
| **ML** | Linear, XGBoost, **LightGBM**, MLP, DoubleEnsemble | 6 个价量字段（OHLCV+vwap）经 Qlib 标准特征工程 | 各方法自己的模型 | **同一** Qlib 切分 + Top50/Drop5；**不是** 150 LLM 因子 |
| **DL** | GRU, LSTM, Transformer, TRA | 时序面板输入 | 神经网络 | 同上组合层；架构不同 |
| **静态因子库** | Alpha158(20), Alpha158, Alpha360 | 固定公式因子集 | **LightGBM**（与 LLM 类同族组合头） | 因子来源固定，非 LLM 挖掘 |
| **LLM Agent** | RD-Agent, AlphaAgent, **QuantaAlpha** | **~150 validated factors** | **同一套 LightGBM 超参** | 论文强调的公平对比核心 |

**LLM 三方法对比协议（论文 + 代码意图）**：

1. 各自用对应 Agent **独立挖矿**（RD-Agent / AlphaAgent / QuantaAlpha）；  
2. 各自产出约 **150** 个通过 Valid 去冗余后的因子；  
3. 导出为 JSON（仓库：`data/factorlib/all_factors_library.json`）；  
4. 分别调用 **同一** `configs/backtest.yaml` 跑 **通路 B**；  
5. 得到 Table 1 中 **每个 LLM × 每个 backbone** 的一行。

**不是** 三个方法共用一个因子池，也 **不是** 每个因子一个模型。

---

## 五、Table 1 三类非 LLM Baseline 如何实现？（Machine Learning / Deep Learning / Factor Libraries）

主实验图（README 中 `docs/images/主实验.png`，即 Table 1 可视化）把方法分为 **四大区块**。其中 **Classical Factor Mining** 下又拆成三行标签：**Machine Learning**、**Deep Learning**、**Factor Libraries**。它们与 **LLM-based Agentic Factor Mining** 的关系是：**共用同一套 Qlib 评估壳，只替换「信号从哪里来」**。

### 5.1 统一对比框架（所有 baseline 共享的「壳」）

论文 Appendix A.1–A.2 + B 节 + Table 8 锁定以下 **不变量**；Table 1 每一行（无论 ML / DL / 因子库 / LLM）都在此壳内换模型或换特征：

| 协议层 | 统一设置 | 论文依据 |
| :--- | :--- | :--- |
| **平台** | Microsoft **Qlib** | Appendix A.2 |
| **市场** | CSI 300（主表）；Figure 1 另含 CSI 500 / S&P 500 | §5.1, §5.4 |
| **Train / Valid / Test** | 2016–2020 / 2021 / **2022–2025-12-26** | Table 3 |
| **Label** | $y_t = P_{t+2}^c / P_{t+1}^c - 1$ | Appendix A.2 |
| **预处理** | Fillna → ProcessInf → DropnaLabel → **CSRankNorm**（特征 + label） | Appendix A.2 |
| **因子层指标** | 每日截面 IC / Rank IC → 时间平均 → ICIR / Rank ICIR | Appendix A.1 |
| **组合策略** | **TopkDropout**：topk=50, n_drop=5, 等权, **开盘价**成交 | Table 8 |
| **成本** | open_cost=0.05%, close_cost=0.15% | Table 8, A.6 |
| **基准** | SH000300 | Table 8 |
| **策略指标** | 超额序列 $r^{excess}_t = r^{port}_t - r^{bench}_t - c_t$ 上算 **IR, ARR, MDD** | Appendix A.1 |

**对比形式（一句话）**：

> 固定 **数据切分 + label + 预处理 + 组合规则 + 成本**；只改变 **预测模型 $\mathcal{M}$** 与 **输入特征 $\mathbf{X}$**；所有方法的 IC/IR 都来自 **同一套 Qlib 后处理**（`SigAnaRecord` + `PortAnaRecord` / `qlib.backtest`）。

```
                    ┌─────────────────────────────────────────┐
                    │     统一 Qlib 评估壳（Table 1 共享）       │
                    │  split · label · CSRankNorm · Top50/Drop5 │
                    └────────────────────┬────────────────────┘
                                         │
     ┌───────────────┬───────────────┬───┴───┬───────────────────┐
     ▼               ▼               ▼       ▼                   ▼
  ML 路线        DL 路线      Factor Lib    LLM Agent ×3
  表格/集成      时序神经网络   静态公式因子   ~150 挖掘因子
     │               │               │           │
     └───────────────┴───────────────┴───────────┘
                         │
                         ▼
              预测分 ŷ_{i,t}  →  IC / Rank IC
                         │
                         ▼
              TopkDropout(ŷ)  →  IR / ARR / MDD
```

### 5.2 Machine Learning（Table 1 第一子块）

**论文列举**（Appendix A.3）：Linear Regression、MLP、LightGBM、XGBoost、CatBoost、DoubleEnsemble。

**它们在比什么**：在 **固定 Qlib 特征面板** 上，用 **传统监督学习** 直接学 $g: \mathbf{X}_{i,t} \mapsto \hat{y}_{i,t}$，**不经过 LLM 因子挖掘**，也 **不使用 ~150 个 Agent 因子**。

| 方法 | 典型 Qlib 实现 | 输入 $\mathbf{X}$（论文未逐行写死，据 Qlib 惯例与 Table 1 数值结构） | 输出与评估 |
| :--- | :--- | :--- | :--- |
| **Linear** | `LinearModel` | 价量衍生的 **表格特征**（与 Alpha158 handler 或等价工程特征同族） | $\hat{y}$ → 同壳 IC + TopkDropout |
| **MLP** | `DNNModelPytorch` / 3 层 MLP | 同上，非时序展开 | 同上 |
| **LightGBM** | `LGBModel` | 同上；与 Factor Libraries 行的 **Alpha158+LGBM 不是同一数字**（IC 0.0247 vs Alpha158 0.0131）→ 说明 **ML 块与因子库块特征构造或 handler 不同** | 同上 |
| **XGBoost** | `XGBModel` | 表格特征 | 同上 |
| **CatBoost** | `CatBoostModel` | 表格特征 | 同上 |
| **DoubleEnsemble** | `DEnsembleModel`（Qlib 金融时序集成） | 表格特征 + 集成结构 | 同上 |

**与 LLM 类的关键区别**：

| 维度 | ML baseline | LLM Agent（QA / RD / AlphaAgent） |
| :--- | :--- | :--- |
| 特征来源 | **人工/标准 handler 特征** | **~150 个 LLM 符号因子** |
| 是否挖矿 | 否 | 是（Train+Valid 上搜索） |
| 下游 combiner | 模型本身即预测器 | **固定 LGBM** 组合因子池 |
| Table 1 角色 | 「不用 Agent 也能预测」的下界/对照 | 论文主贡献对比对象 |

**实现框架（论文侧）**：标准 **Qlib `qrun` workflow**——`DatasetH` + 对应 `model` 类 + `SigAnaRecord` + `PortAnaRecord`（TopkDropout）。与 MCTS-Alpha、AlphaAgent 等 Qlib 系论文的 ML baseline **同族**（见 MCTS-Alpha 附录：在 Alpha158 等特征集上训 LightGBM/MLP 再报 IC）。

**开源代码侧**：QuantaAlpha 仓库 **`BacktestRunner` 仅实现 `model.type: lgb`**（`backtest/runner.py`），**未内置** Linear / XGBoost / MLP / DoubleEnsemble 的一键脚本；Table 1 中 ML 各行需用 **Qlib 官方 benchmark 配置** 或作者未公开实验脚本复现。

### 5.3 Deep Learning（Table 1 第二子块）

**论文列举**：GRU、LSTM、Transformer、**TRA**（Temporal Routing Adaptor）。

**它们在比什么**：把 **每只股票的时间序列** 作为输入，用 **深度学习预测头** 输出截面 $\hat{y}_{i,t}$，再走 **同一 TopkDropout**。

| 方法 | 典型 Qlib 类 | 输入形态 | 备注 |
| :--- | :--- | :--- | :--- |
| **GRU** | `GRUModel` / `pytorch_gru` | `TSDatasetH`：lookback 窗口 × 特征维 | 时序状态 |
| **LSTM** | `LSTMModel` | 同上 | 同上 |
| **Transformer** | `TransformerModel` | 同上 | 注意力时序 |
| **TRA** | `TRAModel`（`qlib.contrib.model.pytorch_tra`） | 路由适配的多任务时序 | Table 1 DL 强基线（IC≈0.0421, ARR≈6.81%） |

**与 ML / 因子库的区别**：

- **ML**：$(i,t)$ 截面一行特征 → 预测；一般不显式建模长序列。  
- **DL**：$(i, t-L:t)$ 序列 → 预测；参数量大、对非平稳更敏感。  
- **因子库 / LLM**：先有一组 **公式因子** $f_k(i,t)$，再用 **LGBM 非线性合成**（DL 块 **不用** 公式因子池 + LGBM 这条路径）。

**对比形式**：DL 与 ML、因子库、LLM **并列四行**，共享 **Test 段、同一 IR/ARR/MDD 定义**；差异仅在 **$\mathcal{M}$ 的网络结构** 与 **Dataset 是 DatasetH 还是 TSDatasetH**。

**开源代码侧**：仓库 **无** GRU/LSTM/Transformer/TRA 训练入口；需 Qlib 自带 `examples/benchmarks` 或论文实验环境。

### 5.4 Factor Libraries（Table 1 第三子块）

**论文列举**：**Alpha158(20)**、**Alpha158**、**Alpha360**（Appendix A.3）。

**它们在比什么**：使用 **工业界预定义公式因子库**（非 LLM 挖掘），把每个因子当作特征维度，再经 **LightGBM 非线性组合** 得到 $\hat{y}$——**与 LLM Agent 行的 pipeline 结构最像**，差别只在 **因子从哪来**。

| 因子集 | 规模（概念） | 在 QuantaAlpha 论文中的双重角色 | Table 1（GPT-5.2 行附近）IC 量级 |
| :--- | :--- | :--- | :--- |
| **Alpha158(20)** | 20 个低相关子集 | **Planning 初始种子**（Appendix A.5）+ **弱基线** | IC **0.0051** |
| **Alpha158** | ~158 经典价量因子 | 工业标准大库 | IC **0.0131** |
| **Alpha360** | ~360 多窗口因子 | 更强静态库上限 | IC **0.0105** |

**算法流程（与 LLM 类同构）**：

```
Alpha158 / Alpha360 / Alpha158(20)  公式
        │
        ▼
QlibDataLoader 或 D.features  →  f_{k,i,t}  （L1 物化）
        │
        ▼
CSRankNorm 等预处理（与主实验一致）
        │
        ▼
【一个】LGBModel.fit( 全部因子列 → label )
        │
        ▼
ŷ → IC / Rank IC ；  TopkDropout(ŷ) → IR / ARR / MDD
```

**为何 Alpha158(20) IC 很低但 ARR 仍可达 4.63%？**  
IC 衡量 **$\hat{y}$ 与 label 的线性/秩相关**；ARR 来自 **Top50 组合** 的超额收益，二者 **不必单调一致**（组合层非线性、换手与成本路径不同）。读表时 **因子层与策略层要分开看**。

**开源代码侧（可复现度最高的一类 baseline）**：

仓库 `quantaalpha/backtest/factor_loader.py` + `configs/backtest.yaml` **专门覆盖 Factor Libraries + LLM 因子库**：

| `factor_source` | 含义 | 代码位置 |
| :--- | :--- | :--- |
| `alpha158_20` | 20 个手写 Qlib 表达式 | `FactorLoader.ALPHA158_20_FACTORS` |
| `alpha158` | 扩展 Alpha158 子集（~60+ 列） | `ALPHA158_FACTORS` |
| `alpha360` | 多窗口 ROC/MA/STD/… | `_load_alpha360()` |
| `custom` | LLM JSON 因子库 | `_load_custom_factors()` |
| `combined` | 官方库 + custom | `_load_combined_factors()` |

复现 Factor Libraries 主表行：

```bash
python -m quantaalpha.backtest.run_backtest -c configs/backtest.yaml --factor-source alpha158_20
python -m quantaalpha.backtest.run_backtest -c configs/backtest.yaml --factor-source alpha158
python -m quantaalpha.backtest.run_backtest -c configs/backtest.yaml --factor-source alpha360
```

**注意**：代码内 `ALPHA158_*` 为 **项目内嵌表达式表**，与 Qlib 官方 `Alpha158DL` handler 的 158 列 **可能不完全逐列一致**；复现论文精确数字需对齐作者 Qlib 版本与 handler。

### 5.5 四类方法对比总表（读主图 / Table 1 用）

| 区块 | 信号来源 | 预测模型 | 是否挖矿 | 因子池规模 | 与 QA 公平对比点 |
| :--- | :--- | :--- | :---: | :--- | :--- |
| **Machine Learning** | 标准表格特征 | Linear / MLP / **树模型各自为预测器** | 否 | N/A（非因子池） | 证明「直接 ML」不如 Agent 因子池 |
| **Deep Learning** | 时序面板 | GRU / LSTM / Trans / **TRA** | 否 | N/A | 证明「端到端 DL」仍难稳赢 QA IC |
| **Factor Libraries** | Alpha158(20)/158/360 | **LightGBM 组合** | 否 | 20 / 158 / 360 | 与 LLM 类 **同 pipeline**，比 **因子质量** |
| **LLM Agent** | Agent 挖掘 | **同一 LightGBM 超参** | 是 | **~150** | 核心竞品：RD-Agent / AlphaAgent / QA |

**论文选型逻辑**（§5.1 + Appendix A.3 + 实验设计参考文档）：

1. **Factor Libraries**：对标「工业标准公式库 + LGBM」上限；Alpha158(20) 同时作 **种子** 与 **弱基线**。  
2. **ML / DL**：对标「不用因子挖掘、直接预测收益」的 **非 Agent 路线**；TRA 代表 DL 强线。  
3. **LLM Agent**：在 **~150 因子 + 同一 LGBM** 下与 RD-Agent / AlphaAgent 公平对决，隔离 **轨迹进化** 贡献。

### 5.6 主图中 baseline 曲线如何画？（Figure 1 / Figure 4）

**Figure 1（跨市场累计超额）**  
- **QuantaAlpha 曲线**：CSI 300 挖出的因子池 → 在 CSI 500 / SP500 上 **零样本** 计算因子 → **同一 LGBM + TopkDropout 协议**（不重新挖矿）。  
- **AlphaAgent / RD-Agent / Alpha158 等**：各自 **自己的因子或特征** + **同一组合规则** 在目标市场重算 $\hat{y}$ 与持仓。  
- **Benchmark**：指数本身（非超额）；曲线多为 **累计超额收益**。

**Figure 4（逐年 IC / Rank IC）**  
- 对比 **QuantaAlpha vs RD-Agent vs AlphaAgent** 等；每条曲线是 **该方法在 CSI 300 上、该年的组合预测 IC**（非单因子）。  
- **ML/DL/Factor Libraries 通常不出现在 Fig.4**（论文聚焦 Agent 抗 decay 叙事）。

**Figure 5（迭代 IC 分布）**  
- 仅 **QA / AlphaAgent / RD-Agent** 五轮挖矿；**不含 ML/DL/因子库**（无迭代过程）。

### 5.7 开源仓库 vs 论文实验：覆盖范围

| 实验内容 | 论文 | 开源 QuantaAlpha 仓库 |
| :--- | :---: | :---: |
| QuantaAlpha 挖矿 + 进化 | ✓ | ✓ `quantaalpha mine` |
| LLM 因子库 → 主表 LGBM | ✓ | ✓ `BacktestRunner` + `--factor-source custom` |
| **Factor Libraries** 三档 | ✓ | ✓ `--factor-source alpha158_20/alpha158/alpha360` |
| **ML 六方法** | ✓ | ✗ 需 Qlib benchmark |
| **DL 四方法** | ✓ | ✗ 需 Qlib benchmark |
| RD-Agent / AlphaAgent 因子池 | ✓ | ✗ 需自行跑对应仓库再 JSON 导入 |

---

## 六、Stage A 进化阶段：何时训练 LightGBM？

挖矿循环（`AlphaAgentLoop` → `QlibFactorRunner.develop`）每轮 **也会** 训练 **一个** LightGBM，但语义是 **Merit**，不是主表。

### 6.1 单轮挖矿内的 LGBM

```python
# factors/runner.py（逻辑摘要）
# 1. 执行当轮 factor.py → 因子值
# 2. 合并为 combined_factors_df.parquet
# 3. qrun conf_combined_factors.yaml → 一次 LGBModel.fit
config_name = "conf_baseline.yaml" if 首轮 else "conf_combined_factors.yaml"
```

`conf_combined_factors.yaml` 特征构成：

- **4 个工程特征**：OPEN_RET, VOL_RATIO, RANGE_RET, CLOSE_RET  
- **+ 当轮挖出的 LLM 因子**（StaticDataLoader 读 parquet）

因此：**每一轮轨迹回测 = 1 个多因子 LGBM**（4 + k 维），用于提取 RankIC 写入 `experiment.result` → 进化控制器选父代。

### 6.2 进化算法参数（论文 Appendix B = 主实验默认）

| 参数 | 论文主实验 | 仓库默认 `configs/experiment.yaml` |
| :--- | :--- | :--- |
| Planning 并行方向 | **10** | 2（需改配置对齐论文） |
| 总迭代轮数 | **5**（1 Original + Mutation/Crossover 交替） | `max_rounds: 3` |
| 每 hypothesis 因子数 | **3** | `factors_per_hypothesis: 1` |
| 符号长度 | ≤ 250 | ≤ 200 |
| 基础特征数 | ≤ 6 | ≤ 5 |
| free args ratio | < 50% | < 50% |
| 父代选择 | 按 $R(\tau)$ / RankIC | `parent_selection_strategy: best` |

> 复现 Table 1 需将 `experiment.yaml` 调到论文 Appendix B；仓库默认是 **轻量 demo**，不是论文完整算力配置。

### 6.3 因子池准入（~150 的来源）

论文 §4.1.2 + Appendix E 描述全局因子池维护规则（主实验规模 ~150；Appendix E 长跑实验 cap 为当前挖掘总量的 50%）：

1. 在 **Valid 2021** 上按 **RankIC 降序** 贪心入库；  
2. 若新因子与库内任一因子 **|corr| ≥ 0.7**，丢弃 RankIC 较低者；  
3. **Test 2022–2025 不参与** 进化与入库；  
4. 主实验最终约 **150** 因子进入通路 B。

代码侧：`loop.py` 每轮把因子写入 `data/factorlib/all_factors_library.json`；通路 B 用 `--factor-source custom --factor-json ...` 加载整库。论文中的 150 截断/筛选可能在实验脚本或后处理中完成（仓库未硬编码 `150`，但 `factor_loader` 支持 `max_factors`）。

---

## 七、主图 / 主表 / 其他实验分别用什么设置？

### 7.1 Table 1 — 主表（§5.2）

| 项 | 设置 |
| :--- | :--- |
| 市场 | **CSI 300** |
| Test | 2022-01-01 — 2025-12-26（约 4 年，966 日） |
| 评估对象 | ~150 因子 + **一个** LGBM + Top50/Drop5 |
| LLM backbone | RD-Agent / AlphaAgent / QuantaAlpha 各 **5 个模型** |
| 其他 LLM 实验默认 | DeepSeek-V3.2（Appendix A.3） |
| 最优行示例（GPT-5.2 QA） | IC 0.0472, IR 0.6453, ARR 4.68%, MDD 11.80% |

### 7.2 Figure 1 — 跨市场累计超额收益（§5.4）

| 项 | 设置 |
| :--- | :--- |
| 因子来源 | **CSI 300 上挖出并筛选的因子池** |
| 部署 | CSI 500、S&P 500 **零样本迁移**（不重新挖矿） |
| 含义 | 因子公式与组合流程迁移；**不是** Table 1 同一数字的简单复制 |
| 曲线 | 累计 **超额收益**（相对当地基准） |
| 读图 | 2024 末 CSI500 QA 终端超额约 **40.28%**；SP500 约 **19.1%** |

### 7.3 Figure 4 — 逐年 IC / Rank IC（§5.4 Alpha Decay）

| 项 | 设置 |
| :--- | :--- |
| 区间 | CSI 300，**2021–2025 分年** |
| 对比 | QuantaAlpha vs RD-Agent vs AlphaAgent 等 |
| 指标 | **年度** IC、Rank IC（基于组合预测 $\hat{y}$ 的因子层口径） |
| 论点 | 2023 风格切换后 QA 仍维持较高 IC |

### 7.4 Figure 5 — 迭代 IC 分布（§5.4 Efficiency）

| 项 | 设置 |
| :--- | :--- |
| 对象 | 前 **5** 轮进化 |
| 指标 | 各轮因子 IC **分布**（挖掘过程，非 Table 1 Test 主表） |
| 对比 | QuantaAlpha vs AlphaAgent vs RD-Agent |
| 论点 | QA 迭代后 IC 均值更高、更稳 |

### 7.5 Table 2 / Figure 3 — 消融（§5.3）

| 实验 | 因子池 + LGBM 协议 |
| :--- | :--- |
| w/o Planning / Mutation / Crossover | 仍走 **同一** 下游评估；只去掉对应进化模块 |
| w/o Consistency / Complexity / Redundancy | 只去掉生成门控 |
| 数字 | 与 Table 1 **同协议** 的 IC / ARR / MDD，便于横向比 |

### 7.6 Appendix E — 15 轮收敛实验（非主表默认）

| 项 | 与主实验差异 |
| :--- | :--- |
| 迭代 | **15** 轮（非 5 轮） |
| 复杂度 | symbol ≤ **200**，features ≤ **4** |
| 池大小 | cap = 当前挖掘总量的 **50%**（非固定 150） |
| 结论 | 第 11–12 轮附近 ARR/MDD 平衡最优 |

---

## 八、代码复现主表的最小命令

### 8.1 挖矿（Stage A）

```bash
cd QuantaAlpha_repo
# 对齐论文：修改 configs/experiment.yaml 中 num_directions=10, max_rounds=5, factors_per_hypothesis=3
./run.sh "价量因子挖掘"
# 产出：data/factorlib/all_factors_library.json
```

### 8.2 主表回测（Stage B）

```bash
python -m quantaalpha.backtest.run_backtest \
  -c configs/backtest.yaml \
  --factor-source custom \
  --factor-json data/factorlib/all_factors_library.json
```

对比 baseline 示例：

```bash
# Factor Libraries — Table 1 第三子块（开源可跑）
python -m quantaalpha.backtest.run_backtest -c configs/backtest.yaml --factor-source alpha158_20
python -m quantaalpha.backtest.run_backtest -c configs/backtest.yaml --factor-source alpha158
python -m quantaalpha.backtest.run_backtest -c configs/backtest.yaml --factor-source alpha360

# ML / DL — Table 1 第一、二子块（需 Qlib 官方 benchmark，仓库未内置）
# 例：qlib/examples/benchmarks/LightGBM/workflow_config_lightgbm_Alpha158.yaml
# 例：qlib/examples/benchmarks/TRA/workflow_config_tra_Alpha158.yaml
# 运行前须将 dataset segments / label / TopkDropout 对齐 configs/backtest.yaml
```

输出：`data/results/backtest_v2_results/*_backtest_metrics.json`（IC、Rank IC、annualized_return、information_ratio、max_drawdown）。

---

## 九、常见误解对照

| 误解 | 正确理解 |
| :--- | :--- |
| 每个因子训练一个 LightGBM | **否**；~150 因子是 **同一模型的 150 维输入** |
| Table 1 IC = 单因子 IC 平均 | **否**；IC 来自 **$\hat{y}$** 与未来 label 的截面相关 |
| 进化 RankIC = 主表 IC | **否**；时间切分、特征集、Test 区间均不同 |
| RD-Agent 与 QA 共用因子池 | **否**；**各自挖矿、各自 ~150 因子、各自训 1 个 LGBM** |
| 主表与消融用不同回测协议 | **否**；消融仍用 **同一 downstream LGBM + TopkDropout** |
| 仓库默认 config = 论文主实验 | **否**；`experiment.yaml` 为轻量配置，需手动对齐 Appendix B |
| ML/DL 行 = Factor Libraries 行 | **否**；ML 用表格/集成直接预测，因子库用 **静态公式 + LGBM**；数字不同（如 ML LightGBM IC 0.0247 vs Alpha158 IC 0.0131） |
| 开源仓库含全部 Table 1 脚本 | **否**；**Factor Libraries + LLM JSON** 可跑；**ML/DL 需 Qlib benchmark** |

---

## 十、检查清单（读 Table 1 / 写实验章节用）

| # | 检查项 | 主实验值 |
| :---: | :--- | :--- |
| 1 | 每方法 LGBM 个数 | **1 个 / 方法 / 因子池** |
| 2 | LLM 类因子池规模 | **~150** |
| 3 | LGBM 输入 | 因子池全部因子（非单因子） |
| 4 | Train / Valid / Test（主表） | 2016–2020 / 2021 / **2022–2025** |
| 5 | Label | $P_{t+2}^c / P_{t+1}^c - 1$ |
| 6 | 预处理 | Fillna, ProcessInf, DropnaLabel, CSRankNorm |
| 7 | 组合 | Top50, Drop5, open, 等权 |
| 8 | 成本 | 买 0.05% + 卖 0.15% |
| 9 | IC 对象 | LGBM **组合预测 $\hat{y}$** |
| 10 | 策略指标 | Test 超额序列上的 IR / ARR / MDD |
| 11 | 代码入口（主表） | `backtest/runner.py` + `configs/backtest.yaml` |
| 12 | 代码入口（进化） | `factors/runner.py` + `conf_combined_factors.yaml` |
| 13 | Factor Libraries 复现 | `BacktestRunner` + `--factor-source alpha158_20/alpha158/alpha360` |
| 14 | ML/DL 复现 | Qlib `examples/benchmarks/*` + 对齐 split/label/TopkDropout |

---

## 十一、相关文档

| 文件 | 内容 |
| :--- | :--- |
| [QuantaAlpha_主实验设置详解](./QuantaAlpha_主实验设置详解.md) | 数据切分、指标公式、Table 1 快照 |
| [QuantaAlpha_Qlib使用说明](./QuantaAlpha_Qlib使用说明.md) | 通路 A/B、Merit vs Test、代码索引 |
| [实验设计参考_CogAlpha与QuantaAlpha](./实验设计参考_CogAlpha与QuantaAlpha.md) | 与 CogAlpha 主实验差异（20 vs 150 因子等） |
| 论文 PDF | `李建推荐的论文/2602.07085v3.pdf` |
| 代码 | `QuantaAlpha_repo/` |

---

## 十二、代码模块对照：Table 1 的 ML / Factor Libraries 对应哪段代码？

先给结论：**开源仓库只完整实现了 Table 1 的「Factor Libraries + LLM 因子库」通路；Machine Learning 六方法不在仓库内，需另用 Qlib benchmark。**

### 12.1 两条容易混淆的回测入口

| 命令 | 代码 | 对应 Table 1？ | 说明 |
| :--- | :--- | :---: | :--- |
| `quantaalpha backtest --factor_path ...` | `pipeline/factor_backtest.py` → `BacktestLoop` | **否** | 旧版 RD-Agent 式 loop，走 `QlibFactorRunner` + `conf_combined_factors.yaml`；**Test=2021**，与主表不同 |
| `python -m quantaalpha.backtest.run_backtest -c configs/backtest.yaml ...` | `backtest/run_backtest.py` → **`BacktestRunner`** | **是（Factor Libraries + 自定义因子）** | README §5「Independent Backtesting」；**Test=2022–2025**，对齐 Table 1 |

**读 Table 1 / 跑 baseline 请只用第二条**（`BacktestRunner`），不要用 `quantaalpha backtest`。

### 12.2 Factor Libraries（Table 1 第三子块）— 代码一一对应

```
configs/backtest.yaml          ← 论文主表协议（split / label / LGBM / TopkDropout）
        │
        ▼
backtest/run_backtest.py       ← CLI 入口
        │
        ▼
backtest/runner.py             ← BacktestRunner：fit LGBM → IC → qlib_backtest
        │
        ├── backtest/factor_loader.py
        │       ├── ALPHA158_20_FACTORS   ← Table 1「Alpha158(20)」
        │       ├── ALPHA158_FACTORS      ← Table 1「Alpha158」
        │       └── _load_alpha360()      ← Table 1「Alpha360」
        │
        └── _create_dataset()  → QlibDataLoader 用表达式算因子值
```

| Table 1 行 | `--factor-source` | 因子定义位置 | 下游模型（代码） |
| :--- | :--- | :--- | :--- |
| **Alpha158(20)** | `alpha158_20` | `factor_loader.py` → `ALPHA158_20_FACTORS`（20 条 Qlib 表达式） | `runner.py` → `LGBModel(**configs/backtest.yaml`) |
| **Alpha158** | `alpha158` | `ALPHA158_FACTORS`（项目内嵌子集，**非** Qlib 官方 handler 158 列全集） | 同上 |
| **Alpha360** | `alpha360` | `_load_alpha360()` 动态生成多窗口表达式 | 同上 |

**`BacktestRunner` 核心逻辑**（Factor Libraries 与 LLM 因子库共用）：

1. `FactorLoader.load_factors()` → 得到 `{因子名: Qlib表达式}`  
2. `_create_dataset()` → `DatasetH` + `QlibDataLoader` 物化特征 + label  
3. `_train_and_backtest()` → **`LGBModel.fit` 仅支持 `model.type: lgb`** → `SigAnaRecord` 算 IC → `TopkDropoutStrategy` 算 IR/ARR/MDD  

**与 LLM 行的关系**：LLM 方法把 `--factor-source custom --factor-json all_factors_library.json` 换成自己的 ~150 因子；**LGBM 超参、组合、Test 区间与 Factor Libraries 完全相同**——这才是论文说的 fair comparison。

### 12.3 Machine Learning（Table 1 第一子块）— 仓库内 **无对应实现**

论文 Table 1 的 Linear / MLP / XGBoost / CatBoost / DoubleEnsemble /（表格里的 LightGBM 行）属于 **Qlib 标准 benchmark workflow**，**不在** `QuantaAlpha_repo/quantaalpha/backtest/` 中：

| 检查项 | 结果 |
| :--- | :--- |
| `BacktestRunner._train_and_backtest` | 仅 `if model_config['type'] == 'lgb'`，否则 `raise ValueError` |
| `configs/backtest.yaml` | `model.type` 只有 `lgb` |
| 全仓库搜索 | 无 `LinearModel` / `XGBModel` / `DEnsembleModel` 的主表脚本 |

**论文侧实现方式（推断 + Qlib 惯例）**：

- 使用 Qlib 自带 **`Alpha158DL` / `Alpha360DL` handler** 或等价 **表格特征**（不是 `factor_loader.py` 的内嵌表）；  
- 各方法换 `task.model.class`（`LinearModel`、`LGBModel`、`XGBModel`、`DEnsembleModel`、`DNNModelPytorch` 等）；  
- **同一** `port_analysis_config`（Top50/Drop5、成本、基准）跑 `PortAnaRecord`。

因此：**Factor Libraries 行 ≈ 仓库 `BacktestRunner`；ML 行 ≈ Qlib `examples/benchmarks/*`，两者特征构造可能不同**（这也解释了 ML-LightGBM IC 0.0247 vs Alpha158 IC 0.0131 的差异）。

### 12.4 挖矿模块 **不** 对应 Table 1 baseline

| 模块 | 路径 | 作用 |
| :--- | :--- | :--- |
| `quantaalpha mine` | `pipeline/factor_mining.py` → `AlphaAgentLoop` | QuantaAlpha **自己的**进化挖矿 |
| 挖矿内回测 | `factors/runner.py` → `qrun conf_combined_factors.yaml` | Merit 反馈（Valid **2021**） |
| 因子库写入 | `factors/library.py` + `loop.py` feedback | 产出 `all_factors_library.json` |

**Alpha158(20) 在挖矿里**只作 **Planning 种子**（论文 Appendix A.5），**不是** Table 1 Factor Libraries 那一步的回测代码。

---

## 十三、在你自己的算法中如何回测 Factor Libraries / ML baseline？

目标：让你的方法与 Table 1 **可比**——固定 **评估壳**，只换 **因子或模型**。

### 13.1 评估壳（必须对齐的 9 项）

无论跑 Factor Libraries 还是你自己的因子，以下应与 `configs/backtest.yaml` 一致：

| # | 项 | 值 |
| :---: | :--- | :--- |
| 1 | 市场 | `csi300` |
| 2 | Train / Valid / Test | 2016–2020 / 2021 / **2022–2025-12-26** |
| 3 | Label | `Ref($close, -2) / Ref($close, -1) - 1` |
| 4 | 预处理 | Fillna, ProcessInf, DropnaLabel, CSRankNorm（特征+label） |
| 5 | 组合 | TopkDropout topk=50, n_drop=5, deal_price=open |
| 6 | 成本 | open 0.05%, close 0.15% |
| 7 | 基准 | SH000300 |
| 8 | LGBM 超参 | 见 `configs/backtest.yaml` §model（与 QA 主表 LLM 行相同） |
| 9 | 指标 | IC/RankIC 来自 **组合预测 $\hat{y}$**；IR/ARR/MDD 来自 Test 超额 |

### 13.2 路径 A：复现 Factor Libraries（推荐，仓库可直接跑）

**Step 1** 准备 Qlib 数据（与 README 相同）：

```bash
export QLIB_DATA_DIR=/path/to/qlib/cn_data
cd QuantaAlpha_repo
```

**Step 2** 跑三档静态因子库 baseline：

```bash
python -m quantaalpha.backtest.run_backtest -c configs/backtest.yaml --factor-source alpha158_20
python -m quantaalpha.backtest.run_backtest -c configs/backtest.yaml --factor-source alpha158
python -m quantaalpha.backtest.run_backtest -c configs/backtest.yaml --factor-source alpha360
```

**Step 3** 读结果：`data/results/backtest_v2_results/*_backtest_metrics.json` 与 `batch_summary.json`。

**Step 4** 跑 **你自己的因子**（与 QA 同 pipeline）：

1. 把挖掘出的因子导出为 JSON（格式同 `all_factors_library.json`）：

```json
{
  "metadata": { "total_factors": 150 },
  "factors": {
    "factor_id_1": {
      "factor_name": "MyFactor_1",
      "factor_expression": "RANK(TS_MEAN($return, 20))",
      "factor_description": "..."
    }
  }
}
```

2. 若表达式含 `RANK`/`TS_MEAN` 等 QuantaAlpha 算子，走 `custom_factor_calculator.py`（`expr_parser` + `function_lib`），**不是** Qlib 原生表达式。

```bash
python -m quantaalpha.backtest.run_backtest \
  -c configs/backtest.yaml \
  --factor-source custom \
  --factor-json /path/to/my_factors.json
```

3. （可选）与 Alpha158(20) 拼接对照：

```bash
python -m quantaalpha.backtest.run_backtest \
  -c configs/backtest.yaml \
  --factor-source combined \
  --factor-json /path/to/my_factors.json
```

**对比解读**：你的方法 vs Alpha158(20)/158/360，在 **同一 LGBM + 同一 Test** 下比 IC / ARR / MDD——这与 Table 1 **Factor Libraries vs LLM Agent** 的对比形式一致。

### 13.3 路径 B：复现 Machine Learning baseline（需 Qlib benchmark）

仓库 **不能** 一键跑出 Linear/XGB/DoubleEnsemble 等行，需要：

**方案 B1 — 用 Qlib 官方 benchmark（最接近论文）**

1. 安装 qlib，进入 `examples/benchmarks/`（或 `qlib/contrib/model` 文档中的 workflow）。  
2. 选对应 yaml，例如：
   - `LightGBM/workflow_config_lightgbm_Alpha158.yaml`
   - `XGBoost/...`
   - `MLP/...`
3. **手动改 yaml** 使其与 `configs/backtest.yaml` 对齐：
   - `segments` → 2016–2020 / 2021 / 2022–2025  
   - `label` → `Ref($close, -2)/Ref($close, -1)-1`  
   - `port_analysis_config` → topk=50, n_drop=5, 成本、open、SH000300  
4. `qrun workflow_config_xxx.yaml`，从 recorder 读 IC 与 PortAna 指标。

**方案 B2 — 扩展 `BacktestRunner`（适合长期集成）**

在 `backtest/runner.py` 的 `_train_and_backtest` 中增加分支，例如：

```python
if model_config['type'] == 'lgb':
    model = LGBModel(**model_config['params'])
elif model_config['type'] == 'linear':
    from qlib.contrib.model.linear import LinearModel
    model = LinearModel()
elif model_config['type'] == 'xgb':
    from qlib.contrib.model.xgb import XGBModel
    model = XGBModel(**model_config['params'])
# ...
```

并在 `configs/backtest.yaml` 增加 `model.type` 选项。**注意**：ML 行通常配合 **Qlib Alpha158DL handler** 特征，而不是 `factor_loader.py` 的 20/60 列内嵌表——若要用 ML baseline 数字对齐论文，特征 handler 也要与 Qlib benchmark 一致。

### 13.4 推荐对比实验设计（写论文 / 做 ablation）

| 对比组 | 你怎么跑 | 回答的问题 |
| :--- | :--- | :--- |
| **你的方法** | `custom` + 你的 JSON | 主结果 |
| **Factor Libraries** | `alpha158_20` / `alpha158` / `alpha360` | 是否优于静态工业因子库 |
| **LLM 竞品** | RD-Agent/AlphaAgent 因子 JSON + 同一 `backtest.yaml` | 是否优于其他 Agent（需先跑对方仓库） |
| **ML 下界** | Qlib benchmark + 对齐 yaml | 是否优于「直接 ML 预测」 |
| **消融：仅换 LGBM 输入** | `combined`（Alpha158(20)+你的因子） | 增益是否来自新因子而非旧特征 |

**不要混用**：

- 挖矿通路 A 的 RankIC（Test=2021）≠ 主表 IC（Test=2022–2025）  
- `quantaalpha backtest`（BacktestLoop）≠ `run_backtest`（BacktestRunner）  
- Factor Libraries（`factor_loader` 内嵌表达式）≠ ML 行（Qlib handler 全特征）

### 13.5 最小文件清单（自建系统只需抄这些）

若要把 QuantaAlpha 的 **Table 1 评估壳** 迁到你自己的项目，最少依赖：

| 文件 | 用途 |
| :--- | :--- |
| `configs/backtest.yaml` | 协议常量 |
| `quantaalpha/backtest/runner.py` | 训练 + IC + 组合回测 |
| `quantaalpha/backtest/factor_loader.py` | Factor Libraries 表达式 |
| `quantaalpha/backtest/custom_factor_calculator.py` | LLM/自定义算子因子 |
| `quantaalpha/factors/coder/function_lib.py` + `expr_parser.py` | 非 Qlib 表达式执行 |

ML baseline **不必** 迁上述仓库代码，直接用 Qlib benchmark 即可。

---

*整理日期：2026-06-24。主表协议以论文 §5.1–5.2、Appendix A–B 为准；超参与切分以 `configs/backtest.yaml` 与 `conf_combined_factors.yaml` 为代码 ground truth。*
