---
title: "量化交易｜自动化因子挖掘中的变异、杂交与搜索范式"
description: "系统梳理公式型 Alpha 因子挖掘从人工因子、遗传规划、质量多样性搜索、强化学习、神经符号方法到 LLM-MCTS 的演进，重点解释变异、杂交的具体做法与文献依据。"
date: "2026-07-31"
category: "量化 Alpha"
series: "LLM Alpha 因子挖掘论文"
status: "polished"
tags: ["Alpha", "Genetic Programming", "MCTS", "LLM", "论文阅读", "Factor Mining"]
featured: true
draft: false
---

# 自动化因子挖掘中的变异、杂交与搜索范式

## 摘要

公式型 Alpha 因子挖掘的核心问题，是在由原始行情字段、常数、横截面算子与时间序列算子组成的巨大表达式空间中，找到既有预测能力、又足够多样且能被人理解的因子。早期的主线是遗传规划：把因子表示成表达式树，通过选择、杂交、变异和淘汰来搜索高 IC 的公式。近年的主线则逐渐从“随机扰动公式”转向“带约束、带反馈、带语义先验的搜索”：AutoAlpha 用层级基因池和 PCA-QD 改善传统 GP 的低效与同质化；AlphaGen 用强化学习直接优化因子组合的下游表现；AlphaForge 与神经符号方法尝试用生成模型替代纯进化；FAMA、LLM-assisted alpha discovery 和 LLM-MCTS 则把语言模型作为金融语义先验，并通过回测反馈、MCTS 或语法约束控制搜索方向。本文重点回答三个问题：过去算法流程里因子挖掘到底怎么做，常说的变异与杂交具体是什么，以及除了变异和杂交以外还有哪些更现代的搜索机制。

## 1. 问题定义：因子挖掘不是找一个公式，而是找一个可用的因子库

一个公式型 Alpha 通常可以写成：

$$
f: X_{t-\tau+1:t} \rightarrow v_t \in \mathbb{R}^n
$$

其中 $X$ 是股票的历史行情张量，包含 open、high、low、close、volume、vwap 等字段；$v_t$ 是第 $t$ 天所有股票的横截面因子值。评价一个单因子时，最常用的是 IC 或 RankIC，即因子值与未来收益之间的横截面相关性。AutoAlpha 用 IC 衡量公式有效性，并要求挖出的因子之间相关性较低；AlphaGen 进一步指出，现实中使用的是一组因子组合后的 mega-alpha，因此优化目标不应只看单个因子的 IC，而应看新因子加入组合后对下游模型的边际贡献。[^autoalpha][^alphagen]

这也是自动因子挖掘与普通符号回归的差别：普通符号回归常常追求一个最优表达式，而量化研究更需要一个“高质量、低相关、可持续更新”的因子库。Kakushadze 发布的 WorldQuant 101 Formulaic Alphas 是这个方向的重要起点：它把一批真实交易中使用过的公式型 Alpha 公开出来，并展示了这些公式的平均持有期、相关性和收益特征，为后续自动挖掘方法提供了算子、表达式形态和因子库范式。[^alpha101]

## 2. 传统流程：遗传规划如何挖因子

最典型的遗传规划流程如下：

1. 定义搜索空间：叶子节点是原始字段或常数，内部节点是算子，例如 `rank`、`ts_mean`、`correlation`、`std`、`+`、`-`、`*`、`/`。
2. 初始化种群：随机生成一批表达式树，或从简单公式开始。
3. 计算适应度：在训练区间计算 IC、RankIC、ICIR、收益、Sharpe 或加入相关性惩罚。
4. 选择父代：保留或抽样表现较好的公式。
5. 生成子代：通过杂交、变异或直接复制产生新公式。
6. 淘汰与入库：根据适应度、相关性、复杂度和回测结果筛选。
7. 重复迭代，最终得到一批候选因子，再进入组合模型或策略回测。

这里最关键的是公式表示。公式型 Alpha 天然可以表示成表达式树。例如：

