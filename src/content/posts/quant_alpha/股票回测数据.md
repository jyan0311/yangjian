---
title: "量化交易｜LLM驱动因子挖掘的实证统一框架：数据张量、回测协议与双层评估体系"
description: "系统梳理论文阅读文件夹内 13 篇 LLM 驱动因子挖掘论文的数据结构、回测协议、评估指标与测试设计，并对照 CTA 管理期货回测范式，为截面量化实证研究提供统一参照框架。"
date: "2026-06-21"
tags: ["LLM", "Alpha", "Backtest", "Qlib", "Cross-Section", "CTA"]
featured: false
draft: false
---



# 量化交易｜LLM驱动因子挖掘的实证统一框架：数据张量、回测协议与双层评估体系

> **整理日期**：2026-06-18  
> **覆盖范围**：`论文阅读/` 主目录 11 篇（A 股/美股）+ `论文/` 子目录 2 篇（加密）  
> **文档性质**：面向截面量化实证初学者的**方法论综述**；指标公式编号 P1–T12、组合范式 C1–C8 详见 [实证评估方法论对比分析.md](./实证评估方法论对比分析.md)  
> **阅读定位**：本文不重复各论文的算法细节，而聚焦于**实证层共性**——数据张量如何定义、回测协议如何执行、最终测试从哪些角度验收。

---

## 一、全景概览（一句话总结）

| 论文 | 简称 | 核心实证范式 | 一句话 |
| :--- | :--- | :--- | :--- |
| **FAMA** (ACL 2024 Findings) | FAMA | 截面因子 + Top 20% 仅做多 | S&P 500 上 LLM 上下文示例驱动因子生成，以 RankIC/RankICIR 与 Sharpe 验收。 |
| **AlphaAgent** (KDD 2025) | AlphaAgent | Qlib Top50/Drop5 + LightGBM | 正则化 LLM 探索防 alpha 衰减，强调**逐年 IC 衰减曲线**。 |
| **QuantaAlpha** | QuantaAlpha | Qlib 进化 + 统一 LightGBM 下游 | 966 日 IC t 检验、成本敏感性；标签采用 $t+2$ close / $t+1$ close 特殊定义。 |
| **FactorEngine** (arXiv 2026) | FactorEngine | 四阶段防泄漏 + 5 日滚动 Top50 | 程序级因子 + 最细成本模型（佣金/印花税/滑点）；8 年盲测 2017–2024。 |
| **Hubble** | Hubble | 单因子截面统计（非完整组合回测） | DSL 约束生成；以 IC、分桶收益、L-S spread + HAC t-stat 为主。 |
| **CogAlpha** | CogAlpha | Qlib 代码进化 + Top50/Drop5 | 五维百分位门控（含 MI）；跨 CSI300/500、S&P500、HSI、HSCI 验证。 |
| **Chain-of-Alpha** | CoA | Qlib（摘要） | FOC 定向优化；CSI500 AR=0.1324、IR=1.4178（完整协议见原文）。 |
| **MCTS-Alpha** (Shi 等, 2025) | MCTS | MCTS 多维回测反馈 + Top10%/Drop-$n$ | 相对百分位评分 + FSA；search count 3000 vs GP 600000 效率对比。 |
| **AlphaForge** (2024) | AlphaForge | 生成-预测双网络 + 滚动 OOS | VWAP 21 日标签；2018–2022 逐年重训 + 约 9 个月实盘跟踪。 |
| **TradingAgents** | TA | 单标的 Agent 择时（非截面因子） | 多模态输入；CR/Sharpe/MDD；可 Long/Short 单股。 |
| **Crypto-Agent** | CA | 加密截面 + 五分组 L-S | **评估协议锁定**，Agent 不可改规则；Train 20–22 / OOS 24+。 |
| **Crypto-GPT** (SSRN) | CG | BitMEX 永续 + Top/Bottom 20% L-S | **LLM 训练截止日 OOS**（2025-09–12）；RankIC 符号翻转机制。 |

**跨论文共性结论**：13 篇工作共享同一**实证骨架**——日频面板 $\mathbf{X} \in \mathbb{R}^{T \times N \times M}$ → 因子映射 $f$ → 截面预测评估（IC 族）→ 组合模拟（Top-$k$ 为主）→ 风险调整绩效（IR/Sharpe/MDD）。分歧集中在**标签 horizon、组合范式、成本假设、OOS 切分粒度**四类协议参数。

---

## 二、统一符号定义

