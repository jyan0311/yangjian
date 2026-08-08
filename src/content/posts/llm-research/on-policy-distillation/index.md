---
title: "OPD 中的 KL 应放在哪里：从全词表等价性到稀疏估计偏差"
description: "围绕 KL-in-Loss 与 KL-in-Advantage 的争论，系统梳理 On-Policy Distillation 的目标、梯度等价条件、Top-k 截断偏差、采样方差与稳定训练方法。"
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

本文以琵琶流离的技术笔记《OPD 实现细节拆解：KL 放在 Loss，还是放在 Advantage？》为起点，复核其全词表等价性推导，并结合 GKD、Thinking Machines 的 OPD 实现、Rethinking OPD、vOPD、TrOPD 与 KL 梯度估计研究补充适用边界。[^zhihu-note] 核心结论有四点：

1. 在固定前缀、全词表、同一行为策略参数点、无裁剪且 advantage 停止梯度时，直接反向 KL 与全词表策略梯度 surrogate 的局部梯度相同。
2. “Top-k KL”不是一个唯一目标。未归一化的局部和、条件化后的 Top-k KL、带尾部聚合桶的 KL，以及只在 baseline 中使用 Top-k，具有不同的偏差和梯度。
3. sampled-token OPD 并不等于“Top-1 KL loss”。若按策略梯度正确实现，它是全词表反向 KL 梯度的无偏 Monte Carlo 估计；主要问题是方差，而非概率质量必然逃向尾部。
4. 因此，工程选择不能简化为“全词表用 Loss，Top-k 只能用 Advantage”。真正需要先确认的是：目标分布在哪个支撑集上定义、是否重新归一化、截断质量如何处理、梯度经过哪些量，以及一次 rollout 会做多少次参数更新。

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

## 8. 工程选择表

| 可获得的信息与约束 | 推荐起点 | 需要明确记录 |
| --- | --- | --- |
| 可获得完整师生 logits，序列较短 | 直接 full-vocabulary RKL loss | teacher detach、token mask、聚合方式、显存成本 |
| 长 CoT，只能查询 sampled token log-prob | sampled-token PG / K1 | reward detach、行为策略版本、ratio、梯度方差与 outlier |
| sampled-token 方差过大 | vOPD baseline 或可靠的 clipping / masking | baseline 是否 action-independent、裁剪引入的偏差 |
| 只能获得 Top-k logits | 条件 Top-k KL 或质量感知 tail bucket | 支撑集来源、$k$、$Z_p$、$Z_q$、是否归一化 |
| 固定 rollout 做多轮更新 | importance ratio 与 trust-region 约束 | old policy 冻结时点、clip 范围、每批 update epochs |
| 师生头部 token overlap 很低 | off-policy cold start、prompt 筛选或混合 FKL | overlap、熵差、教师是否真正具有新能力 |
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

更稳妥的判断顺序是：先定义目标，再定义支撑集，然后区分偏差与方差，最后才选择 Loss、Reward 或 Advantage 的实现位置。全词表直接 KL 提供低方差的精确局部梯度；sampled-token PG 提供低成本的无偏估计；条件 Top-k 以偏差换取成本；Top-k baseline 则可以只做方差控制。它们不是同一算法的四种拼写，而是具有不同统计性质的估计器。

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
