---
title: "OPD 中的反向 KL 如何计算：从完整目标到 Reward 与 Top-k 估计"
description: "以完整反向 KL 为参考目标，系统解释 On-Policy Distillation 为什么需要 sampled reward、Top-k KL 与控制变量，以及这些替代计算带来的收益、偏差与适用边界。"
date: "2026-08-08"
category: "LLM 研究"
series: "On-Policy Distillation"
status: "polished"
tags: ["OPD", "知识蒸馏", "KL 散度", "策略梯度", "Top-k", "方差缩减"]
source: "基于《OPD 实现细节拆解》及相关论文调研"
featured: false
draft: false
---

## 摘要

On-Policy Distillation（OPD）让学生模型在自己的生成轨迹上接受教师模型的 token 级分布监督。它兼具 on-policy 训练与密集反馈的优点，但一个看似局部的实现问题会改变实际优化目标：反向 KL 应直接作为可微损失，还是先转写成停止梯度的 token reward / advantage，再交给策略梯度更新？

本文以琵琶流离的技术笔记《OPD 实现细节拆解：KL 放在 Loss，还是放在 Advantage？》为起点，复核其全词表等价性推导，并结合 GKD、Thinking Machines 的 OPD 实现、Rethinking OPD、vOPD、TrOPD 与 KL 梯度估计研究补充适用边界。[^zhihu-note] 全文采用一条更清楚的叙事主线：**先把完整词表反向 KL 视为参考目标，再讨论如何在长序列、大词表和远程教师约束下估计它。**

这一理解基本成立，但需要区分“目标”和“估计器”：

1. **完整词表反向 KL**：在固定学生前缀上精确计算参考目标，token 维度没有采样方差，但保存和反传完整师生分布的成本最高。
2. **sampled reward / advantage**：从学生分布抽取 token，用对数概率比构造反向 KL 梯度的 Monte Carlo 估计。正确实现时，它不是换了目标，而是以方差换取计算、显存和通信效率。
3. **Top-k KL 主损失**：用少量候选 token 近似全词表求和，通常降低计算量并提供多 token 监督，但会改变目标或引入截断偏差。
4. **sampled reward + Top-k baseline**：主梯度仍由无偏采样给出，Top-k 只用于近似控制变量；这是把低成本主估计与方差缩减结合起来的混合路线。

所以，“最佳求解就是完整反向 KL，其他方法因计算困难而产生”可以作为入门框架；更严谨的说法是：**当反向 KL 已被选为 OPD 目标时，完整词表计算是局部参考解，Reward 与 Top-k 是具有不同偏差、方差和系统收益的估计方案。**反向 KL 本身并非所有蒸馏问题的绝对最优目标；教师高熵、师生容量差距大或需要覆盖教师多种模式时，forward KL、Jensen--Shannon divergence 或混合目标也可能更合适。[^gkd]

## 理解框架：从参考目标到工程估计器

先固定一个学生已经访问到的前缀 $s_t$。如果学生和教师共享词表，并且我们可以取得两者的完整 logits，那么最直接的参考目标是

$$
L_{\mathrm{full}}(s_t)
=
\sum_{v\in\mathcal V}
p_\theta(v\mid s_t)
\log\frac{p_\theta(v\mid s_t)}{q(v\mid s_t)}.
$$

它回答的是：**在当前前缀上，学生整个下一 token 分布与教师相差多少？** 完整计算会遍历词表中的每一个 token。若批量大小为 $B$、回答长度为 $T$、词表大小为 $|\mathcal V|$，仅 token 分布就具有 $B\times T\times|\mathcal V|$ 的规模。长 CoT、十万级词表与大批量训练叠加后，教师 logits 的传输、激活保存和学生全词表反传都会成为瓶颈。[^vopd]

这时出现了三条主要替代路线：

| 路线 | 怎样减少计算 | 与完整反向 KL 的关系 | 主要交换 |
| --- | --- | --- | --- |
| Full-vocabulary Loss | 不近似，完整求和 | 固定前缀上的精确局部目标 | 成本最高，token 维方差最低 |
| Sampled reward / advantage | 每个位置只抽一个或少量 token | 正确 PG 实现下是梯度的无偏随机估计 | 计算和通信低，但方差高 |
| Top-k KL Loss | 只在确定性候选集合上求和 | 通常是有偏截断近似 | 比单样本更密集、稳定，但遗漏尾部 |
| Sampled reward + Top-k baseline | 采样产生主梯度，Top-k 估计平均奖励 | 主梯度可保持无偏 | 兼顾低反传成本与方差缩减 |

这个表揭示了文章后续所有公式的关系：**Reward 不是与 KL 无关的新训练目标，而是计算 KL 梯度的一种随机方法；Top-k 主损失则通常真的改变了被优化的 KL。**

### 为什么不总是直接计算完整 KL

完整词表反向 KL 的主要困难包括：

- **显存**：每个回答位置都需要保留学生全词表分布参与反向传播。
- **教师服务通信**：若教师通过独立服务提供监督，返回完整 logits 远比只返回 sampled-token 或 Top-k log-prob 昂贵。
- **长序列成本**：推理模型的回答可达数千或数万 token，$T|\mathcal V|$ 使成本线性放大。
- **分布式系统耦合**：完整 logit 蒸馏要求教师与学生在 token 对齐、张量切分和批处理方式上更紧密地协同。

这里要区分“教师前向计算”和“数据保存/传输/反向传播”。教师内部通常仍需产生词表 logits 才能归一化概率，但服务可以只返回被采样 token 的 log-prob 或少量 Top-k 项；学生也可以只对被选中的 token 执行策略梯度式反传。节约主要发生在训练计算图、激活、通信与存储，而不是宣称 softmax 可以在任何模型上完全免费省略。

### 替代计算不只是妥协，也会带来新能力

改用 Reward、Top-k 或混合估计器，最初往往是出于资源约束，但它们还带来一些完整 KL Loss 不天然具备的工程优势：

