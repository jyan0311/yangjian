---
title: "LLM | 读论文: 小模型的自迭代过程反馈推理增强 SIPF"
description: "论文提出了一种名为 Self-Iterative Process Feedback (SIPF) 的框架，旨在**不依赖外部人工标注或强教师模型的情况下，逐步提升小语言模型（SLMs）的多步推理能力**。该方法通过采样模拟自动构建过程奖励模型（PRM），并利用 ORPO 对自生成的正负样本进行偏好对齐，使模型在数学与代码生成任务上显著超越监督微调与现有自提升基线，同时展现出更强的分布外泛化能力。"
date: "2026-04-22"
tags: ["LLM", "Reasoning", "Self-Training", "ORPO", "Process Reward Model", "读论文"]
featured: false
draft: false
---

# 1. 研究背景与问题设定

小语言模型（SLMs，参数 ≤7B）因其部署成本低、可定制性强而备受关注，但在数学推理、代码生成等多步推理任务上，性能仍远落后于大模型（LLMs）。[^1] 为弥补这一差距，主流方案包括：

- **监督微调（SFT）**：在人工标注或大模型生成的推理链上微调 SLMs，但获取高质量监督信号成本高昂，且 SLMs 受限于参数与数据规模，容易过度自信、泛化能力弱。[^2]
- **自提升方法（Self-Taught / Self-Refine）**：让模型从自己生成的推理路径中学习，例如 STaR [^3] 和 RFT [^4] 仅保留答案正确的样本进行迭代微调；或利用 DPO 对齐自生成的正负样本 [^5]。然而，这些方法大多仅依据**最终答案的正确性**（结果反馈）来判定样本质量，忽视了中间推理步骤的逻辑正确性。

这种“只看结果不看过程”的反馈机制存在严重隐患：答案正确可能只是巧合（推理过程包含错误步骤），而答案错误也可能包含部分正确推理。[^6] 过程监督信号的缺失，限制了 SLMs 推理能力的持续提升。

针对上述问题，本文提出 **SIPF（Self-Iterative Process Feedback）** 框架，核心思想是：**让 SLMs 从自己生成的推理路径中，通过自动化构建的过程奖励模型获取细粒度步骤反馈，并结合 ORPO 进行在线偏好对齐，在多轮迭代中逐步强化正确推理模式、抑制错误推理习惯。**

# 2. 方法：自迭代过程反馈（SIPF）

SIPF 是一个闭环迭代系统，单轮迭代包含五个步骤（图2）。

## 2.1 推理路径采样（Reasoning Paths Sampling）

给定问题集，使用当前模型 \(M_k\) 以高温度 \(T\) 进行多样化解码，为每个问题采样 \(N\) 条不同的思维链推理路径 \(\{\tau_i\}\)。采样后基于推理路径内容（数学任务）或编辑距离（代码任务）进行去重，保证数据多样性。

## 2.2 过程奖励估计（Process Reward Estimation）

如何自动获得每一步的正确性标签？受 MCTS 启发，论文采用**采样模拟**方法 [^7]：对于一条推理路径 \(\tau = (s_0, s_1, \dots, s_m, a)\)，选定中间步骤 \(s_j\)，让一个更强的**模拟器模型**（如 DeepSeek-Math-7B-Instruct）从该步出发，以随机温度继续生成 \(K\) 条补全路径。统计这些模拟路径最终导向正确答案的比例。若超过阈值 \(\delta\)，则标记该步骤为正确（\(c_j = 1\)），否则为错误（\(c_j = 0\)）。公式如下：

$$
c_{i,j} = \begin{cases}
1, & \text{if } \sum_{t=1}^{K} \mathbb{I}(\hat{a}_i^t = a_i^*) > \delta \\
0, & \text{otherwise}
\end{cases}
$$

## 2.3 过程奖励模型（Process Reward Model, PRM）

利用上一步标注的数据集 \(D_{\text{simulate}} = \{q_i, (s_{i,j}, c_{i,j})_{j=1}^{M_i}\}\)，训练一个验证器 \(V\)（通常选用推理能力较强的开源模型，如 DeepSeek-Math-7B-RL），学习预测每个中间步骤的正确性概率 \(\hat{c}_{i,j}\)。损失函数为标准二元交叉熵：

\[
\mathcal{L}_{\text{PRM}} = -\sum_{i}\sum_{j} \left[ c_{i,j} \log \hat{c}_{i,j} + (1 - c_{i,j}) \log (1 - \hat{c}_{i,j}) \right]
\]

训练完成后，PRM 可以对任意推理路径 \(\tau\) 给出一个标量奖励：

\[
r(\tau) = \frac{1}{m} \sum_{j=1}^{m} \hat{c}_{j}
\]

## 2.4 构建偏好数据集与 ORPO 对齐

利用 PRM 对采样路径进行评分，构建偏好对数据集：

\[
D_{\text{pref}} = \{ (q, \tau^w, \tau^l) \mid r(\tau^w) - r(\tau^l) \ge \eta \}
\]

随后使用 **ORPO（Odds Ratio Preference Optimization）** [^8] 进行对齐。ORPO 的优势在于将 SFT 损失与偏好对齐损失合二为一，无需参考模型，且能同时提升正样本生成概率并抑制负样本：

\[
\mathcal{L}_{\text{ORPO}} = -\mathbb{E}_{(q,\tau^w,\tau^l)} \left[ \mathcal{L}_{\text{SFT}}(q,\tau^w) + \beta \log \sigma \left( \log \frac{\text{odds}(\tau^w|q)}{\text{odds}(\tau^l|q)} \right) \right]
\]