```text
(close - open) / (high - low)

        /
      /   \
     -     -
   /  \   /  \
close open high low
```

树表示让“交换局部结构”和“替换局部结构”变得很自然，因此遗传规划成为早期自动因子挖掘的主要工具。AutoAlpha 明确采用这种表达式树表示，并在图示中展示了同深度子树交换的杂交过程。[^autoalpha]

如果把视野放宽到“用遗传规划发现交易规则”，这个传统比公式型 Alpha 挖掘更早。Neely、Weller 与 Dittmar 在 1997 年的 JFQA 论文中用 genetic programming 搜索外汇技术交易规则，并报告了样本外超额收益证据；后续文献也反复讨论 GP 规则在交易成本、风险调整和市场有效性检验下是否仍然稳健。[^neely] 因此，今天量化因子挖掘中常见的 crossover / mutation，并不是来自某个 LLM 因子挖掘论文的发明，而是从遗传规划搜索表达式和交易规则的传统继承过来的；AutoAlpha 的贡献在于把这套机制重新包装到 formulaic alpha 的层级搜索和质量多样性框架中。

## 3. 杂交：把两个公式的局部结构交换

杂交，或者 crossover，本质是从两个父代公式中各取一个子树，然后交换，生成子代。以两个父代为例：

```text
Parent A: rank(ts_mean(close, 20) - close)
Parent B: correlation(volume, close, 10) / std(close, 20)
```

如果从 Parent A 中取 `ts_mean(close, 20)`，从 Parent B 中取 `std(close, 20)`，杂交后可能得到：

```text
Child A: rank(std(close, 20) - close)
Child B: correlation(volume, close, 10) / ts_mean(close, 20)
```

从金融语义上看，杂交试图复用两个父代中的“有效局部结构”。如果 `ts_mean(close, 20)` 表达中期价格水平，`std(close, 20)` 表达波动状态，那么交换它们就是在复用一个已有结构，同时测试这个结构在另一个上下文里是否仍然有效。

AutoAlpha 对普通杂交做了一个重要限制：它在同一深度层级交换子树，以防止公式深度不断膨胀。论文中的直觉依据是“有效高阶因子往往包含至少一个有效 root gene”。也就是说，复杂公式不是凭空有效，而经常包含一个本身已经有预测能力的低阶子结构；因此算法应该先找到有效浅层基因，再用它们构造更深的公式。[^autoalpha-root]

这个观点很适合解释量化里的“因子杂交”：它不是生物学隐喻，而是对子结构重用的搜索策略。一个短期反转子结构、一个成交量异常子结构、一个波动率归一化子结构，可能分别不够强，但被放入合适的算子上下文后，能形成更稳定的横截面排序信号。

## 4. 变异：对一个公式做局部扰动

变异，或者 mutation，是在一个父代公式内部做随机或半随机修改。常见的 GP 变异至少包括三类：[^gplearn]

| 变异类型 | 做法 | 在因子挖掘中的含义 |
|---|---|---|
| 子树变异 | 选择一个子树，用随机生成的新子树替换 | 把一段旧逻辑替换成新逻辑，例如把 `ts_mean(close, 20)` 换成 `ts_rank(volume, 10)` |
| 点变异 | 随机替换若干节点，同类节点替换同类节点 | 改算子或字段，例如 `close` 变成 `vwap`，`mean` 变成 `std` |
| 提升变异 | 选择一个子树，再把其内部子树提升到原位置 | 缩短过度复杂的公式，控制表达式膨胀 |

在量化场景下，还经常有一些领域化变异：

- 时间窗口变异：`ts_mean(close, 20)` 变成 `ts_mean(close, 10)` 或 `ts_mean(close, 60)`。
- 字段替换：`close`、`vwap`、`volume`、`turnover` 之间替换。
- 算子替换：`rank`、`zscore`、`delay`、`delta`、`correlation` 之间替换。
- 归一化变异：给原公式外层加 `rank`、`zscore`、`winsorize` 或行业/市值中性化。
- 方向变异：乘以 `-1`，因为负 IC 因子反向后仍可能有效。