| 方法 | 除降低成本以外的附加收益 |
| --- | --- |
| Sampled reward | 可直接复用 PPO、importance sampling 等 RL 基础设施；容易与可验证奖励、长度惩罚和安全约束相加；教师只需评价学生实际访问的 token；支持远程黑盒式 log-prob 服务 |
| Advantage + baseline | 可以用控制变量降低重尾 reward 的方差；可按状态中心化信号，使训练关注“比当前位置平均水平更好或更差”的 token |
| Top-k Loss | 每个位置同时监督多个高概率候选，比单样本信号更密集；结果确定、便于调试；可以直接分析师生候选集合 overlap、熵差与头部质量 |
| Top-k baseline | Top-k 近似误差只影响降方差质量，不必直接改变 sampled-token 主梯度的期望目标 |
| Trust-region / clipping 路线 | 可以识别教师与学生严重分歧的位置，限制异常 token 对整个 batch 的支配，并为多轮更新提供稳定边界 |

这些收益同时伴随代价。sampled reward 会引入 Monte Carlo 方差，ratio clipping 会引入偏差；Top-k Loss 会遗漏支撑集之外的信息；把外部任务奖励与 KL reward 相加后，训练目标也不再是纯蒸馏。后文的重点正是说明这些交换如何发生。

### OPD 实际上存在三个近似维度

前面的讨论主要围绕“在固定前缀上怎样近似全词表反向 KL”。Lightning OPD 系列提示我们，完整 OPD 还有另外两个可以被近似或修正的层次：

| 近似维度 | 理想参考 | 常见替代 | 代表方法 |
| --- | --- | --- | --- |
| Action / 词表维度 | 在当前前缀上计算 full-vocabulary RKL | sampled token、Top-k、稀疏 logit | sampled OPD、vOPD、Top-k OPD |
| State / 轨迹维度 | 每轮从当前学生 $\pi_\theta$ 重新生成前缀 | 固定参考策略 $\pi_R$ 的离线 replay | Lightning OPD |
| Reward / 教师语义维度 | 直接使用教师与学生的原始 log-prob 差 | 去除风格、位置或异常 token 分量 | Lightning OPD 2.0、TrOPD |

因此，两个算法即使都采用 sampled-token reward，也可能在“轨迹是否更新”或“reward 是否被修正”上完全不同。判断一个 OPD 方法是否仍在优化同一个参考目标，不能只看它有没有使用 Top-k。

### sampled reward 不是修改 KL，而是估计 KL

这是理解整个方法谱系最关键的一步。反向 KL 本身就可以写成学生分布下的期望：

$$
D_{\mathrm{KL}}(p_\theta\|q)
=
\mathbb E_{a\sim p_\theta}
\left[
\log p_\theta(a)-\log q(a)
\right].
$$

令单 token cost 与 reward 分别为

$$
c(a)=\log p_\theta(a)-\log q(a),
\qquad
r(a)=-c(a)=\log q(a)-\log p_\theta(a).
$$

现在的问题只是：怎样计算期望 $\mathbb E_{a\sim p_\theta}[c(a)]$？

| 计算方式 | 做法 | 统计性质 |
| --- | --- | --- |
| Full vocabulary | 枚举所有 $v\in\mathcal V$，精确求 $\sum_v p(v)c(v)$ | 固定前缀上无 action 采样方差，成本最高 |
| Sampled token | 采样 $a\sim p_\theta$，用单个 $c(a)$ 估计期望 | 期望无偏，单次方差高，成本最低 |
| Top-k | 在确定性集合 $S$ 上计算多个 token | 通常有偏，方差和成本介于两者之间 |

因此 sampled reward 并不是因为研究者认为“KL 不够好”，也不是在 KL 上额外添加了一项。它的提出动机是：**完整词表求和太昂贵，而反向 KL 恰好允许从学生分布采样，用随机样本估计同一个期望。**

为什么这个样本被称为 reward，而不是 sampled loss？原因在于采样 action 本身依赖 $p_\theta$。对固定前缀求反向 KL 梯度，有

$$
\begin{aligned}
\nabla_\theta D_{\mathrm{KL}}(p_\theta\|q)
&=
\mathbb E_{a\sim p_\theta}
\left[
(c(a)+1)\nabla_\theta\log p_\theta(a)
\right]\\
&=
\mathbb E_{a\sim p_\theta}
\left[
c(a)\nabla_\theta\log p_\theta(a)
\right].
\end{aligned}
$$

第二个等号利用了 $\mathbb E_{a\sim p_\theta}[\nabla\log p_\theta(a)]=0$。因此，一个无偏随机梯度样本是

$$
\widehat g(a)
=
-r(a)\nabla_\theta\log p_\theta(a).
$$

这恰好是 Policy Gradient 的形式：模型采样一个 action，获得标量 reward，再用 reward 加权该 action 的 log-prob 梯度。`reward` 这个名称来自优化器接口，而不是因为 KL 被改造成了强化学习任务。实现时 $r(a)$ 必须 stop-gradient；否则会把“采样分布的梯度”和“reward 数值内部的梯度”错误地混在一起。

从统计角度看，full-vocabulary KL 可以理解为对 sampled estimator 的完全期望化，消除了 action 维 Monte Carlo 方差；Top-k 则是只对头部 token 做部分期望化。这比“KL、Reward 和 Top-k 是三种互相竞争的目标”更准确。

### 方法之间的继承关系

下面的关系图描述的是**逻辑继承**，不强行声称论文发表时间完全按此顺序：

```text
选择蒸馏目标
└── Reverse KL
    ├── 怎样计算 action 期望？
    │   ├── Full-vocabulary RKL：精确求和，低方差、高成本
    │   ├── Sampled-token reward：无偏 Monte Carlo，低成本、高方差
    │   │   └── vOPD：给 sampled reward 加 action-independent baseline，降低方差
    │   └── Top-k RKL：截断求和，成本和方差居中，但通常有偏
    │
    ├── 怎样获得训练前缀？
    │   ├── Standard online OPD：持续从当前学生生成
    │   └── Lightning OPD：固定 SFT reference replay，取消在线教师
    │       └── Lightning OPD 2.0：跨教师时去除重复风格分歧
    │
    └── 教师 reward 在所有前缀上都可靠吗？
        ├── TrOPD：识别 mismatch/outlier 区域并改变监督方式
        └── KAT：识别低 KL 但已经失效的前缀并提前终止
```

据此可以把“谁改进了谁”写得更准确：

