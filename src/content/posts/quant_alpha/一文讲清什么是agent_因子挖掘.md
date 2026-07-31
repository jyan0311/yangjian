# 量化交易｜一文讲清楚什么是LLM驱动的Alpha因子挖掘

> **整理日期**：2026-06-18  
> **文献范围**：`论文阅读/` 主目录 **11 篇**（A 股/美股）+ `论文/` 子目录 **2 篇**（加密）+ **Chain-of-Alpha 摘要**；本地 PDF 与 extracted 文本  
> **文档性质**：**Research 导向文献综述**——在既有四份专题笔记基础上，统一回答「这一领域在研究什么、怎么分类、数据与评估如何对齐、各文差异何在、尚缺什么」  

>注：本篇的目的是自用整理，除了“三层数据、三层消费”部分为新内容外，其他部分在之前的文章均进行过分享

```
title: "量化实证｜LLM 驱动 Alpha 因子挖掘：文献综述与实证方法论"
description: "整合论文阅读文件夹内 13 篇 LLM Alpha 挖掘文献，从科研问题、三大流派、数据回测协议、Merit 设计、平台三层架构到逐篇评述，形成 research 导向的系统性文献综述。"
date: "2026-06-23"
tags: ["LLM", "Alpha", "Literature Review", "Backtest", "Reward", "Qlib"]
featured: false
draft: false
```
我们将LLM驱动的Alpha因子挖掘定义为如下的双层优化问题，把握好这个本质就能熟悉理解各个不同trick论文的具体坐标、以及他们是如何围绕这两个核心问题构造算法的。



**总目标**（因子挖掘类论文共享）：

$$
f^* = \arg\max_{f \in \mathcal{F}} \underbrace{L(f(\mathbf{X}), y)}_{\text{预测力}} - \lambda \underbrace{R(f)}_{\text{正则/门控}}
$$

拆为两个可发表子问题：

| 子问题 | 符号 | 工程对应 |
| :--- | :--- | :--- |
| **Q1：Merit** | $\mathcal{M}(f)$ | Reward / Fitness / Gate |
| **Q2：Search** | $\pi$ | MCTS / 进化 / Agent / 梯度 |

**双层优化**（理解 IC–IR 鸿沟）：

$$
\mathcal{F}^* = \arg\max_{\mathcal{F} \subset \mathcal{A}} \mathcal{L}\bigl(g^*(\mathcal{F}), \mathbf{Y}\bigr), \quad \theta_g^* = \arg\max_{\theta_g} \mathcal{L}\bigl(g(\mathcal{F}; \theta_g), \mathbf{Y}\bigr)
$$

外层搜索因子集，内层 LightGBM 学非线性组合，**内外层目标不一致**，故单因子 IC 高不保证组合 IR 高。

---

## 一、全景概览（一句话总结）

| 论文 | 简称 | 流派 | 核心贡献 | 一句话 |
| :--- | :--- | :--- | :--- | :--- |
| **FAMA** (ACL 2024 Findings) | FAMA | A | 上下文示例 + 动态因子组合 | LLM 在 S&P 500 上用 CSS/CoE 挖因子，以 RankIC 与 Sharpe 验收。 |
| **AlphaAgent** (KDD 2025) | AlphaAgent | A | 正则化探索抗 alpha decay | 三 Agent + AST 原创性；强调**逐年 IC 衰减曲线**。 |
| **QuantaAlpha** (2026) | QuantaAlpha | A (+B) | 轨迹级 mutation/crossover | 假设驱动进化 + $R(\tau)$；~150 因子统一 LightGBM 公平对比。 |
| **Hubble** (2026) | Hubble | A | DSL 安全 + 家族多样性 | 仅 L2 因子验收；OOS 195 日 RankIC t-stat。 |
| **FactorEngine** (arXiv 2026) | FE | B | 宏微分离 + 研报先验 | Python 程序进化；四阶段防泄漏；**8 年盲测**。 |
| **CogAlpha** | CogAlpha | B | 代码进化 + MI 非线性 | 五维百分位 gate；5 市场 × 2 horizon 泛化。 |
| **MCTS-Alpha** (Shi 2025, AAAI 2026) | MCTS | B | LLM + MCTS 多维反馈 | 相对百分位 $S(f)$ + FSA；3000 次 LLM vs 600k GP。 |
| **Chain-of-Alpha** | CoA | B | FGC + FOC 分维优化 | 摘要：CSI500 **AR=0.1324, IR=1.4178**（withdrawn arXiv）。 |
| **AlphaForge** (2024) | AF | B | 生成-预测双网络 | 学 $\pi(x)$ 引导采样；滚动 OOS + 约 9 个月实盘。 |
| **TradingAgents** | TA | C | 多 Agent 金融交易 | 单标的择时；CR/Sharpe/MDD；**非因子挖掘**。 |
| **Crypto-Agent** | CA | C (+B) | 协议锁定评估 | Agent 不可改 split/gate；OOS Sharpe 1.55。 |
| **Crypto-GPT** (SSRN) | CG | C (+B) | LLM cutoff OOS | RankIC 符号翻转 L-S；训练截止日严格前向。 |