变异的价值是探索父代附近的局部邻域。但问题也很明显：如果完全随机，绝大多数子代要么语法无效，要么经济含义很弱，要么只是训练集上的偶然相关。Harvey、Liu 与 Zhu 对金融研究中的多重检验和 p-hacking 风险有系统讨论，这也是自动化因子挖掘必须控制搜索次数、样本外验证和复杂度的原因。[^harvey]

## 5. AutoAlpha：从随机进化走向层级基因池和质量多样性

AutoAlpha 是自动化公式 Alpha 挖掘中很值得精读的一篇。它不是简单“用 GP 挖因子”，而是针对 GP 的三个问题做改造：有效因子稀疏、搜索容易进入已探索区域、种群容易早熟收敛。[^autoalpha]

第一，层级搜索。AutoAlpha 先枚举深度为 1 的简单公式，筛选有效 root genes，再用这些浅层基因初始化更深层公式。其依据是作者在实验中发现，许多高阶优秀公式包含有效浅层子结构，例如 `vwap/close` 这种均值回复相关结构。[^autoalpha-root]

第二，PCA-QD。AutoAlpha 的目标不是找到一个最优公式，而是找许多高 IC、低相关的公式。直接计算新因子与记录库中所有因子的相似度很贵，所以论文用因子值矩阵的第一主成分近似相似度，并据此把搜索推向未充分探索的区域。这个思路属于 Quality-Diversity 搜索：不仅奖励质量，也奖励行为空间中的多样性。[^autoalpha-qd]

第三，warm start 与 replacement。warm start 是先生成更大候选池，再选 IC 排名前一部分作为初始种群；replacement 不是让子代和全局最差个体比较，而是让子代只与自己的父代比较，降低某些基因在全种群中快速垄断的风险。AutoAlpha 报告中，AutoAlpha 在同一实验设置下挖出的 IC 高于阈值且多样的因子数量显著高于 gplearn 与 101 Alpha 基线。[^autoalpha-result]

## 6. 除了变异和杂交，还有哪些方法

### 6.1 强化学习：把生成公式看作序列决策

AlphaGen 把公式表示成逆波兰表达式（RPN）序列，令智能体逐 token 生成公式。状态是当前已生成的 token 序列，动作是下一个 token；为了保证表达式合法，动作空间会被规则 mask 约束。生成结束后，公式进入组合模型，算法用组合后 mega-alpha 的 IC 作为奖励，并用 PPO 更新生成策略。[^alphagen-method]

这和 GP 的核心差异在于：GP 是在种群上做局部扰动，RL 是学习一个“更可能生成好公式的策略分布”。更重要的是，AlphaGen 直接优化因子组合的下游表现，而不是只优化单因子 IC。它指出，传统 mutual-IC 过滤并不总能代表组合收益：一个单因子 IC 高但与现有组合冗余，边际贡献可能很低；一个单因子 IC 一般但补充了组合缺失的信息，反而可能有价值。[^alphagen]

### 6.2 深度符号优化：用神经网络搜索小模型

Deep Symbolic Regression / DSO 用 RNN 生成数学表达式，并通过 risk-seeking policy gradient 优化表达式分布。它不是专门为金融因子提出的，但给 AlphaGen 这类方法提供了重要思想基础：用一个大模型去搜索小而可解释的公式，并且优化“最优尾部表现”而非平均表现。[^dso]

在金融方向，ADNN/NNAFC 则尝试用神经网络和领域先验替代 GP 的进化过程。相关论文认为 GP 常产生相似度较高、信息增量有限的表达式，而神经网络特征构造可以生成更多样的信息源；但代价是可解释性通常弱于显式公式树。[^adnn][^nnafc]

### 6.3 动态组合：不是只挖因子，还要动态选择和加权

AlphaForge 的重点是两阶段：先生成 factor zoo，再按当下市场环境动态筛选和组合 Mega-Alpha。它承认固定权重和静态因子集难以适应市场状态变化，因此每天根据滚动 IC、ICIR 等条件选因子，并用线性模型组合。[^alphaforge]

