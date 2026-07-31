---
title: "因子投资术语与 AlphaSchema 流程对照"
description: "把传统因子投资的术语、研究链条与 AlphaSchema 的语义计划、代码实现和奖励搜索流程放到同一张对照图中。"
date: "2026-07-31"
category: "量化研究"
series: "Schema Alpha"
status: "polished"
tags: ["AlphaSchema", "Schema Alpha", "因子投资", "因子挖掘", "量化研究"]
source: "个人研究笔记"
featured: false
draft: false
---

# 因子投资术语与 AlphaSchema 流程对照

本文用于把经典因子投资中的常用术语、研究流程和 AlphaSchema 论文中的算法流程对齐。一个重要前提是：经典因子投资主要讨论“一个因子如何被提出、检验、组合和交易”，而 AlphaSchema 主要讨论“如何自动发现大量可实现、可验证的候选因子”。因此二者不是一套词汇的简单替换，而是处在同一研究链条的不同层级。

## 1. 参考来源

本文的术语整理主要参考以下几类来源：

- 石川、刘洋溢、连祥斌：《因子投资：方法与实践》，电子工业出版社，2020。该书系统介绍因子投资基础、因子投资方法论、主流因子、多因子模型、异象研究和因子投资实践。
- Sharpe (1964), "Capital Asset Prices: A Theory of Market Equilibrium under Conditions of Risk"。这是 CAPM 和系统性风险暴露讨论的重要来源。
- Fama and French (1992), "The Cross-Section of Expected Stock Returns"。这是规模、账面市值比等截面收益因子研究的重要来源。
- Fama and French (1993), "Common Risk Factors in the Returns on Stocks and Bonds"。这是三因子模型和共同风险因子框架的重要来源。
- Hou, Xue, and Zhang (2017), "Replicating Anomalies"。这是异象复现、因子检验稳健性和多重检验问题的重要来源。
- Kakushadze (2016), "101 Formulaic Alphas"。这是公式化 alpha 因子库和 alpha 表达式挖掘的重要来源。
- Qlib (Yang et al., 2020)。这是本文实验中使用的量化研究平台和 Alpha158/Alpha360 等因子库来源。
- AlphaSchema 当前论文：尤其是 `sections/Preliminary_v2.tex`、`sections/Methodology_v3.tex`、`sections/Experiment.tex` 和 `sections/Analysis.tex`。

## 2. 一句话总览

经典因子投资的核心问题是：找到一个可以解释或预测资产收益的变量，检验它是否稳健，再把它转化为组合权重和交易策略。

AlphaSchema 的核心问题是：先把候选因子的经济语义写成结构化 schema plan，再让 LLM 把它实现成代码，通过验证和回测得到 reward，并用 reward model 学习哪些语义组合更值得继续探索。

因此可以这样理解：

```text
经典因子投资：经济假设 -> 因子变量 -> 实证检验 -> 因子组合 -> 投资组合 -> 回测与上线

AlphaSchema：语义计划 -> 代码实现 -> 执行验证 -> 因子评价 -> 语义奖励学习 -> 自动搜索下一批计划
```

## 3. 核心术语中英文对照

### 3.1 因子与收益解释

| 中文术语 | 英文术语 | 含义 | 常见出处 | 与 AlphaSchema 的关系 |
|---|---|---|---|---|
| 因子 | Factor | 能解释或预测资产收益差异的变量、特征或组合收益。可以是风险暴露，也可以是交易信号。 | Sharpe (1964), Fama and French (1992, 1993), 石川等 (2020) | AlphaSchema 最终生成的是 executable factor，即可执行因子函数。 |
| Alpha 因子 | Alpha factor | 在量化交易中通常指具有预测力的交易信号，不一定承担资产定价模型中“风险因子”的含义。 | Kakushadze (2016), Qlib (2020) | AlphaSchema 论文中的 alpha mining 更接近“自动挖掘预测信号”。 |
| 风险因子 | Risk factor | 代表系统性风险来源的因子，投资者因承担该风险获得风险溢价。 | Sharpe (1964), Fama and French (1993) | AlphaSchema 不直接建模风险溢价，而是发现可预测信号；某些 schema 可表达风险状态或风险条件。 |
| 风险溢价 | Risk premium | 投资者承担某类风险后获得的预期补偿。 | CAPM, Fama-French 模型 | 在论文中不是核心目标；论文更关注 out-of-sample predictive power 和 portfolio performance。 |
| 异象 | Anomaly | 无法被传统定价模型充分解释、但在历史数据中呈现收益差异的现象。 | Fama and French (1992), Hou et al. (2017) | AlphaSchema 的 Event/Context 可以被看作对潜在异象或交易机制的语义化表达。 |
| 因子暴露 | Factor exposure | 个股或组合对某个因子的敏感度或取值。 | 多因子模型、Barra 风格模型、石川等 (2020) | AlphaSchema 的 realized factor 输出的是横截面信号，可被视为一种动态因子暴露或排序分数。 |
| 因子收益 | Factor return | 多空组合或回归中由某个因子对应的收益。 | Fama-French 三因子模型、实证资产定价 | AlphaSchema 主要报告 IC/RankIC 和组合表现，不直接估计定价模型中的 factor return。 |