**跨文献共识（本综述的核心结论）**：

1. **科研问题**：在有限样本与高维搜索空间下，联合设计 **Merit 函数**（什么是好因子）与 **迭代机制**（如何高效找到好因子）。  
2. **实证骨架**：日频面板 $\mathbf{X}^{T \times N \times M}$ → L1 物化因子 → L2 因子层 IC 验收 →（多数）L2.5 LightGBM + Top-$k$ 组合 → Test IR/AER。  
3. **流派三分**：**A 依靠 LLM 进化** / **B 显式搜索 + Reward** / **C 端到端交易目标**——可组合，但主标签唯一。  
4. **关键分野**：搜索 Merit（Train/Valid）≠ 论文主表 Test IR；因子层 IC ≠ 组合层 IR；本文件夹 **0 篇** 标准 CTA 时序期货范式。

---

## 二、研究背景与问题定义

### 2.1 领域演进（文献脉络）

| 阶段 | 代表方法 | 痛点 | LLM 文献的回应 |
| :--- | :--- | :--- | :--- |
| **传统 GP/RL** | GPlearn, DSO, AlphaGen | 搜索效率低（$10^5$–$10^6$ 次）；公式同质化 | MCTS、学习先验、LLM 定向生成 |
| **符号因子库** | Alpha101/158/360 | 人工/规则固化；难适应新市场 | LLM 从 OHLCV **现场**发现新表达式 |
| **纯 LLM Prompt** | CoT, ToT, 直接生成 | 不可执行、语义漂移、alpha decay | Agent 闭环、AST/DSL、正则 $R_g$ |
| **Agent 框架** | RD-Agent, AlphaAgent | 评估不可控、过拟合 Valid | 协议锁定（Crypto-Agent）、四阶段拆分（FE） |

Harvey-Liu-Zhu (2016) 的多重检验警示贯穿全领域：高维搜索后，样本内 IC 的 t 统计量需远高于 2.0；各文以时序切分、LLM 记忆对照、cutoff OOS、FSA/AST 多样性等作**实证层**回应，但不能替代独立 Holdout。

### 2.2 核心科研问题（形式化）

**总目标**（因子挖掘类论文共享）：

$$
f^* = \arg\max_{f \in \mathcal{F}} \underbrace{L(f(\mathbf{X}), y)}_{\text{预测力}} - \lambda \underbrace{R(f)}_{\text{正则/门控}}
$$

拆为两个可发表子问题：

| 子问题 | 符号 | 工程对应 |
| :--- | :--- | :--- |
| **Q1：Merit** | $\mathcal{M}(f)$ | Reward / Fitness / Gate |
| **Q2：Search** | $\pi$ | MCTS / 进化 / Agent / 梯度 |

**双层优化**（理解 IC–IR 鸿沟）：

$$
\mathcal{F}^* = \arg\max_{\mathcal{F} \subset \mathcal{A}} \mathcal{L}\bigl(g^*(\mathcal{F}), \mathbf{Y}\bigr), \quad \theta_g^* = \arg\max_{\theta_g} \mathcal{L}\bigl(g(\mathcal{F}; \theta_g), \mathbf{Y}\bigr)
$$

外层搜索因子集，内层 LightGBM 学非线性组合——**内外层目标不一致**，故单因子 IC 高不保证组合 IR 高。

### 2.3 工程痛点 ↔ 科研映射

| 工程痛点 | 科研表述 | 典型文献 |
| :--- | :--- | :--- |
| GP 百万次才出一个 | Sample efficiency | MCTS-Alpha, AlphaForge |
| LLM 公式跑不通 | Semantic alignment | AlphaAgent, QuantaAlpha |
| Valid IC 高、Test 崩 | Generalization / alpha decay | AlphaAgent ($R_g$), MCTS (五维 $S$) |
| IC 高、赚不到钱 | Portfolio gap | MCTS (Turnover 维), L2.5 验收 |
| API 贵 | Macro-micro decoupling | FactorEngine |
| 因子雷同 | Diversity | FSA, AST, CSS, Hubble 家族惩罚 |
| Agent 改评估规则 | Evaluation protocol integrity | Crypto-Agent |

---

## 三、统一符号定义

