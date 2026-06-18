---
title: "量化交易｜LLM 驱动 Alpha 挖掘的九篇论文整理，从实证角度分析因子评估方法（股票类）"
description: "在因子挖掘中，“什么样的因子是想要的因子”这个应该是一个核心问题。我整理了九篇论文的计算方法和标准。"
date: "2026-06-18"
tags: ["LLM", "Alpha", "Math"]
featured: false
draft: false
---


# 量化交易｜LLM 驱动 Alpha 挖掘的九篇论文整理，从实证角度分析因子评估方法（股票类）


## 论文目录

| # | 论文 | 简称 |
|---|------|------|
| 1 | Can Large Language Models Mine Interpretable Financial Factors More Effectively? (ACL 2024) | **FAMA** |
| 2 | TradingAgents: Multi-Agents LLM Financial Trading Framework | **TradingAgents** |
| 3 | AlphaAgent: LLM-Driven Alpha Mining with Regularized Exploration (KDD 2025) | **AlphaAgent** |
| 4 | QuantaAlpha: An Evolutionary Framework for LLM-Driven Alpha Mining | **QuantaAlpha** |
| 5 | FactorEngine: A Program-level Knowledge-Infused Factor Mining Framework | **FactorEngine** |
| 6 | Hubble: An LLM-Driven Agentic Framework for Safe, Diverse Alpha Factor Discovery | **Hubble** |
| 7 | Cognitive Alpha Mining via LLM-Driven Code-Based Evolution (CogAlpha) | **CogAlpha** |
| 8 | Chain-of-Alpha (alphaXiv 摘要文档) | **Chain-of-Alpha** |
| 9 | Navigating the Alpha Jungle: An LLM-Powered MCTS Framework (Shi et al. 2025) | **MCTS-Alpha** |

---

## 一、通用评估指标词典

下文按 **预测能力 → 交易绩效 → 稳健性/衰减** 分类定义各指标。后文各论文仅标注使用了哪些指标编号，**不再重复公式**；若某论文对标准定义有改动，在论文章节中以「变体说明」单独注明。

### 1.1 指标索引速查

| 编号 | 指标 | 类别 |
|------|------|------|
| **P1** | IC (Information Coefficient) | 预测能力 |
| **P2** | RankIC (Rank Information Coefficient) | 预测能力 |
| **P3** | ICIR | 稳健性/衰减 |
| **P4** | RankICIR / RankIR / RICIR | 稳健性/衰减 |
| **P5** | MI (Mutual Information) | 预测能力 |
| **T1** | CR (Cumulative Return) | 交易绩效 |
| **T2** | AR (Annualized Return) | 交易绩效 |
| **T3** | AER / ARR (Annualized Excess Return) | 交易绩效 |
| **T4** | IR (Information Ratio) | 交易绩效 |
| **T5** | SR / Sharpe Ratio | 交易绩效 |
| **T6** | Vol (Volatility) | 交易绩效 |
| **T7** | MDD (Maximum Drawdown) | 交易绩效 / 稳健性 |
| **T8** | RMDD (Relative MDD) | 交易绩效 / 稳健性 |
| **T9** | LS Ret. (Long-Short Spread) | 交易绩效 |
| **T10** | Bucket Returns | 交易绩效 |
| **T11** | Turnover | 稳健性/衰减 |
| **T12** | Coverage | 稳健性 |
| **R1** | HAC t-stat | 稳健性/衰减 |
| **R2** | Overfitting Risk Score | 稳健性/衰减 |
| **R3** | 逐年 IC / RankIC 衰减曲线 | 稳健性/衰减 |

**通用计算粒度（因子类论文共性）**：在每个交易日 $t$，对截面内 $N_t$ 只股票计算相关系数 $\text{IC}_t$ 或 $\text{RankIC}_t$，再对 $t=1,\ldots,T$ 做时间聚合（均值或 IR）。组合类指标多在日频组合收益上计算后再年化。

---

### 1.2 预测能力指标

#### P1 — IC (Information Coefficient)

**含义**：预测分值/因子值与后续实现收益的**线性**相关强度。

**日频截面 Pearson 相关（标准形式，QuantaAlpha / MCTS-Alpha / CogAlpha 等）**：

