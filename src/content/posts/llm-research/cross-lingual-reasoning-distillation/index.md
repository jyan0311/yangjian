---
title: "跨语言场景的模型蒸馏与英语推理中心化：从数学推理到医疗推理的文献综述"
description: "系统梳理跨语言推理中的英语中心化、语言混合、推理蒸馏与资源感知训练：先讨论数学推理的评测与训练路线，再进入医疗推理的高风险验证问题，并提出可检验的研究议程。"
date: "2026-08-08"
category: "LLM 研究"
series: "多语言推理与强化学习"
status: "polished"
tags: ["跨语言蒸馏", "多语言推理", "数学推理", "医疗大模型", "Chain-of-Thought", "低资源语言"]
source: "基于 Math-Beyond-English 文献库与补充调研"
featured: true
draft: false
---

# 跨语言场景的模型蒸馏与英语推理中心化：从数学推理到医疗推理的文献综述

> **核心判断**：今天的多语言推理模型往往不是在所有语言中同等地“思考”，而更像是让非英语问题经由英语或其他高资源语言的表征通道进入一个较强的推理核心。蒸馏的真正问题因此不只是把教师答案翻译给学生，而是：**如何迁移高资源语言的推理能力，同时保留目标语言的语义锚点、表达权与可审计性。**

## 摘要

推理型大语言模型在数学、代码与科学任务中快速进步，但其训练数据、推理轨迹与评测长期以英语和少数高资源语言为中心。低资源语言用户面对的并不只是翻译质量下降，而是从题意解析、内部表示、推理轨迹到最终回答的整条能力链可能发生失配。本文以“英语推理中心化”为主线，综述跨语言模型蒸馏与推理研究，并将问题分为四个层次：语言输入能否进入共享推理空间、模型应以哪种语言生成中间推理、教师的推理行为如何被迁移到目标语言学生、以及评测是否能区分推理正确性、语言忠实性和领域安全性。

叙事顺序刻意遵循训练链条：先讨论数学推理，因其答案可验证、最适合揭示跨语言推理差距和蒸馏机制；再讨论医疗推理，因其要求在更高风险下同时处理语言可及性、知识检索和临床边界。本文综合本地文献库中的 PluraMath、Language-Mixed CoT、COPSD、CURE-Med、Med-CoReasoner 等工作，并补充 LMU 研究者参与的语言混合与多语言 latent reasoning 分析，以及早期跨语言表示蒸馏研究。文章最后提出一组可检验的研究问题和一条面向低资源语言的技术路线。

## 1. 问题不是翻译：为什么跨语言推理需要单独研究

令问题语言为 $\ell_q$，中间推理语言为 $\ell_r$，最终回答语言为 $\ell_a$。一个跨语言推理系统通常被简化成“把 $\ell_q$ 翻译成英语，推理后再翻回 $\ell_a$”。这隐含了一个强假设：推理能力本身与语言无关，语言只是输入输出外壳。

现有证据并不支持这个假设。PluraMath 扩展了多语言数学评测到 18 种代表性不足语言，并在 27 个推理模型上观察到持续的高资源 - 低资源性能差距；英文 CoT 提示或回译并没有稳定消除该差距。[^pluramath] 语言混合研究则发现，模型越遇到困难的 STEM 任务，越倾向在英语、汉字或拉丁脚本之间切换；这种输出行为与中间层的脚本偏好相一致。[^langmix]

因此，跨语言推理应被写成一个链式问题，而不是单步翻译：

$$
x_{\ell_q}
\xrightarrow{\;E_{\ell_q}\;}
z
\xrightarrow{\;\pi(\ell_r,\,\mathcal{T})\;}
r_{\ell_r}
\xrightarrow{\;G_{\ell_a}\;}
y_{\ell_a}.
$$

其中 $E_{\ell_q}$ 是目标语言的输入表征，$z$ 是模型内部状态，$\pi$ 是在工具、提示或训练约束 $\mathcal{T}$ 下的推理策略，$G_{\ell_a}$ 负责最终生成。英语中心化可能发生在每一环：低资源语言无法稳定激活 $z$、推理策略偏好英语 $\ell_r$、或最终答案被英语模板覆盖。

这一区分带来三个直接后果：