| 符号 | 含义 | 备注 |
| :--- | :--- | :--- |
| $T$ | 交易日总数 | 时间维；所有论文均**按时间顺序**切分，禁止 shuffle |
| $N_t$ | 第 $t$ 日可交易股票数 | 截面维；指数成分动态调整（新股/退市） |
| $M$ | 原始特征字段数 | 通常 $M=5$（OHLCV）或 $M=6$（+VWAP） |
| $\tau$ / $L$ | 因子计算回看窗口 | 时序算子（Ma, Std, Pct 等）的 lookback |
| $\mathbf{X}_{t-\tau+1:t}$ | 历史特征张量切片 | 因子输入 |
| $y_{i,t}$ | 股票 $i$ 在 $t$ 日的预测标签 | 未来 $H$ 日 forward return |
| $f_{i,t}$ | 因子在 $(i,t)$ 的截面分值 | Alpha 输出 |
| $\mathcal{F}_{zoo}$ | 有效因子库 | MCTS-Alpha 等动态入库集合 |
| $\mathcal{A}$ / $\mathcal{P}$ | 搜索空间 | 公式树（MCTS）或 Python 程序（FactorEngine/CogAlpha） |
| $g(\cdot;\theta_g)$ | 组合/预测模型 | LightGBM、MLP、Ridge 等 |
| $H$ | 预测 horizon（持有期对齐） | 10 日 / 30 日 / 1 日（QuantaAlpha 特殊） |

**因子形式化定义（Qlib 系通用）**：

$$
f: \mathbf{X}_{t-\tau+1:t} \mapsto \mathbf{v}_t \in \mathbb{R}^{N_t}, \quad v_{i,t} = f_i(\mathbf{X}_{t-\tau+1:t})
$$

**双层优化问题（MCTS-Alpha / AlphaForge 等）**：

$$
\mathcal{F}^* = \arg\max_{\mathcal{F} \subset \mathcal{A}} \mathcal{L}\bigl(g^*(\mathcal{F}), \mathbf{Y}\bigr), \quad \theta_g^*(\mathcal{F}) = \arg\max_{\theta_g} \mathcal{L}\bigl(g(\{v_{k,t}\}_{k=1}^K; \theta_g), \mathbf{Y}\bigr)
$$

外层搜索因子集合 $\mathcal{F}$，内层学习组合权重或非线性映射——这是理解「因子 IC 高但组合 IR 低」的数学根源：**内外层目标函数不一致**。

---

## 三、数据层：字段、维度与样本设计

### 3.1 面板数据结构

实证层数据可统一表示为三维张量：

$$
\mathbf{X} \in \mathbb{R}^{T \times N \times M}, \quad X_{t,i,m} = \text{股票 } i \text{ 在 } t \text{ 日的第 } m \text{ 个字段}
$$

| 字段类别 | 典型变量 | $M$ 维构成 | 使用论文 |
| :--- | :--- | :--- | :--- |
| **价量核心** | open, high, low, close, volume | $M=5$ | CogAlpha, AlphaAgent, QuantaAlpha |
| **价量扩展** | + vwap | $M=6$ | MCTS-Alpha, AlphaForge |
| **截面属性** | 市值、行业、流动性 | 额外列或过滤条件 | FactorEngine, Hubble |
| **另类数据** | 新闻、社媒、财报、链上 | 高维非结构化 | TradingAgents, Crypto 两篇 |
| **衍生算子空间** | Ma, Std, Pct, Zscore, Corr 等 30+ | 表达式树内部节点 | 全部公式/程序型论文 |

**标签 $\mathbf{Y}$ 的标准形式**：

$$
y_{i,t} = \frac{P_{i,t+H}}{P_{i,t}} - 1 \quad \text{或 close-to-close / VWAP 变体}
$$

| 论文 | 标签 $H$ | 价格基准 | 特殊说明 |
| :--- | :--- | :--- | :--- |
| MCTS-Alpha | 10 / 30 日 | close | 组合 $n = k/w$ 与 horizon 对齐 |
| CogAlpha | 10 / 30 日 | Qlib 标准 | 滚动训练 step=126 |
| QuantaAlpha | **1 日** | $P_{t+2}^{c}/P_{t+1}^{c}-1$ | 非标准 horizon，复现时须对齐 |
| AlphaForge | ~21 日 | VWAP | Ref(VWAP,-21)/Ref(VWAP,-1)-1 |
| AlphaAgent | 多 horizon | close | 4 基础 alpha + 新因子 → LightGBM |
| FactorEngine | 可配置 | close | 全市场挖、指数成分评 |
| FAMA | 短期 | close | 挖掘窗口 2020/06–2021/01 |
| Hubble | forward $h$ | close | S&P 501 股；840 日发现 + 195 日 OOS |
| Chain-of-Alpha | 推断 10 日 | — | 摘要信息不完整 |
| Crypto-Agent | 日频 forward | CoinMarketCap | 过滤上市 <180 日、低流动性 |
| Crypto-GPT | 日频 forward | 现货（信号源自永续） | 规避合约杠杆噪声 |