| 方法 | 直接基线 | 发现的问题 | 主要修改 | 是否仍估计原始局部 RKL |
| --- | --- | --- | --- | --- |
| Full-vocabulary OPD | RKL 定义 | sampled estimator 方差大 | 对 action 维完整求和 | 是，固定前缀上精确 |
| Sampled-token OPD | Full RKL 的期望形式 | 全词表保存、通信、反传昂贵 | 每个位置采样一个 action，以 PG 更新 | 是，正确实现时期望无偏 |
| Top-k OPD | Full RKL | full 太贵、sampled 太噪 | 只监督头部多个 token | 通常不是，存在截断偏差 |
| vOPD | Sampled-token OPD | reward 重尾、梯度方差大 | 减去 action-independent KL baseline | 是，理想条件下不改变期望梯度 |
| Lightning OPD | Online sampled-token OPD | 在线教师服务器和反复 rollout 昂贵 | 固定 $\pi_R$ replay 并缓存教师 chosen-token log-prob | action 估计不变，但 state 分布变为近似 |
| Lightning OPD 2.0 | Lightning OPD | SFT 与 OPD 教师不一致时，风格分歧污染 reward | 对跨 rollout 可预测分歧做残差化 | 否，主动修改有效教师 reward |
| TrOPD | Online sampled-token OPD | 师生严重失配导致极端错误梯度 | trust region、mask/clip、异常区 FKL | 部分区域改变或裁剪目标 |
| KAT | Online sampled-token OPD | 错误前缀中出现低 KL agreement trap | 动态终止弱监督后缀 | token reward 形式不变，但改变采样轨迹 |

还应把 GKD 与 Entropy-Aware OPD 放在更上层理解。GKD 讨论 on/off-policy 数据比例和散度选择，是 OPD 的总体框架；Entropy-Aware OPD 认为教师高熵时纯反向 KL 的 mode-seeking 性质不合适，因此混入 forward KL。它修改的是**蒸馏目标本身**，而不是对同一个 RKL 做更便宜的估计。[^entropy-opd]

## 1. OPD 解决的不是普通的监督学习问题

传统序列级蒸馏通常让教师先生成答案，再把这些静态答案当作监督数据训练学生。训练时，学生看到的是教师访问过的前缀；推理时，它却必须继续处理自己生成的前缀。一步误差会改变后续状态，由此形成 exposure bias。

GKD 将训练分布从固定教师轨迹扩展到学生生成轨迹，并允许在师生分布之间选择不同散度；它因此可以被看作现代 OPD 的直接方法基础。[^gkd] MiniLLM 则从生成模型蒸馏的角度强调反向 KL，并用策略优化处理序列级目标。[^minillm] Thinking Machines 后来的工程化表述更直观：SFT 是“off-policy + dense”，RL 是“on-policy + sparse”，OPD 则试图组合“on-policy + dense”。[^tml-opd]

设提示为 $x$，学生生成序列为 $y=(y_1,\ldots,y_T)$，第 $t$ 步前缀为

$$
s_t=(x,y_{<t}).
$$

学生和教师在该前缀上的分布分别记为

$$
p_\theta(v\mid s_t),\qquad q(v\mid s_t),\qquad v\in\mathcal V.
$$

常见的 token 级 OPD 目标是在学生访问的前缀上最小化反向 KL：

$$
\mathcal L_{\mathrm{OPD}}(\theta)
=
\mathbb E_{x\sim\mathcal D,\,y\sim p_\theta(\cdot\mid x)}
\left[
\sum_{t=1}^{T}
D_{\mathrm{KL}}\!\left(
p_\theta(\cdot\mid s_t)\,\|\,q(\cdot\mid s_t)
\right)
\right].
$$

“On-policy”首先描述的是**前缀从哪里来**：它们来自当前或近期学生策略。至于在每个前缀上如何估计 KL、如何反向传播，是另一层问题。把这两个层次混在一起，是许多实现争论的根源。

## 2. 先澄清三个常被混用的概念

### 2.1 KL in Loss

给定一个已经采样到的前缀 $s_t$，直接计算全词表反向 KL：

$$
L_{\mathrm{RKL}}(s_t)
=
\sum_{v\in\mathcal V}
p_\theta(v\mid s_t)
\log\frac{p_\theta(v\mid s_t)}{q(v\mid s_t)}.
$$

这里的 $p_\theta$ 既充当权重，也位于对数项中，自动微分会经过整个学生分布。若教师 logits 不参与训练，$q$ 应被视为常量。

### 2.2 KL in Reward / Advantage

Thinking Machines 的 sampled-token 实现先让学生采样 $a_t\sim p_{\mathrm{old}}(\cdot\mid s_t)$，再计算

$$
r_t(a_t)
=
\log q(a_t\mid s_t)-\log p_{\mathrm{old}}(a_t\mid s_t),
$$

并把该值停止梯度，作为 token reward 或 advantage 送入 importance-sampling policy loss。[^tml-opd] 更一般的全词表 surrogate 可写为

$$
L_{\mathrm{PG}}(\theta)
=
-\sum_{v\in\mathcal V}
p_{\mathrm{old}}(v\mid s_t)
\rho_\theta(v\mid s_t)
\operatorname{sg}\!\left[A_{\mathrm{old}}(v,s_t)\right],
$$

其中

$$
\rho_\theta(v\mid s_t)
=
\frac{p_\theta(v\mid s_t)}{p_{\mathrm{old}}(v\mid s_t)},
\qquad
A_{\mathrm{old}}(v,s_t)
=
\log q(v\mid s_t)-\log p_{\mathrm{old}}(v\mid s_t).
$$

$\operatorname{sg}$ 表示 stop-gradient。这里所谓“KL 放在 Advantage”，严格地说不是把一个非负 KL 标量塞进 advantage，而是把 KL 的逐 action 被积项转成奖励；若再减去与 action 无关的 baseline，它才成为通常意义上的 advantage。

#### Reward 到底近似了什么

对于从学生分布采样的 token $a\sim p_\theta(\cdot\mid s_t)$，定义

$$
r(a,s_t)
=
\log q(a\mid s_t)-\log p_\theta(a\mid s_t).
$$

它与完整反向 KL 的关系是

$$
\mathbb E_{a\sim p_\theta}[r(a,s_t)]
=
-D_{\mathrm{KL}}\!\left(p_\theta(\cdot\mid s_t)\|q(\cdot\mid s_t)\right).
$$

因此可以从两个层面理解 Reward：

1. **数值层面**：单个 $r(a,s_t)$ 是负反向 KL 被积项的一次随机观测；多个独立样本的平均值会逼近负反向 KL。
2. **梯度层面**：将 $r$ 停止梯度后乘以 $\nabla_\theta\log p_\theta(a\mid s_t)$，得到反向 KL 局部梯度的 score-function 估计。

