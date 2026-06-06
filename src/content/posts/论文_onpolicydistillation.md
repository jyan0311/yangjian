# On-policy distillation
---
title: "On policy Distillation"
description: "Study Notes for OPD"
date: "2026-06-06"
tags: ["LLM", "Knowledge Distillation", "on-policy", "reading notes"]
featured: false
draft: false
---



## 目录

- [On-Policy Distillation](#第一部分on-policy-distillation)
  - [1. Background and Motivation：why we need On-Policy](#1-背景与动机为什么需要-on-policy)
  - [2. Core math framework](#2-核心数学框架)
  - [3. Taxonomy](#3-三维分类法taxonomy)
  - [4. 重要论文详解](#4-重要论文详解)
  - [5. 关键结论、失败模式与开放问题](#5-关键结论失败模式与开放问题)
- [第二部分：Finance Reasoning](#第二部分finance-reasoning)
  - [6. Finance Reasoning 的定位与特殊性](#6-finance-reasoning-的定位与特殊性)
  - [7. 代表性 Benchmark](#7-代表性-benchmark)
  - [8. 代表性金融推理模型](#8-代表性金融推理模型)
  - [9. 金融推理需要特殊解决的问题](#9-金融推理需要特殊解决的问题)
- [第三部分：两条线索的交汇与研究机会](#第三部分两条线索的交汇与研究机会)
- [第四部分：On-Policy Distillation 算法的问题、成因与解决思路](#第四部分on-policy-distillation-算法的问题成因与解决思路)
  - [10. OPD 算法当前面临的核心问题](#10-opd-算法当前面临的核心问题)
- [第五部分：直接将 OPD 应用到 Finance Reasoning 的问题](#第五部分直接将-opd-应用到-finance-reasoning-的问题)
  - [11. 金融场景下 OPD 的失效与风险](#11-金融场景下-opd-的失效与风险)
- [第六部分：算法设计 —— Active Learning + 白盒 On-Policy Distillation for Finance Reasoning](#第六部分算法设计--active-learning--白盒-on-policy-distillation-for-finance-reasoning)
  - [12. AL-OPD 算法设计](#12-al-opd-算法设计)
- [附录：完整文献列表](#附录完整文献列表)

# On-Policy Distllation

### 1. Three paradigms of post-training
The work of Thinking Machines Lab[^1] clearly categories post-training methods into three types, which is the best framework for understanding the value of OPD:


| Method | Sampling | Reward signal |
| --- | --- | --- |
|  SFT / Off-policy  | off-policy | dense|
| RL（on-policy RL） | on-policy | sparse |
| **On-Policy Distillation** | **on-policy** | **dense** |

The core idea of OPD is: **Let the student model sample trajectories from its own policy $\pi(\theta)$ and then let a high-level teacher provide dense feedback for each token of these "student-generated trajectories**

It combines the advantages of on-policy's `distributed correlation` and distullation's `dense supervision`.
> Or it may combine both drawbacks: `off-policy teacher decay` and `rollout time computing` LOL


### 2. Defects of off-policy distllation
Most of LLM distllation works have long been `off-policy`: student train on pre-generated static copora(e.g. trajectories or sequences), learn to replicate the teacher's token-level probabilities on these sequences. However, during inference, students must autogressively continue generating based on their own historical outputs.

This causes a `train-test mismatch` between the training and generated distribution, moreover, this is accumulated along the sequence length.

This is a classic example of `explore bias` in imitation learning: a policy trained only on expert states cannot recover after drifting to unfamiliar states at test time.

The `explore bias` typically has three characteristics:

- This is particularly severe for autoregressive LLMs, where error in early tokens propagaete throughout the entire subsequent sequence;
- The cumulative error grows approximately **with the square of the sequence lenght $O(T^2)$ [^2]
- 



# REFERENCE

[^1][Kevin Lu & Thinking Machines Lab. *On-Policy Distillation.* Thinking Machines Lab: Connectionism, Oct 2025.](https://thinkingmachines.ai/blog/on-policy-distillation)

[^2][S. Ross, G. Gordon, D. Bagnell. *A Reduction of Imitation Learning and Structured Prediction to No-Regret Online Learning (DAgger).](https://arxiv.org/abs/1011.0686)


[^3][Rethinking On-Policy Distillation of Large Language Models: Phenomenology, Mechanism, and Recipe]()

[^4][Revisiting On-Policy Distillation: Empirical Failure Modes and Simple Fixes]()

[^5][Less is More: Early Stopping Rollout for On-Policy Distillation]()