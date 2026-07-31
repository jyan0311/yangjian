---
title: "量化交易｜重新思考，从框架层面如何定义和寻找好因子"
description: "从因子挖掘的工程问题抽象为科研问题；按 LLM 进化、显式搜索、端到端三类流派梳理 Merit 设计、使用链路与 Test 验收关系。"
date: "2026-06-18"
tags: ["LLM", "Alpha", "Reward", "Fitness", "Rethink"]
featured: false
draft: false
---



# 量化交易｜重新思考，从框架层面如何定义和寻找好因子

> **整理日期**：2026-06-22  
> **笔记性质**：从因子挖掘的工程问题抽象为科研问题；按 LLM 进化、显式搜索、端到端三类流派梳理 Merit 设计、使用链路与 Test 验收关系。 

---

## 一、如何理解这份整理？

这份笔记在之前的一个笔记的基础之上进行重新思考，从更高的维度上思考如何定义和寻找好因子，主要回答三层递进问题：

| 层次 | 问题 | 对应章节 |
| :--- | :--- | :--- |
| **科研层** | 因子挖掘的本质研究问题是什么？ | §二、§三 |
| **方法层** | 三类流派如何生成候选、如何评判好坏？ | §四、§五、§六 |
| **验收层** | 搜索 Merit 与论文主表 Test IR 是什么关系？ | §七、§八、§九 |

**一条主线**：工程上是「生成 → 回测 → 打分 → 再生成」；科研上是两个子问题的联合求解——

1. **Merit（什么是好）**：用什么 Reward / Fitness / Gate 把回测信号变成可比较的标量或向量？  
2. **Search / Evolution（怎么找）**：用什么机制在公式/程序空间里快速到达好区域？

> **关键认知**：Merit 几乎都在 **Train/Valid** 上算，用来**驱动迭代**；论文主表的 **AER/IR** 多在 **Test + L2.5 组合** 上算，用来**验收**。二者相关，但不是同一个数。

---

## 二、全景概览：从工程到科研

### 2.1 核心科研问题

> **在有限算力与样本下，如何高效找到可泛化、可交易、可解释的 alpha 因子？**

| 子问题 | 形式化 | 工程对应 |
| :--- | :--- | :--- |
| **Q1：Merit 函数** | $f^* = \arg\max_{f \in \mathcal{F}} \mathcal{M}(f; \mathcal{D}_{train})$ | Reward / Fitness / Gate 怎么设计 |
| **Q2：迭代策略** | $\pi^* = \arg\max_\pi \mathbb{E}[\mathcal{M}(f)]$ | LLM 多轮进化 / MCTS·GP·RL 搜索 / 直接优化 PnL |

几乎所有论文的差异，都可以归结为：**$\mathcal{M}$ 长什么样** + **迭代机制怎么更新**。

### 2.2 三大流派

| 流派 | 核心思路 | 「好因子」由谁定义 | 代表论文 |
| :--- | :--- | :--- | :--- |
| **A. 依靠 LLM 进化** | 依赖 LLM 的常识、假设推理、多 Agent 反馈，**逐轮改进想法与公式**；搜索状态藏在对话轨迹与因子库里，而非显式树搜索 | 正则 $R_g$、语义 gate、RAG/家族惩罚；IC 多为**反馈信号**，常作 gate 而非唯一优化目标 | AlphaAgent, QuantaAlpha, Hubble, FAMA |
| **B. 显式搜索** | 在公式树/程序空间里**变异、扩展、选择**；每步用标量或向量 Merit **指引方向**；LLM 常作生成算子，但**指挥棒是 Reward** | 显式 $S(f)$、FS、百分位、多维短板；入库/出库常有硬 threshold | MCTS-Alpha, FactorEngine, CogAlpha, Chain-of-Alpha, AlphaForge |
| **C. 端到端** | 不强调可复用公式或因子库；直接优化**组合 PnL / Sharpe** 或交易决策 | 模拟交易收益、Sharpe 即目标；IC 仅作中间 gate（如有） | TradingAgents, Crypto-Agent, Crypto-GPT |

**边界说明**：

