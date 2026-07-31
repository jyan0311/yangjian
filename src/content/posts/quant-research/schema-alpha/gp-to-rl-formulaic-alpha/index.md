---
title: "从因子投资到因子挖掘：遗传编程、公式 Alpha 与强化学习的演化"
description: "先从因子、异象、多因子模型与组合实践的整体框架出发，再以 Koza、Kakushadze 与 AlphaGen 为主线，解释公式型 Alpha 挖掘为何从搜索单一表达式走向优化协同因子集合。"
date: "2026-07-31"
category: "量化研究"
series: "Schema Alpha"
status: "polished"
tags: ["遗传编程", "公式型 Alpha", "强化学习", "因子挖掘", "文献综述"]
source: "个人研究笔记；文献综述"
featured: false
draft: false
---

# 从因子投资到因子挖掘：遗传编程、公式 Alpha 与强化学习的演化

## 摘要

公式型 Alpha 挖掘不是从 `open`、`high`、`low`、`close`、`volume` 中“自动拼公式”的孤立任务。它处于因子投资的上游：因子投资先研究哪些特征与收益有关，再把经过验证的因子组合成预测模型与可交易组合；因子挖掘则试图提高其中“提出候选因子”的效率。只有放在这条完整链路里，遗传编程、公式库与强化学习的差别才真正清楚。

本文先以石川、刘洋溢、连祥斌对“因子、多因子模型与异象”的统一叙事为入口：因子不是一个漂亮的公式，而是一个可检验、可组合并最终可用于投资决策的收益相关特征。[^factor-investing-practice] 在这个背景下，Koza（1992）将“写程序”改写为“在程序空间中进化高适应度个体”，为表达式树搜索提供了通用计算范式；Kakushadze（2016）将抽象程序搜索落到金融领域；Yu 等人（2023）的 AlphaGen 则进一步将目标改为协同因子集合的下游价值。[^alphagen]

本文的主张是：三篇工作的真正连续性不在于“都用了智能算法”，而在于它们依次解决了**搜索表示、金融对象和集合目标**三个问题。理解这条主线，才能正确判断遗传算法、强化学习与 LLM 在当代 Alpha 挖掘中各自解决什么，又没有解决什么。

## 1. 先回答：什么是因子投资

石川、刘洋溢、连祥斌的叙事起点不是某一个技术指标，而是一个统一视角：**因子、多因子模型、异象与投资实践属于同一条研究链。**该书先讨论因子投资基础，再进入排序法与回归检验、多因子模型、异象研究和投资实践。[^factor-investing-practice] 这提供了理解因子挖掘最自然的顺序。

### 1.1 因子不是公式，而是收益差异的可检验解释或预测变量

在实证资产定价中，因子可以理解为与资产预期收益相关的系统性来源或共同特征。对个股而言，因子暴露 $\beta_{i,k}$ 描述它对第 $k$ 个因子的敏感度；对横截面选股而言，因子值 $x_{i,t}$ 则是在调仓时点对股票 $i$ 的可观测评分。Fama-French 三因子模型展示了前一种语言：市场、规模与价值相关的共同因子用于描述收益的横截面差异。[^fama-french]

在量化投资实践中，“因子”通常更接近第二种语言：它是一个能将股票排序的特征，例如估值、动量、质量、低波动或量价结构。因子值高低本身不等于收益；只有在明确的股票池、持有期、数据可得性和检验协议下，才可以讨论它是否具有预测能力。

### 1.2 异象、因子与多因子模型如何连接

一条典型的研究链可以写为：

```text
市场中的收益差异或规律
        -> 异象假设
        -> 可计算的公司特征或因子
        -> 排序法 / 回归法检验
        -> 通过筛选的因子库
        -> 多因子预测模型
        -> 有风险和成本约束的投资组合
        -> 实盘监控与因子退役
```

**异象**是一个经验事实或待检验命题，例如过去赢家后续仍可能表现更强；**因子**是把该命题编码为可测量变量的方式；**多因子模型**是将许多因子共同用于解释或预测收益的模型；**因子投资**则是将模型输出转化为组合并承担实施与监控责任。动量的经典证据正是通过赢家/输家组合形成与后续持有期收益来建立，而不是先有一个名为“动量”的神秘公式。[^jegadeesh-titman]

这一区分也防止一个常见误解：一条公式在样本内 IC 为正，只能说明它是“待验证的候选特征”；它还不是风险因子，也不是可投入资金的策略。它必须经过样本外稳定性、与已有因子的增量、交易成本和组合层检验，才能沿着这条链继续向下走。