所以，“Reward 是 KL 的近似和优化形式”这个理解基本正确，但最好改写为：

> Reward 是反向 KL 被积项的 Monte Carlo 样本；Policy Gradient 利用这个样本构造反向 KL 梯度的随机估计。

这里的 stop-gradient 不可省略。如果把

```python
loss = student_sampled_logp - teacher_sampled_logp
```

当作普通监督 loss 直接反传，自动微分只会看到被选 token 的 $\nabla\log p_\theta(a)$，却没有正确处理“token 本身也由 $p_\theta$ 采样”这一事实，得到的不是所需的完整 KL 梯度。正确实现应把 log-ratio 作为固定 reward，并通过 policy ratio 或 score-function 项传递梯度。[^kl-pitfalls]

Reward 形式还提供了一个额外接口：可以在同一 token reward 上组合任务正确性、格式约束、安全惩罚或长度代价。例如

$$
r_{\mathrm{total}}
=
\beta_{\mathrm{KD}}r_{\mathrm{KL}}
+\beta_{\mathrm{task}}r_{\mathrm{task}}
-\beta_{\mathrm{len}}r_{\mathrm{length}}.
$$

这使 OPD 可以直接复用 RL 训练框架。不过此时优化目标已经从“纯反向 KL 蒸馏”变成多目标策略优化；权重选择和奖励尺度会影响最终策略，不能再把结果解释为单纯逼近教师分布。

### 2.3 Top-1 与 sampled token 不是一回事

Top-1 通常表示确定性地选择 $\arg\max_v p(v\mid s_t)$；sampled token 则按完整学生分布随机抽样。前者只追踪一个模式并产生系统偏差，后者会在多次采样中按概率覆盖候选 token。Rethinking OPD 的实验也发现，Top-1 明显不稳定，而 sampled-token OPD 可达到与多个 Top-k 设置相近的表现。[^rethink-opd]

因此，任何把“Top-1”“sampled token”和“单 token 反向传播”直接画等号的判断，都需要重新检查。

## 3. 全词表下，Loss 与 Advantage 为何等价

以下推导只讨论**给定前缀 $s_t$ 时的局部 token 分布**。为简化记号，记 $p_v=p_\theta(v\mid s_t)$、$q_v=q(v\mid s_t)$。

直接反向 KL 的梯度为

$$
\begin{aligned}
\nabla_\theta D_{\mathrm{KL}}(p\|q)
&=
\nabla_\theta\sum_v p_v(\log p_v-\log q_v)\\
&=
\sum_v p_v(\log p_v-\log q_v+1)\nabla_\theta\log p_v.
\end{aligned}
$$

由于 softmax 在全词表上归一化，

$$
\sum_v p_v\nabla_\theta\log p_v
=
\sum_v\nabla_\theta p_v
=
\nabla_\theta 1
=0.
$$

所以

$$
\nabla_\theta D_{\mathrm{KL}}(p\|q)
=
\sum_v p_v(\log p_v-\log q_v)\nabla_\theta\log p_v.
$$

另一方面，在 $\theta=\theta_{\mathrm{old}}$ 处，策略梯度 surrogate 的梯度为

$$
\begin{aligned}
\left.\nabla_\theta L_{\mathrm{PG}}(\theta)\right|_{\theta=\theta_{\mathrm{old}}}
&=
-\sum_v p_{\mathrm{old},v}
A_{\mathrm{old},v}
\nabla_\theta\log p_{\theta,v}\\
&=
\sum_v p_v(\log p_v-\log q_v)\nabla_\theta\log p_v.
\end{aligned}
$$

两式相同。原笔记抓住的正是这个 score-function 恒等式：全词表下，多出来的 $+1$ 项是一个零期望 baseline。[^zhihu-note]

### 3.1 这不是无条件等价

“等价”至少依赖以下条件：

- 比较的是同一个固定前缀上的局部梯度，而不是自动包含所有后续状态分布变化的完整序列梯度。
- 比较点是 $p_\theta=p_{\mathrm{old}}$；固定一批 rollout 做多轮更新后，ratio 不再等于 1。
- advantage 必须停止梯度，否则会额外对 $\log p_\theta$ 求导。
- 未使用 PPO ratio clipping、advantage normalization、token clipping、额外熵正则或不一致的 token 聚合权重。
- 两个模型共享可对齐的词表；跨 tokenizer 时，逐 token KL 本身就没有天然的一一对应关系。

Tang 与 Munos 专门指出，直接对单样本 KL 数值做普通自动微分，以及忽略序列采样分布对参数的依赖，都可能得到错误或不完整的 KL 梯度。[^kl-pitfalls] 因而，“两个 loss 数值看起来一样”并不足以证明实现等价，还应检查计算图。

## 4. sampled-token OPD：问题是方差，不是必然有偏

若 $a\sim p_\theta$，定义单样本梯度估计

$$
\widehat g(a)
=
(\log p_\theta(a)-\log q(a))
\nabla_\theta\log p_\theta(a).
$$

则

$$
\mathbb E_{a\sim p_\theta}[\widehat g(a)]
=
\nabla_\theta D_{\mathrm{KL}}(p_\theta\|q).
$$

所以，只要按 score-function / policy-gradient 形式实现，sampled-token OPD 是局部全词表反向 KL 梯度的无偏估计。它不需要把被采样 token 视为一个“只有一个元素且未归一化的 Top-1 支撑集”。原笔记中“Top-1（准确说 sampled token）直接放进 Loss 会因为 $Z_S$ 很小而崩溃”的结论，混淆了**无偏随机估计**与**确定性截断目标**。

真正的困难是方差。当教师对学生采样 token 给出极低概率时，$\log q(a)-\log p(a)$ 会形成重尾负奖励，少数 token 可能支配梯度。vOPD 将 OPD 解释为策略梯度，并给出一个无需额外 critic 的闭式 baseline：[^vopd]

$$
b(s_t)
=
\mathbb E_{a\sim p_\theta}[r(a,s_t)]
=
-D_{\mathrm{KL}}\!\left(p_\theta(\cdot\mid s_t)\|q(\cdot\mid s_t)\right).
$$

于是