- **FactorEngine** 用 LLM 改代码，但 UCT + FS + 贝叶斯 EI 是主循环 → 归入 **B**；研报/CoE 是先验注入，不改变搜索范式。  
- **QuantaAlpha** 有三 Agent，但 mutation/crossover 按轨迹 $R(\tau)$ 选父代 → 主标签 **A**，搜索 Reward 来自 **B** 的 $L-\lambda R$ 形式。  
- **AlphaForge** 训练小网络学 $\pi(x)$，本质是「有学习先验的搜索」→ 归入 **B**。  
- **FAMA** 优化因子集合 $\gamma(\mathcal{F})$，但迭代靠 LLM + CoE → 归入 **A**；集合级 Merit 是其特色。  
- 各 Qlib 论文最终都用 LightGBM + Top-k 报 IR，那是 **L2.5 验收**，不改变上述三分类。

### 2.3 论文覆盖一览

| 论文 | 流派 | Merit（搜索/迭代用） | 一句话 |
| :--- | :--- | :--- | :--- |
| **MCTS-Alpha** (Shi 2025) | B | 五维相对百分位 $S(f)$ | LLM 生成 + MCTS，多维短板定向改公式 |
| **FactorEngine** (2026) | B | FS + CoE 路径分 $S_{total}$ | 程序进化；LLM 改逻辑，贝叶斯调参 |
| **CogAlpha** | B | 五维百分位 gate | GP 式进化 + MI 非线性 |
| **Chain-of-Alpha** | B | 四维 $S,C,E,D$ + FOC | FGC 探索 + 分维补短板 |
| **AlphaForge** | B | 学习 $\pi(x)$，$P(G(z))$ | 生成器-预测器，学搜索先验 |
| **AlphaAgent** (KDD 2025) | A | $L-\lambda R_g(f,h)$ | 三 Agent 抗 alpha decay |
| **QuantaAlpha** (2026) | A (+B) | 轨迹 $R(\tau)=L-\lambda R(f)$ | 假设驱动 + 轨迹级变异/交叉 |
| **Hubble** | A | score + 家族/RAG 惩罚 | DSL 约束 + LLM 迭代 |
| **FAMA** (ACL 2024) | A | $\gamma(\mathcal{F})$ + CSS | 动态因子组合 + 跨样本选择 |
| **TradingAgents** | C | 日频 PnL | 多 Agent 辩论 → 仓位 |
| **Crypto-Agent / Crypto-GPT** | C (+B) | IC gate / RankIC | 加密市场 OOS Sharpe |


---

## 三、统一符号定义

| 符号 | 含义 | 典型出现 |
| :--- | :--- | :--- |
| $\mathbf{X}_t$ | $t$ 日截面特征（OHLCV 等） | 全部 |
| $y$ / $\mathbf{Y}$ | 未来收益标签 | 全部 |
| $f \in \mathcal{F}$ | 单个因子表达式或程序 | A、B |
| $\mathcal{F}_{zoo}$ | 已通过 gate 的有效因子库 | MCTS, AlphaAgent, Hubble |
| $\mathcal{M}(f)$ | Merit 函数（Reward / Fitness） | 搜索/迭代阶段 |
| $S(f)$, FS | 标量搜索奖励 | 流派 B |
| $R_g(f,h)$ | 正则（复杂度、原创性、假设对齐） | AlphaAgent, QuantaAlpha |
| $R(\tau)$ | 整条生成轨迹的 reward | QuantaAlpha |
| $\gamma(\mathcal{F})$ | 因子集合的联合质量 | FAMA |
| L2 / L2.5 | 因子 IC 层 / LightGBM+Top-k 组合层 | Qlib 系 |

---

## 四、问题定义
| 工程痛点 | 科研表述 | 哪类流派在回应 |
| :--- | :--- | :--- |
| GP 随机搜，百万次才出一个 | **Sample efficiency**：迭代如何利用历史反馈 | B（MCTS/FS/AlphaForge） |
| LLM 生成不可执行 / 语义漂移 | **Semantic alignment**：假设–公式–回测一致 | A（AlphaAgent, QuantaAlpha） |
| 验证集 IC 高，Test 崩 | **Generalization / alpha decay** | A 的 $R_g$；B 的多维 $S(f)$ |
| 单因子 IC 高，组合赚不到 | **Portfolio gap** | B 加 Turnover 维；L2.5 验收 |
| API 贵、参数耦合 | **Macro-micro decoupling** | B（FactorEngine 贝叶斯） |
| 因子同质化 | **Diversity** | B 的 FSA；A 的 AST/CSS/RAG |
| 不要可解释公式，只要赚钱 | **End-to-end objective** | C |