| 符号 | 含义 | 备注 |
| :--- | :--- | :--- |
| $T, N_t, M$ | 时间、截面股票数、原始特征维 | $\mathbf{X} \in \mathbb{R}^{T \times N \times M}$ |
| $\tau$ / $L$ | 因子回看窗口 | 时序算子 lookback |
| $y_{i,t}$ | 标签：未来 $H$ 日收益 | QuantaAlpha 用 $P_{t+2}^c/P_{t+1}^c-1$ |
| $f_{i,t}$ | 因子截面分值 | L1 物化输出 |
| $\mathcal{F}_{zoo}$ | 有效因子库 | MCTS, AlphaAgent |
| $\mathcal{A}$ / $\mathcal{P}$ | 公式树 / Python 程序搜索空间 | MCTS vs FE/CogAlpha |
| $\mathcal{M}(f)$ | Merit（Reward/Fitness） | 搜索阶段 |
| L2 / L2.5 / L3 | 因子 IC / 轻组合 IR / Barra 优化 | 见 §五 |

**因子映射（Qlib 系通用）**：

$$
f: \mathbf{X}_{t-\tau+1:t} \mapsto \mathbf{v}_t \in \mathbb{R}^{N_t}
$$

---

## 四、文献分类：三大流派

| 流派 | 迭代机制 | Merit 形态 | 代表文献 |
| :--- | :--- | :--- | :--- |
| **A. 依靠 LLM 进化** | 假设 → 因子 → 回测 → **反馈改假设**；状态在对话与因子库 | $R_g$ gate、score 惩罚、$\gamma(\mathcal{F})$；IC 为反馈 | AlphaAgent, QuantaAlpha, Hubble, FAMA |
| **B. 显式搜索** | MCTS / UCT / GP / FGC-FOC / $G$ 梯度；**Reward 指挥每步** | $S(f)$, FS, 百分位, $P(G(z))$ | MCTS, FE, CogAlpha, CoA, AlphaForge |
| **C. 端到端** | 辩论/仓位/组合规则；**直接优化 PnL/Sharpe** | 交易收益；IC 仅 gate | TradingAgents, Crypto 两篇 |

**边界案例**（读文献时必辨）：

| 论文 | 主标签 | 理由 |
| :--- | :--- | :--- |
| QuantaAlpha | A | 三 Agent + 假设；$R(\tau)$ 为 B 式 Merit |
| FactorEngine | B | UCT+FS 为主；研报为先验 |
| FAMA | A | LLM+CoE；$\gamma(\mathcal{F})$ 为集合 Merit |
| AlphaForge | B | 生成器-预测器是搜索先验学习 |
| Crypto-Agent | C | Sharpe 为终目标；IC t-stat 为 gate |

---

## 五、实证架构：数据、消费层与评估

### 5.1 三层数据（存储职能）

| 层 | 平台路径 | 职能 | 13 篇文献 |
| :--- | :--- | :--- | :--- |
| **D1** | `BackTestData_pq/` | 价量、label、mask、基准 | **全部依赖** |
| **D2** | `FactorRequireDataBase/` | 预计算宽表、Alpha158/360 | **几乎不用**（论文从 OHLCV 内联算） |
| **D3** | `OptimizerDataBase/` | Barra、风险模型 | **完全不用** |

学术原因：LLM 论文需证明「从**最小原始字段**发现 alpha」；若依赖 137GB 预计算宽表，审稿人质疑信息泄露与不可复现。

### 5.2 三层消费（流水线职能）

| 层 | 职能 | 典型指标 | 文献覆盖 |
| :--- | :--- | :--- | :--- |
| **L1 物化** | 公式/code → $f_{i,t}$ | 可执行率 | 12/13（TA 跳过） |
| **L2 回测验收** | 因子 + label → fitness | IC, RankIC, reward | **搜索反馈主战场** |
| **L2.5 轻组合** | LGBM + Top-$k$ + 成本 | AER, IR, MDD | 8/13 报告 Test |
| **L3 组合优化** | Barra + Optimizer | TE、风格中性 | **0/13** |

**读表规则**：论文 Table 上的 IR 默认是 **L2.5**，不是 L3 Optimizer 实盘收益。

### 5.3 双层评估：因子层 vs 组合层

| 评估层 | 经济问题 | 典型指标 | 是否模拟交易 |
| :--- | :--- | :--- | :--- |
| **因子层 L2** | 截面排序能否预测相对收益？ | P1 IC, P2 RankIC, P3/P4 ICIR | 否 |
| **组合层 L2.5** | 按信号建组合能否跑赢基准？ | T3 AER, T4 IR, T7 MDD | 是 |

**IC 标准定义（P1）**：

$$
\text{IC}_t = \frac{\sum_i (f_{i,t}-\bar{f}_t)(r_{i,t+1}-\bar{r}_{t+1})}{\sqrt{\sum_i (f_{i,t}-\bar{f}_t)^2}\sqrt{\sum_i (r_{i,t+1}-\bar{r}_{t+1})^2}}
$$

**IR 标准定义（T4，Qlib）**：

$$
r_t = r_t^{\text{port}} - r_t^{\text{bench}} - \text{cost}_t, \quad \text{IR} = \frac{\mu}{\sigma}\sqrt{252}
$$