$$
A(a,s_t)
=
r(a,s_t)-b(s_t)
=
\log q(a\mid s_t)-\log p_\theta(a\mid s_t)
+D_{\mathrm{KL}}(p_\theta\|q).
$$

只要 baseline 对当前采样 action 不变并停止梯度，减去它不会改变期望梯度，却可降低方差。vOPD 进一步发现：即使只用 Top-k 近似这个 baseline，主梯度仍由 sampled token 提供，因此 Top-k baseline 的近似误差不会把目标改成 Top-k KL。这一位置差异非常关键。[^vopd]

## 5. Top-k KL 不是一个目标，而是一组目标

设 $S\subset\mathcal V$ 是选出的 Top-k 集合，并记

$$
Z_p=\sum_{v\in S}p_v,
\qquad
Z_q=\sum_{v\in S}q_v.
$$

讨论 Top-k 是否“可用”之前，必须先写清楚以下哪一个量被优化。

### 5.1 未归一化的局部和

$$
L_{\mathrm{partial}}
=
\sum_{v\in S}p_v\log\frac{p_v}{q_v}.
$$

这个量不是概率分布之间的 KL，因此不保证非负。将条件分布定义为 $\bar p_v=p_v/Z_p$、$\bar q_v=q_v/Z_q$，可得

$$
L_{\mathrm{partial}}
=
Z_p\left[
D_{\mathrm{KL}}(\bar p\|\bar q)
+\log\frac{Z_p}{Z_q}
\right].
$$

这说明它同时改变集合内部的相对概率与集合总质量。若实现允许通过减小 $Z_p$ 降低目标，学生确实可能把概率转移到未受监督的尾部；原笔记的“tail mass leakage”直觉主要适用于这一类未归一化截断。[^zhihu-note] 但该现象的强度和方向仍取决于 $Z_q$、集合如何选取、集合是否随参数变化，以及是否存在额外约束，不能外推为所有 Top-k 方案必然崩溃。

### 5.2 条件化的 Top-k KL

Rethinking OPD 明确定义的是重新归一化后的子集 KL：

$$
L_{\mathrm{conditional}}
=
D_{\mathrm{KL}}(\bar p\|\bar q)
=
\sum_{v\in S}
\frac{p_v}{Z_p}
\log
\frac{p_v/Z_p}{q_v/Z_q}.
$$

它是合法且非负的 KL，但比较的是“已知 token 落在 $S$ 中时”的条件分布。它完全忽略 $Z_p$ 与 $Z_q$ 是否相等，因此对完整词表 KL 是有偏近似。Rethinking OPD 报告，在其模型组合中，师生共享 Top-k token 承载了约 97%--99% 的概率质量；这解释了条件 Top-k 在特定设置中为何有效，却不是对任意模型、任意前缀的普遍保证。[^rethink-opd]

### 5.3 带尾部聚合桶的质量感知 KL

若只传输 Top-k logits，又不希望尾部质量凭空消失，可以把整个尾部合并为一个事件：

$$
\begin{aligned}
L_{\mathrm{bucket}}
&=
\sum_{v\in S}p_v\log\frac{p_v}{q_v}\\
&\quad+
(1-Z_p)
\log\frac{1-Z_p}{1-Z_q}.
\end{aligned}
$$

这是把词表粗化为 $k+1$ 个事件后的 KL。它保留集合总质量信息，也不会假装知道尾部内部如何分配。根据 KL 的数据处理性质，它不超过完整词表 KL；因此它仍是近似，但其丢失的信息与偏差来源更透明。

### 5.4 只用 Top-k 近似 baseline

vOPD 的 Top-k 用法不是把训练目标替换为 $D_{\mathrm{KL}}(\bar p\|\bar q)$，而是用它近似 action-independent baseline。主更新仍由 $a\sim p_\theta$ 的单 token 无偏估计给出。[^vopd] 这解释了为什么“KL 在 Loss 里”与“KL 在 Advantage 里”的差异不能只看公式中有没有 `top_k`：近似量处在估计器的哪个位置，决定了它影响偏差还是只影响方差。

### 5.5 支撑集由谁选择同样重要

常见选择包括 student Top-k、teacher Top-k、并集、交集以及 top-p 集合。它们对应不同问题：

| 支撑集 | 保留的信号 | 主要风险 |
| --- | --- | --- |
| Student Top-k | 学生当前最可能访问的 action | 漏掉教师偏好但学生尚未覆盖的模式 |
| Teacher Top-k | 教师高概率模式 | 学生在这些 token 上概率过小，梯度或数值不稳定 |
| 师生交集 | 双方共享的高概率区域 | 容易只做局部重排，难以引入新模式 |
| 师生并集 | 同时覆盖双方头部 | 查询和显存成本更高，集合大小不固定 |
| Student top-p | 近似固定学生覆盖质量 | 集合离散变化，仍需处理教师对应质量 |

稀疏 logit 蒸馏研究也证明，朴素缓存 Top-k 教师概率会形成有偏分布估计；通过随机采样与重要性加权，才可能在稀疏存储下保持期望梯度。[^sparse-logit]

## 6. 对原笔记结论的逐项校正

| 原笔记中的主张 | 判断 | 更准确的表述 |
| --- | --- | --- |
| 全词表 KL-in-Loss 与 KL-in-Adv 梯度等价 | 有条件成立 | 固定前缀、同一 on-policy 参数点、advantage detach、无裁剪时，局部梯度相同 |
| KL-in-Loss 更省工程开销 | 通常成立 | 若已经持有全词表师生 logits，直接 KL 更简单；长 CoT 下全词表反传可能成为显存瓶颈 |
| sampled token 等同于 Top-1 | 不成立 | sampled token 是按 $p$ 的随机样本；argmax Top-1 是确定性且有偏的选择 |
| sampled-token KL-in-Loss 必然崩溃 | 不成立 | 正确的 score-function estimator 无偏但高方差；错误地对单样本标量普通反传才会产生错误梯度 |
| Top-k KL-in-Loss 都会把质量推向 tail | 过度概括 | 主要适用于某些未归一化局部目标；条件 Top-k KL 的问题是忽略支撑集质量，而不是同一个“漏质量”梯度 |
| Rethinking OPD 靠把负 KL 截为 0 才没有崩溃 | 来源对应有误 | 该论文正文将 Top-k 定义为归一化子集 KL；其公开配置使用 token reward 与 Top-k 权重。point-wise KL clipping 更明确见于 OPSD 等稳定化实现，不能移作该论文结论 |