$$
\text{IC}_t = \frac{(\mathbf{f}_t - \bar{f}_t \mathbf{1})^\top (\mathbf{r}_{t+1} - \bar{r}_{t+1}\mathbf{1})}{\|\mathbf{f}_t - \bar{f}_t\mathbf{1}\|_2 \cdot \|\mathbf{r}_{t+1} - \bar{r}_{t+1}\mathbf{1}\|_2}
$$

或等价标量形式（MCTS-Alpha）：

$$
\text{IC}_t = \frac{\sum_i (f_{i,t}-\bar{f}_t)(r_{i,t+1}-\bar{r}_{t+1})}{\sqrt{\sum_i (f_{i,t}-\bar{f}_t)^2}\sqrt{\sum_i (r_{i,t+1}-\bar{r}_{t+1})^2}}
$$

**聚合**：$\text{IC} = \frac{1}{T}\sum_t \text{IC}_t$（时间均值）。

**变体**：
- **Hubble**：$\text{IC}_t = \rho_P(\alpha_{t,\cdot}, r_{t,\cdot}^{(h)})$，$\rho_P$ 为 Pearson 相关；标签为 horizon $h$ 的前向收益。
- **AlphaAgent**：IC 基于预测分值与**实际日收益**的截面相关。

---

#### P2 — RankIC (Rank Information Coefficient)

**含义**：预测与收益的**单调**关系（对秩做相关，等价 Spearman）。

**标准形式**：

$$
u_{i,t} = \text{rank}(f_{i,t}),\quad v_{i,t} = \text{rank}(r_{i,t+1})
$$

$$
\text{RankIC}_t = \text{Corr}(\mathbf{u}_t, \mathbf{v}_t),\quad \text{RankIC} = \frac{1}{T}\sum_t \text{RankIC}_t
$$

**变体（FAMA）**：对因子排序 $\text{order}_t^f$ 与收益排序 $\text{order}_t^{r_j}$ 做 Pearson 相关，并对因子集、股票 $j$、时间 $t$ 多重平均：

$$
\gamma(f) = \frac{1}{N_1 T_N} \sum_{j=1}^{N} \sum_{t=1}^{T} \text{RankIC}_t(f, r_j)
$$

---

#### P3 — ICIR

**含义**：IC 的时序稳定性（IC 的信息比率）。

$$
\text{ICIR} = \frac{\mathbb{E}[\text{IC}_t]}{\text{Std}[\text{IC}_t]} \approx \frac{\text{IC}}{\text{Std}(\{\text{IC}_t\})}
$$

---

#### P4 — RankICIR / RankIR / RICIR

**含义**：RankIC 的时序稳定性，定义同 ICIR，将 IC 替换为 RankIC。

**变体（FAMA）**：

$$
\text{RankICIR} = \mathbb{E}_f\left[\mathbb{E}_j\left[\frac{\gamma(f)}{\sigma(\text{RankIC}_t(f,r_j))}\right]\right]
$$

FactorEngine 将 Rank IC 记为 **RIC**，其 IR 记为 **RICIR**：$\text{RICIR} = \text{mean(RIC)} / \text{std(RIC)}$。

---

#### P5 — MI (Mutual Information)

**含义**：因子与收益的**非线性**依赖（CogAlpha 进化筛选用）。

$$
\text{MI}(F,R) = \iint p(f,r)\log\frac{p(f,r)}{p(f)p(r)}\,df\,dr
$$

---

### 1.3 交易绩效指标

#### T1 — CR (Cumulative Return)

**含义**：模拟期内总收益率。

$$
\text{CR} = \frac{V_{\text{end}} - V_{\text{start}}}{V_{\text{start}}} \times 100\%
$$

---

#### T2 — AR (Annualized Return)

**含义**：年化收益率（多为**绝对收益**，未必扣除基准）。

**几何年化（TradingAgents / FactorEngine）**：

$$
\text{AR} = \left[\left(\frac{V_{\text{end}}}{V_{\text{start}}}\right)^{1/N} - 1\right] \times 100\%
$$

其中 $N$ 为模拟年数。

**复利年化（FactorEngine 组合绝对收益）**：

$$
\text{AR} = \left[\prod_{t=1}^{T}(1+r_t)\right]^{252/T} - 1
$$

**变体（FAMA）**：$\text{AR} = (1+R)^{252/N_{\text{days}}} - 1$，$R$ 为累计收益率。

---

#### T3 — AER / ARR (Annualized Excess Return)

**含义**：相对基准的年化**超额**收益。

**算术缩放（Qlib 系：CogAlpha / MCTS-Alpha AER）**：