1. **翻译正确不等于推理对齐。** 题目条件、数学符号、文化语境和医学术语在翻译链中都可能失真。
2. **英语推理强不等于用户得到英语答案。** 中间语言可以是能力支架，但最终输出必须满足用户语言、术语和场景约束。
3. **教师输出不能只蒸馏最终答案。** 若能力差距来自中间表示或推理策略，student 还需要学习何时保持本地语言、何时借用高资源语言、以及如何回到本地答案。

## 2. 研究史：从跨语言表示对齐到推理语言控制

跨语言蒸馏可粗略分为四个阶段。

| 阶段 | 核心问题 | 代表路线 | 主要局限 |
|---|---|---|---|
| 表示蒸馏 | 小模型能否保留多语言表示 | mBERT/XLM-R 的 hidden state、attention 蒸馏 | 通常不涉及长推理与生成 |
| 翻译桥接 | 英语模型如何服务其他语言 | translate-test、回译、MT encoder + LLM | 延迟高，误差级联，容易丢失语境 |
| 推理蒸馏 | 如何迁移教师的 CoT / RL 行为 | 英语 CoT、mixed-CoT、rationale distillation、on-policy distillation | 容易把英语中心化固化为学生行为 |
| 推理机制与控制 | 模型为什么混语，如何选择推理语言 | script control、adaptive routing、latent probing、layer swap | 机制证据尚难直接转成通用训练法 |

早期 LightMBERT 说明，跨语言能力并不只存在于最终分类头，而分布在 embedding、attention 与隐藏表示中；保护和蒸馏这些对齐结构，可以让更小学生接近多语言教师的零样本迁移能力。[^lightmbert] 随后，Self-Distillation for Model Stacking 将 NLLB 类机器翻译编码器与英语 LLM 表征空间对齐，尝试让 200 多种语言直接进入 LLM 的知识空间，而不是在推理时先做完整机器翻译。[^model-stacking]

推理模型时代改变了问题：我们不再只关心“低资源输入能否被分类”，而要关心它是否能触发正确的长推理轨迹。英语 CoT、RLVR 和测试时扩展提供了强大能力，但也让训练语料和推理过程的英语中心性更加可见。[^crosslingual-scaling]

### 2.1 LMU 的贡献：从“现象”走到内部机制

用户提到 LMU 是很准确的。以 Hinrich Schütze 为代表的 LMU 研究脉络至少直接贡献了两项关键问题：Language Mixing in Reasoning Language Models 系统测量混语何时发生、是否影响准确率及其内部脚本偏好；Large Reasoning Models Are (Not Yet) Multilingual Latent Reasoners 则进一步追问，模型是否在隐状态中已经形成跨语言的答案。[^langmix][^latent]

前者在 15 种输入语言、7 个难度等级与 18 个学科上发现：英语和中文经常充当内部 pivot，难题与 STEM 任务的混语熵更高；约束模型以拉丁或汉字脚本推理，在部分非拉丁/非汉字输入上可明显提高表现。[^langmix] 后者的结论更尖锐：多语言 latent reasoning 的确存在，但高资源语言显著更强，内部解码路径总体仍与英语对齐。[^latent]

这两项工作把“模型突然说英语”从表面格式问题改写成一个可检验的机制假设：**高资源语言可能是模型较易访问的内部推理通道。** 这也是本文将英语中心化置于综述标题中的原因。

## 3. 统一的研究问题与评测框架

围绕这一现象，一份可积累的研究议程至少应回答下列五个问题。

### RQ1：差距发生在哪一层？

低资源性能下降究竟来自题意理解、翻译、内部推理、输出语言，还是数据与评测本身？PluraMath 的人工核验翻译和多提示设置，以及 LMU 的 hidden-state 分析，正是在把这些来源拆开。[^pluramath][^latent]

### RQ2：何时应该使用英语或混合语言推理？

对形式化数学，英语可能提供术语、模板和训练数据优势；对本地文化、法律或医疗语境，强制英语可能丢失关键信息。Language-Mixed CoT 将英语定义为 reasoning anchor、目标语言定义为 semantic anchor；这是一条具体的、可比较的中间路线。[^mixed-cot]

### RQ3：蒸馏什么，才能不只是复制英语答案？

候选蒸馏对象包括：最终答案 $y$、推理轨迹 $r$、教师 logits、跨语言表示 $z$、语言路由策略、或教师 - 学生之间的偏好/过程奖励。不同对象对应不同失效模式，不能用“蒸馏”一词一概而论。