### 3.2 股票池（Universe）与平台

| Universe | 经济含义 | 典型 $N$ | 论文 |
| :--- | :--- | :--- | :--- |
| **CSI 300** | 大盘蓝筹 | ~300 | MCTS, CogAlpha, QuantaAlpha, AlphaForge, FactorEngine |
| **CSI 500** | 中盘 | ~500 | AlphaAgent, QuantaAlpha, Chain-of-Alpha, FactorEngine |
| **CSI 1000** | 小中盘 | ~1000 | MCTS-Alpha, Chain-of-Alpha |
| **S&P 500** | 美股大盘 | ~500 | FAMA, AlphaAgent, CogAlpha, Hubble, MCTS 扩展实验 |
| **全 A 股** | 最广截面 | ~4000+ | FactorEngine 挖掘阶段 |
| **Alpha158 / Alpha360** | Qlib 内置因子库 | 158 / 360 | 作 baseline，非原始 $M$ 维 |

**数据平台**：Qlib 系论文（MCTS, CogAlpha, AlphaAgent, QuantaAlpha, AlphaForge）共享 **Microsoft Qlib** 回测引擎，保证协议可复现；FactorEngine、FAMA、Hubble 部分自建 pipeline。

### 3.3 时序划分：Train / Valid / Test 的系统对比

**原则（Harvey-Liu-Zhu 框架）**：因子挖掘属于高维搜索，**样本内过拟合风险极高**；严格 chronological split 是最低要求，FactorEngine 等进一步采用**四阶段防泄漏**。

| 论文 | Train（挖因子/训模型） | Valid（调参/门控） | Test（最终报告） | OOS 设计特点 |
| :--- | :--- | :--- | :--- | :--- |
| **MCTS-Alpha** | 2011–2020 | — | 2021–2024/11 | LLM 记忆对照实验 |
| **CogAlpha** | 2011–2019 | 2020 | 2021–2024/12 | 5 市场 × 2 horizon |
| **AlphaAgent** | 2015–2019 | 2020 | 2021–2025/01 | **逐年 IC 衰减** |
| **QuantaAlpha** | 2016–2020 | 2021 | 2022–2025/12 | 966 日 t 检验；成本 1.5×/2× |
| **FactorEngine** | 挖矿 2008–2012；评估训 2008–2014 | 2013；2015–2016 | **盲测 2017–2024** | 研报仅用 2017 前；8 年 OOS |
| **FAMA** | 2015–2020 | 2020–2021 | 2021–2022 | 挖掘仅 2020/06–2021/01 |
| **AlphaForge** | 滚动：测试前一年 valid | 逐年 | 2018–2022 逐年 OOS | 实盘 9 个月跟踪 |
| **Hubble** | 发现 2022–2025/05 | — | OOS 2025/06–2026/03 | 短 OOS（195 日） |
| **Crypto-Agent** | 2020–2022 | 2023 | **2024+ 纯 OOS** | 协议锁定，Agent 不可改 |
| **Crypto-GPT** | 全样本至 2025-12 | — | **2025-09–12**（LLM cutoff） | 训练截止日 OOS |

---

## 四、双层评估架构：因子层 vs 组合层

这是读懂全部论文表格的**概念分水岭**。两层回答不同经济问题，**不可混读**。

| 评估层 | 经济问题 | 计算对象 | 是否模拟交易 | 典型指标 |
| :--- | :--- | :--- | :--- | :--- |
| **因子层（Factor-level）** | 截面排序能否预测未来相对收益？ | 每日 $\text{Corr}_\text{cross-section}(f_t, r_{t+1})$ | 否 | P1 IC, P2 RankIC, P3/P4 ICIR |
| **组合层（Portfolio-level）** | 按信号建组合能否经风险调整后跑赢基准？ | 每日组合超额收益 $r_t^{\text{excess}}$ | 是 | T3 AER, T4 IR, T5 SR, T7 MDD |