$$
r_t = r_t^{\text{port}} - r_t^{\text{bench}} - \text{cost}_t,\quad \mu = \frac{1}{T}\sum_t r_t,\quad \text{AER} = \mu \times N
$$

$N=252$（日频年化乘数）。

**MCTS-Alpha AER（Top-k 组合超额，算术年化）**：

$$
R_{p,t+1} = \frac{1}{k}\sum_{s \in \text{TopK}_t} r_{s,t+1}^{\text{excess}},\quad \text{AER} = \left(\frac{1}{T_p}\sum_j R_{p,j}\right) \times P
$$

$P=252$（日频）或 $P=12$（月频）。

**相对净值几何年化（FactorEngine AER）**：

$$
\text{AER} = \left(\frac{P_T/P_0}{B_T/B_0}\right)^{252/T} - 1
$$

$P_t$、$B_t$ 分别为组合与基准净值。

**QuantaAlpha ARR**：扣费后 $r_{\text{excess},t} = r_{\text{portfolio},t} - r_{\text{benchmark},t} - c_{\text{transaction},t}$，再年化超额。

**AlphaAgent AR**：表中 AR 即年化超额收益（相对 CSI 500 / S&P 500 指数）。

---

#### T4 — IR (Information Ratio)

**含义**：超额收益的风险调整表现。

**Qlib 标准（CogAlpha）**：

$$
\text{IR} = \frac{\mu}{\sigma}\sqrt{N},\quad \sigma = \sqrt{\frac{1}{T-1}\sum_t (r_t-\mu)^2}
$$

**QuantaAlpha**：

$$
\text{IR} = \frac{r_{\text{excess}}}{\sigma(r_{\text{excess}})} \times \sqrt{252}
$$

**MCTS-Alpha（变体，与常见 $\mu/\sigma\cdot\sqrt{P}$ 写法不同）**：

$$
\text{IR} = \frac{\text{AER}}{\sigma(R_p)\sqrt{P}}
$$

**FAMA 组合 IR 语境**：文中主要报告 SR；RankICIR 用于因子预测侧。

---

#### T5 — SR (Sharpe Ratio)

**含义**：绝对收益的风险调整比率。

**标准（FAMA / TradingAgents）**：

$$
\text{SR} = \frac{\bar{R} - R_f}{\sigma}
$$

FAMA 进一步年化：$\text{SR} = (R_p - R_f) / (\sigma_p \sqrt{252})$，$R_f=0$。

**FactorEngine**：

$$
\text{SR} = \frac{\mathbb{E}[r_t - r_f]}{\sqrt{\text{Var}(r_t - r_f)}}
$$

---

#### T6 — Vol (Volatility)

**含义**：组合收益波动率（FAMA）。

$$
\text{Vol} = \sigma_p \sqrt{252}
$$

$\sigma_p$ 为日收益标准差。

---

#### T7 — MDD (Maximum Drawdown)

**含义**：净值（或累计超额收益）最大峰谷回撤。

$$
\text{MDD} = \max_{t \in [0,T]} \frac{\text{Peak}_t - \text{Trough}_t}{\text{Peak}_t} \times 100\%
$$

---

#### T8 — RMDD (Relative MDD, FactorEngine)

**含义**：策略相对基准净值的回撤。

$$
V_t^{\text{rel}} = P_t / B_t,\quad \text{RMDD} = \max_{t}\frac{\max_{s\le t} V_s^{\text{rel}} - V_t^{\text{rel}}}{\max_{s\le t} V_s^{\text{rel}}}
$$

---

#### T9 — LS Ret. (Long-Short Spread, Hubble)

**含义**：因子截面**分位数分桶**后，Top 桶与 Bottom 桶收益之差的时序均值（**非**可交易对冲组合净值）。

---

#### T10 — Bucket Returns (Hubble)

**含义**：按因子值截面分位数分组后，各桶的平均收益序列（用于绘制 bucket-return profile）。

---

#### T11 — Turnover

**含义**：组合或因子信号的换手强度。

- **组合层**：日换手率、Top-k Dropout 导致的换手（MCTS-Alpha 用于 MCTS 评分维度）。
- **Hubble Top-decile**：相邻日 Top 10% 股票集合的 Jaccard 距离：$1 - |A \cap B| / |A \cup B|$。

---

#### T12 — Coverage (Hubble)

**含义**：因子在截面上有效覆盖的股票比例（对齐前向标签后的非缺失占比）。