### 3.2 因子构造与预处理

| 中文术语 | 英文术语 | 含义 | 常见出处 | 与 AlphaSchema 的关系 |
|---|---|---|---|---|
| 因子构造 | Factor construction | 从原始数据生成因子变量，例如估值、动量、波动率、成交量冲击等。 | 石川等 (2020), Kakushadze (2016) | 在 AlphaSchema 中分成两层：schema plan 先定义语义，LLM realization 再生成具体代码。 |
| 原始特征 | Raw feature | OHLCV、VWAP、财务字段、分析师预期等原始输入。 | Qlib (2020), 因子投资实践 | AlphaSchema 当前主实验主要使用 OHLCV/VWAP，+Fundamental 设置加入基本面 schema。 |
| 去极值 | Winsorization | 对极端值进行截尾，避免少数异常点主导因子。 | 石川等 (2020), 因子实证流程 | AlphaSchema 的 Quality 可表达 outlier filtering，也可由代码实现阶段选择具体处理方式。 |
| 标准化 | Standardization | 将因子转为均值 0、标准差 1，便于比较和组合。 | 多因子模型实践 | AlphaSchema 实验中使用 cross-sectional rank normalization 处理因子和标签。 |
| 排序标准化 | Rank normalization | 将因子值转成横截面排序或分位数，降低极端值影响。 | Qlib, 量化选股实践 | AlphaSchema 的 Output 可选择 cross-sectional rank 或 z-score 类信号。 |
| 中性化 | Neutralization | 剔除行业、市值、风格等暴露，使因子更纯粹。 | Barra 风格模型、因子实证实践 | 当前论文没有把行业/市值中性化作为核心贡献；可以作为后续数据契约或 Quality 约束加入。 |
| 正交化 | Orthogonalization | 从一个因子中剔除与已有因子的线性相关部分，降低冗余。 | 多因子组合实践 | AlphaSchema 的最终 factor pool 使用 correlation filtering 控制冗余，但不等同于严格正交化。 |
| 因子方向 | Factor direction | 因子值越大预期收益越高，或越大预期收益越低。 | 因子排序、多空组合 | AlphaSchema 中 Direction 明确表达 continuation、reversal、range oscillation 等方向假设。 |

### 3.3 因子检验与评价