**形式化总目标**：

$$
f^* = \arg\max_{f \in \mathcal{F}} \underbrace{L(f(\mathbf{X}), y)}_{\text{预测力}} - \lambda \underbrace{R(f)}_{\text{正则/门控}}
$$

- **流派 B** 常把 $L$ 的加权版或整体当作**每步搜索的 Reward**  
- **流派 A** 常把 $R$ 当作**硬 gate**，$L$ 进 Agent 反馈，改假设而不只改公式  
- **流派 C** 去掉显式 $f$，直接最大化 Sharpe / PnL

---

## 五、什么是「好因子」？

### 5.1 流派 A：正则门控 + 假设对齐（AlphaAgent）

**设计动机**：纯 IC 优化导致 **alpha decay**；需在经济假设 $h$ 约束下生成**原创、简洁、语义一致**的因子。

$$
f^* = \arg\max_{f} L(f(\mathbf{X}), y) - \lambda R_g(f, h)
$$

$$
R_g = \alpha_1 SL(f) + \alpha_2 PC(f) + \alpha_3 ER(f,h)
$$

$$
ER = \beta_1 S_{AST}(f) + \beta_2 C(h,d,f) + \beta_3 \log(1+|F_f|)
$$

| 项 | 含义 |
| :--- | :--- |
| $SL$ | AST 符号长度 |
| $PC$ | 自由参数个数 |
| $S_{AST}$ | 与 alpha zoo 的 AST 最大公共子树（越大越差，惩罚同质化） |
| $C(h,d,f)$ | 假设–自然语言描述–公式的一致性（Eq.7） |
| $L$ | eval agent 回测 IC/RankIC 等 |

**Merit 如何使用**：

| Agent | 职责 |
| :--- | :--- |
| idea | 生成/ refine 市场假设 $h$（观察–知识–论证–规格四段式） |
| factor | 假设 → AST 因子；须过 $R_g$ **门控** |
| eval | 回测 $L$；反馈 **改假设** 而不仅是改公式 |

5 轮进化 × 20 次独立 trial；Test Table 2：**IC, ICIR, AR, IR, MDD**（2021–2024）。Fig.4 **逐年 IC/RankIC** 是抗衰减的核心证据。

---

### 5.2 流派 A：轨迹 Reward（QuantaAlpha）

**设计动机**：单次 LLM 挖矿是一串决策 $\tau$；应优化**整条轨迹**而非孤立公式；mutation/crossover 比「噪声反馈下整段重生成」更高效。

$$
f^* = \arg\max_{f} L(f(X),y) - \lambda R(f), \quad R(\tau) = L(f_\tau) - \lambda R(f_\tau)
$$

**$R(f)$ 含**：复杂度 $C(f)=\alpha_1 SL+\alpha_2 PC+\alpha_3\log(1+|F_f|)$；AST 冗余 $S(f)=\max_{\phi\in Z}s(f,\phi)$；语义一致性 gate。

**Merit 如何使用**：

| 操作 | 机制 |
| :--- | :--- |
| Mutation | 诊断低 $R(\tau)$ 的决策节点 $k$ → 只改写 $a_k$ 及后缀 |
| Crossover | 按轨迹 $R(\tau)$ 选父代 → LLM 重组高 reward 片段 |
| Test | ~150 因子 → 统一 LightGBM → Table 1：IC/ICIR/RankIC/RankICIR + ARR/IR/MDD |

附录 factor card 展示父代 Rank IC、IC、IR，是 $R(\tau)$ 分量的直观实例。

---

### 5.3 流派 A：score + 家族惩罚（Hubble）

**设计动机**：早期迭代 top-$k$ 被流动性类因子垄断；需 DSL 约束可执行性，并用**家族/相似度/RAG** 惩罚拥挤。