这对实际研究很重要：因子挖掘不是结束于“发现公式”，而是结束于“这个公式在什么市场状态、什么股票池、什么组合约束下仍然有效”。因此一个完整流程至少要包含生成、合法性检查、样本内外评价、相关性控制、组合权重、交易成本和回撤诊断。

### 6.4 LLM：把金融语义作为生成先验

FAMA 提出用 LLM 结合 Cross-Sample Selection 与 Chain-of-Experience 进行可解释因子挖掘，试图让语言模型在神经模型和符号模型之间搭桥。[^fama] 随后一些 LLM-assisted 框架进一步比较“LLM 直接生成公式”和“LLM 辅助已有搜索框架”的差异，核心观点是：LLM 直接生成虽然语义更好，但必须接入回测、错误修复和经验库，否则容易停留在看起来合理的已知模式上。[^llmhybrid]

最新的多智能体 LLM alpha mining 也采用 WriterAgent、JudgeAgent 和 BacktestEngine 的闭环，并把 WorldQuant 101 Alphas 作为结构化知识先验，用已有公式模式减少无效搜索。[^selfimproving]

### 6.5 LLM-MCTS：从随机扰动变成“带反馈的定向修复”

Navigating the Alpha Jungle 把 LLM 和 MCTS 结合起来，是近年最接近“研究员式因子迭代”的流程。每个节点是一条候选 Alpha 公式，MCTS 用 UCT 在探索和利用之间平衡；被选中的节点不是简单随机变异，而是根据多维回测反馈选择一个短板维度，例如有效性、稳定性、换手率、多样性或过拟合风险，然后让 LLM 先写 refinement suggestion，再生成具体公式。[^jungle]

这个机制可以理解为“语义化变异”：传统变异问的是“随机改哪里”，LLM-MCTS 问的是“这个因子哪里差，应该沿着什么投资逻辑改”。它还引入 Frequent Subtree Avoidance：从有效因子库中挖掘频繁子树，把过度使用的结构加入提示词黑名单，引导 LLM 避开常见模式，减少公式同质化。[^jungle-fsa]

这与 AutoAlpha 的 root gene 思想有继承关系，但方向相反：AutoAlpha 利用有效 root gene 搭建更深公式；LLM-MCTS 在后期会主动避免过于频繁的 root gene，迫使搜索走向尚未充分开发的结构。

### 6.6 语法约束搜索：把表达式空间先设计好

AlphaCFG 代表了另一条新方向：把因子发现视为“数学语言生成问题”，用面向 Alpha 的上下文无关语法定义合法表达式空间，再用语法感知的 MCTS、Tree-LSTM value/policy network 进行搜索。它强调仅靠事后语法检查效率太低，应该在生成前就用语法和金融语义约束缩小空间。[^alphacfg]

这对你现在的研究尤其有启发：如果 SchemaEvolve 或 LLM-MCTS 经常生成“形式合法但金融上怪异”的公式，那么与其在生成后修，不如在 schema 层提前规定哪些 operand、operator、window、normalization、neutralization 组合才是可解释的。

## 7. 一条更合理的现代因子挖掘流水线

综合以上文献，一个更稳健的现代流程可以设计成：

```text
领域语法 / Schema 空间
  ↓
种子因子：人工因子、101 Alphas、已有 factor zoo、LLM 初稿
  ↓
生成器：GP / RL / LLM / MCTS / CFG-MCTS
  ↓
合法性检查：语法、维度、时间因果、缺失率、常数值、极端值
  ↓
回测评价：IC、RankIC、ICIR、换手率、分层收益、交易成本
  ↓
泛化评价：时序切分、跨股票池、跨市场、bootstrap、样本外衰减
  ↓
多样性控制：相关性、PCA-QD、FSA、语义聚类、行业/风格暴露
  ↓
组合模型：线性组合、LightGBM、XGBoost、动态权重
  ↓
入库：记录公式、来源、修改历史、失败原因、适用市场状态
```