**三个「不能等同」**：

1. Merit（搜索）≠ Test IR（验收）  
2. 因子层 IC ≠ 组合层 IC（LightGBM 改变截面）  
3. 样本内 IC ≠ OOS IC（Harvey 多重检验）

### 5.4 组合构建范式（C1–C8）

| 编号 | 名称 | 规则 | 代表论文 |
| :--- | :--- | :--- | :--- |
| **C1** | Top-$k$ Dropout | Top 50 等权；每日最多换 $n$ 只 | CogAlpha, AlphaAgent, QuantaAlpha |
| **C2** | Top 20% 仅做多 | 截面前 20% 等权 | FAMA |
| **C3** | Top 10% + Drop-$n$ | $n=k/w$（$w$=horizon） | MCTS-Alpha |
| **C4** | 5 日滚动 Top 50 | 佣金+印花税+滑点最细 | FactorEngine |
| **C5** | 因子分桶 L-S | Top−Bottom spread；**非可交易** | Hubble |
| **C6** | 单标的 Agent 择时 | Long/Short 单股 | TradingAgents |
| **C7** | Top/Bottom 20% L-S | RankIC 符号翻转 | Crypto-GPT |
| **C8** | 五分组 Quintile L-S | Ridge 合成 → Q4−Q0 | Crypto-Agent |

### 5.5 时序划分对照

| 论文 | Train | Valid | Test | OOS 特点 |
| :--- | :--- | :--- | :--- | :--- |
| MCTS-Alpha | 2011–2020 | — | 2021–2024 | LLM 记忆对照 |
| CogAlpha | 2011–2019 | 2020 | 2021–2024 | 5 市场 |
| AlphaAgent | 2015–2019 | 2020 | 2021–2025 | 逐年 IC 衰减 |
| QuantaAlpha | 2016–2020 | 2021 | 2022–2025 | 966 日 t；成本敏感 |
| FactorEngine | 2008–2012 / 2008–2014 | 2013 / 2015–2016 | **2017–2024 盲测** | 四阶段；研报≤2017 |
| FAMA | 2015–2020 | 2020–2021 | 2021–2022 | 挖掘窗口短 |
| AlphaForge | 滚动 | 逐年 | 2018–2022 OOS | 9 个月实盘 |
| Hubble | 840 日发现 | — | 195 日 OOS | 短 OOS |
| Crypto-Agent | 2020–2022 | 2023 | **2024+** | 协议锁定 |
| Crypto-GPT | 至 2025-12 | — | **2025-09–12** | LLM cutoff |

---

## 六、Merit（Reward / Fitness）设计：文献分水岭

Merit 是**搜索阶段**的指挥棒，几乎均在 Train/Valid 计算；与 Test 主表 IR **相关但非同构**。

### 6.1 两类 Merit 哲学

| 哲学 | 公式要点 | 代表 | 优化导向 |
| :--- | :--- | :--- | :--- |
| **相对百分位** | $e_i=1-R(f,m_i,\mathcal{F}_{zoo})$；$S(f)=\mathrm{mean}(e_i)$ | MCTS-Alpha | **补短板**（Softmax 选最低维） |
| **绝对加权** | $FS=\frac{1}{4}(IC{\times}10+ICIR+RIC{\times}10+RICIR)$ | FactorEngine | **总分最大化** |
| 正则门控   | $L-\lambda R_g$；$ER=\beta_1 S_{AST}+\beta_2 C+\beta_3\log(1+\lvert F_f \rvert)$ | AlphaAgent | 先 gate 再 IC |
| **轨迹 Reward** | $R(\tau)=L(f_\tau)-\lambda R(f_\tau)$ | QuantaAlpha | mutation/crossover 选父代 |
| **百分位 Gate** | 五维 > p65/p80 | CogAlpha | 无单一标量 |
| **学习先验** | $\max P(G(z))$ | AlphaForge | 生成器梯度 |
| **集合效用** | $\gamma(\mathcal{F})$ 单调 | FAMA | 动态组合 |
| **组合 Score** | score − 家族/RAG 惩罚 | Hubble | top-$k$ 迭代 |
| **端到端** | PnL / Sharpe | TradingAgents, Crypto | 直接交易目标 |

### 6.2 Merit 使用链路（文字版）

**步骤 1–2**：LLM/GP/$G(z)$ 生成 → L1 物化。  
**步骤 3**：回测得 IC、换手、corr 等分量。  
**步骤 4**：合成 Merit 或 gate。  
**步骤 5**：更新搜索（$Q$、进化、轨迹、Agent 反馈）。  
**步骤 6**：入库/出库（**常与步骤 4 不同标准**，如 MCTS 用 $S(f)$ 搜、RankIR 出库）。  
**步骤 7**：L2.5 Test → AER/IR/MDD。