最后一项尤其值得注意：原笔记提供了一个很强的因果解释，但未给出对应代码位置或论文公式。Rethinking OPD 的公开论文将 Top-k 分布重新归一化，并报告不同支撑规模和 overlap 诊断；不能仅凭二手描述把其成功归因于“负 KL 截断”。[^rethink-opd]

## 7. 从“放在哪里”转向“估计什么”：研究主线

### 7.1 GKD：先解决训练状态分布失配

GKD 的关键贡献不是指定唯一 KL 实现，而是把蒸馏写成可调的框架：学生数据和教师数据可以混合，散度也可根据学生容量和任务选择。[^gkd] 从这一视角看，OPD 的第一原则是让教师在学生真正访问的状态上提供监督。

### 7.2 Thinking Machines：把单样本 RKL 接入 RL 基础设施

Thinking Machines 采用 sampled-token 的 $\log p-\log q$ 信号，并通过 importance-sampling loss 更新学生。其实现刻意不使用 Top-k logit 蒸馏，因此它支持的是“单样本无偏但可能高方差”的路线，而不是原笔记讨论的确定性 Top-k 向量 loss。[^tml-opd]

### 7.3 Rethinking OPD：支撑规模不是唯一瓶颈

该工作比较 sampled-token、全词表和条件 Top-k OPD，发现有效训练与师生思维模式兼容、教师是否带来新能力、头部 token overlap 和熵差有关。扩大 $k$ 超过较小阈值未必继续带来收益；低 overlap 时，off-policy cold start 或 teacher-aligned prompt selection 可能比继续扩大支撑集更重要。[^rethink-opd]

### 7.4 vOPD：用控制变量处理 Monte Carlo 方差

vOPD 把“全词表 KL”从需要反传的主损失改作停止梯度的 value baseline。它保留 sampled-token 主梯度的无偏性，同时利用闭式反向 KL 降低方差；Top-k 只近似 baseline 时，也不会直接改变期望梯度。[^vopd] 这给“KL 放在哪里”提供了目前最清楚的统计解释：放进主 loss 会定义优化目标，放进 action-independent baseline 主要改变估计方差。

### 7.5 TrOPD 与 KAT：前缀可靠性不能由局部 KL 单独保证

当师生分布差异很大时，单样本 K1 estimator 会产生重尾梯度。TrOPD 因此区分教师可可靠监督的 trust region 与 outlier region，在异常区域尝试裁剪、屏蔽或 Top-k forward KL，并加入教师前缀的 off-policy guidance。[^tropd]

另一个相反的失效模式是“低 KL 但轨迹已经无可挽回”：教师在错误前缀上也只能局部顺着当前语境预测，于是师生看似一致，却不再提供有效纠错信号。KAT 将其称为 KL agreement trap，并用持续低 KL 作为提前终止 rollout 的信号。[^kat] 这两类结果共同说明：KL 数值既不是单调的监督质量指标，也不能替代对轨迹状态的判断。

### 7.6 Lightning OPD：把在线轨迹近似为固定 SFT replay

标准 sampled-token OPD 每轮从当前学生 $\pi_\theta$ 生成回答，再让在线教师计算这些 token 的 log-prob。它的主要系统负担不是公式本身，而是训练期间必须持续部署教师推理服务。Lightning OPD 提出一个不同方向的近似：**不再实时刷新学生轨迹，而是在训练前一次性固定参考策略的 rollout 与教师分数。**[^lightning-opd]

其流程分为两阶段：

1. 教师 $\pi_T$ 生成 SFT 示范，基础模型在这些示范上训练得到参考策略 $\pi_R$。
2. 从 $\pi_R$ 为每个 OPD prompt 采样固定回答，并让同一个教师一次性计算每个已实现 token 的 $\log\pi_T(a_t\mid s_t)$。训练时只加载这份离线 replay，不再启动教师服务器。

标准在线 OPD 与 Lightning OPD 使用相同的 sampled-token advantage：

$$
A_t(\theta)
=
\log\pi_T(a_t\mid s_t)
-\log\pi_\theta(a_t\mid s_t).
$$

二者差异不在 action 维的 KL 估计，而在产生轨迹的分布：

$$
J_{\mathrm{online}}(\theta)
=
\mathbb E_{x\sim\pi_\theta}
\left[\sum_t A_t(\theta)\right],
$$

$$
J_{\mathrm{Lightning}}(\theta)
=
\mathbb E_{x\sim\pi_R}
\left[\sum_t A_t(\theta)\right].
$$

从重要性采样看，在线目标本应带有轨迹比率 $w(x;\theta)=\pi_\theta(x)/\pi_R(x)$；Lightning OPD 将其近似为 $w=1$。因此，尽管名称保留了 OPD，它在训练阶段实际使用的是**从 SFT 初始化采集的固定、近 on-policy replay**，而不是每一步严格跟随当前策略的数据分布。

这一近似成立的关键条件被论文称为 **teacher consistency**：生成 SFT 示范的教师与 OPD 阶段提供 log-prob 的教师应为同一个模型。作者认为，在这一条件下，离线与在线 OPD 具有相同最优点，梯度差异可被约束；固定 replay 还形成一种隐式正则，使学生不易远离 $\pi_R$。实验中，作者报告 Qwen3-8B-Base 在 AIME 2024 上达到 69.9%，训练成本为 30 GPU 小时，相对标准 OPD 加速约 4 倍。[^lightning-opd]

在本文框架中，Lightning OPD 的位置可以准确描述为：

> 它保留 sampled reward 对局部反向 KL 的估计，但用固定 $\pi_R$ replay 近似不断变化的 $\pi_\theta$ 状态分布，并将教师评价从在线服务改成离线缓存。

它带来的收益不只是少一次教师调用，而是解除训练作业与教师服务的并行部署：GPU 可以集中给学生训练，教师分数可以重复用于多次实验，MoE 教师也不必与学生共同驻留。代价则是 replay 逐渐离策略、无法覆盖训练中新出现的前缀，以及对 teacher consistency 的强依赖。论文自身也把多轮 agent、工具调用和开放式指令跟随列为尚未验证的场景；如果更换教师，还需要重新生成 SFT 数据，这会抵消一部分一次性成本。[^lightning-opd]

### 7.7 Lightning OPD 2.0：跨教师时对 Reward 做风格残差化