**因子层——截面 IC 的标准定义（P1）**：

$$
\text{IC}_t = \frac{\sum_i (f_{i,t}-\bar{f}_t)(r_{i,t+1}-\bar{r}_{t+1})}{\sqrt{\sum_i (f_{i,t}-\bar{f}_t)^2}\sqrt{\sum_i (r_{i,t+1}-\bar{r}_{t+1})^2}}, \quad \text{IC} = \frac{1}{T}\sum_t \text{IC}_t
$$

**因子层——RankIC（P2，Spearman 秩相关）**：

$$
\text{RankIC}_t = \text{Corr}\bigl(\text{rank}(\mathbf{f}_t), \text{rank}(\mathbf{r}_{t+1})\bigr)
$$

**组合层——信息比率 IR（T4，Qlib 标准）**：

$$
r_t = r_t^{\text{port}} - r_t^{\text{bench}} - \text{cost}_t, \quad \text{IR} = \frac{\mu}{\sigma}\sqrt{252}, \quad \mu = \frac{1}{T}\sum_t r_t
$$

**关键学术洞见**：

1. **IC 高 $\nRightarrow$ IR 高**：高 IC 因子可能高换手（T11），交易成本侵蚀 AER；MCTS-Alpha 显式将 Turnover 纳入 MCTS 评分维，Turnover 反馈略降 IC 但提升 IR。
2. **因子层 IC 高 $\nRightarrow$ 组合层 IC 高**：LightGBM 非线性组合改变预测截面，Test 段应分别报告「因子 IC」与「模型 IC」。
3. **样本内 IC 高 $\nRightarrow$ OOS 有效**：Harvey et al. (2016) 多重检验问题；论文通过 R3 逐年 IC、短 OOS 窗口、LLM 记忆对照等缓解。

---

## 五、回测引擎与组合构建范式

### 5.1 标准四阶段流水线

```
阶段 1  In-Sample 因子挖掘  →  Train 段计算 f_{i,t}，单因子/多维门控，入库 F_zoo
阶段 2  组合模型训练        →  Train(+Valid) 上 LightGBM/MLP，截面 Rank/Z-score 预处理
阶段 3  Test 模拟交易       →  Top-k 组合 + 成本 + 基准超额 → AER/IR/MDD
阶段 4  稳健性验收（并行）  →  逐年 IC、alpha 数量敏感性、LLM 骨干、成本敏感性
```

### 5.2 组合构建范式索引（C1–C8）

| 编号 | 名称 | 构建规则 | 成本/成交 | 代表论文 |
| :--- | :--- | :--- | :--- | :--- |
| **C1** | Top-$k$ Dropout | 持有预测 Top $k$ 等权；每日最多换 $n$ 只 | Qlib 标准；开 0.05%/平 0.15% | CogAlpha, AlphaAgent, QuantaAlpha |
| **C2** | Top 20% 仅做多 | 截面前 20% 等权；日频全换 | FAMA RankIC 加权多因子 | FAMA |
| **C3** | Top 10% + Drop-$n$ | $k = \lfloor 0.1 \times N \rfloor$；$n = k/w$（$w$=horizon） | 单边 0.15%；close 成交 | MCTS-Alpha |
| **C4** | 5 日滚动持有 | 5 子组合错开；每日平到期 + 买 Top 50 | 佣金+印花税+滑点最细 | FactorEngine |
| **C5** | 因子分桶 L-S spread | 截面分位数 bucket；Top−Bottom 收益差 | **非可交易组合**；无完整成本 | Hubble |
| **C6** | 单标的 Agent 择时 | 单股 buy/sell/hold；可 Long/Short | ~0.015 | TradingAgents |
| **C7** | Top/Bottom 20% L-S | 买 Top 20%、卖 Bottom 20%；RankIC 符号翻转 | 单边 0.05% | Crypto-GPT |
| **C8** | 五分组 Quintile L-S | Ridge 合成 → Q4−Q0 等权 L-S | 单边 5bp（主） | Crypto-Agent |

**C1 协议细节（Qlib 生态最常用）**：

- **持仓**：Top $k$（如 $k=50$）等权 long-only
- **换仓**：Top-$k$ Dropout——每日最多剔除/替换 $n$ 只（如 $n=5$），控制换手
- **基准**：CSI 300/500 或 S&P 500 指数；报告**超额**收益
- **涨跌停**：QuantaAlpha 设 9.5% 阈值；A 股实务约束