### 6.3 Merit 与 Test 关系矩阵

| 关系 | 含义 | 例子 |
| :--- | :--- | :--- |
| **同构** | Merit 分量 = 主表因子指标，不同样本 | FE：FS 在 Valid，Table 在 Test |
| **引导** | Merit ↑ → 更好因子池 → Test IC ↑ | MCTS Table 1 五维消融 |
| **脱钩** | 搜索 Merit ≠ 出库标准 | MCTS：$S(f)$ 搜，RankIR 选 top-$k$ |
| **门控** | 正则只过滤 | AlphaAgent $R_g$ |
| **正交** | Test IR，Merit 无 IR | 几乎全部 Qlib 文 |

---

## 七、逐篇文献评述

### 7.1 流派 B：显式搜索

#### MCTS-Alpha (Shi 等, 2025 → AAAI 2026)

**问题**：GP 需 $\sim 6\times 10^5$ 次尝试；LLM 盲搜效率低；公式同质化。  
**方法**：LLM 生成 + **MCTS**；五维相对百分位 $S(f)$；FSA 黑名单；虚拟扩展。  
**Merit**：Effectiveness=RankIC, Stability=RankIR, Turnover, Diversity, Overfitting(LLM Judge)。  
**实证**：CSI300/1000；Train 2011–2020；C3 Top10%/Drop-$n$；Test IC + IR。  
**主结果**：3000 次 LLM 下有效因子数与 IR 优于 600k GP；Table 1 证五维 $S(f)$ 各维贡献 Test IR。  
**定位**：L2 驱动搜索的典型；与 SchemaEvolve 同层（搜索+L1+L2），机制为 MCTS 非 Bandit。

#### FactorEngine (Lin 等, arXiv 2026)

**问题**：符号因子表达力受限；LLM 逻辑与参数耦合浪费 API。  
**方法**：**宏微分离**——LLM 输出代码 Diff（逻辑）；贝叶斯 EI 调参（本地）；CoE 路径记忆；研报先验。  
**Merit**：FS 绝对加权；$S_{total}=S_{eff}-\gamma S_{cov}$。  
**实证**：四阶段防泄漏；盲测 2017–2024；C4 五滚动 Top50；成本最细（佣金/印花税/滑点）。  
**主结果**：程序级因子 + 8 年 OOS；L2.5 最强，仍无 L3。  
**定位**：B 流派 + 知识注入；最接近「可交易」的 L2.5，但不是 Optimizer。

#### CogAlpha

**问题**：GP 只优化 IC 易过拟合；缺非线性约束。  
**方法**：LLM **代码进化**；五维百分位（含 **MI**）；qualified/elite 分层。  
**Merit**：Rwd-D，无单一 closed-form reward。  
**实证**：CSI300 主实验 + 4 市场；C1 Top50/Drop5；10/30 日 horizon。  
**定位**：B 流派；与 MCTS 共享 Qlib 生态但无树搜索。

#### Chain-of-Alpha

**问题**：MCTS 复杂度高。  
**方法**：FGC 广度 + FOC 按 $S,C,E,D$ 分维补短板。  
**局限**：arXiv withdrawn；本地仅摘要；CSI500 AR=0.1324, IR=1.4178。  
**定位**：B 流派；思想近 MCTS Softmax 选维，无 UCT。

#### AlphaForge (2024)

**问题**：GP 样本效率低。  
**方法**：预测器 $P$ 拟合 $\pi(x)$；生成器 $G$ 最大化 $P(G(z))$；多样性 loss。  
**Merit**：Rwd-C，可学习 fitness。  
**实证**：VWAP 21 日标签；2018–2022 滚动 OOS；约 9 个月实盘。  
**定位**：B 流派；非 LLM 主循环，但同属「搜索先验学习」。

---

### 7.2 流派 A：依靠 LLM 进化

#### AlphaAgent (KDD 2025)

**问题**：GP/RL 过拟合历史；**alpha decay**。  
**方法**：idea / factor / eval 三 Agent；AST + 算子库；$R_g$ 原创性+对齐+复杂度。  
**Merit**：$f^*=\arg\max L-\lambda R_g$；$ER$ 越低越好；**门控**非单一 FS。  
**实证**：CSI500/SP500；5 轮×20 trials；C1 + LightGBM depth=4。  
**主结果**：Fig.4 **逐年 IC/RankIC** 是核心卖点；Table 2 IC/ICIR/AR/IR/MDD。  
**定位**：A 流派标杆；Merit 与 Test 关系：$L$ 展示于 Table，$R_g$ 通过消融 Fig.6 验证。

#### QuantaAlpha (2026)