| 中文术语 | 英文术语 | 含义 | 常见出处 | 与 AlphaSchema 的关系 |
|---|---|---|---|---|
| 信息系数 | Information Coefficient, IC | 因子值与未来收益之间的相关系数，常用 Pearson 相关。 | 因子实证实践、石川等 (2020) | 论文主表报告 IC，并用于衡量 predictive power。 |
| 秩信息系数 | Rank IC | 因子横截面排序与未来收益排序之间的 Spearman 相关。 | 因子实证实践、Qlib | AlphaSchema 的 reward 直接使用 RankIC 和 RankICIR。 |
| ICIR | IC Information Ratio | IC 均值除以 IC 标准差，衡量因子预测稳定性。 | 因子实证实践 | 论文主表报告 ICIR 和 RankICIR。 |
| 分组检验 | Portfolio sorting / Quantile sorting | 按因子值把股票分成若干组，观察组间未来收益是否单调。 | Fama and French (1992), 石川等 (2020) | AlphaSchema 论文没有以分组收益作为核心图表，但 portfolio evaluation 承担类似验证功能。 |
| 多空组合 | Long-short portfolio | 买入高因子组、卖出低因子组，检验因子收益。 | 因子投资实践 | 论文使用 Top50/Drop5 组合回测，更偏 long-only 或 benchmark-relative 交易评价。 |
| 换手率 | Turnover | 组合持仓变化程度，影响交易成本和可实施性。 | 投资组合实践 | 论文在附录中说明交易成本和回测协议，但主文没有把 turnover 作为主指标。 |
| 最大回撤 | Maximum Drawdown, MDD | 净值从高点到低点的最大跌幅。 | 组合评价 | 论文主表报告 MDD，越低越好。 |
| 年化收益 | Annualized Return | 将周期收益换算成年化收益，可能是简单年化或复利年化。 | 投资绩效评价 | 论文使用 benchmark-relative AER，附录定义为复利年化 excess return。 |
| 信息比率 | Information Ratio, IR | 超额收益均值相对跟踪误差的比率。 | 主动投资评价 | 论文用 IR 衡量相对基准的组合表现。 |
| 样本外 | Out-of-sample | 在未参与训练、调参或选择的测试期上评价。 | 统计学习与因子实证 | 论文使用 2016-2020 train、2021-2022 validation、2023-2025 test。 |
| 前视偏差 | Look-ahead bias | 使用了当前时点不可获得的未来信息。 | 量化回测规范 | AlphaSchema 的 execution guards 包括 look-ahead leakage screening。 |
| 幸存者偏差 | Survivorship bias | 只保留存续资产导致历史表现被高估。 | 投资实证规范 | 论文需要依赖数据集设定说明是否控制；不是算法核心。 |
| 数据挖掘偏差 | Data snooping / Multiple testing | 大量试验中偶然发现显著因子，导致过拟合。 | Hou et al. (2017), 因子异象复现研究 | AlphaSchema 用 validation/test split、reward buffer、correlation filtering 和 held-out backtest 缓解，但自动搜索本身仍需要严格控制。 |
| 因子衰减 | Alpha decay / Factor decay | 因子发现后预测力随时间下降。 | AlphaAgent 等近期 alpha mining 文献、实务研究 | 论文附录有 factor-decay analysis，用测试期 rolling RankIC 观察稳定性。 |

### 3.4 多因子模型与组合

| 中文术语 | 英文术语 | 含义 | 常见出处 | 与 AlphaSchema 的关系 |
|---|---|---|---|---|
| 多因子模型 | Multi-factor model | 使用多个因子解释或预测收益。 | Fama-French 三因子模型、Barra 模型、石川等 (2020) | AlphaSchema 先发现 factor pool，再用 LightGBM combiner 做下游组合预测。 |
| 因子池 | Factor pool / Factor library | 可供组合、筛选和建模的一组因子。 | Alpha158, Alpha360, 101 Formulaic Alphas | AlphaSchema 的输出不是单个因子，而是 120 或 150 个 selected factor pool。 |
| 因子筛选 | Factor selection | 根据预测力、稳定性、相关性等选择因子。 | 多因子实践 | AlphaSchema 使用 reward ranking 和 correlation filtering。 |
| 因子合成 | Factor combination | 将多个因子合成为一个综合信号，可用加权、回归、树模型等。 | 多因子模型实践、Qlib | 论文使用 LightGBM ranker 作为 combiner。 |
| 组合构建 | Portfolio construction | 将预测信号转为持仓权重，并考虑约束、换手和成本。 | 投资组合理论与实务 | 论文使用 Top50/Drop5 backtest protocol。 |
| 基准 | Benchmark | 用来比较超额收益的市场指数或组合。 | 主动投资评价 | 论文使用 CSI300 和 SH000300 benchmark，附录还含 CSI500 transfer。 |

## 4. 经典因子投资流程

经典因子研究可以串成如下流程：

```text
研究问题
  -> 投资假设
  -> 数据与股票池
  -> 因子构造
  -> 因子清洗
  -> 单因子检验
  -> 稳健性检验
  -> 因子筛选
  -> 多因子合成
  -> 组合构建
  -> 回测与实盘监控
```

### 4.1 研究问题与投资假设

经典因子投资通常从一个经济或行为金融假设出发。例如：

- 价值效应：便宜股票可能有更高未来收益。
- 动量效应：过去表现强的股票短期内可能延续强势。
- 反转效应：短期过度反应后价格可能反向修正。
- 质量效应：盈利质量更高、财务更稳健的公司可能获得溢价。
- 低波动效应：低风险股票长期风险调整收益可能更高。