**C3 协议细节（MCTS-Alpha）**：

- CSI300：$k=30$（10%）；CSI1000：$k=100$
- $n = k/w$：10 日 horizon → $n=3$，使理论完整换手周期与预测 horizon 对齐
- 保守单边成本 0.15%

### 5.3 下游预测模型（阶段 2）

| 模型 | 典型超参 | 训练策略 | 论文 |
| :--- | :--- | :--- | :--- |
| **LightGBM** | 32 leaves, 200 trees, depth 8, lr 0.05, L1/L2=0.1 | MCTS：全 Train 无 early stop；AlphaAgent：depth=4 + 截面 Z-score | MCTS, CogAlpha, AlphaAgent, QuantaAlpha |
| **MLP** | 256-128-64, dropout 0.3, Adam lr 0.001 | Valid=Train 最后一年 early stop patience=5 | MCTS-Alpha |
| **Ridge** | 正则化合成 | Crypto-Agent 五分组前合成 | Crypto-Agent |
| **RankIC 加权** | $w_i \propto \text{RankIC}_{\text{past},i}$ | 2020/06–2021/01 估计权重 | FAMA |

**输入预处理共性**：因子值与标签在训练前做**截面 rank 标准化**（CSRankNorm），抑制极端值对 IC 与梯度的影响——QuantaAlpha 对此有显式说明。

---

## 六、评估指标体系：学术定义与论文用法

### 6.1 预测能力指标（因子层）

| 编号 | 指标 | 定义要点 | 使用广度 |
| :--- | :--- | :--- | :--- |
| **P1** | IC | 截面 Pearson 相关；$\text{IC}>0.02$ 常作「有效」启发阈值 | 8/9 篇主目录 |
| **P2** | RankIC | 截面 Spearman；对异常值鲁棒 | 几乎全部 |
| **P3** | ICIR | $\mathbb{E}[\text{IC}_t]/\text{Std}[\text{IC}_t]$；时序稳定性 | AlphaAgent, QuantaAlpha, CogAlpha |
| **P4** | RankICIR / RankIR | RankIC 的 IR；MCTS 用作 Stability 维 | MCTS, FAMA, FactorEngine |
| **P5** | MI | 非线性依赖；CogAlpha 进化 65th/80th 百分位门控 | CogAlpha |
| **P6** | IC t-stat | mean IC 的显著性；Crypto-Agent 训练期门控 | Crypto-Agent |
| **T11** | Turnover | 日换手；MCTS 评分维；Chain-of-Alpha 作 Efficiency 倒数 | MCTS, CoA, Crypto |

### 6.2 交易绩效指标（组合层）

| 编号 | 指标 | 定义要点 | 注意事项 |
| :--- | :--- | :--- | :--- |
| **T2** | AR | 年化**绝对**收益 | FAMA, FactorEngine；未必扣基准 |
| **T3** | AER / ARR | 年化**超额**；算术 vs 几何定义不同 | 跨论文对比须核对公式变体 |
| **T4** | IR | 超额/波动 × $\sqrt{252}$ | MCTS 变体：IR = AER / ($\sigma(R_p)\sqrt{P}$) |
| **T5** | SR / Sharpe | $(\bar{R}-R_f)/\sigma$；FAMA 年化 $\sqrt{252}$ | TradingAgents, FAMA |
| **T7** | MDD | 净值峰谷最大回撤 | 几乎全部组合层论文 |
| **T8** | RMDD | 相对基准净值回撤 | FactorEngine |
| **T9** | LS Ret. | 分桶 Top−Bottom spread | Hubble（因子层，非组合） |
| **T13** | Calmar | 年化收益 / \|MDD\| | Crypto-Agent |

### 6.3 稳健性 / 衰减指标

| 编号 | 指标 | 含义 | 论文 |
| :--- | :--- | :--- | :--- |
| **R1** | HAC t-stat | Newey-West 型；IC/LS 均值显著性 | Hubble |
| **R2** | Overfitting Risk | LLM-as-a-Judge 定性评分 | MCTS-Alpha |
| **R3** | 逐年 IC / RankIC | Alpha 衰减曲线 | AlphaAgent, QuantaAlpha, FactorEngine, MCTS |
| **R4** | LLM cutoff OOS | 模型训练截止日后的严格前向窗口 | Crypto-GPT |

### 6.4 「好因子」的两种评分哲学（深挖）