---

### 1.4 稳健性 / 衰减指标

#### R1 — HAC t-stat (Hubble)

对 IC、LS Ret. 时间序列均值是否显著异于 0 做检验；Bartlett-kernel HAC 方差（Newey-West 型自动滞后）。

#### R2 — Overfitting Risk Score (MCTS-Alpha)

LLM 评估的过拟合风险分，纳入 MCTS 节点聚合评分（与 RankIC、RankIR 等并列）。

#### R3 — 逐年 IC / RankIC

按自然年切片计算 IC、RankIC，观察因子预测力衰减（AlphaAgent、QuantaAlpha、FactorEngine、MCTS-Alpha）。

---

### 1.5 常见组合构建范式（供后文引用）

| 范式编号 | 名称 | 要点 |
|----------|------|------|
| **C1** | Top-k Dropout（Qlib） | 持有 Top $k$ 预测最高股票，每日最多剔除/替换 $n$ 只；等权；日频 |
| **C2** | Top 比例仅做多（FAMA） | Top 20% 等权，日频次日换仓 |
| **C3** | Top 10% + Drop-$n$（MCTS-Alpha） | $k$=池内 10%；$n=k/w$（$w$=预测 horizon 天数）；等权 |
| **C4** | 5 日滚动持有（FactorEngine） | 5 个子组合错开；每日仅平到期仓并买入 Top 50 等权 |
| **C5** | 因子分桶 L-S（Hubble） | 截面分位数 bucket；统计 Top−Bottom spread，非对冲组合 |
| **C6** | 单标的择时（TradingAgents） | 每日 buy/sell/hold；可做多/做空单股 |

---

## 二、各论文实证设定

---

### 📄 FAMA — Can Large Language Models Mine Interpretable Financial Factors More Effectively?

#### 1. 使用指标

| 指标 | 类别 | 依赖多空 |
|------|------|----------|
| P2 RankIC | 预测能力 | 否 |
| P4 RankICIR（FAMA 变体，见 §1.2） | 稳健性/衰减 | 否 |
| T2 AR | 交易绩效 | 否 |
| T6 Vol | 交易绩效 | 否 |
| T5 SR | 交易绩效 | 否 |

#### 2. 多空组合实施细节

- **是否做空**：**否**（范式 **C2**）。
- **构建**：Top 20% 等权；次日换仓；多因子权重 $w_i = \text{RankIC}_{\text{past},i}/\sum_i \text{RankIC}_{\text{past},i}$（2020/06–2021/01）。
- **基准**：S&P 500 全成分等权组合。
- **限制**：未说明涨跌停/流动性过滤。

#### 3. 实验环境

- **数据**：S&P 500；2015/01/01–2022/01/01；训练 2015–2020、验证 2020–2021、测试 2021–2022；挖掘仅用 2020/06–2021/01。
- **基线**：Alpha101、GP、ALSTM、DTransformer、FactorVAE、直接 LLM。

---

### 📄 TradingAgents — Multi-Agents LLM Financial Trading Framework

> 单标的择时框架，**非**截面因子挖掘评估。

#### 1. 使用指标

| 指标 | 类别 | 依赖多空 |
|------|------|----------|
| T1 CR | 交易绩效 | 是（单标的） |
| T2 AR | 交易绩效 | 是 |
| T5 SR | 交易绩效 | 是 |
| T7 MDD | 交易绩效 / 稳健性 | 是 |

#### 2. 多空组合实施细节

- **是否做空**：**是**（范式 **C6**；单股 Long/Short，非截面 Top–Bottom）。
- **标的**：AAPL、GOOGL、AMZN 等；**2024/01/01–2024/03/29**。
- **基准**：Buy & Hold；规则策略 MACD、KDJ+RSI、ZMR、SMA。
- **成本**：模拟含约 0.015 交易成本。

#### 3. 实验环境

- **数据**：多模态（价格、新闻、社媒、财报、60 项技术指标）。
- **基线**：B&H、MACD、KDJ+RSI、ZMR、SMA。

---

### 📄 AlphaAgent — LLM-Driven Alpha Mining with Regularized Exploration (KDD 2025)

#### 1. 使用指标