### RQ4：如何证明能力迁移，而不是基准或翻译捷径？

必须至少报告按语言资源等级、脚本、语族、任务类型和输出语言分层的结果，并区分 native CoT、English-pivot CoT 与 mixed CoT。只报告跨语言平均分，容易掩盖低资源语言的真实退化。

### RQ5：高风险领域的正确性还缺什么？

医学等领域不能只看答案匹配。还需分别验证语言可理解性、来源可追溯性、不确定性表达、危险信号覆盖和人工复核边界。CURE-Med 与 Med-CoReasoner 虽然在多语言医疗推理上前进了一步，但都不能被理解为临床部署结论。[^curemed][^medcoreasoner]

---

## 4. 数学推理：最适合研究跨语言蒸馏的“可验证试验场”

数学推理的优势在于最终答案通常可验证，因此能在较少主观判断的条件下研究语言、推理轨迹和训练数据的作用。它不能代表所有语言任务，却是理解跨语言蒸馏机制的最佳起点。

### 4.1 先有评测鸿沟：PluraMath 纠正了“多语言”样本偏差

PolyMath、MGSM 等基准扩大了语言覆盖，但往往仍集中在高资源语言。PluraMath 在此基础上加入 18 种代表性不足语言，横跨六个语系，并由母语者核验预先翻译的题目。论文同时评估 Base、英文 CoT 与回译等提示策略。[^pluramath]

其最重要的负结果是：**英文 CoT 与回译不是稳定的通用补丁。** 较强模型总体表现更好，但性能提升与翻译能力只弱相关；提示模型在高资源语言中推理，也无法显著弥合低资源差距。[^pluramath] 这否定了一个过于简单的技术叙事：只要题目能翻成英语，推理能力就会自动跨语言迁移。

> **插图位 1：评测版图。** 建议使用 PluraMath Figure 1 或自行绘制“高资源 - 低资源语言覆盖”地图。图注应标明该基准加入 18 种代表性不足语言，并经人工核验翻译。详见 [插图清单](figures/README.md)。

### 4.2 英语枢轴的经验优势：测试时扩展与 quote-and-think

Crosslingual Reasoning through Test-Time Scaling 研究英文推理模型能否在非英语问题上通过增加思考预算获益。它发现，英文长 CoT 的训练能够迁移到多语言数学题，模型常以英语进行主干推理，同时引用原题中的非英语短语作为语义锚点，即所谓 quote-and-think 模式。[^crosslingual-scaling]

这说明英语枢轴并非“把原题抛掉后重新解一遍”，而更像一个双通道系统：

$$
\text{target-language anchors}
\;\longleftrightarrow\;
\text{English reasoning scaffold}
\;\longrightarrow\;
\text{answer}.
$$

但该论文也显示，强制低资源语言进行 native reasoning 常会降低准确率，且测试时扩展在非 STEM 任务上不总是稳定。这意味着英语枢轴是当前训练分布下的经验优势，而不是语言无关推理已经被证明的证据。[^crosslingual-scaling]

### 4.3 语言混合：从“不合规输出”到可控变量

Language Mixing in Reasoning Language Models 将混语量化为推理轨迹中语言分布的熵，并使用 constrained decoding 对脚本进行因果控制。其发现可概括为三点：

1. 输入既非英语也非中文时，混语更普遍；英语、其次中文常充当 pivot。
2. 任务越难、越偏 STEM，混语越明显。
3. 输出脚本偏好与隐藏状态中的脚本偏好一致，说明混语并非纯粹的最后一层格式错误。[^langmix]

The Impact of Language Mixing on Bilingual LLM Reasoning 以中英双语为例进一步显示，混语的作用受任务而变：在某些数学任务中，约束为单一中文推理会伤害表现；在依赖中文本土语境的完形等任务中，混语又可能有害。[^impact-mixing] 因此，正确问题不是“应不应该禁止混语”，而是“针对什么任务、什么语言对和什么用户目标，如何控制混语”。

> **插图位 2：机制图。** 建议重绘 Language Mixing in Reasoning Language Models 中“输入语言 - 隐层脚本偏好 - 推理轨迹语言”的关系，而不要直接裁剪论文页面；重绘可避免版式和版权问题。