**相对百分位（MCTS-Alpha）**——标准随 $\mathcal{F}_{zoo}$ 动态升高：

$$
R(f, m, \mathcal{F}_{zoo}) = \frac{1}{|\mathcal{F}_{zoo}|} \sum_{f' \in \mathcal{F}_{zoo}} \mathbb{I}\bigl(m(f) < m(f')\bigr), \quad e_i(f) = 1 - R(f, m_i, \mathcal{F}_{zoo})
$$

五维（Effectiveness=RankIC, Stability=RankIR, Turnover, Diversity, Overfitting Risk）平均得 $S(f)$；入库硬约束 RankIC $\ge 0.015$、RankIR $\ge 0.3$、Turnover $\le 1.6$、max corr $< 0.8$。

**绝对加权适应度（FactorEngine）**——固定统计量最大化：

$$
FS = \frac{1}{4}\bigl(\text{IC} \times 10 + \text{ICIR} + \text{RIC} \times 10 + \text{RICIR}\bigr)
$$

| 对比维 | 相对百分位（MCTS） | 绝对适应度（FactorEngine） |
| :--- | :--- | :--- |
| 评分基准 | 在 $\mathcal{F}_{zoo}$ 中排位 | 固定 IC/ICIR 加权 |
| 标准演化 | 动态水涨船高 | 固定目标 |
| 过拟合控制 | LLM Judge + FSA 结构黑名单 | 四阶段时序拆分 + 8 年盲测 |
| 优化导向 | **补短板**（Softmax 选最低维） | **总分最大化**（宏微协同进化） |

---

## 七、各论文实证设定系统对比

### 7.1 数据 × 回测 × 评估三维总表

| 论文 | 平台 | $M$ | Universe | 标签 $H$ | 组合范式 | Test 因子层 | Test 组合层 | 防泄漏亮点 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| FAMA | 自建 | OHLC+ | SP500 | 短期 | C2 | P2, P4 | T2, T5, T6 | — |
| AlphaAgent | Qlib | OHLCV | CSI500, SP500 | 多 | C1 + LGBM | P1–P3 | T3, T4, T7, R3 | 逐年衰减 |
| QuantaAlpha | Qlib | OHLCV | CSI300/500, SP500 | 1 日特殊 | C1 | P1–P4 | T3, T4, T7 | 966 日 t；成本敏感 |
| FactorEngine | 自建+Qlib | OHLCV+研报 | 全市场→CSI | 可配置 | C4 | P1–P4 | T2–T5, T7, T8 | 四阶段；研报时间戳 |
| Hubble | DSL | OHLCV | SP500 | forward | C5 | P1, P2, T9–T12, R1 | **无完整组合** | 短 OOS 195 日 |
| CogAlpha | Qlib | OHLCV | 5 市场 | 10/30 日 | C1 | P1–P5 | T3, T4 | 5 市场泛化 |
| Chain-of-Alpha | Qlib? | 推断 | CSI500/1000 | 推断 | 未详 | P1–P4 | T2/T3, T4 | FOC 定向优化 |
| MCTS-Alpha | Qlib | OHLCV+VWAP | CSI300/1000 | 10/30 日 | C3 | P1, P2, P4 | T3, T4 | LLM 记忆对照；FSA |
| AlphaForge | Qlib | OHLCV+VWAP | CSI300/500 | ~21 VWAP | Qlib | IC | 实盘 9 月 | 滚动 OOS |
| TradingAgents | 多源 | 价量+文本 | 单股 | 1 日 | C6 | — | T1, T2, T5, T7 | 非截面 |
| Crypto-Agent | 锁定引擎 | 价量+市值 | CMC 截面 | 日频 | C8 | P1, P6 | T5, T7, T13 | **协议不可改** |
| Crypto-GPT | SSRN | OHLC+基差 | BitMEX | 日频 | C7 | P2, P3 | T5, P7, R4 | LLM cutoff OOS |

### 7.2 搜索效率的统一标尺

多篇论文采用 **search count**（生成并评估的唯一公式/程序数）归一化算力：

| 方法类 | 典型 search count | 代表 |
| :--- | :--- | :--- |
| LLM 系 | 1,000 / 2,000 / **3,000** | MCTS, CoT, ToT, FAMA |
| GP / RL / DSO | 递增至 **600,000**（200× 上限） | GP, AlphaGen, DSO |

MCTS-Alpha 结论：在 3000 次 LLM 调用下，有效因子累计数与 Test IR 均优于 600k 次 GP——**搜索引导（MCTS + 回测反馈）比 brute-force 更有效**。