在传统流程中，这一步通常由研究员手工提出。它对应的是“为什么这个变量应该预测收益”。

AlphaSchema 的对应关系：AlphaSchema 把这一步拆成 Event、Context、Qualities、Direction、Output。也就是说，研究假设不再只是一句话，而是被拆成结构化语义字段。

### 4.2 数据与股票池

经典流程会先确定：

- 投资标的范围，即 universe，例如 CSI300、CSI500、全 A 股或行业子集。
- 数据频率，例如日频、分钟频、财报频率。
- 原始字段，例如 OHLCV、VWAP、财务报表、分析师预期、新闻文本。
- 样本区间，例如训练期、验证期、测试期。

AlphaSchema 的对应关系：论文中主实验使用 CSI300，时间划分为 2016-2020 training、2021-2022 validation、2023-2025 testing，输入主要是 OHLCV/VWAP，+Fundamental 设置额外加入基本面 schema。

### 4.3 因子构造

经典流程会把原始字段加工成因子，例如：

```text
过去 20 日收益率 -> 动量因子
过去 20 日波动率 -> 波动率因子
成交量相对均值变化 -> 成交量冲击因子
账面市值比 -> 价值因子
ROE 或毛利率 -> 盈利质量因子
```

AlphaSchema 的对应关系：论文不直接把公式作为搜索对象，而是先生成 schema plan。例如“成交量扩张 + VWAP 附近 + 多周期确认 + continuation + rank signal”，再由 LLM 把它实现成代码。

### 4.4 因子清洗与变换

经典流程通常包括去极值、缺失值处理、标准化、中性化、方向统一和相关性处理。其目标是让因子更稳健、更可比较、更容易组合。

AlphaSchema 的对应关系：AlphaSchema 的执行验证负责检查代码是否可运行、是否有数值异常、是否符合数据契约、是否存在前视泄漏。因子池阶段还使用 correlation filtering 控制冗余。

### 4.5 单因子检验

经典流程通常会报告：

- IC / Rank IC：因子与未来收益的相关性。
- ICIR / RankICIR：因子预测稳定性。
- 分组收益：高因子组是否比低因子组收益更高。
- 多空收益：long top group、short bottom group 的收益。
- 单调性：因子分组收益是否随组别单调变化。
- 换手和交易成本：因子是否可交易。

AlphaSchema 的对应关系：论文的 reward 使用 RankIC、RankICIR 和 lag penalty；主表报告 IC、ICIR、RankIC、RankICIR，组合评价报告 IR、AER 和 MDD。

### 4.6 稳健性检验

经典流程会检查：

- 不同时间段是否稳定。
- 不同股票池是否稳定。
- 不同行业或市值组是否稳定。
- 是否被已有因子解释。
- 是否对交易成本敏感。
- 是否存在前视偏差、幸存者偏差和过拟合。

AlphaSchema 的对应关系：论文用 held-out test、CSI500 transfer、factor decay、component ablation、LLM backend robustness 来展示稳定性和机制可信度。

### 4.7 多因子合成与组合构建

经典流程不会只依赖一个因子，而是把多个因子合成为综合信号，再构建组合。常见做法包括等权加权、IC 加权、回归模型、树模型和学习排序模型。

AlphaSchema 的对应关系：论文把自动发现的因子组成 factor pool，再用 LightGBM ranker 合成预测信号，最后通过 Top50/Drop5 协议做回测。

## 5. AlphaSchema 的算法流程

根据当前论文，AlphaSchema 的流程可以串成：

```text
构建 schema vocabulary
  -> 采样或变异生成 semantic plans
  -> quota selector 选择待实现计划
  -> LLM code agent 实现 fast/slow 因子
  -> execution guards 检查可运行性、数值稳定性和前视泄漏
  -> 回测并计算 RankIC、RankICIR、lag penalty
  -> 得到 plan-level reward
  -> 更新 reward buffer
  -> 训练 LightGBM semantic surrogate
  -> 预测未实现 plan 的 reward
  -> 下一轮继续探索、利用和局部变异
  -> 选出最终 factor pool
  -> LightGBM combiner 合成因子池
  -> 组合回测与评价
```