### 1.3 因子挖掘在整条链上的位置

传统因子研究中，候选主要由研究员从经济理论、行为金融、会计信息或市场微观结构中提出。因子挖掘并不替代后面的排序检验、多因子建模和组合管理；它只改变最上游的候选生产方式：

```text
传统路径：经济直觉 -> 研究员手写候选公式 -> 统一验证 -> 因子库

自动挖掘：字段与算子语言 -> 搜索/生成候选公式 -> 统一验证 -> 因子库
```

因此，挖掘算法应被看成“研究员的候选生成器”，而不是直接的投资决策者。它的产物仍要接受因子投资方法论的约束：时间可得性、横截面检验、样本外验证、冗余控制、交易成本和组合层边际价值。把这个位置放清楚后，后面的技术细节才有意义。

## 2. 为什么公式型 Alpha 挖掘是一个困难的搜索问题

一个常见公式型 Alpha 可写为

$$
f_i(t) = \operatorname{rank}\!\left(
  \frac{\operatorname{ts\_mean}(\text{close}, 20)}{\text{close}}
\right),
$$

其中叶节点是原始字段，内部节点是时间序列、横截面或代数算子。若允许字段集合 $\mathcal X$、算子集合 $\mathcal O$、窗口集合 $\mathcal W$，则深度为 $d$ 的表达式数量会随 $|\mathcal O|$ 与 $d$ 快速增长。更麻烦的是，许多不同的语法树在数值上近似等价，许多看似优秀的树只是在特定样本中偶然与标签对齐。

因此，公式挖掘至少同时面对四个约束：

1. **组合爆炸**：无法穷举所有表达式；
2. **语法与类型合法性**：`rank`、`correlation`、滚动窗口和横截面操作并非可以任意嵌套；
3. **金融可实施性**：候选必须避免前视信息、极端换手和不可交易暴露；
4. **统计选择偏差**：在大量尝试中，总能挑出训练期表现异常好的公式。

这意味着“找高 IC”不是单一的预测问题，而是受约束的符号搜索、统计验证和组合决策问题。后续三篇文献的贡献正好落在这三个层面。

## 3. Koza（1992）：把程序作为可进化的表达式树

Koza 的《*Genetic Programming: On the Programming of Computers by Means of Natural Selection*》提供了一个通用的程序归纳框架：从一群随机生成的程序开始，按适应度选择父代，再通过复制、交叉和变异产生后代，使群体在多代迭代中朝更高适应度演化。[^koza]

### 2.1 对公式因子而言，GP 改变了什么

将公式型 Alpha 写成树后，GP 的对应关系非常直接：

| 遗传编程概念 | 公式型 Alpha 中的对象 |
|---|---|
| 个体 | 一棵因子表达式树 |
| 终端集 | `close`、`volume`、`vwap`、常数、基本面字段 |
| 函数集 | `rank`、`delta`、`ts_mean`、`ts_std`、`correlation` 等算子 |
| 适应度 | IC、RankIC、收益、夏普，或其带惩罚的组合 |
| 交叉 | 交换两棵树的同类型子树 |
| 变异 | 替换节点、窗口、字段或局部子树 |
| 选择 | 保留高适应度且可运行的候选 |

GP 的关键优点不是“随机试公式”，而是**结构化重用**。一棵有效的父代表达式中，可能有局部结构真正捕捉了动量、反转或量价关系；子树交叉允许这些局部结构与其他父代重组。相对独立随机采样，GP 把历史评估结果转化为下一轮搜索的偏置。

### 2.2 但 GP 的适应度并不等于金融价值

在普通符号回归中，适应度常是样本内误差。金融中若直接令

$$
\operatorname{Fitness}(f)=\operatorname{IC}_{train}(f),
$$

系统会偏好偶然与训练标签对齐的复杂树。复杂度越高、尝试次数越多，选择偏差越强。Bailey 等人对回测过拟合的分析指出，在足够多的策略配置中，出色的历史表现可以由选择过程本身制造；若不报告尝试规模，读者无法判断一条回测有多少发现价值。[^backtest-overfitting]

因此，GP 在金融中的正确角色是**候选生成器**，不是因子有效性的最终证明。一个合格的 GP 评估器至少要加入：