### 4.4 从现象到训练：Language-Mixed CoT 蒸馏

Pushing on Multilingual Reasoning Models with Language-Mixed Chain-of-Thought 给出了最直接的训练回答。该工作以韩语为案例，构建 YI-SANG：5.79M 本地韩语 prompts、3.7M 由 Qwen3-32B 生成的长推理轨迹，并筛出 260k 高收益样本训练 KO-REAson 系列。[^mixed-cot]

它的核心不是“中英混写更自然”，而是明确分工：英语承担逻辑与形式推理锚点，韩语保留实体、引用、术语和文化语义。论文报告该格式优于英语单语 CoT 与韩语单语 CoT，并指出其在推理重任务上保留英语支架优势、在文化理解任务上避免纯英语路径的损失。[^mixed-cot]

从蒸馏角度，这可以被看作轨迹级监督：

$$
\mathcal{L}_{\text{traj}} =
-\mathbb{E}_{(x,r_{\text{mix}},y)\sim \mathcal{D}_T}
\log p_S(r_{\text{mix}},y\mid x),
$$

其中教师数据 $\mathcal{D}_T$ 不只包含答案，还包含经过语言设计的推理轨迹。这个设计比“英语答案翻译成韩语答案”更丰富，但也更危险：如果教师错误、英语模板或不必要的长 CoT 被大规模复制，student 会一并继承。因此数据过滤、按任务分桶的评测和保留本地真实 prompt 是不可省略的部分。

### 4.5 从离线轨迹到同策略迁移：COPSD

Crosslingual On-Policy Self-Distillation for Multilingual Reasoning（COPSD）针对另一种瓶颈：低资源语言中正确轨迹极少，单纯使用最终答案奖励的 RL 容易稀疏且不稳定。它让模型利用自身高资源语言的推理行为，为低资源语言的 on-policy 轨迹提供跨语言蒸馏信号。[^copsd]

COPSD 的思想可抽象为：对语义等价的高资源问题 $x_h$ 和低资源问题 $x_l$，不仅奖励 $y_l$ 是否正确，也约束低资源策略接近高资源轨迹或偏好：

$$
\mathcal{L} = \mathcal{L}_{\text{RLVR}}(x_l)
+ \beta\,\mathcal{L}_{\text{XDistill}}
\big(\pi_S(\cdot\mid x_l),\,\pi_S(\cdot\mid x_h)\big).
$$

这一范式把“英语中心化”变成可利用的教师信号，但尚未解决一个规范性问题：学生学到的是可迁移的抽象推理，还是更强的英语依赖？要回答它，必须测试在去除英语提示、改变脚本、或使用非英语高资源教师时，迁移是否仍成立。

### 4.6 Native reasoning 的反证：层交换与匹配监督

Rethinking the Multilingual Reasoning Gap with Layer Swap 对“英语 CoT 必然更好”提出重要修正。该论文认为，过去 native reasoning 的劣势很可能混入了监督规模与质量不匹配。给各语言提供可比的 native reasoning supervision 后，英语枢轴与 native CoT 的差距缩小到 1.9% - 3.5%。[^layer-swap]

进一步的权重空间分析显示，中间层更接近语言无关的推理核心，前后层更偏语言特定。于是作者提出 Layer Swap：保留目标语言 specialist 的输入/输出能力，置换英语 specialist 的中间推理层。[^layer-swap]

这一发现对蒸馏设计极其重要：未来不必在“全部英语”与“全部 native”之间二选一。一个更有希望的目标是**模块化迁移**：蒸馏或共享中间推理模块，同时保留语言专属的编码与生成边界。

---

## 5. 医疗推理：同一语言问题在高风险场景下如何变化

医疗场景并不是“把数学方法换成医学数据集”。数学的答案常可由符号规则验证；医疗回答则同时依赖临床知识、语境、风险表达和用户理解。跨语言系统若只借助英语强推理通道，可能会在最终面向患者或临床人员时丢失本地术语、文化语境与安全边界。

### 5.1 医疗多语言推理的四个约束

对医疗回答 $y$，至少应区分：

$$
Q(y) =
\big(C_{\text{clinical}},\;F_{\text{language}},\;G_{\text{grounding}},\;S_{\text{safety}}\big),
$$