这个流程的关键变化是：经典流程中的“研究员提出因子公式”被拆成“schema plan proposal + LLM realization”。经典流程中的“研究员根据历史检验结果决定下一步研究方向”被替换为“reward buffer + surrogate model + quota selector”。

## 6. 两套流程的逐步对应

| 经典因子投资流程 | AlphaSchema 流程 | 是否等价 | 说明 |
|---|---|---|---|
| 提出经济假设 | 构造 Event/Context/Quality/Direction/Output | 部分等价 | 经典假设通常是自然语言和经济解释；AlphaSchema 把它结构化成可搜索对象。 |
| 构造因子公式 | LLM realization 生成 executable factor | 部分等价 | 经典流程中公式通常由研究员写；AlphaSchema 中公式/代码由 LLM 根据 schema 实现。 |
| 因子清洗 | execution guards + data contract + numerical checks | 部分等价 | 经典清洗更偏统计处理；AlphaSchema 还强调代码是否执行、是否泄漏。 |
| 单因子检验 | RankIC/RankICIR reward | 高度对应 | AlphaSchema 用因子检验结果作为 plan reward。 |
| 因子筛选 | reward ranking + correlation filtering | 高度对应 | 都是在候选因子中筛掉弱因子和冗余因子。 |
| 多因子合成 | LightGBM combiner | 高度对应 | 论文中用学习排序模型合成 factor pool。 |
| 组合构建 | Top50/Drop5 backtest | 高度对应 | 都是把预测信号转成投资组合。 |
| 样本外检验 | 2023-2025 held-out test | 高度对应 | 都要求测试期不能参与训练、调参和选择。 |
| 稳健性检验 | CSI500 transfer、factor decay、LLM robustness | 部分等价 | AlphaSchema 额外检验自动发现流程和 LLM 实现环节。 |
| 研究员经验迭代 | reward buffer + surrogate + quota selector | 不等价但对应 | AlphaSchema 把人工经验迭代替换为可学习的语义搜索策略。 |

## 7. 为什么你会觉得“术语和流程对不上”

这种不对齐很正常，原因主要有四个：

### 7.1 经典因子投资关注的是“因子使用链条”

石川等因子投资框架通常关心：

```text
这个因子是什么
为什么它可能有效
怎么构造它
怎么检验它
怎么和其他因子组合
怎么交易它
```

因此常见词是因子、异象、风险溢价、因子收益、因子暴露、分组收益、多空组合、IC、ICIR、中性化、组合优化等。

### 7.2 AlphaSchema 关注的是“因子发现链条”

AlphaSchema 关心：

```text
搜索空间如何定义
候选计划如何表示
哪些计划值得实现
LLM 如何实现代码
实现失败如何反馈
历史 reward 如何指导下一轮搜索
最终如何得到 factor pool
```

因此论文中的核心词是 semantic plan、schema space、Event、Context、Qualities、Direction、Output、realization、reward buffer、semantic surrogate、quota selector、mutation 等。

### 7.3 经典流程中“假设、公式、代码”常常混在一起

传统研究员提出一个因子时，通常会同时给出：

```text
经济解释 + 构造公式 + 回测结果
```

AlphaSchema 刻意把它拆开：

```text
语义假设 = schema plan
代码公式 = LLM realization
实证结果 = reward
搜索经验 = surrogate model
```

这正是论文想强调的贡献：把“搜索什么”和“怎么实现”分开。

### 7.4 经典术语里的 factor 不一定等于论文里的 plan

在经典因子投资里，factor 往往已经是一个可计算变量。在 AlphaSchema 中，plan 还不是 factor；plan 是一个待实现的交易语义。只有经过 LLM realization 并通过 execution validation 后，才得到 realized factor。

所以最准确的对应是：

```text
schema plan != factor
schema plan -> realized factor
realized factor -> factor quality / reward
validated realized factors -> factor pool
factor pool -> downstream portfolio signal
```

## 8. 用经典语言重述 AlphaSchema

如果用因子投资读者更熟悉的话语重述 AlphaSchema，可以写成：

