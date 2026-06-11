---
title: "On policy Distillation"
description: "Study Notes for OPD"
date: "2026-06-06"
tags: ["LLM", "Knowledge Distillation", "on-policy", "reading notes"]
featured: false
draft: false
---

# On-policy distillation

## 目录

- [On-Policy Distillation](#on-policy-distillation)
- [Core math framework](#core-math-framework)
- [Taxonomy](#taxonomy)
- [实践要点与风险](#实践要点与风险)

## On-Policy Distillation

On-policy distillation (OPD) 的核心思想是：让学生模型在自己的策略下采样轨迹，并由高层教师或判分器对每个 token 提供密集反馈，进而构建用于蒸馏的监督信号。

### Core math framework

通过对比 chosen/rejected 的 log-probs，并结合参考策略（可选），构造类似于 DPO 的损失，从而在自采样分布下对学生模型进行密集监督。

### 实践要点与风险

- 需要可靠的 reward/打分函数，否则 chosen/rejected 将是随机的，训练无效。
- rollout 成本高，需注意采样效率与早停策略。

（如需，我可以把原笔记的全文按章节恢复到这份文件中。）