这里的关键不是选择 GP、RL 还是 LLM，而是把搜索过程变成闭环。没有回测反馈，LLM 只是写公式；没有语法约束，RL 和 GP 会浪费大量样本；没有多样性控制，算法会反复发现同一种均值回复或量价背离；没有样本外验证，所有自动挖掘都容易变成对历史噪声的拟合。

## 8. 对“变异”和“杂交”的再理解

变异和杂交不是过时概念，它们只是低层搜索算子。现代算法仍然在做类似事情，只是形式更高级：

| 传统说法 | 现代对应 | 本质 |
|---|---|---|
| 点变异 | LLM 按短板维度改字段、窗口、算子 | 局部结构修正 |
| 子树变异 | MCTS 对一个节点生成 refined formula | 替换一段逻辑 |
| 杂交 | 从 factor zoo 检索有效结构并组合 | 复用多个好子结构 |
| 选择 | UCT、PPO policy、value network、LGBM scorer | 把预算分配给更有希望的区域 |
| 淘汰 | 相关性过滤、FSA、复杂度惩罚、样本外筛选 | 控制过拟合与同质化 |

因此，我更倾向于把自动因子挖掘理解为三层问题：

第一层是表达式空间：你允许算法生成什么样的公式。  
第二层是搜索策略：你如何在巨大空间中分配试错预算。  
第三层是评价与记忆：你如何判断一个公式是真的有效，并把成功与失败经验沉淀下来。

GP 的变异和杂交主要解决第二层；AutoAlpha 加入第一层的层级基因池和第三层的多样性记录；AlphaGen 把第三层的组合收益反馈给第二层；LLM-MCTS 则进一步把第三层的多维反馈翻译成第二层的语义化修复动作。

## 9. 小结

如果只问“因子变异和杂交出自哪篇论文”，最直接的答案是：它们来自遗传规划/遗传算法传统，AutoAlpha 是量化公式 Alpha 挖掘中对这套机制进行系统化改造的代表论文；gplearn 等 GP 工具则提供了标准 crossover、subtree mutation、hoist mutation、point mutation 的实现范式。[^gplearn][^autoalpha] 但如果问“今天还应不应该只靠变异和杂交挖因子”，答案是否定的。

更可靠的方向是：保留表达式树和局部结构复用的优点，但用语法约束减少无效搜索，用回测和样本外验证避免噪声拟合，用质量多样性或 FSA 控制同质化，用 RL/MCTS/LLM 把搜索预算投向更有希望的结构区域。换句话说，变异和杂交是自动因子挖掘的底层动作；真正决定系统上限的，是搜索空间设计、反馈质量和记忆机制。

## 参考文献