**问题**：噪声反馈下整段重生成低效；交易约束仅事后过滤。  
**方法**：轨迹 $R(\tau)$；mutation 诊断低 reward 节点；crossover 重组父代；~150 因子统一 LGBM。  
**Merit**：$R(\tau)=L-\lambda R(f)$；复杂度+AST 冗余+一致性 gate。  
**实证**：CSI300/500/SP500；标签 $P_{t+2}^c/P_{t+1}^c-1$；966 日 IC t；跨 seed Table 4–5。  
**定位**：A+B 混合；公平对比 LLM Agent 因子池质量。

#### Hubble (2026)

**问题**：流动性因子垄断 top-$k$；LLM 生成不安全。  
**方法**：DSL + AST 沙箱；score − 家族/RAG 惩罚；每轮 top-5 RAG。  
**Merit**：Rwd-E，tanh 标准化加权 + 惩罚项。  
**实证**：SP500 501 股；840 日发现 + **195 日 OOS**；**仅 L2**（分桶 LS spread，HAC t）。  
**定位**：A 流派；** deliberately 不做 L2.5**——与 MCTS IR **不可直接比**。

#### FAMA (ACL 2024 Findings)

**问题**：LLM few-shot 同质化；单因子好 ≠ 组合好。  
**方法**：CSS 跨样本选择；CoE；动态 $\gamma(\mathcal{F})$ 单调；RankIC 加权组合。  
**Merit**：Rwd-G，集合效用。  
**实证**：SP500；C2 Top20%；RankIC/RankICIR + SR/AR/Vol。  
**定位**：A 流派；偏 L2 RankIC，L2.5 较简。

---

### 7.3 流派 C：端到端

#### TradingAgents

**问题**：多模态金融决策。  
**方法**：分析师/研究员/交易员多 Agent 辩论 → 单股仓位。  
**Merit**：日频 PnL；**非因子挖掘**。  
**实证**：AAPL 等单标的；2024 Q1；CR/Sharpe/MDD vs B&H 与规则策略。  
**定位**：C 流派；无 L1 因子物化；与截面因子文献**范式正交**。

#### Crypto-Agent

**问题**：Agent 可改评估规则 → 虚假强结果。  
**方法**：**推理与评估分离**；固定 split/gate/cost；Ridge 合成 → L-S。  
**Merit**：训练期 IC + **IC t-stat gate**；组合 Sharpe。  
**实证**：Train 20–22 / OOS 24+；C8 五分组；OOS Sharpe 1.55。  
**定位**：C 流派；**评估协议锁定** ≈ 平台化 L2 规范，对 Agent 研究有方法论贡献。

#### Crypto-GPT (SSRN)

**问题**：LLM 知识截止与 OOS。  
**方法**：GPT 生成因子；RankIC 筛选；60 日滚动符号翻转 L/S。  
**Merit**：RankIC；**R4 LLM cutoff OOS**（2025-09–12）。  
**实证**：BitMEX 永续；C7 Top/Bottom 20%。  
**定位**：C 流派；leakage 测试设计值得 A 股文献借鉴。

---

## 八、横向对比与文献矩阵

### 8.1 流派 × 消费层

| 论文 | 流派 | L1 | L2 | L2.5 | L3 | 搜索反馈 |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| MCTS-Alpha | B | ✓ | ✓** | ✓ | ✗ | $S(f)$→MCTS |
| FactorEngine | B | ✓ | ✓ | ✓** | ✗ | FS→UCT |
| CogAlpha | B | ✓ | ✓ | ✓ | ✗ | 百分位→进化 |
| AlphaForge | B | ✓ | ✓ | ✓ | ✗ | $P(G(z))$ |
| Chain-of-Alpha | B | ✓ | ✓ | △ | ✗ | FOC 分维 |
| AlphaAgent | A | ✓ | ✓ | ✓ | ✗ | $R_g$+反馈 |
| QuantaAlpha | A | ✓ | ✓ | ✓ | ✗ | $R(\tau)$ |
| Hubble | A | ✓ | ✓** | ✗ | ✗ | score |
| FAMA | A | ✓ | ✓ | ✓ | ✗ | $\gamma(\mathcal{F})$ |
| TradingAgents | C | — | △ | △ | ✗ | PnL |
| Crypto-Agent | C | ✓ | ✓ | ✓ | ✗ | IC gate→Sharpe |
| Crypto-GPT | C | ✓ | ✓ | ✓ | ✗ | RankIC→Sharpe |

（✓** = 该层为论文核心或最强贡献）

### 8.2 实证设定总表