其中 $C_{\text{clinical}}$ 是临床正确性，$F_{\text{language}}$ 是目标语言与术语忠实性，$G_{\text{grounding}}$ 是证据可追溯性，$S_{\text{safety}}$ 是不确定性、红旗与人工复核边界。现有论文通常覆盖前两项的一部分，后两项仍明显不足。

### 5.2 CURE-Med：让推理可以混语，让最终回答必须本地化

CURE-Med 构建了 13 语言、15,774 条开放式医疗推理数据 CUREMed-Bench，并使用 code-switching SFT 加上从高资源到低资源语言的 GRPO 课程训练。它将逻辑正确性和最终答案语言一致性拆为独立目标。[^curemed]

其设计与数学 mixed-CoT 有相似性：允许中间推理借用英语医学术语与知识载体，却要求最终答案在提问语言中完成。不同之处在于，CURE-Med 将语言一致性显式写入奖励：

$$
R = \lambda_{\text{acc}}R_{\text{acc}}
+ \lambda_{\text{lang}}R_{\text{lang}}
+ \lambda_{\text{fmt}}R_{\text{fmt}}.
$$

消融结果尤其值得重视。在 32B 规模，普通多语言 SFT 对逻辑正确性的提升有限；code-switching SFT 已将逻辑正确性从 49.69% 提升至 66.34%，完整课程 GRPO 再提升至 70.04%。这意味着最大的能力基础来自结构化、语言设计过的监督，RL 是增量而非替代。[^curemed]

> **插图位 3：训练流水线。** 建议重绘 CURE-Med Figure 1：数据构建 -> code-switching SFT -> 高/中/低资源语言课程 GRPO。图中应加注“最终答案而非全部中间 CoT 必须对齐目标语言”。

### 5.3 Med-CoReasoner：英语脚手架与本地临床语境的双路径协作

Med-CoReasoner 提出另一条路线：对本地语言问题分别生成英语和本地语言的独立推理路径，将概念抽取、融合和知识检索建立在英语锚定的 scaffold 上，再生成本地语言答案。[^medcoreasoner]

它与 CURE-Med 的差别可概括如下：

| 方法 | 英语的角色 | 本地语言的角色 | 主要训练/推理机制 |
|---|---|---|---|
| CURE-Med | 中间推理中的医学术语与能力支架 | 问题与最终回答，语言一致性奖励 | mixed SFT + 课程 GRPO |
| Med-CoReasoner | 并行英语推理和融合 scaffold | 独立本地推理、语境细节与最终输出 | 双路径推理 + 概念融合 + 检索 |

二者共同拒绝了“全程英语”与“全程 native”这两个极端。前者偏训练时的推理策略蒸馏，后者偏推理时的多路径协作。未来可把二者结合：用本地真实医疗问题训练混合轨迹，同时在推理时显式保留双语证据与概念对齐记录。

### 5.4 为什么医疗不能直接照搬数学结论

数学里“答案正确”往往是强信号；医疗里一个看似正确的诊断词不意味着安全。模型还需要说明条件、鉴别方向、何时不应继续自信回答、何时应建议专业帮助。因而，CURE-Med 和 Med-CoReasoner 的结果应理解为多语言医疗问答与推理的研究证据，而不是临床部署证明。[^curemed][^medcoreasoner]

特别需要警惕 LLM-as-a-judge。它能扩大开放答案评测，却可能将评委的语言偏好、医学知识盲点和提示词格式带入奖励。高风险场景至少应报告人工/专业复核子集、各语言的 judge 一致性、以及包含红旗和不确定性的问题集。

---

## 6. 蒸馏方法谱系：到底该迁移什么

为避免将不同方法都叫作“跨语言蒸馏”，可以按被迁移对象分类。

| 蒸馏对象 | 典型方法 | 解决的问题 | 主要风险 |
|---|---|---|---|
| 表示 | LightMBERT、NLLB-LLM stacking | 让低资源输入进入跨语言知识空间 | 不保证生成与长推理能力 |
| 最终答案 | 翻译式 SFT、伪标签 | 快速扩充低资源监督 | 学生仅学会表面答案或继承翻译错误 |
| 推理轨迹 | Language-Mixed CoT、rationale KD | 迁移分解、验证与长思考格式 | CoT 幻觉、模板复制、语言依赖固化 |
| 过程/偏好 | COPSD、跨语言 RL | 在正确答案稀疏时引导轨迹 | reward hacking、教师偏差放大 |
| 模块/权重 | Layer Swap、专家模块 | 迁移推理核心并保留语言边界 | 结构依赖强，跨架构泛化未知 |
| 行为恢复 | TransLLM 的恢复蒸馏 | 目标语言适配后缓解英语 chat 能力遗忘 | 可能重新强化英语默认行为 |