其中 \(\text{odds}(\tau|q) = \frac{P(\tau|q)}{1 - P(\tau|q)}\)。

## 2.5 自迭代流程

完成一轮 ORPO 对齐后，得到新模型 \(M_{k+1}\)，将其作为下一轮采样的起点，重复上述步骤。迭代中不断扩充数据集 \(D_{k+1} = D_k \cup D_{\text{sample}}\)，使模型在持续扩大的高质量数据上进化。

# 3. 实验设置

- **模型**：TinyLlama-v1.1、Phi-1.5、Gemma-2B，均采用 QLoRA 高效微调。
- **任务**：
  - 数学推理：GSM8K（域内），MMLU_Math（域外）。
  - 代码生成：MBPP（域内），HumanEval（域外）。
- **模拟器与 PRM**：数学任务使用 DeepSeek-Math-7B-Instruct 和 DeepSeek-Math-7B-RL；代码任务使用 DeepSeek-Coder-6.7B-Instruct。
- **基线**：CoT 提示、SFT、STaR、RFT、RPO、SRF（基于 DPO 的自精炼）及其过程反馈增强版 pRFT / pSRF。

# 4. 实验结果与分析

## 4.1 域内性能显著提升

在数学任务 GSM8K 上，Gemma-2B 经过 SIPF 迭代 3 轮后，准确率从 SFT 的 **31.54%** 提升至 **43.97%**（表1）；在代码任务 MBPP 上，Pass@1 从 SFT 的 **29.75%** 提升至 **33.70%**（表2）。所有模型上 SIPF 均全面超越 SFT 及各类自提升基线。

## 4.2 分布外泛化能力更强

SFT 模型在分布外任务（MMLU_Math、HumanEval）上有时甚至不如零样本 CoT。而 SIPF 在 OOD 任务上依然稳健提升（如 Gemma-2B 在 MMLU_Math 上从 SFT 的 24.01% → 29.10%），表明其习得的是可迁移的通用推理模式，而非死记硬背。

## 4.3 过程反馈 vs 结果反馈

图4 对比了多种自迭代方法在多轮迭代中的性能变化。基于**结果反馈**的方法（RFT、SIOF）在达到性能瓶颈后出现退化；而基于**过程反馈**的 SIPF 与 pRFT 则持续提升。这表明细粒度步骤监督对于推理能力的持续改进至关重要。

## 4.4 为什么用 ORPO 而不是 DPO？

表1-2 显示，基于 DPO 的自精炼方法 SRF 性能甚至低于 SFT。图3 进一步揭示，DPO 在训练过程中**降低**了模型生成正样本（chosen）的概率，导致灾难性遗忘。ORPO 由于保留了 SFT 损失，不仅提升正样本概率，还能有效压低负样本概率，使对齐更稳健。

## 4.5 消融实验

表4 显示，移除过程反馈（w/o PF）、移除 ORPO 损失（w/o OR）、或同时移除两者（w/o PFOR），模型性能均显著下降。此外，ORPO 的相对比率损失权重 \(\beta\) 在 **0.1** 附近效果最佳（图6）。

## 4.6 奖励模型质量分析

表3 评估了不同模型作为 PRM 或 ORM（结果奖励模型）的准确性。PRM 比 ORM 更能精确判断中间步骤正确性，且 PRM 的性能与基座模型的推理能力正相关（DeepSeek-Math 系列优于通用模型 TinyLlama）。

# 5. 局限性与未来工作

- **模型规模限制**：实验仅在 ≤2B 模型上进行，尚未验证在 7B 及以上模型的有效性。
- **任务范围**：当前仅在数学和代码生成任务上验证，对其他推理类型（如常识推理、逻辑谜题）的适用性未知。
- **资源开销**：自迭代流程需多轮采样与 PRM 训练，计算成本较高。

# 6. 总结

SIPF 提出了一种无需外部强监督信号的 SLMs 推理增强框架，通过**过程奖励模型 + ORPO 偏好对齐 + 自迭代**的闭环设计，有效解决了传统自提升方法“只看结果不看过程”的缺陷。实验证明其在多步推理任务上性能提升显著，且具备出色的分布外泛化能力，为低成本、高效率的 SLMs 推理优化提供了新范式。

## 参考注脚

[^1]: [Chain-of-Thought Prompting Elicits Reasoning in Large Language Models (Wei et al., 2022)](https://arxiv.org/abs/2201.11903)
[^2]: [Scaling Relationship on Learning Mathematical Reasoning with Large Language Models (Yuan et al., 2023)](https://arxiv.org/abs/2308.01825)
[^3]: [STaR: Bootstrapping Reasoning With Reasoning (Zelikman et al., 2022)](https://arxiv.org/abs/2203.14465)
[^4]: [RFT: Scaling Relationship on Learning Mathematical Reasoning (Yuan et al., 2023)](https://arxiv.org/abs/2308.01825)
[^5]: [Self-Rewarding Language Models (Yuan et al., 2024)](https://arxiv.org/abs/2401.10020)
[^6]: [Chain-of-Thought Unfaithfulness as Disguised Accuracy (Bentham et al., 2024)](https://arxiv.org/abs/2402.14897)
[^7]: [Let's Verify Step by Step (Lightman et al., 2024)](https://arxiv.org/abs/2305.20050)
[^8]: [ORPO: Monolithic Preference Optimization without Reference Model (Hong et al., 2024)](https://arxiv.org/abs/2403.07691)