### 7.3 最终测试的四步验收框架

| Step | 验收问题 | 操作 | 通过标准（启发式） |
| :--- | :--- | :--- | :--- |
| **1** | 因子是否仍有预测力？ | Test 段逐日截面 IC/RankIC | RankIC $>0$ 且稳定；R3 无单调衰减 |
| **2** | 组合模型是否过拟合？ | Test 段模型预测 IC vs Train | Test IC $\ge 0.7 \times$ Train IC（经验） |
| **3** | 能否经风险调整跑赢基准？ | C1/C3 组合 + 成本 → IR, AER | IR $>1$；MDD 可接受 |
| **4** | 结论是否稳健？ | 换 alpha 数量、LLM 骨干、成本倍数 | 方向一致；Hubble 用 HAC t-stat |

---

## 八、防泄漏与过拟合控制：论文级机制对照

| 机制 | 原理 | 论文 |
| :--- | :--- | :--- |
| **严格时序切分** | Test 不参与挖因子/调参 | 全部 |
| **相对百分位门控** | 避免固定 IC 阈值早期过松/晚期过严 | MCTS-Alpha |
| **LLM 记忆对照** | 直接 prompt「高性能因子」≈ 随机 | MCTS-Alpha（Table 5） |
| **LLM 训练 cutoff OOS** | 利用模型知识截止日期定义 OOS | Crypto-GPT |
| **评估协议锁定** | Agent 不可修改 split/gate/cost | Crypto-Agent |
| **四阶段拆分** | 挖矿/评估 Train-Valid-Test 分离 | FactorEngine |
| **研报时间戳过滤** | 仅 2017 前研报作先验 | FactorEngine |
| **进化百分位门控** | 65th qualified / 80th elite | CogAlpha |
| **FSA 结构黑名单** | 禁止高频子树，防公式同质化 | MCTS-Alpha |
| **DSL + AST 沙箱** | 禁止危险代码；语法校验 | Hubble, CogAlpha |

**Harvey-Liu-Zhu (2016) 警示**：在 $\mathcal{A}$ 或 $\mathcal{P}$ 上搜索 $10^5+$ 候选后，样本内 IC 的 t 统计量需远高于传统 2.0 阈值；上述机制是论文对 **data snooping** 的实证层回应，但**不能替代**独立 Holdout 或 Paper Trading。

---

## 九、CTA 回测：管理期货范式的对照分析

### 9.1 CTA 的学术定位

**CTA（Commodity Trading Advisor）** 在实务中指管理期货策略，学术上更接近 **time-series momentum / trend-following**（Moskowitz, Ooi & Pedersen, 2012）：在**单一或少量期货合约**的时间序列上识别方向，而非在**数百只股票截面**上排序。

本文件夹 13 篇论文中 **0 篇** 属于标准 CTA；Crypto 两篇的 L-S 组合在**组合构建**上接近期货多空，但数据仍为**加密截面**。

### 9.2 CTA 数据与股票面板的形式化差异

| 维度 | 股票截面因子（本文件夹） | CTA / 管理期货 |
| :--- | :--- | :--- |
| **数据张量** | $\mathbf{X} \in \mathbb{R}^{T \times N \times M}$，$N \gg 1$ | $\mathbf{X} \in \mathbb{R}^{T \times M}$ 或 $\mathbb{R}^{T \times K \times M}$，$K$ 为小品种数 |
| **信号映射** | $f: \mathbf{X}_{t-\tau:t} \mapsto \mathbf{v}_t \in \mathbb{R}^{N}$ | $s: \mathbf{x}_t \mapsto \{-1, 0, +1\}$ 或连续仓位 |
| **经济问题** | 截面相对定价：谁更强？ | 时序方向：涨还是跌？ |
| **主评估** | IC / RankIC（P1/P2） | Sharpe / Calmar / MDD |
| **做空** | 多数 **long-only**（C1–C4） | **天然双向** |
| **杠杆** | 现金 1 倍 | 保证金；强平约束 |
| **换月** | 无 | **roll yield**、主力切换 |
| **特有字段** | 市值、行业 | Open Interest、基差、展期 |

### 9.3 CTA 回测的标准流程

```
连续合约构建 → 时序信号（MA/突破/动量） → 仓位（±1 或波动率缩放）
→ 逐 bar 成交（开平 + 保证金检查） → 日 mark-to-market → NAV 曲线
→ Sharpe / Calmar / MDD / 分年收益
```