| 论文 | 平台 | Universe | 标签 $H$ | 组合 | Test 因子层 | Test 组合层 | Merit |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| FAMA | 自建 | SP500 | 短期 | C2 | P2,P4 | T2,T5,T6 | Rwd-G |
| AlphaAgent | Qlib | CSI500,SP500 | 多 | C1 | P1–P3,R3 | T3,T4,T7 | Rwd-H |
| QuantaAlpha | Qlib | CSI300/500,SP500 | 1日特殊 | C1 | P1–P4 | T3,T4,T7 | $R(\tau)$ |
| FactorEngine | 自建 | 全市场→CSI | 可配置 | C4 | P1–P4 | T2–T5,T7,T8 | Rwd-B |
| Hubble | DSL | SP500 | forward | C5 | P1,P2,T9,R1 | 无 | Rwd-E |
| CogAlpha | Qlib | 5市场 | 10/30日 | C1 | P1–P5 | T3,T4 | Rwd-D |
| MCTS-Alpha | Qlib | CSI300/1000 | 10/30日 | C3 | P1,P2,P4 | T3,T4 | Rwd-A |
| AlphaForge | Qlib | CSI300/500 | ~21 VWAP | Qlib | IC | 实盘 | Rwd-C |
| TradingAgents | 多源 | 单股 | 1日 | C6 | — | T1,T5,T7 | Rwd-I |
| Crypto-Agent | 锁定 | CMC | 日频 | C8 | P1,P6 | T5,T7,T13 | Rwd-J |
| Crypto-GPT | SSRN | BitMEX | 日频 | C7 | P2,P3 | T5,P7,R4 | RankIC |

### 8.3 搜索效率（统一标尺）

| 方法类 | search count | 代表 |
| :--- | :--- | :--- |
| LLM 系 | 1k / 2k / **3k** | MCTS, FAMA, CoT |
| GP / RL / DSO | 至 **600k** | GP, AlphaGen |

**文献结论**：引导式搜索（MCTS + 回测反馈）在**远低调用量**下可达更高 Test IR——这是 B 流派相对 brute-force GP 的核心论据。

### 8.4 与 CTA 的分野（本文件夹 0/13）

| 维度 | 本综述文献 | CTA / 管理期货 |
| :--- | :--- | :--- |
| 数据 | $\mathbf{X}^{T \times N \times M}$，$N \gg 1$ | $\mathbf{X}^{T \times M}$，单/少品种 |
| 问题 | 截面：谁更强？ | 时序：涨还是跌？ |
| 主指标 | IC / RankIC | Sharpe / Calmar |
| 做空 | 多数 long-only | 天然双向 |

Crypto L-S 论文在**组合构建**上接近期货多空，但数据仍为**加密截面**，非标准 CTA。

---

## 九、防泄漏与过拟合：文献级机制

| 机制 | 原理 | 论文 |
| :--- | :--- | :--- |
| 严格时序切分 | Test 不参与挖因子 | 全部 |
| 四阶段拆分 | 挖矿/评估 Train-Valid-Test 分离 | FactorEngine |
| 相对百分位 | 动态 IC 门槛 | MCTS-Alpha |
| LLM 记忆对照 | Prompt 高性能因子 ≈ 随机 | MCTS Table 5 |
| LLM cutoff OOS | 知识截止日期 | Crypto-GPT |
| 协议锁定 | Agent 不可改规则 | Crypto-Agent |
| 研报时间戳 | 仅 2017 前研报 | FactorEngine |
| 进化百分位 | p65/p80 | CogAlpha |
| FSA / AST | 防公式同质化 | MCTS, AlphaAgent |
| DSL 沙箱 | 安全可执行 | Hubble, CogAlpha |
| 逐年 IC (R3) | alpha 衰减曲线 | AlphaAgent, QuantaAlpha, FE, MCTS |

---

## 十、研究缺口与未来方向

### 10.1 文献已覆盖

- 从 OHLCV 自动发现公式/程序因子（L1+L2）  
- LLM 作为**推理引擎**（均不微调）+ 搜索/进化/Agen t 闭环  
- Qlib 系 L2.5 组合验收（Top-$k$ + LightGBM）  
- 多样性、防泄漏、alpha decay 的**实证层**机制  

### 10.2 文献空白（Research Gaps）

| 缺口 | 说明 | 可能方向 |
| :--- | :--- | :--- |
| **L3 组合优化** | 0/13 使用 Barra/Optimizer | Merit 能否 cheap 近似 TE/IR？ |
| **D2 生产级特征** | 论文刻意不用宽表 | 搜索 vs 生产的样本效率权衡 |
| **Merit–Test 理论** | 多为消融，缺统一理论 | Valid Merit 与 Test IR 的泛化界 |
| **成本–IC 联合优化** | Turnover 维仅 MCTS/CoA | 直接以 IR 作搜索目标的可行性 |
| **跨市场迁移** | CogAlpha 5 市场；多数单市场 | 因子公式跨 universe 稳定性 |
| **LLM 微调** | 全部 API 推理 | 领域微调 vs 过拟合风险 |
| **另类数据** | TA 多模态；因子文少 | 新闻/链上与 OHLCV 联合搜索 |
| **Agent 评估规范** | Crypto-Agent 起步 | 行业评估协议标准（cf. ML reproducibility） |
| **Chain-of-Alpha 等** | withdrawn / 摘要不全 | 完整协议待公开 |