一个成熟系统可能需要组合这些层次：先以跨语言表示蒸馏解决输入可达性，再以高质量 native/mixed 轨迹建立推理格式，最后用过程奖励和语言忠实性约束做训练，必要时用模块化专家或层迁移保存语言专属能力。

## 7. 面向本项目的技术路线与研究问题

基于上述文献，一个值得推进的项目不是“让模型尽量用英语推理”，而是构建**可控、可解释、可逆的跨语言推理蒸馏**。

### 7.1 建议的系统框架

```text
目标语言问题 x_l
  -> 语言/脚本诊断：资源等级、术语密度、文化语境、置信度
  -> 路由器：native / English-pivot / language-mixed / parallel co-reasoning
  -> 教师生成：答案 + 可过滤推理轨迹 + 证据或可验证步骤
  -> 质量筛选：答案正确性、语言忠实性、轨迹冗余、翻译一致性
  -> 学生训练：表示对齐 + 轨迹蒸馏 + 过程/结果奖励
  -> 输出控制：目标语言答案、可选简明解释、风险/不确定性边界
  -> 分层评估：语言、脚本、任务、领域、资源等级、OOD
```

### 7.2 可发表的研究问题

1. **RQ-A：英语枢轴收益来自哪里？** 在固定题意与输出语言后，比较英语 CoT、native CoT、mixed CoT 和无显式 CoT；再用 activation/probe 测试差异是否发生在中间层。
2. **RQ-B：路由能否优于固定策略？** 训练一个轻量路由器，根据语言资源、脚本、任务类型和不确定性选择推理语言；和 AdaMCoT 的固定候选语言路由作比较。[^adamcot]
3. **RQ-C：蒸馏能否避免英语依赖固化？** 使用英语教师、非英语高资源教师和混合教师分别训练 student，比较低资源 native-only 测试、脚本控制测试和跨域测试。
4. **RQ-D：数学中的机制是否能迁移到医学？** 对同一语言集合，测试 mixed-CoT 是否提升医学结论正确性而不损害语言可理解性；同时增加人工专家复核。
5. **RQ-E：如何量化公平性？** 不只报告平均分，还报告最弱语言、不同脚本、不同资源层之间的最坏组性能与校准差距。

### 7.3 最小可行实验

第一阶段建议从一个中资源语言和两个低资源语言开始，避免一开始铺得过大：

1. 在 PluraMath 或其可复现子集上建立 native、English-pivot、mixed 三个零训练基线。
2. 用同一教师生成三种格式的轨迹，严格控制题目、token 预算、筛选规则和学生参数量。
3. 评估最终答案、目标语言一致性、推理脚本比例、翻译一致性，以及按题目难度分层的表现。
4. 再将同一 recipe 移到 CUREMed-Bench 或另一公开医疗 QA 子集；加入人工复核的小样本，而不把 LLM judge 当作唯一裁判。

这个设计能将“混语有用吗”转化为更精确的问题：**对哪些语言、哪些任务和哪些安全约束，什么形式的混语监督能带来净收益。**

## 8. 未解决问题与研究伦理

### 8.1 英语中心化是能力捷径，也是知识权力分布

英语作为推理枢轴可能是当前训练语料和算力分布下的最佳工程选择，但它不是中性的。若系统只能通过英语获得高质量推理，低资源语言用户就被迫将问题、术语和知识体系投影进英语框架。研究应把 native reasoning 的能力增长与英语枢轴的效用同时当作目标，而不是把后者当成终局。

### 8.2 “可见 CoT”不能自动等于忠实推理

蒸馏长推理轨迹可以改善答案，却不能证明轨迹是模型真实因果过程。对用户可见的解释应以可验证、简明和领域安全为目标；对训练使用的内部轨迹则应接受质量审计，避免把未经验证的教师推测变成学生的确定性知识。

### 8.3 翻译、方言与文化语境不能被压缩为语言代码