$$
\operatorname{Fitness}(f) =
\underbrace{\operatorname{Score}_{valid}(f)}_{\text{样本外预测}}
- \lambda_c\underbrace{\operatorname{Complexity}(f)}_{\text{防止树膨胀}}
- \lambda_t\underbrace{\operatorname{Turnover}(f)}_{\text{摩擦约束}}
- \lambda_r\underbrace{\operatorname{Redundancy}(f)}_{\text{避免重复}}.
$$

这也解释了为什么“变异”和“杂交”本身不是研究结论。它们只定义了如何移动于表达式空间；真正决定搜索质量的是表示语言、适应度函数、验证划分和多样性控制。

## 4. Kakushadze（2016）：把抽象程序搜索变成可管理的 Alpha 库

Kakushadze 的 *101 Formulaic Alphas* 提供了 101 个明确的、可执行的量化交易 Alpha 公式。论文的价值不只在于公开了公式，更在于把因子研究的对象具体化：一个 Alpha 是由字段、算子、延迟与排序规则组成的程序，同时拥有收益、波动、换手和与其他 Alpha 的相关性等组合层属性。[^formulaic-alphas]

这里需要更正一个常见书目错误：该文正式发表为 *Wilmott*（2016），pp. 72–81，DOI 为 `10.1002/wilm.10525`；并非 *Risk, 18(2), 1–17*。[^formulaic-alphas]

### 3.1 从“一个好公式”到“一个好因子库”

如果把 Alpha 当作独立预测器，最自然的目标是最大化单因子 IC 或单策略夏普。但实际多因子系统使用的是集合 $A=\{f_1,\ldots,f_K\}$。此时第 $K+1$ 个候选的价值不取决于自身分数，而取决于它加入现有集合后的边际贡献：

$$
\Delta V(f\mid A) = V(A \cup \{f\}) - V(A),
$$

其中 $V$ 可以是组合预测性能、净收益、风险调整收益或其他下游目标。一个单独 IC 很高、但与现有因子高度重复的公式，可能有 $\Delta V\approx 0$；反之，一个单独较弱、但在不同市场状态提供独立信息的公式，可能有更大组合价值。

Kakushadze 报告的 Alpha 间平均两两相关性较低，并讨论收益、波动、换手和相关性的关系。[^formulaic-alphas] 无论特定样本中的数值能否外推，这个研究视角是持久的：**Alpha 挖掘不是寻找单一冠军，而是构建有足够有效维度的资产库。**

### 3.2 公式库带来的方法论收益

一个显式的公式库至少带来三种研究能力：

- **可比较**：所有候选使用同一套字段、数据对齐和回测协议；
- **可解释**：研究者可检查每个算子对应的经济含义和潜在泄漏；
- **可组合**：可以直接研究相关性、共线性、条件有效性和边际贡献。

它也暴露了一个限制：固定库只能覆盖研究者预先写入的表达式语言。公式库足够好，并不等于搜索空间足够大；搜索空间足够大，也不等于可以免除对低相关、换手和样本外稳定性的要求。

## 5. 从 GP 到领域化搜索：中间文献解决了什么

Koza 的 GP 提供了通用搜索算子，Kakushadze 提供了金融领域的对象和评估维度。二者之间仍有一个鸿沟：金融表达式空间高度离散、重复、非平稳，标准 GP 容易出现树膨胀、早熟收敛和因子同质化。

AutoAlpha 的代表性改进是将层级搜索与质量多样性结合。其目标不只是提升候选的预测力，也要让搜索避开已被充分探索的相似区域，并为下游模型提供多样化的公式型因子。[^autoalpha] 这类工作说明，金融因子挖掘的关键不是把通用 GP 原样搬来，而是把“多样性、复杂度、相似性和下游使用方式”写进搜索过程。

另一个重要转向来自机器学习资产定价：模型可以直接处理大量特征及其非线性交互，但模型复杂度上升会使可解释性、时间可得性和交易稳定性更难验证。Gu、Kelly 与 Xiu 将机器学习比较置于统一的预测与经济评价框架下，这提示公式挖掘研究也不能只报告生成器自身的训练分数。[^gu-kelly-xiu]

## 6. Yu 等人（2023）：把“因子集合的协同”直接写进生成目标

Yu 等人的 KDD 论文 *Generating Synergistic Formulaic Alpha Collections via Reinforcement Learning*，通常被称为 AlphaGen。其最重要的改变不是“用 RL 代替 GP”，而是把优化目标从单一因子改成**协同公式因子集合**：候选因子通过下游组合模型带来的性能改进获得回报。[^alphagen]