| 指标 | 类别 | 依赖多空 |
|------|------|----------|
| P1 IC | 预测能力 | 否 |
| P2 RankIC | 预测能力 | 否 |
| P3 ICIR | 稳健性/衰减 | 否 |
| T3 AR（超额） | 交易绩效 | 否 |
| T4 IR | 交易绩效 | 否 |
| T7 MDD | 交易绩效 / 稳健性 | 否 |
| R3 逐年 IC / RankIC | 稳健性/衰减 | 否 |

#### 2. 多空组合实施细节

- **是否做空**：**否**（范式 **C1**：Top 50 / Drop 5，等权，日频）。
- **基准**：CSI 500 / S&P 500 指数。
- **成本**：CSI 500 买 0.0005、卖 0.0015；S&P 500 仅卖 0.0005。
- **下游**：4 个基础 alpha + 新因子 → LightGBM（depth=4，截面 Z-score）。

#### 3. 实验环境

- **数据**：CSI 500、S&P 500；训练 2015–2019、验证 2020、测试 2021–2025/01；OHLCV。
- **基线**：LSTM、Transformer、LightGBM、TRA、StockMixer、AlphaForge、RD-Agent、DeepSeek-R1、OpenAI-o1；衰减对比 Alpha158、GP、RSI。

---

### 📄 QuantaAlpha — An Evolutionary Framework for LLM-Driven Alpha Mining

#### 1. 使用指标

| 指标 | 类别 | 依赖多空 |
|------|------|----------|
| P1 IC | 预测能力 | 否 |
| P2 Rank IC | 预测能力 | 否 |
| P3 ICIR | 稳健性/衰减 | 否 |
| P4 Rank ICIR | 稳健性/衰减 | 否 |
| T3 ARR | 交易绩效 | 否 |
| T4 IR | 交易绩效 | 否 |
| T7 MDD | 交易绩效 / 稳健性 | 否 |
| R3 逐年 IC / Rank IC | 稳健性/衰减 | 否 |

**附加稳健性分析**：966 日 IC t 检验、正 IC 天数占比、跨 seed 方差、交易成本 1.5×/2.0× 敏感性。

#### 2. 多空组合实施细节

- **是否做空**：**否**（范式 **C1**：topk=50，n_drop=5，等权，**次日开盘价**成交）。
- **基准**：SH000300 / SH000905 / SPX。
- **成本**：买 0.05%、卖 0.15%；涨跌停阈值 9.5%。
- **标签**：$y_t = P_{t+2}^{\text{close}}/P_{t+1}^{\text{close}} - 1$；CSRankNorm 预处理。

#### 3. 实验环境

- **数据**：CSI 300/500、S&P 500；训练 2016–2020、验证 2021、测试 2022–2025/12/26；约 150 因子 → 统一 LightGBM。
- **基线**：Linear、MLP、XGBoost、CatBoost、LightGBM、DoubleEnsemble、GRU、LSTM、Transformer、TRA、Alpha158、Alpha360、RD-Agent、AlphaAgent。

---

### 📄 FactorEngine — A Program-level Knowledge-Infused Factor Mining Framework

#### 1. 使用指标

| 指标 | 类别 | 依赖多空 |
|------|------|----------|
| P1 IC | 预测能力 | 否 |
| P3 ICIR | 稳健性/衰减 | 否 |
| P2 RIC (Rank IC) | 预测能力 | 否 |
| P4 RICIR | 稳健性/衰减 | 否 |
| T2 AR | 交易绩效 | 否 |
| T3 AER（相对净值变体，§1.3） | 交易绩效 | 否 |
| T4 IR | 交易绩效 | 否 |
| T5 SR | 交易绩效 | 否 |
| T7 MDD | 交易绩效 / 稳健性 | 否 |
| T8 RMDD | 交易绩效 / 稳健性 | 否 |
| R3 lag 窗口 IC / RankIC | 稳健性/衰减 | 否 |

#### 2. 多空组合实施细节

- **是否做空**：**否**（范式 **C4**：5 日滚动持有，Top 50 等权）。
- **基准**：CSI 300 / CSI 500 指数（$P_t/B_t$）。
- **成本**：佣金 0.00015（双边）、印花税 0.0005（卖）、滑点 0.0008；100 股最小单位；单日成交量 ≤10%；初始资金 1 亿 CNY。

#### 3. 实验环境

- **数据**：全市场 + CSI 300/500 评估；训练 2008–2014、验证 2015–2016、测试 2017–2024；OHLCV；研报仅用 2017 年前。
- **基线**：GPLearn、Transformer、LSTM、TRA、LightGBM、Alpha158、AlphaAgent、RD-Agent。