Lightning OPD 的 teacher consistency 在真实项目中并不总能满足：SFT 数据可能来自多个未知模型，也可能希望 SFT 使用便宜教师、OPD 再换成更强教师。Lightning OPD 2.0 研究的正是这种 **cross-teacher** 场景，即 SFT 数据生成器 $\pi_G$ 与 OPD 教师 $\pi_T$ 不同。[^lightning-opd2]

固定 replay 中，每个 token 同时由 SFT 参考策略与新教师评分：

$$
\ell^R_{it}=\log\pi_R(y_{it}\mid h_{it}),
\qquad
\ell^T_{it}=\log\pi_T(y_{it}\mid h_{it}).
$$

二者的原始分歧为

$$
d_{it}=\ell^T_{it}-\ell^R_{it}.
$$

论文的核心判断是：$d_{it}$ 混合了两类信号。一类是与当前题目相关的推理纠错，例如教师不认可某个中间结论；另一类是跨题目反复出现的表达偏好，例如转折词、格式、推理长度与行文节奏。后者可能持续惩罚一个逻辑正确但风格不同的 SFT 参考。

2.0 将分歧写成

$$
d_{it}=b(z_{it})+v_{it},
$$

其中 $b(z_{it})$ 表示跨 rollout 可预测的重复分量，$v_{it}$ 是剩余的上下文相关变化。算法按 prompt 将离线 replay 分成多个 fold，只用其他 fold 建立两张平滑 lookup table：

- token identity 表：某个 token 在不同回答中通常受到多大惩罚；
- context 表：由归一化回答位置和参考策略 surprisal 分箱，估计该类位置上的重复分歧。

两张表的平均值形成 held-out 风格代理 $\widehat b_{it}$，随后构造残差化 advantage：

$$
A^{\mathrm{res}}_{it}(\theta)
=
\ell^T_{it}
-\widehat b_{it}
-\log\pi_\theta(y_{it}\mid h_{it}).
$$

cross-fitting 的作用是避免当前 rollout 用自己的分歧解释自己；response-balanced weighting 则防止长回答支配 lookup table。作者在两个跨教师设置中报告，2.0 相对原 Lightning OPD 的平均数学成绩分别提升 3.1 和 1.0 个点，代码成绩均提升 1.4 个点；Klear-Reasoner-8B-SFT 设置达到 AIME 2024 82.4% 和 LiveCodeBench v5 63.0%。[^lightning-opd2]

需要特别区分 Lightning OPD 2.0 与 vOPD：

| 方法 | 减去的量 | 是否依赖采样 token | 对参考目标的影响 |
| --- | --- | --- | --- |
| vOPD baseline | 当前状态下的期望 reward / 负 KL | 否 | 理想条件下不改变期望梯度，主要降低方差 |
| Lightning OPD 2.0 residual | token 与粗粒度上下文上的重复师生分歧 | 是 | 主动改变有效教师 reward，属于去偏假设而非纯方差缩减 |

因此，2.0 不是“更精确地近似原始反向 KL”，而是在跨教师场景下提出：**原始 KL 分歧本身含有不希望学习的风格成分，应先修改 reward，再优化剩余信号。** 这超出了“如何便宜地估计同一个 KL”的范畴，进入“教师分布中的哪些差异值得蒸馏”的问题。

这一结论目前仍应保守理解。论文明确把“跨 rollout 可预测分量”称为风格的操作性代理，并不声称每个可预测分量都属于风格、每个残差都属于正确推理；验证也集中于数学、代码和兼容的 Qwen-family tokenization。Lightning OPD 2.0 是 2026 年 7 月公开的预印本，其跨模型家族、开放式生成和在线 OPD 迁移效果仍需更多复现。[^lightning-opd2]

## 8. 工程选择表

| 可获得的信息与约束 | 推荐起点 | 需要明确记录 |
| --- | --- | --- |
| 可获得完整师生 logits，序列较短 | 直接 full-vocabulary RKL loss | teacher detach、token mask、聚合方式、显存成本 |
| 长 CoT，只能查询 sampled token log-prob | sampled-token PG / K1 | reward detach、行为策略版本、ratio、梯度方差与 outlier |
| sampled-token 方差过大 | vOPD baseline 或可靠的 clipping / masking | baseline 是否 action-independent、裁剪引入的偏差 |
| 只能获得 Top-k logits | 条件 Top-k KL 或质量感知 tail bucket | 支撑集来源、$k$、$Z_p$、$Z_q$、是否归一化 |
| 固定 rollout 做多轮更新 | importance ratio 与 trust-region 约束 | old policy 冻结时点、clip 范围、每批 update epochs |
| 师生头部 token overlap 很低 | off-policy cold start、prompt 筛选或混合 FKL | overlap、熵差、教师是否真正具有新能力 |
| 在线教师服务成本过高，且 SFT 教师来源明确 | Lightning OPD 固定 replay | teacher consistency、$\pi_\theta/\pi_R$、replay 覆盖与策略漂移 |
| SFT 数据来源混杂或必须更换 OPD 教师 | Lightning OPD 2.0 可作为候选 | residual 前后 reward、lookup 覆盖、风格代理消融与任务外泛化 |
| 师生 tokenizer 不同 | 序列级、表示级或对齐后的 span 级蒸馏 | token 对齐方法；不要直接声称逐 token KL 等价 |

一个稳健实验不应只报告最终准确率。至少还应跟踪：

- $Z_p$、$Z_q$ 与 tail mass，确认截断后概率质量如何变化；
- student / teacher Top-k overlap 与 overlap mass；
- sampled reward、advantage、gradient norm 的分位数，而非只有均值；
- 学生熵、教师熵与 entropy gap；
- avg@$k$、pass@$k$、响应长度和提前终止率；
- full-RKL、sampled estimator 与 Top-k approximation 在小模型上的梯度余弦相似度。

## 9. 最小实现检查

下面的伪代码强调计算图，而非提供完整训练框架。

```python
# Full-vocabulary reverse KL: teacher is a fixed target.
student_logp = student_logits.log_softmax(dim=-1)
teacher_logp = teacher_logits.detach().log_softmax(dim=-1)
student_p = student_logp.exp()
loss = (student_p * (student_logp - teacher_logp)).sum(dim=-1)
loss = masked_token_mean(loss, response_mask)
```