**连续合约（Continuous Contract）**：期货有到期日，回测须定义 roll 规则（volume-based / date-based），否则 **survivorship bias** 与 **roll yield** 未计入。

**保证金与强平**：CTA 回测必须模拟 equity $<$ maintenance margin 时的 forced liquidation——股票 Top-$k$ 回测通常无此约束。

**评估指标（CTA 实务核心）**：

$$
\text{Sharpe} = \frac{\mathbb{E}[r_t - r_f]}{\text{Std}[r_t - r_f]} \sqrt{252}, \quad \text{Calmar} = \frac{\text{AnnRet}}{|\text{MDD}|}
$$

CTA **极少报告 IC**——单合约无截面，IC 定义不自然；若多品种组合，有时用 **cross-sectional momentum across commodities**，但仍以 NAV-based Sharpe 为主。

### 9.4 加密 L-S 论文：截面与 CTA 的混合地带

| 维度 | Crypto-Agent / Crypto-GPT | 标准 CTA | 标准 A 股因子 |
| :--- | :--- | :--- | :--- |
| 截面 | 多币种 $\checkmark$ | $\times$ | 多股票 $\checkmark$ |
| L-S | $\checkmark$（C7/C8） | $\checkmark$ | 多数 long-only |
| IC | $\checkmark$ | $\times$ | $\checkmark$ |
| 成本敏感 | **极高**（5bp 主假设） | 极高 | 高 |
| OOS 设计 | cutoff / 协议锁定 | 分年 / walk-forward | 多年 Test |

---

## 十、截面股票因子 vs CTA：方法学分野总结

| 维度 | 股票 Alpha 因子挖掘（本文件夹） | CTA / 管理期货 |
| :--- | :--- | :--- |
| **范式归属** | Empirical Cross-Sectional Asset Pricing | Time-Series / Managed Futures |
| **核心文献** | Fama-French; Qian-Hua-Sorensen; Harvey-Liu-Zhu | Moskowitz-Ooi-Pedersen; Hurst-Ooi-Pedersen |
| **搜索空间** | 公式树 / Python 程序（$\mathcal{A}$, $\mathcal{P}$） | 时序规则参数（lookback, threshold） |
| **验证核心** | 截面 IC + 可交易组合 IR | NAV Sharpe + Calmar + 分年 |
| **过拟合来源** | 高维公式搜索 + LLM 生成 | 参数少但样本短、regime 依赖 |
| **实务平台** | Qlib, rqalpha | vnpy, backtrader, 掘金 CTP |
| **与本文件夹关系** | **13/13 主体或部分** | **0/13**；CTA 作对照范式 |

**一句话分野**：

> 本文件夹论文回答的是 **「哪些股票 tomorrow 相对更强」**（cross-sectional ranking）；CTA 回答的是 **「这个品种 future 方向如何」**（time-series direction）。两者评估语言不同：**IC 属于 asset pricing；Sharpe 属于 portfolio management**——不可直接比较数值高低。


## 十一、终极总结

| 维度 | 本文件夹 13 篇论文的实证共识 | 与 CTA 的分野 |
| :--- | :--- | :--- |
| **数据** | 日频 $\mathbf{X}^{T \times N \times M}$；$M=5$ 或 $6$；指数成分股 | 日/ intraday $\mathbf{X}^{T \times M}$；连续合约 |
| **标签** | Forward return $y_{i,t}$；$H=10$ 日最常见 | 方向/收益率；无截面 rank |
| **挖掘验收** | IC / RankIC / ICIR + 多维门控 | 样本内 Sharpe（需谨慎） |
| **交易验收** | Top-$k$ long-only + 成本 → AER / IR | L-S + 保证金 → Sharpe / Calmar |
| **OOS** | 多年 Test + 逐年 IC + 特殊 leakage 测试 | Walk-forward + 分年 + roll 敏感性 |
| **平台** | Qlib 生态为主 | vnpy / CTP / 专业期货回测 |

**给初学者的阅读路径**：

1. 先掌握 **§二符号** + **§四双层评估**（因子 IC vs 组合 IR）
2. 再读 **§五 C1 协议**（Qlib Top50/Drop5）——覆盖 CogAlpha / AlphaAgent / QuantaAlpha
3. 对照 **§七总表** 看各论文差异项（标签、组合、OOS）
4. 若转向期货，读 **§九–§十**，明确 **IC 范式不适用于单品种 CTA**