### 5.1 为什么单因子挖掘目标与最终任务错位

传统流程通常是：生成一个公式 $f$，计算其 IC，若高于阈值则加入候选池。该流程隐含假设是：单因子质量可以加总为因子集合质量。但多因子模型中，这个假设往往不成立，因为：

- 因子之间可能高度相关，重复信号不会提升组合；
- 某个因子只在已有因子失效的状态下有效，单独平均 IC 可能不突出；
- 下游学习器会吸收交互、非线性和条件关系；
- 最终目标可能是预测损失、排序质量或投资收益，而非任一因子的边际相关。

因此，正确的奖励应近似为候选对当前因子集合的**增量贡献**。AlphaGen 的摘要明确说明，其使用下游组合模型的表现来优化生成器，并将贡献作为强化学习回报。[^alphagen]

### 5.2 将公式生成表述为序列决策

在 AlphaGen 类方法中，一条公式可被逐 token 或逐节点构造。状态 $s_t$ 是当前不完整表达式，动作 $a_t$ 是添加字段、算子或终止符号，策略 $\pi_\theta(a_t\mid s_t)$ 生成完整表达式 $f$。表达式通过语法检查和回测后，其对集合的贡献形成终局回报 $R$。目标为：

$$
\max_\theta\; \mathbb E_{f\sim\pi_\theta}
\left[R\big(f; A, \mathcal D_{train/valid}\big)\right].
$$

与 GP 相比，RL 的优势在于它可以直接学习“在什么部分表达式后更应选择什么下一个算子”的策略，而不只依赖父代子树交换。与纯随机枚举相比，它能复用历史轨迹；与只按单因子 IC 的 RL 相比，集合级回报把冗余和互补性显式纳入目标。

### 5.3 AlphaGen 没有自动解决的四个问题

集合级奖励比单因子适应度更接近最终任务，但它没有绕开以下问题：

1. **奖励昂贵且有噪声**：每次候选评估可能要重训下游模型，回报受样本切分与随机种子影响；
2. **验证期过度使用**：若用同一验证期反复训练策略和选择集合，验证期会被逐步拟合；
3. **经济目标错配**：下游预测改进不一定在交易成本、容量和风险约束下转化为净收益；
4. **解释与因果仍未建立**：公式可读不代表它代表稳定的经济机制。

这些不是 AlphaGen 的缺陷特例，而是所有自动因子挖掘系统共同面对的边界。Harvey、Liu 与 Zhu 讨论的大规模因子检验问题说明，当候选数庞大时，传统单次显著性门槛会制造过多假发现。[^multiple-testing] 因此，RL 的奖励必须结合冻结测试集、滚动样本外验证、复杂度/换手惩罚和独立市场检验。

## 7. 一条完整学术叙事：三个阶段如何衔接

三篇核心文献可以被压缩成下面这条主线：

```text
Koza (1992)
程序 = 可进化表达式树
问题：怎样在巨大程序空间中进行结构化搜索？
方法：选择、交叉、变异，以适应度引导迭代
        ↓
Kakushadze (2016)
Alpha = 可执行且可管理的金融程序
问题：怎样把抽象表达式落为可比较、可组合的因子对象？
方法：显式公式库 + 收益/波动/换手/相关性视角
        ↓
Yu et al. (2023, AlphaGen)
目标 = 有协同作用的公式因子集合
问题：怎样避免逐个高分因子却无法提升下游组合的错位？
方法：以组合模型的边际贡献作为 RL 回报
```

这条线索还揭示了一个更一般的演化：

$$
\text{search for a program}
\;\rightarrow\;
\text{search for a financial signal}
\;\rightarrow\;
\text{search for a useful signal set}.
$$

每一步都改变了“适应度”的含义：从普通任务误差，到单个因子的统计/交易属性，再到因子集合对下游任务的边际价值。算法从 GP 变为 RL 不是最本质的变化；最本质的变化是优化对象从孤立表达式升级为系统中的一个组件。

## 8. 对 Schema Alpha / LLM 因子挖掘的启发

这条主线可以直接用于理解当前的 Schema Alpha 或 LLM 因子挖掘：

- Koza 告诉我们，必须明确**表示语言**与合法变换；
- Kakushadze 告诉我们，必须把候选视为有相关性、换手和可实施性的**因子库成员**；
- AlphaGen 告诉我们，必须用接近下游任务的**集合级边际回报**指导搜索。