```python
# Sampled-token OPD: the log-ratio is a detached reward.
reward = (teacher_sampled_logp - old_student_sampled_logp).detach()
ratio = (student_sampled_logp - old_student_sampled_logp).exp()
loss = -(ratio * reward)
loss = masked_token_mean(loss, response_mask)
```

```python
# vOPD-style baseline: KL changes variance, not the sampled action target.
value = -(student_p * (student_logp - teacher_logp)).sum(dim=-1)
advantage = (reward - value.detach()).detach()
loss = -(ratio * advantage)
loss = masked_token_mean(loss, response_mask)
```

若使用 Top-k，代码审查时必须能回答三个问题：`topk_indices` 来自谁、截断概率是否重新归一化、尾部质量是否进入目标。回答不了这三个问题，就无法从“用了 Top-k KL”推断算法行为。

## 结论

原笔记最有价值的部分，是指出了 stop-gradient 与归一化恒等式对梯度的影响；它提醒我们，KL 出现在公式中的位置会改变计算图。需要修正的是，它把 sampled-token estimator、未归一化 Top-k 局部和与条件 Top-k KL 合并成了同一种情形，因而把一个有条件成立的 tail leakage 分析扩展成了过强的工程禁令。

更稳妥的判断顺序是：先定义目标，再确认 action 支撑集、state 数据分布和教师信号，随后区分偏差与方差，最后才选择 Loss、Reward 或 Advantage 的实现位置。全词表直接 KL 提供低方差的精确局部梯度；sampled-token PG 提供低成本的无偏 action 估计；条件 Top-k 以偏差换取成本；Top-k baseline 可以只做方差控制；Lightning OPD 用固定 replay 近似在线状态分布；Lightning OPD 2.0 则进一步修改跨教师 reward。它们不是同一算法的不同拼写，而是在不同层次做出的统计与系统选择。

[^zhihu-note]: 琵琶流离，〈[OPD 实现细节拆解：KL 放在 Loss，还是放在 Advantage？](https://zhuanlan.zhihu.com/p/280565996)〉，知乎，编辑于 2026-08-05。本文依据用户保存的 PDF 导出版复核其公式与结论。
[^gkd]: Rishabh Agarwal et al., “[On-Policy Distillation of Language Models: Learning from Self-Generated Mistakes](https://arxiv.org/abs/2306.13649),” ICLR 2024. 论文提出 Generalized Knowledge Distillation，以学生自生成序列缓解训练与推理状态分布失配，并比较不同散度与学生/教师数据混合策略。
[^minillm]: Yuxian Gu et al., “[MiniLLM: Knowledge Distillation of Large Language Models](https://arxiv.org/abs/2306.08543),” ICLR 2024. 该工作以反向 KL 和策略梯度式优化蒸馏生成式语言模型，并讨论 exposure bias、长度归一化和方差缩减。
[^tml-opd]: Kevin Lu and Thinking Machines Lab, “[On-Policy Distillation](https://thinkingmachines.ai/blog/on-policy-distillation/),” 2025. 文中公开了 sampled-token reverse-KL reward 与 importance-sampling loss 的伪代码，并明确说明实验未采用 Top-k logit distillation。
[^rethink-opd]: Yaxuan Li et al., “[Rethinking On-Policy Distillation of Large Language Models: Phenomenology, Mechanism, and Recipe](https://arxiv.org/abs/2604.13016),” arXiv:2604.13016, 2026. 该预印本区分 sampled-token、full-vocabulary 与归一化 Top-k OPD，并分析 overlap、熵差、教师新增能力和长轨迹信号衰减。
[^kl-pitfalls]: Yunhao Tang and Remi Munos, “[On a Few Pitfalls in KL Divergence Gradient Estimation for RL](https://arxiv.org/abs/2506.09477),” arXiv:2506.09477, 2025. 作者分析了对 KL 样本估计错误反传以及忽略序列结构所造成的梯度偏差。
[^vopd]: Minjae Oh et al., “[KL for a KL: On-Policy Distillation with Control Variate Baseline](https://arxiv.org/abs/2605.07865),” arXiv:2605.07865, 2026. 该预印本提出 vOPD，用闭式负反向 KL 作为 action-independent baseline，并区分 Top-k 主损失与 Top-k baseline 的偏差性质。
[^sparse-logit]: Anshumann et al., “[Sparse Logit Sampling: Accelerating Knowledge Distillation in LLMs](https://aclanthology.org/2025.acl-long.885/),” ACL 2025. 论文证明朴素 Top-k logit 缓存会形成有偏估计，并以重要性采样构造稀疏但期望无偏的替代方案。
[^tropd]: Xingrun Xing et al., “[Trust Region On-Policy Distillation](https://arxiv.org/abs/2606.01249),” arXiv:2606.01249, 2026. 该预印本围绕师生分布失配下的监督可靠性，引入 trust region、outlier 处理与 off-policy guidance。
[^kat]: Haoran Xin et al., “[Escaping the KL Agreement Trap in On-Policy Distillation](https://arxiv.org/abs/2606.09471),” arXiv:2606.09471, 2026. 该预印本指出错误前缀上可能出现低 KL 但弱监督的 agreement trap，并提出在线终止规则。
[^lightning-opd]: Yecheng Wu, Song Han, and Han Cai, “[Lightning OPD: Efficient Post-Training for Large Reasoning Models with Offline On-Policy Distillation](https://arxiv.org/abs/2604.13010),” arXiv:2604.13010, 2026. 论文与[公开代码](https://github.com/jet-ai-projects/Lightning-OPD)提出固定 SFT reference rollout、离线缓存 chosen-token 教师 log-prob，并以 teacher consistency 解释离线与在线 OPD 的关系。
[^lightning-opd2]: Yecheng Wu, Song Han, and Han Cai, “[Lightning OPD 2.0: Mitigating Style Bias in Cross-Teacher On-Policy Distillation for Large Reasoning Models](https://arxiv.org/abs/2607.28449),” arXiv:2607.28449, 2026. 该预印本以 rollout-level cross-fitting 估计跨样本重复出现的师生分歧，将其作为风格偏差代理从 token reward 中扣除。
[^entropy-opd]: Woogyeol Jin et al., “[Entropy-Aware On-Policy Distillation of Language Models](https://arxiv.org/abs/2603.07079),” arXiv:2603.07079, 2026. 该预印本在教师高熵 token 上引入 forward KL，以缓解纯反向 KL 的模式收缩和不稳定监督。