### 10.3 对平台与复现的建议

1. **读 IR**：默认 L2.5，非 L3；与 Optimizer 实盘不可直接比。  
2. **复现论文**：D1 级 Qlib 数据即可；不必先导入 D2 宽表。  
3. **上线链路**：搜索方法（SchemaEvolve/论文）→ Top 因子 → FactorRequire（D2）→ Optimizer（D3）。  
4. **Hubble 特例**：仅 L2，与 MCTS IR 不可比。  
5. **QuantaAlpha 标签**：$P_{t+2}^c/P_{t+1}^c-1$ 非标准 next-day，复现须对齐。

---

## 十一、训练本质：LLM 在文献中的角色

| 维度 | 流派 A、B | AlphaForge | 流派 C |
| :--- | :--- | :--- | :--- |
| LLM 微调 | **否** | **否**（训 $P,G$ 小网） | 部分 API |
| 被优化对象 | $Q/N$、因子库、轨迹 | $P$, $G$ | 策略/规则 |
| 环境反馈 | 回测→Merit | 回测→$\pi(x)$ | PnL |
| 先验 | 预训练+Prompt/研报/RAG | 历史因子+GP | 市场+新闻 |

**共性**：LLM 是**推理引擎**；Merit + 搜索状态是迭代载体。

---

## 十二、终极总结

### 12.1 领域一句话

> LLM 驱动 Alpha 因子挖掘 = 在 **D1 价量面板**上，通过 **A/B/C 三类迭代机制**，用 **Merit 函数**指引搜索，在 **L2 因子层**验收预测力，多数在 **L2.5 轻组合层**报告 Test IR——**不涉及 L3 Barra 优化**。

### 12.2 读文献四问

1. **流派**：A LLM 进化 / B 显式搜索 / C 端到端？  
2. **Merit**：相对/绝对？gate 还是优化目标？  
3. **消费层**：主表是 L2 IC 还是 L2.5 IR？  
4. **OOS**：Test 几年？是否有 R3/cutoff/协议锁定？


## 附录 A：指标编号索引（P/T/R/C）

| 编号 | 指标 | 类别 |
| :--- | :--- | :--- |
| P1–P5 | IC, RankIC, ICIR, RankICIR, MI | 预测/稳健 |
| P6–P7 | IC t-stat, Alpha | 加密扩展 |
| T1–T13 | CR, AR, AER, IR, SR, Vol, MDD, RMDD, LS, Bucket, Turnover, Coverage, Calmar | 交易绩效 |
| R1–R4 | HAC t, Overfitting, 逐年 IC, LLM cutoff OOS | 稳健/衰减 |
| C1–C8 | Top-k Dropout … Quintile L-S | 组合范式 |
| Rwd-A–J | 见 [Reward与Fitness方法论对比](./Reward与Fitness方法论对比.md) | 搜索 Merit |

## 附录 B：本地文献文件

| 简称 | 本地文件 |
| :--- | :--- |
| FAMA | `2024.findings-acl.233.pdf` |
| TradingAgents | `2412.20138v7.pdf` |
| AlphaAgent | `2502.16789v2.pdf` |
| QuantaAlpha | `2602.07085v3.pdf` |
| FactorEngine | `2603.16365v2.pdf` |
| Hubble | `2604.09601v2.pdf` |
| CogAlpha | `4492_Cognitive_Alpha_Mining_vi.pdf` |
| MCTS-Alpha | `Shi 等 - 2025 - Navigating the Alpha Jungle...pdf` |
| Chain-of-Alpha | `Chain-of-Alpha_...alphaXiv.pdf` |
| AlphaForge | `论文/` 目录 |
| Crypto-Agent | `论文/2604.26747v1.pdf` |
| Crypto-GPT | `论文/ssrn-6461691.pdf` |

## 附录 C：相关文档

| 文件 | 内容 |
| :--- | :--- |
| [股票回测与评估方法统一指南.md](./股票回测与评估方法统一指南.md) | 数据、回测、C1–C8、CTA 对照 |
| [Reward与Fitness方法论对比.md](./Reward与Fitness方法论对比.md) | 三流派、Merit 公式、主图索引 |
| [三层数据与三层消费：论文与平台定位图.md](./三层数据与三层消费：论文与平台定位图.md) | D1–D3、L1–L3、SchemaEvolve |
| [实证评估方法论对比分析.md](./实证评估方法论对比分析.md) | P/T/R 公式、逐篇指标表 |
| [论文/实证评估方法论对比分析.md](./论文/实证评估方法论对比分析.md) | Crypto C7/C8、P6/T13/R4 |
| [Alpha-Jungle-学习笔记/](./Alpha-Jungle-学习笔记/) | MCTS-Alpha 算法深挖 |