| 机制 | 说明 |
| :--- | :--- |
| DSL + AST | 保证公式可解析、可执行 |
| score($\alpha$) | 综合 IC 等，每轮排序 |
| 家族惩罚 | 抑制同族因子霸占 top-$k$ |
| RAG 反馈 | 每轮 top-5 写入检索库，引导下一轮多样化 |

**Merit 如何使用**：score 排序 → top-5 → RAG；**不做** L2.5 IR 作 Reward。Test：OOS 195 日 **RankIC, IC, HAC t, LS spread**（因子层为主，非组合 IR 主图）。

---

### 5.4 流派 A：集合级 Merit（FAMA）

**设计动机**：单因子 RankIC 高不代表组合好；优化**因子集合** $\mathcal{F}$ 的联合表现，并用 **CSS（Cross-Sample Selection）** 防 few-shot 同质化。

| 组件 | 说明 |
| :--- | :--- |
| $\gamma(\mathcal{F})$ | 加入因子后组合质量应**单调提升** |
| CoE | 历史路径指导 LLM 生成 |
| CSS | 跨样本选例，控制 prompt 多样性 |
| 入库 | RankIC > 0.01 |

**Merit 如何使用**：每轮 LLM 挖因子 → 若 $\gamma$ 提升则加入 $\mathcal{F}$ → 动态 RankIC 加权组合。Test：RankIC/RankICIR + 投资模拟 **SR, AR, Vol**（Top 20% 策略）。


### 5.5 流派 B：相对百分位 + 多维短板（MCTS-Alpha）

**设计动机**：固定 IC 阈值在因子库变强后会过严或过松；单维 IC 无法告诉搜索「下一步改什么」。因此用**相对百分位**衡量「在现有 $\mathcal{F}_{zoo}$ 里排第几」，并用**五维短板**驱动 LLM 定向修复。

$$
R(f, m, \mathcal{F}_{zoo}) = \frac{1}{|\mathcal{F}_{zoo}|} \sum_{f'} \mathbb{I}(m(f) < m(f')), \quad e_i(f) = 1 - R(f, m_i, \mathcal{F}_{zoo})
$$

$$
S(f) = \frac{1}{|\mathcal{D}|} \sum_i e_i(f)
$$

| 维度 | 指标 $m_i$ | 设计动机 |
| :--- | :--- | :--- |
| Effectiveness | RankIC | 预测力 |
| Stability | RankIR | 时间稳定 |
| Turnover | 日换手率 | 可交易 |
| Diversity | 与库内 max corr | 防同质 |
| Overfitting | LLM Judge 0–10 | 防 p-hacking 式复杂公式 |

**FSA（频繁子树避免）**：对 $\mathcal{F}_{zoo}$ 中高频子树建黑名单，强制 LLM 避开 `Pct(close,t)` 等模式。

**Merit 如何使用**：

| 环节 | 机制 |
| :--- | :--- |
| MCTS 回传 | $Q(s_k,a_k) \leftarrow \max(Q, S(f_{new}))$ |
| 选改进维 | $P(i^*|s) = \text{Softmax}((e_{\max}\mathbf{1} - E_s)/T)_i$，最低分维优先 |
| 动态预算 | $S(f_{new})$ 创新高 → 搜索预算 +1 |
| 入库 Gate | RankIC≥0.015, RankIR≥0.3, Turnover≤1.6, corr<0.8 |
| **出库** | 按 **RankIR** top-$k$，**不是** $S(f)$ |

---

### 5.6 流派 B：绝对加权 Fitness（FactorEngine）

**设计动机**：验证集上需要**稳定、可复现**的标量，不依赖动态库；宏微分离要求 Merit 在本地可快速计算以驱动贝叶斯搜索。

$$
FS = \frac{1}{4}\left( IC \times 10 + ICIR + RIC \times 10 + RICIR \right)
$$

| 项 | 权重逻辑 |
| :--- | :--- |
| IC / RIC | ×10，与 ICIR/RICIR 量纲对齐 |
| ICIR / RICIR | 直接加和，奖励时间稳定 |

**路径分**（防重复进化，类似 FSA）：