LLM 新增的能力是用自然语言先验提出假设、生成代码与解释公式，但它并没有取消这三条约束。一个稳健的现代系统仍应遵循：

$$
\text{semantic hypothesis}
\rightarrow \text{typed expression / executable code}
\rightarrow \text{leakage and feasibility checks}
\rightarrow \text{out-of-sample individual evidence}
\rightarrow \text{marginal value to factor collection}
\rightarrow \text{cost-aware portfolio evaluation}.
$$

如果只保留“LLM 生成更多因子”，系统会回到最原始的多重检验困境；如果只保留“集合级 reward”，又可能把下游模型和验证期共同过拟合。真正可积累的研究资产应包括候选、失败记录、数据版本、搜索轨迹、集合边际贡献和样本外表现，而不是某次回测的冠军公式。

## 9. 结论

Koza、Kakushadze 和 Yu 等人的工作共同构成了一条清晰但常被误读的学术线索。Koza 解决了“如何搜索程序”；Kakushadze 使“程序”成为可评估的金融因子；AlphaGen 则把“好因子”重新定义为能改善因子集合与下游模型的候选。

这条主线的终点不是“用强化学习替代遗传编程”，而是承认 Alpha 挖掘本质上是一个带金融约束、统计选择风险和组合外部性的程序搜索问题。任何后续方法，无论是 GP、RL 还是 LLM，都应被同一套证据标准约束：时间可得性、样本外稳定性、交易成本、冗余控制与集合级增量价值。

## 参考文献

[^koza]: John R. Koza, *[Genetic Programming: On the Programming of Computers by Means of Natural Selection](https://mitpress.mit.edu/9780262527910/genetic-programming/)*, MIT Press, 1992.
[^factor-investing-practice]: 石川、刘洋溢、连祥斌，《[因子投资：方法与实践](https://phei.com.cn/module/goods/wssd_content_comment.jsp?bookid=56644)》，电子工业出版社，2020。该书的目录以“因子投资基础—方法论—主流因子—多因子模型—异象研究—投资实践”组织主题。
[^fama-french]: Eugene F. Fama and Kenneth R. French, “[Common Risk Factors in the Returns on Stocks and Bonds](https://doi.org/10.1016/0304-405X(93)90023-5),” *Journal of Financial Economics*, 1993.
[^jegadeesh-titman]: Narasimhan Jegadeesh and Sheridan Titman, “[Returns to Buying Winners and Selling Losers: Implications for Stock Market Efficiency](https://doi.org/10.1111/j.1540-6261.1993.tb04702.x),” *The Journal of Finance*, 1993.
[^formulaic-alphas]: Zura Kakushadze, “[101 Formulaic Alphas](https://doi.org/10.1002/wilm.10525),” *Wilmott*, 2016, pp. 72–81. 预印本见 [arXiv:1601.00991](https://arxiv.org/abs/1601.00991)。
[^alphagen]: Shuo Yu, Hongyan Xue, Xiang Ao, Feiyang Pan, Jia He, Dandan Tu, and Qing He, “[Generating Synergistic Formulaic Alpha Collections via Reinforcement Learning](https://doi.org/10.1145/3580305.3599831),” *Proceedings of the 29th ACM SIGKDD Conference on Knowledge Discovery and Data Mining*, 2023, pp. 5476–5486. 开放预印本见 [arXiv:2306.12964](https://arxiv.org/abs/2306.12964)。
[^backtest-overfitting]: David H. Bailey, Jonathan Borwein, Marcos López de Prado, and Qiji Jim Zhu, “[Pseudo-Mathematics and Financial Charlatanism: The Effects of Backtest Overfitting on Out-of-Sample Performance](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=2308659),” *Notices of the American Mathematical Society*, 2014.
[^autoalpha]: Tianping Zhang, Yuanqi Li, Yifei Jin, and Jian Li, “[AutoAlpha: an Efficient Hierarchical Evolutionary Algorithm for Mining Alpha Factors in Quantitative Investment](https://arxiv.org/abs/2002.08245),” 2020.
[^gu-kelly-xiu]: Shihao Gu, Bryan Kelly, and Dacheng Xiu, “[Empirical Asset Pricing via Machine Learning](https://doi.org/10.1093/rfs/hhaa009),” *The Review of Financial Studies*, 2020.
[^multiple-testing]: Campbell R. Harvey, Yan Liu, and Heqing Zhu, “[... and the Cross-Section of Expected Returns](https://doi.org/10.1093/rfs/hhv059),” *The Review of Financial Studies*, 2016.