---

### 📄 Hubble — An LLM-Driven Agentic Framework for Safe, Diverse Alpha Factor Discovery

> 以**单因子截面评估**为主，非完整可交易组合回测。

#### 1. 使用指标

| 指标 | 类别 | 依赖多空 |
|------|------|----------|
| P2 RankIC | 预测能力 | 否 |
| P1 Pearson IC | 预测能力 | 否 |
| P3/P4 RankICIR / ICIR (ann.) | 稳健性/衰减 | 否 |
| T10 Bucket Returns | 交易绩效 | 是（分桶） |
| T9 LS Ret. | 交易绩效 | **是（因子层）** |
| T11 Turnover | 稳健性/衰减 | 部分 |
| T12 Coverage | 稳健性 | 否 |
| R1 HAC t-stat | 稳健性/衰减 | 否 |

#### 2. 多空组合实施细节

- **是否做空**：**部分**（范式 **C5**：分桶 Top–Bottom spread；**未**构建对冲组合净值）。
- **频率**：日频截面评估；portfolio diagnostics **不含**完整交易成本回测；无行业/市值中性化。

#### 3. 实验环境

- **数据**：S&P 500（501 股）；发现 2022-01-01–2025-05-31（840 日）；OOS 2025-06-01–2026-03-13（195 日）；3 轮、每轮 20 候选、top-k=5。
- **对照**：Nemotron-120B vs Hunter-Alpha 后端；无 GP/RL 数值基线表。

---

### 📄 CogAlpha — Cognitive Alpha Mining via LLM-Driven Code-Based Evolution

#### 1. 使用指标

| 指标 | 类别 | 依赖多空 |
|------|------|----------|
| P1 IC | 预测能力 | 否 |
| P2 RankIC | 预测能力 | 否 |
| P3 ICIR | 稳健性/衰减 | 否 |
| P4 RankICIR | 稳健性/衰减 | 否 |
| P5 MI | 预测能力 | 否 |
| T3 AER | 交易绩效 | 否 |
| T4 IR | 交易绩效 | 否 |

**进化筛选（论文特有）**：五指标均超过同代 65th 百分位为 qualified、80th 为 elite；下界截断（如 IC≥0.005）。

#### 2. 多空组合实施细节

- **是否做空**：**否**（范式 **C1**：Top 50 / Drop 5，**开盘价**成交）。
- **基准**：Qlib 默认市场指数（CSI 300）。
- **成本**：开 0.05%、平 0.15%，最低 5 CNY/笔。
- **标签**：10 日收益；滚动训练 step=126。

#### 3. 实验环境

- **数据**：主实验 CSI 300；另 CSI 500、S&P 500、HSI、HSCI；训练 2011–2019、验证 2020、测试 2021–2024/12/01。
- **基线**：21 种（ML、DL、Alpha158/360、AutoAlpha、AlphaAgent、6 种 LLM 等）；20 个 alpha 组合评估。

---

### 📄 Chain-of-Alpha (alphaXiv 摘要)

> ⚠️ 工作区仅有摘要文档，组合细节未披露。

#### 1. 使用指标

| 指标 | 类别 | 依赖多空 |
|------|------|----------|
| P1 IC | 预测能力 | 否 |
| P2 RankIC | 预测能力 | 否 |
| P3/P4 RankICIR（作 Consistency） | 稳健性/衰减 | 否 |
| T11 Turnover（作 Efficiency 倒数） | 稳健性/衰减 | 否 |
| T2/T3 AR | 交易绩效 | 未明确 |
| T4 IR | 交易绩效 | 未明确 |
| T5 Sharpe（管线提及） | 交易绩效 | 未明确 |

**挖掘阶段四维得分（摘要特有）**：$S$=RankIC，$C$=RankICIR，$E$=Turnover$^{-1}$，$D$=1−min Corr；FOC 按 IC / RankICIR 低值定向优化。

#### 2. 多空组合实施细节

- **是否做空**：**未明确**；摘要仅报告 AR、IR 及相对市场基准的累计超额曲线。

#### 3. 实验环境

- **数据**：CSI 500、CSI 1000。
- **结果（摘要）**：CSI 500 AR=0.1324、IR=1.4178；CSI 1000 AR=0.1471、IR=1.4043。
- **基线**：Alpha 101/158/360、GP、DSO、AlphaGen、AlphaForge、LLM+CoT/ToT/MCTS、FAMA。