$$
S_{total}(p_i) = S_{eff}(p_i) - \gamma S_{cov}(p_i), \quad S_{cov}(p_i) = \alpha \frac{|\Phi|}{|p_i|} + \beta \frac{|\Phi|}{|C|}
$$

**Merit 如何使用**：

| 环节 | 机制 |
| :--- | :--- |
| UCT 选节点 | $Q(v)$ = 子树经验**均值**（非 max） |
| 贝叶斯 Phase 2 | 最大化 EI，目标为 **FS** |
| 精英保留 | FS>0.4；每节点 top-10 参数配置 |
| Test | Table 1：IC/RIC 列≈FS 分量；AR/IR/MDD 为盲测组合层 |

---

### 5.7 流派 B：百分位 Gate + MI 非线性（CogAlpha）

**设计动机**：传统 GP 只优化 IC 易过拟合；CogAlpha 用**五维百分位**同时约束有效性、稳定性、换手、多样性与**互信息（MI）非线性**，且用 GP 式 qualified/elite 分层而非 MCTS。

| 层级 | 条件 | 用途 |
| :--- | :--- | :--- |
| Qualified | 五维均超过 **65th** 百分位 | 进入变异池 |
| Elite | 五维均超过 **80th** 百分位 | 参与交叉繁殖 |

五维与 MCTS 类似（IC/RankIC/ICIR/RankICIR、换手、相关等），但 **MI 非线性**是 CogAlpha 独有：要求因子与收益的关系不能仅靠线性 IC 刻画。

**Merit 如何使用**：无 $S(f)$ 标量排序；**硬 gate** 决定谁可变异/交叉。Test 主表：IC/RankIC/ICIR/RankICIR + AER/IR（L2.5）。

---

### 5.8 流派 B：四维分维优化（Chain-of-Alpha）

**设计动机**：MCTS 树搜索复杂度高；Chain-of-Alpha 用 **FGC（Factor Generation Chain）** 做广度探索，**FOC（Factor Optimization Chain）** 按维度补短板，避免显式树。

| 符号 | 含义 |
| :--- | :--- |
| $S$ | RankIC（有效性） |
| $C$ | RankICIR（一致性/稳定） |
| $E$ | Turnover$^{-1}$（可执行性） |
| $D$ | $1 - \min_j \text{Corr}(f, f_j)$（多样性） |

FOC 选中**最低分维**，LLM 针对该维生成改进版公式（思想同 MCTS Softmax 选维，但无 UCT）。

**Merit 如何使用**：FGC 生成候选 → 算四维 → FOC 迭代 → 达标因子进池 → LGBM 组合。摘要报告 CSI500 **AR=0.1324, IR=1.4178**（Test L2.5）。

---

### 5.9 流派 B：学习搜索先验（AlphaForge）

**设计动机**：GP 样本效率低；先从历史好因子**学习**表达式空间中的高 IC 区域分布 $\pi(x)$，再让生成器 $G$ 朝高 $\pi$ 区域采样。

| 组件 | 作用 |
| :--- | :--- |
| 预测器 $P$ | 拟合 $\pi(x)$，输入表达式特征，输出「好坏」代理 |
| 生成器 $G$ | 最大化 $P(G(z))$，$z$ 为噪声 |
| 多样性 | 防模式坍缩的显式 loss |

**Merit 如何使用**：训练阶段用 IC/ICIR 标签训 $P$；搜索阶段 $P(G(z))$ 为 Reward；入库仍用 IC/ICIR/相关 **硬 gate**。Test：滚动 OOS IC、Mega-Alpha 组合、约 9 个月实盘跟踪。



---

### 5.10 流派 C：端到端目标

| 论文 | 优化目标 | 中间 gate | Test 主指标 |
| :--- | :--- | :--- | :--- |
| **TradingAgents** | 多 Agent 辩论 → 单股仓位 → **日频 PnL** | 无显式因子 Merit | **CR, Sharpe, MDD** |
| **Crypto-Agent** | L-S 组合 **Sharpe** | 训练期 IC + IC **t-stat** gate | OOS Sharpe 1.55 等 |
| **Crypto-GPT** | 因子组合收益 | 单因子 **RankIC**；60 日滚动符号翻转 | Table Sharpe, Alpha |

