---
title: "LLM | 整理一个全景的视图"
description: "本文介绍了一个专为大型语言模型（LLMs）设计的知识蒸馏（KD）综合工具箱 EasyDistill。它提供了包含数据合成、监督微调（SFT）、排序优化和强化学习等在内的完整流水线，旨在同时支持 System 1（快思考）和 System 2（慢思考）模型的黑盒与白盒蒸馏实践。"
date: "2026-04-21"
tags: ["LLM", "Knowledge Distillation", "读论文"]
featured: false
draft: false
---
# 一、LLM 主要研究方向（全景图）

大致可以分为 8 个方向：

1. **预训练（Pretraining / Scaling Laws）**
2. **对齐（Alignment）**
3. **推理能力（Reasoning）**
4. **工具使用（Tool Use / Agents）**
5. **知识增强（RAG / Memory）**
6. **多模态（Multimodal）**
7. **高效训练与推理（Efficiency）**
8. **评估与安全（Evaluation & Safety）**

---

# 二、每个方向的代表工作 + 推荐理解路径

---

## 1️⃣ 预训练（基础能力的来源）

### 核心问题

> 模型为什么“什么都会一点”

### 代表作品

* Attention Is All You Need
* Scaling Laws for Neural Language Models
* PaLM: Scaling Language Modeling with Pathways

### 为什么重要

* Transformer 定义了一切
* scaling law 告诉你：**更多数据 + 更大模型 = 更强能力**

👉 这是所有后续能力（reasoning、alignment）的基础

---

## 2️⃣ 对齐（Alignment）

### 核心问题

> 模型“能做” ≠ “该做” → 如何让它符合人类价值

### 代表作品

* Training language models to follow instructions with human feedback
* RLHF
* DPO

### 进化路线

SFT → RLHF → DPO / RLAIF

### 推荐理解重点

* 为什么需要“偏好数据”
* reward model 的作用
* DPO 如何绕开 RL

---

## 3️⃣ 推理能力（Reasoning）

### 核心问题

> 模型如何“像人一样思考”

### 代表作品

* Chain-of-Thought Prompting Elicits Reasoning in Large Language Models
* Self-Consistency Improves Chain of Thought Reasoning
* Tree of Thoughts

### 当前趋势

* 从 prompt → training（如 RL/GRPO）
* 从单路径 → 多路径搜索

---

## 4️⃣ 工具使用 / Agents

### 核心问题

> LLM 本身不够强 → 能不能调用外部工具？

### 代表作品

* ReAct: Synergizing Reasoning and Acting in Language Models
* LangChain
* AutoGPT

### 本质

> LLM = 大脑，工具 = 手脚

---

## 5️⃣ 知识增强（RAG）

### 核心问题

> 模型知识会过时 / 不准确怎么办？

### 代表作品

* Retrieval-Augmented Generation
* OpenAI（大量产品化实践）

### 核心思想

* 不靠记忆 → 靠检索

---

## 6️⃣ 多模态（Multimodal）

### 核心问题

> 模型能否理解图像、音频、视频？

### 代表作品

* CLIP
* GPT-4V
* Gemini

---

## 7️⃣ 高效化（Efficiency）

### 核心问题

> 太贵、太慢 → 怎么降成本？

### 代表作品

* LoRA
* QLoRA
* FlashAttention

---

## 8️⃣ 评估与安全（Evaluation & Safety）

### 核心问题

> 怎么知道模型“真的更好”？

### 代表作品

* MMLU
* HELM

---

# 三、这些方向之间的关系（非常关键）

可以这样理解：

```
Pretraining → 提供基础能力
        ↓
Reasoning → 提升“思考能力”
        ↓
Alignment → 控制行为
        ↓
Tools / RAG → 扩展能力边界
        ↓
Efficiency → 让一切可落地
        ↓
Evaluation → 衡量结果
```

👉 它们不是独立的，而是**层层叠加**

---

# 四、如果你要入门 / 深入，我建议的路线

### 第一阶段（打基础）

1. Transformer（Attention Is All You Need）
2. Scaling Laws

### 第二阶段（核心能力）

3. InstructGPT（alignment 起点）
4. CoT（reasoning 起点）

### 第三阶段（进阶）

5. DPO vs RLHF
6. ReAct（agent）
7. RAG

### 第四阶段（研究方向选择）

根据兴趣分支：

* 想做“更聪明” → reasoning / RL（如 GRPO）
* 想做“更可控” → alignment
* 想做“应用” → agent + RAG

---

# 五、一个更直白的总结

* **Pretraining** 决定“智商上限”
* **Reasoning** 决定“会不会思考”
* **Alignment** 决定“会不会乱说话”
* **Tools / RAG** 决定“能不能干活”
* **Efficiency** 决定“用不用得起”

---

如果你愿意，我可以帮你做一个更具体的东西：
👉 比如“只针对 reasoning + RL（DPO / GRPO）的一条深入论文路线图（带难度分级）”