AlphaSchema 是一个自动化因子研究系统。它不是直接在公式空间里搜索因子，而是先把候选因子的投资逻辑拆成市场事件、适用情境、质量约束、方向假设和输出形式五个维度。每一个语义组合代表一个候选因子假设。系统从这些假设中选择一批候选，让 LLM 生成可执行因子代码，并通过数据契约、数值稳定性和前视泄漏检查。通过回测得到 RankIC、RankICIR 和滞后惩罚后，系统把结果记录为 plan-level reward。随着搜索进行，LightGBM surrogate 学习哪些语义组合更可能产生高质量因子，并指导后续搜索在探索新语义、利用高预测 reward 的候选和局部变异强候选之间分配预算。最终，系统得到一个通过验证的因子池，再用 LightGBM combiner 合成信号并做组合回测。

## 9. 用 AlphaSchema 语言重述经典因子研究

反过来，经典因子研究也可以被写成一个 schema 流程：

```text
传统研究员发现一个市场现象
  = Event

研究员说明该现象在哪类市场状态下有效
  = Context

研究员加入过滤条件、稳健性要求、确认信号
  = Qualities

研究员判断应该做多高因子值还是低因子值
  = Direction

研究员决定输出连续值、排序、分组或交易信号
  = Output

研究员写公式并回测
  = Realization and evaluation
```

这个视角能解释为什么 AlphaSchema 的五类 schema 不是凭空造词，而是在拆解传统因子研究员脑中的隐含步骤。

## 10. 对论文写作的启发

为了让读过经典因子投资的审稿人更容易理解 AlphaSchema，论文中可以更明确地区分以下概念：

| 容易混淆的词 | 建议解释 |
|---|---|
| factor | 已经可计算、可回测的因子变量或信号。 |
| schema plan | 还没有实现成代码的结构化交易语义假设。 |
| realization | 把 schema plan 转换成 executable factor 的代码生成过程。 |
| reward | realized factor 经过验证和回测后的 plan-level 评价。 |
| factor pool | 通过验证和筛选后，进入下游组合模型的一组因子。 |
| semantic surrogate | 学习 schema plan 与 reward 之间关系的模型，不是直接预测股票收益的模型。 |
| LightGBM combiner | 下游把 factor pool 合成为股票预测信号的模型。 |

因此，AlphaSchema 的定位可以进一步写清楚：

```text
它不是替代因子检验流程，而是自动化因子检验之前的候选假设生成和搜索流程；
它不是直接学习股票收益，而是先学习“哪些交易语义更可能产生好因子”；
它不是把 LLM 当作全流程研究员，而是让 LLM 只承担 plan-to-code realization。
```

## 11. 建议在论文中采用的术语桥接句

可以考虑在 Introduction 或 Preliminary 中加入类似表达：

```text
In conventional factor investing, a candidate factor is usually introduced as a
fully specified variable and then evaluated through IC, portfolio sorting, and
out-of-sample backtesting. AlphaSchema moves one step upstream: before a factor
is written as an executable formula, we represent its investment hypothesis as a
structured semantic plan over event, context, quality, direction, and output.
The realized factor is then treated as one implementation sample of this plan.
```

中文含义是：

```text
传统因子投资通常从一个已经写好的因子变量开始，再通过 IC、分组收益和样本外回测检验它。
AlphaSchema 把流程前移：在因子被写成可执行公式之前，先把它的投资假设表示为由事件、情境、
质量、方向和输出构成的结构化语义计划。实现出来的因子只是该语义计划的一个实现样本。
```

这个桥接句能直接解释“为什么书里的 factor workflow 和论文里的 schema workflow 不完全一样”。

## 12. 最终对照图

```text
经典因子投资
经济假设
  -> 因子公式
  -> 数据清洗和标准化
  -> IC / RankIC / 分组收益
  -> 稳健性检验
  -> 多因子合成
  -> 组合回测
  -> 实盘监控

AlphaSchema
Schema vocabulary
  -> Semantic plan p=(e,c,Q,d,o)
  -> LLM realization
  -> Execution and leakage guards
  -> RankIC / RankICIR / lag penalty reward
  -> Reward buffer
  -> LightGBM semantic surrogate
  -> Quota selection and mutation
  -> Validated factor pool
  -> LightGBM combiner
  -> Portfolio backtest
```

一句话总结：经典因子投资研究的是“怎样评价和使用一个因子”，AlphaSchema 研究的是“怎样在实现因子之前，系统性地搜索可能产生好因子的交易语义”。二者并不矛盾，AlphaSchema 更像是把传统研究员手工提出候选因子的部分结构化、自动化和可学习化。
