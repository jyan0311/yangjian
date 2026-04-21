---
title: "LLM | 读论文: 黑盒模型上的在线强化蒸馏算法GAD"
description: "论文提出了一种名为 Generative Adversarial Distillation (GAD) 的框架，旨在解决**黑盒（Black-Box）环境下的大语言模型知识蒸馏问题**。该方法将学生模型视作生成器，并引入一个判别器进行博弈，使得学生模型在无法获取教师模型 logits 的情况下，仍能实现**在线（On-Policy）学习**，大幅超越传统的监督微调（SeqKD）。"
date: "2026-04-21"
tags: ["LLM", "Knowledge Distillation", "RL", "读论文"]
featured: false
draft: false
---

# GAD: 生成对抗蒸馏框架
在大型语言模型（LLMs）的知识蒸馏（Knowledge Distillation, KD）中，通常分为白盒（White-box）和黑盒（Black-box）两种设定。白盒蒸馏可以直接获取教师模型的内部概率分布（logits）进行对齐，但在实际应用中，强大的教师模型（如 GPT-4、GPT-5）往往只提供 API 接口，我们只能获取其生成的文本结果，这就是黑盒蒸馏。[^1]

面对黑盒蒸馏，业界最常用的方法是序列级知识蒸馏（Sequence-level KD, SeqKD），即直接将教师模型的输出作为目标，对学生模型进行监督微调（SFT）。[^2] 然而，近期的研究表明，**在线学习（On-policy learning）**——即让学生模型从自己生成的回复中学习并接收反馈——比单纯模仿教师的“死记硬背”效果更好，能有效缓解过拟合和曝光偏差（Exposure Bias）。[^3]

但在黑盒环境下，如果学生自己生成了一段话，由于无法获取教师模型的 logits 评分，学生不知道自己生成的好坏。为了解决这个“无法获得在线反馈”的核心痛点，本文提出了 **GAD (Generative Adversarial Distillation)** 框架。

### GAD 的核心思想与工作流
GAD 巧妙地将黑盒蒸馏转化为了一个类似 GAN（生成对抗网络）的博弈过程：[^4]

1. **生成器（Generator）：** 就是我们要训练的**学生模型**。它根据输入的 Prompt 生成回复。
2. **判别器（Discriminator）：** 充当**在线奖励模型（On-policy Reward Model）**。它的任务是给回复打分，目标是尽量给教师模型（如 GPT-5）的真实回复打高分，给学生模型自己生成的回复打低分，从而学会“明辨真伪”。

在训练过程中（如论文图 2 所示），这两者进行 minimax 博弈：
* **判别器的更新：** 利用 Bradley-Terry (BT) 损失函数，学习教师和学生回复之间的偏好对齐（确保 $Score_{Teacher} > Score_{Student}$）。
* **生成器的更新：** 使用强化学习算法（如 PPO 或 GRPO），将判别器给出的分数作为 Reward，不断调整策略去“骗过”判别器，即努力生成能获得高分的回复。[^5]

### 与传统 RLHF / RLAIF 的区别
不同于传统 RLHF 中“先训练好一个固定的 Reward Model，然后再去优化 Policy Model”的做法（这容易导致 Reward Hacking，即模型学会了作弊拿高分但不解决实际问题），GAD 中的判别器是**在线且动态更新的 (Co-evolves)**。随着学生模型越来越强，判别器也会变得越来越挑剔，从而提供稳定且持续的监督信号。[^6]

# 核心实验与结论
作者使用 GPT-5-Chat 作为教师模型，使用 Qwen2.5 和 Llama3 系列作为学生模型，在 LMSYS-Chat-1M-Clean 数据集上进行了训练，并使用 GPT-4o 作为裁判进行打分评估。[^4]

### 1. 性能全面超越 SeqKD
在所有参数规模下，GAD 的表现均显著优于传统的 SeqKD 方法。
* **越级挑战：** Qwen2.5-3B 使用 GAD 蒸馏后的性能，追平了使用 SeqKD 蒸馏的 7B 模型；而 Qwen2.5-14B 经过 GAD 训练后，其能力已经逼近了其教师模型 GPT-5-Chat。[^4]
* **泛化能力极强：** SeqKD 往往会过拟合于教师模型的局部文本模式（N-gram overlap 高），导致在分布外（Out-of-Distribution, OOD）的测试集（如 Dolly, Selfinst, Vicuna）上提升微弱甚至倒退。而基于 RL 的 GAD 方法学会了捕捉全局的风格和逻辑，在 OOD 数据集上表现出了惊人的泛化能力（详见论文图 1 右侧）。[^7]

### 2. 关键消融实验发现
* **Warmup（预热）至关重要：** 在进行对抗训练前，必须先用 SeqKD 对生成器和判别器进行 1 个 epoch 的联合预热。如果不预热，一开始差距太大，判别器太容易区分真伪，会导致对抗训练失效。[^4]
* **BT Loss 优于交叉熵：** 在训练判别器时，衡量偏好的 Bradley-Terry Loss 比传统的二分类交叉熵（Cross-Entropy）损失更稳定，能带来更高的最终得分。[^8]
* **模型尺寸需要匹配：** 实验发现，生成器和判别器使用**相同参数规模**的模型效果最好。如果强行用一个 14B 的判别器去指导 7B 的生成器，效果反而不如 7B 指导 7B。[^4]

## 参考注脚

[^1]: [OpenAI API - Logprobs 参数文档](https://platform.openai.com/docs/api-reference/chat/create#chat-create-logprobs)
[^2]: [Sequence Level Knowledge Distillation (Kim & Rush, 2016)](https://arxiv.org/abs/1606.07947)
[^3]: [On-Policy Distillation (Thinking Machines, 2025)](https://thinkingmachines.ai/blog/on-policy-distillation/)
[^4]: [Generative Adversarial Distillation for Black-Box Language Model Compression (Ding et al., 2023)](https://arxiv.org/abs/2306.13649)
[^5]: [Proximal Policy Optimization Algorithms (Schulman et al., 2017)](https://arxiv.org/abs/1707.06347)
[^6]: [Training language models to follow instructions with human feedback (Ouyang et al., 2022)](https://arxiv.org/abs/2203.02155)
[^7]: [The False Promise of Imitating Proprietary LLMs (Gudibande et al., 2023)](https://arxiv.org/abs/2305.15717)
[^8]: [The Bradley-Terry Model and Ranking (Wikipedia)](https://en.wikipedia.org/wiki/Bradley%E2%80%93Terry_model)