[^alpha101]: Zura Kakushadze, “101 Formulaic Alphas,” arXiv:1601.00991 / SSRN, 2016. https://arxiv.org/pdf/1601.00991
[^autoalpha]: Tianping Zhang, Yuanqi Li, Yifei Jin, Jian Li, “AutoAlpha: an Efficient Hierarchical Evolutionary Algorithm for Mining Alpha Factors in Quantitative Investment,” arXiv:2002.08245, 2020. https://arxiv.org/pdf/2002.08245
[^autoalpha-root]: AutoAlpha Section 3.1 提出 effective root gene 假设，并用高阶优秀公式中的 root gene 分布支持“从低阶有效结构附近搜索高阶公式”的设计。https://arxiv.org/pdf/2002.08245
[^autoalpha-qd]: AutoAlpha Section 3.2 使用 PCA-similarity 近似因子相似度，并引入 PCA-QD 将搜索推离已探索区域。https://arxiv.org/pdf/2002.08245
[^autoalpha-result]: AutoAlpha Table 2 报告 AutoAlpha 在发现高 IC、多样公式方面优于 gplearn 与 Alpha101 基线。https://arxiv.org/pdf/2002.08245
[^neely]: Christopher Neely, Paul Weller, Robert Dittmar, “Is Technical Analysis in the Foreign Exchange Market Profitable? A Genetic Programming Approach,” Journal of Financial and Quantitative Analysis, 1997. https://ideas.repec.org/a/cup/jfinqa/v32y1997i04p405-426_00.html
[^gplearn]: gplearn 的 Genetic Programming 实现包含 crossover、subtree mutation、hoist mutation、point mutation 等标准操作，文档和源码引用 Koza 的 Genetic Programming。https://sources.debian.org/src/python-gplearn/0.4.2-5/gplearn/genetic.py
[^harvey]: Campbell R. Harvey, Yan Liu, Heqing Zhu, “... and the Cross-Section of Expected Returns,” Review of Financial Studies, 2016. 该文系统讨论金融因子研究中的多重检验问题。https://academic.oup.com/rfs/article/29/1/5/1843824
[^alphagen]: Shuo Yu et al., “Generating Synergistic Formulaic Alpha Collections via Reinforcement Learning,” KDD 2023 / arXiv:2306.12964. https://arxiv.org/pdf/2306.12964
[^alphagen-method]: AlphaGen Section 3 将公式生成建模为非平稳 MDP，使用 RPN token 序列、valid-action masking、PPO 和组合模型 IC 奖励。https://arxiv.org/pdf/2306.12964
[^dso]: Brenden K. Petersen et al., “Deep Symbolic Regression: Recovering Mathematical Expressions from Data via Risk-Seeking Policy Gradients,” ICLR 2021. https://arxiv.org/pdf/1912.04871
[^adnn]: Jie Fang, Shutao Xia, Jianwu Lin, Yong Jiang, “Automatic Financial Feature Construction,” arXiv:1912.06236, 2019/2020. https://arxiv.org/pdf/1912.06236
[^nnafc]: Jie Fang et al., “Neural Network-based Automatic Factor Construction,” Quantitative Finance, 2020. https://www.tandfonline.com/doi/abs/10.1080/14697688.2020.1814039
[^alphaforge]: Hao Shi et al., “AlphaForge: A Framework to Mine and Dynamically Combine Formulaic Alpha Factors,” arXiv:2406.18394, 2024. https://arxiv.org/pdf/2406.18394
[^fama]: Zhiwei Li et al., “Can Large Language Models Mine Interpretable Financial Factors More Effectively? A Neural-Symbolic Factor Mining Agent Model,” Findings of ACL 2024. https://aclanthology.org/2024.findings-acl.233/
[^llmhybrid]: Shuo Yu et al., “A hybrid approach to formulaic alpha discovery with large language model assistance,” Frontiers of Computer Science, 2026. https://journal.hep.com.cn/fcs/EN/1159676948312023295
[^selfimproving]: Son Minh Vu, Trung The Pham, Viet Hong Tran, “Self-Improving Alpha Mining for Quantitative Trading via Multi-Agent Large Language Models with Knowledge Base Accumulation,” SSRN, 2026. https://papers.ssrn.com/sol3/papers.cfm?abstract_id=6906675
[^jungle]: Yu Shi, Yitong Duan, Jian Li, “Navigating the Alpha Jungle: An LLM-Powered MCTS Framework for Formulaic Factor Mining,” arXiv:2505.11122, 2025. https://arxiv.org/pdf/2505.11122
[^jungle-fsa]: Navigating the Alpha Jungle 提出 Frequent Subtree Avoidance，从有效 Alpha 库挖掘频繁子树并在 LLM 生成时显式避免这些结构。https://arxiv.org/pdf/2505.11122
[^alphacfg]: Han Yang et al., “Alpha Discovery via Grammar-Guided Learning and Search,” arXiv:2601.22119, 2026. https://arxiv.org/pdf/2601.22119
[^qlib]: Xiao Yang, Weiqing Liu, Dong Zhou, Jiang Bian, Tie-Yan Liu, “Qlib: An AI-oriented Quantitative Investment Platform,” arXiv:2009.11189, 2020. https://arxiv.org/pdf/2009.11189
