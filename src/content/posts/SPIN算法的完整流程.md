---
title: "SPIN (Online DPO) 算法完整流程分析"
description: "SPIN 算法（Online DPO） 的工程流程与核心公式解析。"
date: "2026-06-11"
tags: ["LLM", "DPO", "SPIN"]
featured: false
draft: false
---

# SPIN (Online DPO) 算法完整流程分析

## 一、整体架构概览

SPIN 是一个以 Online DPO 为核心的训练流程。在每个训练 step 中，系统为同一 prompt 生成多个候选 response，然后依据某种 reward 函数把这些 response 排序，进而构造 chosen / rejected 对用于 DPO 损失计算并更新 policy。

核心公式（简要）：

```
L_DPO = -log σ(β · (log π(y_w|x) - log π(y_l|x) - log π_ref(y_w|x) + log π_ref(y_l|x)))
```

## 二、训练流程概述

1. 对每个 prompt 使用当前 policy 采样 n 个 response（常见 n=2）。
2. 计算每个 response 的 token-level reward（或 sequence-level score）。
3. 按 pair 将 scores 转成 chosen / rejected（argmax）。
4. 构造 DPO batch：将 chosen/rejected 分别取出用于 loss 计算（prompt 部分 mask 掉）。
5. 计算 DPO loss，反向传播并更新 actor。

## 三、Reward 的来源与注意点

Reward 可以来自外部评分模型（RM）、自动化测试或规则判题器。可靠的 reward 对训练效果至关重要。

---

（本文为精简版，保留关键段落；如需，我可以把完整原文按章节恢复。）
