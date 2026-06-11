---
title: "Toy Experiment: SFT / RLHF / DPO 练习"
description: "一些用于掌握 SFT、RL 和偏好对齐（DPO/ORPO）的小型实验笔记。"
date: "2026-06-11"
tags: ["LLM", "experiment", "notes"]
featured: false
draft: false
---

我需要通过一些 toy experiment 去实现两个目的：

1、 掌握对verl 的了解，熟悉它的sft 训练和 强化学习训练

2、具体的夯实自己对 LLM 的理解

### 第一类：你拥有“绝对正确”的标准答案
**数据格式**：$(x, y)$，即（提示词，人类写的完美回答）。
**应用场景**：监督微调（SFT）、指令微调（Instruction Tuning）。