流派 C 的「Merit」就是**可交易结果本身**；若使用 IC gate，仅为过滤，不参与梯度式搜索（Crypto-Agent）。

---

### 5.11 Merit 设计对比总表

| 对比维 | MCTS $S(f)$ | FE FS | AlphaAgent $R_g$ | Quanta $R(\tau)$ | CogAlpha gate | AlphaForge $P$ |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **基准** | 动态 zoo | 固定统计量 | 假设 + AST zoo | 轨迹终端 | 百分位分布 | 历史因子分布 |
| **信号形态** | 多维→标量 | 标量 | gate + $L$ 反馈 | 轨迹标量 | 五维 threshold | 学习标量 |
| **防过拟合** | LLM Judge + FSA | 四阶段时序 | $R_g$ 原创性 | 一致性 gate | MI 非线性 | diversity loss |
| **短板优化** | Softmax 选维 | EI 调参 | 改假设 | 诊断低 reward 节点 | FOC 式 gate 分层 | $G$ 梯度 |
| **与 Test IR** | 间接；出库 RankIR | FS≠IR | Fig.4 衰减 | Table 1 组合 | AER/IR 表 | OOS IC + 实盘 |

---




## 六、终极总结

### 6.1 读任意新论文的四问

1. **流派**：A LLM 进化 / B 显式搜索 / C 端到端？  
2. **Merit**：相对还是绝对？多维还是标量？gate 还是优化目标？  
3. **迭代更新**：$Q$、进化、轨迹 reward、还是 Agent 反馈？  
4. **验收**：主表是 IC 还是 IR？Merit 与 Test 是否同构？

### 6.2 科研地图（一句话）

> 因子挖掘 = 联合设计 **Merit（什么是好）** 与 **迭代机制（怎么找）**。  
> **流派 A** 靠 LLM 假设与反馈进化；**流派 B** 靠变异/搜索 + 显式 Reward 指引；**流派 C** 跳过可复用公式，直接优化交易结果。  
> 工程上的「回测打分」是 Merit 的实例化；论文主表 IR 是 L2.5 验收，与 Merit **相关但非同构**。

### 6.3 瓶颈 → 借鉴

| 瓶颈 | 优先借鉴 |
| :--- | :--- |
| 搜索慢、盲目 | B：MCTS / FS / AlphaForge |
| OOS 衰减、公式雷同 | A：$R_g$、假设闭环；B：FSA / 多维 $S(f)$ |
| IC 高、IR 低 | B：Turnover 维；检查 L2.5 协议 |
| LLM 成本高 | B：FactorEngine 宏微分离 |
| 不要可解释公式 | C：TradingAgents / Crypto |

---

## 附录：Merit 公式速查

| 论文 | 流派 | Merit（搜索/迭代） | 入库 Gate | 出库 |
| :--- | :--- | :--- | :--- | :--- |
| MCTS-Alpha | B | $S(f)=\mathrm{mean}(e_i)$ | RankIC/IR/换手/corr | RankIR top-$k$ |
| FactorEngine | B | FS | FS>0.4 | FS + 贝叶斯 elite |
| CogAlpha | B | 五维 > p65/p80 | 硬下界 | elite 交叉 |
| Chain-of-Alpha | B | $S,C,E,D$ + FOC | 分维阈值 | LGBM |
| AlphaForge | B | $P(G(z))$ | IC/ICIR/corr | 生成器 |
| AlphaAgent | A | $L-\lambda R_g$ | AST/对齐/复杂度 | 进化 zoo |
| QuantaAlpha | A | $R(\tau)=L-\lambda R(f)$ | 一致性+复杂度 | 轨迹进化 |
| Hubble | A | score($\alpha$) | DSL+AST | top-5/轮 |
| FAMA | A | $\gamma(\mathcal{F})$ | RankIC>0.01 | RankIC 加权 |
| TradingAgents | C | PnL | — | 仓位 |
| Crypto-Agent | C | Sharpe；IC t-stat gate | IC gate | L-S |
| Crypto-GPT | C | RankIC | RankIC 筛选 | 组合 Sharpe |