---

### 📄 MCTS-Alpha — Navigating the Alpha Jungle (Shi et al. 2025)

#### 1. 使用指标

| 指标 | 类别 | 依赖多空 |
|------|------|----------|
| P1 IC | 预测能力 | 否 |
| P2 RankIC | 预测能力 | 否 |
| P4 RankIR / RankICIR | 稳健性/衰减 | 否 |
| T3 AER（算术年化变体，§1.3） | 交易绩效 | 否 |
| T4 IR（AER/σ 变体，§1.3） | 交易绩效 | 否 |
| T11 Turnover（MCTS 评分维） | 稳健性/衰减 | 否 |
| R2 Overfitting Risk Score | 稳健性/衰减 | 否 |

**MCTS 内四维评分**：Effectiveness=RankIC；Stability=RankIR；Turnover=日换手；Diversity=与库内最大相关。有效 alpha 门槛：RankIC≥0.015、RankIR≥0.3 等。

#### 2. 多空组合实施细节

- **是否做空**：**否**（范式 **C3**：Top 10%，$n=k/w$，等权，日频）。
- **基准**：Qlib 市场基准超额。
- **成本**：单边 0.15%。
- **标签**：10 日 / 30 日收益；收盘价买卖（主实验）。

#### 3. 实验环境

- **数据**：CSI 300、CSI 1000；训练 2011–2020、测试 2021–2024/11/30。
- **基线**：DSO、GP、AlphaGen、AlphaForge、CoT、ToT、FAMA；另 Alpha158/360、AlphaAgent、RiskMiner；S&P 500 扩展 2007–2015 训练、2016–2020 测试。

---

## 三、核心评估范式对比表

| 论文 | 是否做空 | 使用指标（编号） | 计算粒度 | 组合范式 | 基准 |
|------|----------|------------------|----------|----------|------|
| **FAMA** | 否 | P2, P4, T2, T6, T5 | 日频截面→均值 | C2 Top 20% | S&P500 等权 |
| **TradingAgents** | 是（单标的） | T1, T2, T5, T7 | 日频单标的 | C6 择时 | B&H + 规则策略 |
| **AlphaAgent** | 否 | P1–P3, T3, T4, T7, R3 | 日频截面→均值 | C1 Top50/Drop5 | CSI500 / SP500 |
| **QuantaAlpha** | 否 | P1–P4, T3, T4, T7, R3 | 日频截面→均值 | C1 Top50/Drop5 | SH000300/905, SPX |
| **FactorEngine** | 否 | P1–P4, T2–T5, T7, T8, R3 | 日频截面→均值 | C4 5日滚动 Top50 | CSI300/500 指数 |
| **Hubble** | 因子层 L-S | P1, P2, P3/P4, T9–T12, R1 | 日频截面 | C5 分桶 spread | 因子统计为主 |
| **CogAlpha** | 否 | P1–P5, T3, T4 | 日频截面→均值 | C1 Top50/Drop5 | Qlib 市场指数 |
| **Chain-of-Alpha** | 未明确 | P1–P4, T11, T2/T3, T4, T5 | 日频（推断） | 未披露 | 市场基准 |
| **MCTS-Alpha** | 否 | P1, P2, P4, T3, T4, T11, R2 | 日频截面→均值 | C3 Top10%/Drop-n | Qlib 基准超额 |

### 跨论文共性

1. **预测侧**：8/9 篇使用 P1/P2（IC + RankIC），多数配套 P3/P4（ICIR / RankICIR）。
2. **交易侧**：Qlib 生态普遍 **C1 仅做多** + LightGBM 下游；超额相对 **市场指数**。
3. **多空**：仅 TradingAgents（C6）与 Hubble（C5 因子层）涉及空头逻辑。
4. **衰减**：AlphaAgent、QuantaAlpha、FactorEngine、MCTS-Alpha 使用 **R3 逐年 IC** 或多年 OOS。

### 范式差异速览

| 维度 | 典型 A | 典型 B |
|------|--------|--------|
| 持仓规模 | Top 50（C1） | Top 10%–20%（C2/C3） |
| 换仓 | 日频全调（C1） | 5 日滚动（C4） |
| 超额收益定义 | 算术年化 AER（T3） | 几何 AR / 相对净值 AER（T2/T3） |
| 评估目标 | 可交易组合回测 | 因子分桶 + LS spread（C5） |