同一 ISO 语言代码内部也有地域、书写系统、医学术语和教育背景差异。尤其医疗场景中，语言忠实性不能只用 language ID 衡量，还应考虑术语适配、健康素养与本地临床路径。

### 8.4 数据许可与社区参与

低资源语言的“数据不足”不应成为无边界抓取和未经同意数据合成的理由。真正可持续的路线需要本地研究者、母语者和领域专家参与数据构建、翻译核验、评测设计与收益分配。PluraMath 的母语者核验流程为评测数据提供了一个可复用的最低标准。[^pluramath]

## 9. 结论

跨语言推理蒸馏的核心矛盾不是英语是否有用。现有证据已充分表明，英语和其他高资源语言常提供更强的推理支架；真正的问题是如何不让这种支架吞没目标语言的语义、表达权与可验证性。

数学推理文献告诉我们：翻译和英文 CoT 并非稳定万能解，混语是一种与难度和内部表征相关的策略，轨迹蒸馏、同策略迁移和模块化层交换各自提供不同杠杆。医疗文献则提醒：即使逻辑正确性与语言一致性提升，临床安全、证据来源和人工监督仍必须独立成立。

未来最有价值的方向不是训练一个“永远用英语想”的多语言模型，而是训练一个知道**何时借用高资源语言、何时坚持本地语言、如何将两者的证据与结论重新交还给用户**的推理系统。

## 参考注脚

[^pluramath]: Daryna Dementieva et al., “[PluraMath: Extending Mathematical Reasoning Evaluation Beyond High-Resource Languages](https://arxiv.org/abs/2607.05992),” arXiv:2607.05992, 2026。
[^langmix]: Mingyang Wang et al., “[Language Mixing in Reasoning Language Models: Patterns, Impact, and Internal Causes](https://arxiv.org/abs/2505.14815),” arXiv:2505.14815, 2025。
[^lightmbert]: Jihyung Moon et al., “[LightMBERT: A Simple and Effective Multilingual BERT Distillation Method](https://aclanthology.org/2021.eacl-main.251/),” EACL, 2021。
[^model-stacking]: Yang Liu et al., “[Self-Distillation for Model Stacking Unlocks Cross-Lingual NLU in 200+ Languages](https://arxiv.org/abs/2406.12739),” arXiv:2406.12739, 2024。
[^crosslingual-scaling]: Hao Yong et al., “[Crosslingual Reasoning through Test-Time Scaling](https://arxiv.org/abs/2505.05408),” arXiv:2505.05408, 2025。
[^latent]: Yihong Liu et al., “[Large Reasoning Models Are (Not Yet) Multilingual Latent Reasoners](https://arxiv.org/abs/2601.02996),” arXiv:2601.02996, 2026。
[^impact-mixing]: Yihao Li et al., “[The Impact of Language Mixing on Bilingual LLM Reasoning](https://arxiv.org/abs/2507.15849),” arXiv:2507.15849, 2025。
[^mixed-cot]: Guijin Son et al., “[Pushing on Multilingual Reasoning Models with Language-Mixed Chain-of-Thought](https://arxiv.org/abs/2510.04230),” arXiv:2510.04230, 2026。
[^copsd]: “[Crosslingual On-Policy Self-Distillation for Multilingual Reasoning](https://arxiv.org/abs/2605.09548),” arXiv:2605.09548, 2026。
[^layer-swap]: Maxence Lasbordes, Amélie Chatelain, and Djamé Seddah, “[Rethinking the Multilingual Reasoning Gap with Layer Swap](https://arxiv.org/abs/2605.26735),” arXiv:2605.26735, 2026。
[^curemed]: Eric Onyame et al., “[CURE-Med: Curriculum-Informed Reinforcement Learning for Multilingual Medical Reasoning](https://arxiv.org/abs/2601.13262),” arXiv:2601.13262, 2026。
[^medcoreasoner]: Fan Gao et al., “[Med-CoReasoner: Reducing Language Disparities in Medical Reasoning via Language-Informed Co-Reasoning](https://arxiv.org/abs/2601.08267),” arXiv:2601.08267, 2026。
[^adamcot]: Weihua Zheng et al., “[AdaMCoT: Rethinking Cross-Lingual Factual Reasoning through Adaptive Multilingual Chain-of-Thought](https://arxiv.org/abs/2501.16154),” arXiv:2501.16154, 2025。
