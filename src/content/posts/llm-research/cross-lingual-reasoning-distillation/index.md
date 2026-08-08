---
title: "跨语言模型蒸馏与英语中心化推理：从数学、语码转换到医疗推理的研究综述"
description: "系统梳理多语言模型的语言覆盖、英语中心化、语码转换、跨语言推理蒸馏与资源感知训练，并重点比较 OPD、OPSD 与两类 MOPD 的目标、证据和失效模式。"
date: "2026-08-08"
category: "LLM 研究"
series: "多语言推理与强化学习"
status: "polished"
tags: ["跨语言蒸馏", "多语言推理", "数学推理", "医疗大模型", "语码转换", "OPD", "低资源语言"]
source: "基于 Math-Beyond-English 文献库与补充调研"
featured: true
draft: false
---

# 跨语言模型蒸馏与英语中心化推理：从数学、语码转换到医疗推理的研究综述

> **核心判断**：今天的多语言推理模型往往不是在所有语言中同等地“思考”，而更像是让非英语问题经由英语或其他高资源语言的表征通道进入一个较强的推理核心。蒸馏的真正问题因此不只是把教师答案翻译给学生，而是：**如何迁移高资源语言的推理能力，同时保留目标语言的语义锚点、表达权与可审计性。**

## 摘要

推理型大语言模型在数学、代码与科学任务中快速进步，但其训练数据、推理轨迹与评测长期以英语和少数高资源语言为中心。低资源语言用户面对的并不只是翻译质量下降，而是从题意解析、内部表示、推理轨迹到最终回答的整条能力链可能发生失配。本文以“英语推理中心化”为主线，综述跨语言模型蒸馏与推理研究，并将问题分为五个层次：模型宣称的语言覆盖究竟代表什么、语言输入能否进入共享推理空间、模型为何以及何时进行语码转换、教师的推理行为如何被迁移到目标语言学生、以及评测是否能区分推理正确性、语言忠实性和领域安全性。

叙事顺序刻意遵循训练链条：先界定模型语言覆盖与语码转换，再讨论数学推理，因为其答案可验证、最适合揭示跨语言推理差距和蒸馏机制；随后进入医疗推理，因为它要求在更高风险下同时处理语言可及性、知识检索和临床边界。本文综合本地文献库中的 PluraMath、Language-Mixed CoT、COPSD、CURE-Med、Med-CoReasoner 等工作，补充 LMU 研究者参与的语言混合与多语言 latent reasoning 分析，并把 2024--2026 年 OPD、OPSD、MOPD 的快速演化放入同一训练分布框架。本文的目标不是罗列“多语言方法”，而是识别哪些结论已有机制或消融证据，哪些仍只是由有限基准支持的工程假设。

## 综述范围与方法

本文采用问题导向的叙述性综述，而非声称完成严格意义上的系统综述或元分析。检索与筛选围绕四组关键词展开：`multilingual/cross-lingual reasoning`、`code-switching/language mixing`、`knowledge/on-policy/self distillation`、`medical/math reasoning`。文献来源以 ACL Anthology、arXiv、官方技术报告和模型卡为主；本地 `Math-Beyond-English` 文献库用于建立种子集合，再沿论文引用与作者研究脉络补充工作。截止时间为 **2026 年 8 月 8 日**。

纳入正文的证据至少满足以下条件之一：提出可复现的方法或数据集；给出按语言、脚本或资源层分解的实验；提供内部表征、因果干预或消融分析；直接讨论部署风险或评测偏差。对尚未同行评审的 2026 年预印本，本文使用“作者报告”“初步证据”等措辞，不把排行榜增益视为稳定事实。模型语言数量则只记录开发者明确宣称的“支持”或“优化”范围，不用 tokenizer 能编码某种文字来推断能力。

这套方法仍有三项限制。第一，2026 年 OPD 文献更新极快，结论可能随实现和模型家族变化。第二，不同工作对“语言”“方言”“脚本”和“支持”的口径不同，因此数量只能用于描述产品定位，不能直接作为能力排名。第三，多语言医学评测仍缺少足够规模的母语临床专家验证，自动评委结果必须保守解释。

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

## 2. “原生支持多少语言”究竟说明什么

讨论跨语言推理前，必须先处理一个经常被混用的概念：**语言覆盖（coverage）不是语言能力（competence），语言能力也不是推理能力（reasoning competence）。** 模型卡中的“支持 $N$ 种语言”可能表示预训练语料包含这些语言、团队针对这些语言做过后训练、产品接口允许输入输出，或只是在少量通用基准上验证过。它通常不保证长链推理、工具调用、安全对齐和专业领域能力在各语言中等价。

截至 2026 年 8 月，若严格采用开发者公开口径，几个常用开放模型家族可以作如下比较：

| 模型家族 | 官方语言口径 | 语言举例 | 解释时必须保留的限制 |
|---|---:|---|---|
| Gemma 3 | 超过 140 种语言 | 英语、中文、阿拉伯语、印地语及大量低资源语言 | 模型卡承认其部分安全评测仍只使用英语；覆盖面不能替代逐语言验证[^gemma3] |
| Qwen3 | 119 种语言与方言 | 简繁中文、粤语、英语、马来语、印尼语、阿拉伯语多种方言、泰语、越南语等 | “方言”与“语言”合并计数；36T token 覆盖并不意味着各语种数据均衡[^qwen3] |
| Qwen2.5 | 29 种以上 | 中英法西葡德意俄、日、韩、越、泰、阿拉伯语等 | 较早一代的公开口径更窄，可用于观察模型代际中的广度扩张[^qwen25] |
| Aya Expanse | 优化 23 种语言 | 阿拉伯语、简繁中文、英语、希伯来语、印地语、印尼语、日语、韩语、乌克兰语、越南语等 | Aya 系列还存在覆盖 101 种语言的广度路线；23 种是“以深度换广度”的设计选择[^aya] |
| Llama 3.1 | 正式支持 8 种语言 | 英语、德语、法语、意大利语、葡萄牙语、印地语、西班牙语、泰语 | 预训练见过更多语言不等于正式支持；Meta 的模型卡明确列出这 8 种[^llama31] |
| Mistral Large 2 | “数十种语言”，未给单一总数 | 英、法、德、西、意、葡、荷、俄、中、日、韩、阿拉伯语、印地语 | 官方页面给代表性列表而非完整、固定的逐语言能力保证[^mistral2] |
| DeepSeek-R1 | 未给出通用语言总数 | 官方评测重点报告英语和中文，并明确把 language mixing 列为 R1-Zero 的问题 | 不应据此写成“只支持中英双语”；更准确的说法是官方没有给出广覆盖承诺[^deepseekr1] |

这个表最值得读出的不是谁的数字最大，而是**口径差异本身**。Gemma 3 的“140+”、Qwen3 的“119 种语言与方言”、Aya Expanse 的“23 种优化语言”和 Llama 3.1 的“8 种正式支持语言”回答的是不同问题。若把这些数字直接作为横向排名，就会把数据存在性、产品支持、生成流利度和推理能力压成一个指标。

### 2.1 从模型卡到研究评测：需要四层语言能力矩阵

更可靠的项目文档应为每种语言分别报告四层证据：

1. **可编码性**：tokenizer 能否高效表示文字，是否因切词膨胀导致成本和上下文不平等。
2. **基础语言能力**：理解、生成、翻译和指令遵循是否经母语者或可靠基准验证。
3. **推理能力**：在保持题目与难度等价时，数学、逻辑、代码和领域推理是否稳定。
4. **对齐与安全能力**：输出语言、拒答、安全策略和不确定性表达是否跨语言一致。

因此，本文后续不把“原生支持”当作二值属性，而把语言 $\ell$ 上的能力写成向量：

$$
\mathbf{c}_{\ell}
=
\big(c_{\text{token}},c_{\text{language}},c_{\text{reason}},c_{\text{align}},c_{\text{domain}}\big).
$$

一个模型可以在 $c_{\text{language}}$ 上流利，却在 $c_{\text{reason}}$ 或 $c_{\text{align}}$ 上明显落后。英语中心化讨论的正是这些维度之间的不对称，而不是模型是否“认识”某种语言。

## 3. 研究史：从跨语言表示对齐到推理语言控制

跨语言蒸馏可粗略分为四个阶段。

| 阶段 | 核心问题 | 代表路线 | 主要局限 |
|---|---|---|---|
| 表示蒸馏 | 小模型能否保留多语言表示 | mBERT/XLM-R 的 hidden state、attention 蒸馏 | 通常不涉及长推理与生成 |
| 翻译桥接 | 英语模型如何服务其他语言 | translate-test、回译、MT encoder + LLM | 延迟高，误差级联，容易丢失语境 |
| 推理蒸馏 | 如何迁移教师的 CoT / RL 行为 | 英语 CoT、mixed-CoT、rationale distillation、on-policy distillation | 容易把英语中心化固化为学生行为 |
| 推理机制与控制 | 模型为什么混语，如何选择推理语言 | script control、adaptive routing、latent probing、layer swap | 机制证据尚难直接转成通用训练法 |

早期 LightMBERT 说明，跨语言能力并不只存在于最终分类头，而分布在 embedding、attention 与隐藏表示中；保护和蒸馏这些对齐结构，可以让更小学生接近多语言教师的零样本迁移能力。[^lightmbert] 随后，Self-Distillation for Model Stacking 将 NLLB 类机器翻译编码器与英语 LLM 表征空间对齐，尝试让 200 多种语言直接进入 LLM 的知识空间，而不是在推理时先做完整机器翻译。[^model-stacking]

推理模型时代改变了问题：我们不再只关心“低资源输入能否被分类”，而要关心它是否能触发正确的长推理轨迹。英语 CoT、RLVR 和测试时扩展提供了强大能力，但也让训练语料和推理过程的英语中心性更加可见。[^crosslingual-scaling]

### 3.1 LMU 的贡献：从“现象”走到内部机制

以 Hinrich Schütze 为代表的 LMU 研究脉络至少直接贡献了两项关键问题：Language Mixing in Reasoning Language Models 系统测量混语何时发生、是否影响准确率及其内部脚本偏好；Large Reasoning Models Are (Not Yet) Multilingual Latent Reasoners 则进一步追问，模型是否在隐状态中已经形成跨语言的答案。[^langmix][^latent]

前者在 15 种输入语言、7 个难度等级与 18 个学科上发现：英语和中文经常充当内部 pivot，难题与 STEM 任务的混语熵更高；约束模型以拉丁或汉字脚本推理，在部分非拉丁/非汉字输入上可明显提高表现。[^langmix] 后者的结论更尖锐：多语言 latent reasoning 的确存在，但高资源语言显著更强，内部解码路径总体仍与英语对齐。[^latent]

这两项工作把“模型突然说英语”从表面格式问题改写成一个可检验的机制假设：**高资源语言可能是模型较易访问的内部推理通道。** 这也是本文将英语中心化置于综述标题中的原因。

## 4. 语码转换：自然语言实践、推理策略与模型失效不能混为一谈

中文讨论中常把 code-switching、code-mixing 和 language mixing 都译作“语码转换”或“混语”，但它们在现有研究中至少指向四种不同现象。若不先区分，研究者很容易把用户的自然双语表达误判为噪声，又把模型失控后的语言侵入包装成“跨语言推理”。

| 现象 | 操作者与意图 | 例子 | 应关注的指标 |
|---|---|---|---|
| 社会语言学语码转换 | 用户主动转换，以表达身份、语用功能或适配语境 | “这个 diagnosis 我还是不太明白” | 自然度、语用适切性、结构约束 |
| 跨语言/混合推理 | 系统主动选择语言作为推理支架 | 韩语题目中保留实体、用英语展开形式推理 | 答案正确率、语义锚点保留、语言成本 |
| 无意语言侵入 | 模型偏离用户要求或在生成中突然换语 | 中文回答中无理由出现长段英语 | intrusion rate、脚本熵、指令遵循 |
| 输出语言错配 | 输入包含多种语言，模型误判用户希望的回答语言 | 英语指令附带韩语材料，却用韩语回答 | output-language accuracy、对话稳定性 |

### 4.1 语码转换首先是社会语言学行为，而非“污染数据”

Doğruöz 等人的综述指出，语码转换具有结构和社会功能：切换位置受语法约束，也可能标记身份、话题、引用、强调或参与者关系。计算研究长期偏重 language ID 和序列标注，却较少覆盖真实社区中的语用功能与多样类型。[^cs-survey] 这意味着，一个只追求“每个句子属于单一语言”的系统，可能在技术上减少混语，却在交互上损害真实双语用户。

2026 年的大规模综述将该领域扩展到 327 项研究、15 类以上 NLP 任务、30 多个数据集和 80 多种语言，并再次指出数据稀缺、评测偏差与多模态覆盖不足仍是主要瓶颈。[^cs-llm-survey] 这里的核心变化是：语码转换不再只是预训练模型之前的特殊 NLP 子任务，而成为 LLM 在对话、检索、推理、生成和安全对齐中的横向压力测试。

### 4.2 “能理解双语”不等于“能在双语条件下推理”

早期跨语言推理研究已经发现，模型在同一语言中迁移逻辑能力，和在上下文、问题语言不同的 code-switched setting 中推理，是两种难度。Structured Self-Attention 在 RuleTaker 与 LeapOfThought 的 code-switched 设置中分别带来最高约 14% 和 4% 的提升，说明显式促进跨语言注意力可以缓解表示断裂。[^structured-attn]

但 2026 年的受控研究给出了更不对称的结果：向英语语境插入非英语 token，通常降低理解与推理准确率；把英语嵌入非英语语境，有时反而提高表现。[^lost-mix] 这不是“混语普遍有利”的证据，而更符合英语中心化假设：英语片段可能向非英语上下文注入高资源表征，而反方向切换会把英语强路径拉离熟悉分布。

因此，应把语码转换收益写成条件函数，而不是常数：

$$
\Delta_{\text{CS}}
=
f(\ell_{\text{matrix}},\ell_{\text{embedded}},\text{task},\text{switch point},
\text{resource gap},\text{model}).
$$

其中 matrix language 决定主要句法框架，embedded language 提供局部术语或片段。只有在固定方向、切换位置、任务难度和语言资源差距后，才能判断混语究竟帮助了推理、只是提供了术语捷径，还是破坏了输入理解。

### 4.3 输出语言对齐是一项独立能力

OLA 基准把一个长期被忽视的问题单独提出：当用户在同一提示中使用多种语言时，模型必须从指令、内容和语用线索推断回答语言。该工作在韩英交互中发现，前沿模型仍会系统性误判输出语言，错误还能扩展到中英与印尼语场景；显式 CoT 提示并未解决，而约 1,000 个语码转换偏好样本的 DPO 已显著缓解错配。[^ola]

这组结果提供了一个重要反例：推理更长不等于语用更好。输出语言决策应被独立建模为

$$
\hat{\ell}_a
=
\arg\max_{\ell}
p(\ell\mid x,\text{instruction span},\text{quoted span},\text{dialogue history}),
$$

并单独评估，而不应期待模型在生成长 CoT 时“顺便理解”。对医疗等高风险系统尤其如此：回答语言错配会直接影响可理解性，即使临床结论本身正确。

### 4.4 对本文的术语约定

后文用“语码转换”指用户或自然语料中的社会语言学行为；用“混合推理”指训练或推理时设计的多语言轨迹；用“语言侵入”指违背预期的无意切换；用“输出语言错配”指模型未满足用户的回答语言。这四者需要不同的数据、奖励与评测，不应由单一 language-ID 比例替代。

## 5. 统一的研究问题与评测框架

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

## 6. 数学推理：最适合研究跨语言蒸馏的“可验证试验场”

数学推理的优势在于最终答案通常可验证，因此能在较少主观判断的条件下研究语言、推理轨迹和训练数据的作用。它不能代表所有语言任务，却是理解跨语言蒸馏机制的最佳起点。

### 6.1 从提示迁移到训练一致性：数学路线的历史过渡

跨语言数学推理并非一开始就以蒸馏或 RL 为中心。早期工作先问：一个主要在英语中学到 CoT 的模型，能否仅通过提示在其他语言复用能力？Cross-lingual Prompting 把流程拆成跨语言表征对齐提示和任务求解提示，并通过跨语言 self-consistency 聚合多条不同语言的路径。[^clp] 这条路线成本低，但其收益依赖模型已在预训练中形成足够共享的表示，也无法修复低资源语言在模型参数中的系统性缺口。

mCoT 随后把问题从 inference-time prompting 推进到 instruction tuning。它构建覆盖 11 种语言的 mCoT-MATH，并直接优化同一道题在多语言中的推理一致性；7B 模型的结果表明，有针对性的多语言推理监督可以缩小语言间方差，而不必完全依赖更大参数规模。[^mcot] 这构成了一条重要历史线索：

$$
\text{English CoT elicitation}
\rightarrow
\text{cross-lingual prompting}
\rightarrow
\text{multilingual CoT tuning}
\rightarrow
\text{mixed/native trajectory distillation}
\rightarrow
\text{on-policy transfer}.
$$

每一步都增加训练成本和控制力：提示方法只重排已有能力；instruction tuning 改变模型的语言条件分布；轨迹蒸馏规定中间推理形式；OPD/OPSD 则进一步在 student 实际访问的状态上纠错。后文的 PluraMath、Language-Mixed CoT 和 COPSD 应放在这条演进线上理解，而不是看作互不相关的技巧。

### 6.2 先有评测鸿沟：PluraMath 纠正了“多语言”样本偏差

PolyMath、MGSM 等基准扩大了语言覆盖，但往往仍集中在高资源语言。PluraMath 在此基础上加入 18 种代表性不足语言，横跨六个语系，并由母语者核验预先翻译的题目。论文同时评估 Base、英文 CoT 与回译等提示策略。[^pluramath]

其最重要的负结果是：**英文 CoT 与回译不是稳定的通用补丁。** 较强模型总体表现更好，但性能提升与翻译能力只弱相关；提示模型在高资源语言中推理，也无法显著弥合低资源差距。[^pluramath] 这否定了一个过于简单的技术叙事：只要题目能翻成英语，推理能力就会自动跨语言迁移。

> **插图位 1：评测版图。** 建议使用 PluraMath Figure 1 或自行绘制“高资源 - 低资源语言覆盖”地图。图注应标明该基准加入 18 种代表性不足语言，并经人工核验翻译。详见 [插图清单](figures/README.md)。

### 6.3 英语枢轴的经验优势：测试时扩展与 quote-and-think

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

### 6.4 语言混合：从“不合规输出”到可控变量

Language Mixing in Reasoning Language Models 将混语量化为推理轨迹中语言分布的熵，并使用 constrained decoding 对脚本进行因果控制。其发现可概括为三点：

1. 输入既非英语也非中文时，混语更普遍；英语、其次中文常充当 pivot。
2. 任务越难、越偏 STEM，混语越明显。
3. 输出脚本偏好与隐藏状态中的脚本偏好一致，说明混语并非纯粹的最后一层格式错误。[^langmix]

The Impact of Language Mixing on Bilingual LLM Reasoning 以中英双语为例进一步显示，混语的作用受任务而变：在某些数学任务中，约束为单一中文推理会伤害表现；在依赖中文本土语境的完形等任务中，混语又可能有害。[^impact-mixing] 因此，正确问题不是“应不应该禁止混语”，而是“针对什么任务、什么语言对和什么用户目标，如何控制混语”。

> **插图位 2：机制图。** 建议重绘 Language Mixing in Reasoning Language Models 中“输入语言 - 隐层脚本偏好 - 推理轨迹语言”的关系，而不要直接裁剪论文页面；重绘可避免版式和版权问题。

### 6.5 从现象到训练：Language-Mixed CoT 蒸馏

Pushing on Multilingual Reasoning Models with Language-Mixed Chain-of-Thought 给出了最直接的训练回答。该工作以韩语为案例，构建 YI-SANG：5.79M 本地韩语 prompts、3.7M 由 Qwen3-32B 生成的长推理轨迹，并筛出 260k 高收益样本训练 KO-REAson 系列。[^mixed-cot]

它的核心不是“中英混写更自然”，而是明确分工：英语承担逻辑与形式推理锚点，韩语保留实体、引用、术语和文化语义。论文报告该格式优于英语单语 CoT 与韩语单语 CoT，并指出其在推理重任务上保留英语支架优势、在文化理解任务上避免纯英语路径的损失。[^mixed-cot]

从蒸馏角度，这可以被看作轨迹级监督：

$$
\mathcal{L}_{\text{traj}} =
-\mathbb{E}_{(x,r_{\text{mix}},y)\sim \mathcal{D}_T}
\log p_S(r_{\text{mix}},y\mid x),
$$

其中教师数据 $\mathcal{D}_T$ 不只包含答案，还包含经过语言设计的推理轨迹。这个设计比“英语答案翻译成韩语答案”更丰富，但也更危险：如果教师错误、英语模板或不必要的长 CoT 被大规模复制，student 会一并继承。因此数据过滤、按任务分桶的评测和保留本地真实 prompt 是不可省略的部分。

### 6.6 从离线轨迹到同策略迁移：COPSD

Crosslingual On-Policy Self-Distillation for Multilingual Reasoning（COPSD）针对另一种瓶颈：低资源语言中正确轨迹极少，单纯使用最终答案奖励的 RL 容易稀疏且不稳定。它让模型利用自身高资源语言的推理行为，为低资源语言的 on-policy 轨迹提供跨语言蒸馏信号。[^copsd]

COPSD 的思想可抽象为：对语义等价的高资源问题 $x_h$ 和低资源问题 $x_l$，不仅奖励 $y_l$ 是否正确，也约束低资源策略接近高资源轨迹或偏好：

$$
\mathcal{L} = \mathcal{L}_{\text{RLVR}}(x_l)
+ \beta\,\mathcal{L}_{\text{XDistill}}
\big(\pi_S(\cdot\mid x_l),\,\pi_S(\cdot\mid x_h)\big).
$$

这一范式把“英语中心化”变成可利用的教师信号，但尚未解决一个规范性问题：学生学到的是可迁移的抽象推理，还是更强的英语依赖？要回答它，必须测试在去除英语提示、改变脚本、或使用非英语高资源教师时，迁移是否仍成立。

### 6.7 Native reasoning 的反证：层交换与匹配监督

Rethinking the Multilingual Reasoning Gap with Layer Swap 对“英语 CoT 必然更好”提出重要修正。该论文认为，过去 native reasoning 的劣势很可能混入了监督规模与质量不匹配。给各语言提供可比的 native reasoning supervision 后，英语枢轴与 native CoT 的差距缩小到 1.9% - 3.5%。[^layer-swap]

进一步的权重空间分析显示，中间层更接近语言无关的推理核心，前后层更偏语言特定。于是作者提出 Layer Swap：保留目标语言 specialist 的输入/输出能力，置换英语 specialist 的中间推理层。[^layer-swap]

这一发现对蒸馏设计极其重要：未来不必在“全部英语”与“全部 native”之间二选一。一个更有希望的目标是**模块化迁移**：蒸馏或共享中间推理模块，同时保留语言专属的编码与生成边界。

---

## 7. 医疗推理：同一语言问题在高风险场景下如何变化

医疗场景并不是“把数学方法换成医学数据集”。数学的答案常可由符号规则验证；医疗回答则同时依赖临床知识、语境、风险表达和用户理解。跨语言系统若只借助英语强推理通道，可能会在最终面向患者或临床人员时丢失本地术语、文化语境与安全边界。

### 7.1 医疗多语言推理的四个约束

对医疗回答 $y$，至少应区分：

$$
Q(y) =
\big(C_{\text{clinical}},\;F_{\text{language}},\;G_{\text{grounding}},\;S_{\text{safety}}\big),
$$

其中 $C_{\text{clinical}}$ 是临床正确性，$F_{\text{language}}$ 是目标语言与术语忠实性，$G_{\text{grounding}}$ 是证据可追溯性，$S_{\text{safety}}$ 是不确定性、红旗与人工复核边界。现有论文通常覆盖前两项的一部分，后两项仍明显不足。

### 7.2 CURE-Med：让推理可以混语，让最终回答必须本地化

CURE-Med 构建了 13 语言、15,774 条开放式医疗推理数据 CUREMed-Bench，并使用 code-switching SFT 加上从高资源到低资源语言的 GRPO 课程训练。它将逻辑正确性和最终答案语言一致性拆为独立目标。[^curemed]

其设计与数学 mixed-CoT 有相似性：允许中间推理借用英语医学术语与知识载体，却要求最终答案在提问语言中完成。不同之处在于，CURE-Med 将语言一致性显式写入奖励：

$$
R = \lambda_{\text{acc}}R_{\text{acc}}
+ \lambda_{\text{lang}}R_{\text{lang}}
+ \lambda_{\text{fmt}}R_{\text{fmt}}.
$$

消融结果尤其值得重视。在 32B 规模，普通多语言 SFT 对逻辑正确性的提升有限；code-switching SFT 已将逻辑正确性从 49.69% 提升至 66.34%，完整课程 GRPO 再提升至 70.04%。这意味着最大的能力基础来自结构化、语言设计过的监督，RL 是增量而非替代。[^curemed]

> **插图位 3：训练流水线。** 建议重绘 CURE-Med Figure 1：数据构建 -> code-switching SFT -> 高/中/低资源语言课程 GRPO。图中应加注“最终答案而非全部中间 CoT 必须对齐目标语言”。

### 7.3 Med-CoReasoner：英语脚手架与本地临床语境的双路径协作

Med-CoReasoner 提出另一条路线：对本地语言问题分别生成英语和本地语言的独立推理路径，将概念抽取、融合和知识检索建立在英语锚定的 scaffold 上，再生成本地语言答案。[^medcoreasoner]

它与 CURE-Med 的差别可概括如下：

| 方法 | 英语的角色 | 本地语言的角色 | 主要训练/推理机制 |
|---|---|---|---|
| CURE-Med | 中间推理中的医学术语与能力支架 | 问题与最终回答，语言一致性奖励 | mixed SFT + 课程 GRPO |
| Med-CoReasoner | 并行英语推理和融合 scaffold | 独立本地推理、语境细节与最终输出 | 双路径推理 + 概念融合 + 检索 |

二者共同拒绝了“全程英语”与“全程 native”这两个极端。前者偏训练时的推理策略蒸馏，后者偏推理时的多路径协作。未来可把二者结合：用本地真实医疗问题训练混合轨迹，同时在推理时显式保留双语证据与概念对齐记录。

### 7.4 为什么医疗不能直接照搬数学结论

数学里“答案正确”往往是强信号；医疗里一个看似正确的诊断词不意味着安全。模型还需要说明条件、鉴别方向、何时不应继续自信回答、何时应建议专业帮助。因而，CURE-Med 和 Med-CoReasoner 的结果应理解为多语言医疗问答与推理的研究证据，而不是临床部署证明。[^curemed][^medcoreasoner]

特别需要警惕 LLM-as-a-judge。它能扩大开放答案评测，却可能将评委的语言偏好、医学知识盲点和提示词格式带入奖励。高风险场景至少应报告人工/专业复核子集、各语言的 judge 一致性、以及包含红旗和不确定性的问题集。

---

## 8. 蒸馏方法谱系：到底该迁移什么

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

## 9. 从 OPD 到 OPSD 与 MOPD：2024--2026 年的训练分布转向

近两年的推理蒸馏研究出现了一个共同转向：训练不再只让 student 模仿 teacher 预先生成的“标准答案”，而是让 student 先暴露自己的真实错误，再由 teacher 在这些前缀上提供反馈。这一变化可以用训练轨迹的来源来区分。

离策略蒸馏从固定数据集 $\mathcal{D}_T$ 学习：

$$
y\sim\pi_T(\cdot\mid x),
\qquad
\min_\theta -\log \pi_\theta(y\mid x).
$$

同策略蒸馏则从当前学生分布采样：

$$
\tau\sim\pi_\theta(\cdot\mid x),
\qquad
\min_\theta
\sum_t
D\!\left(
\pi_\theta(\cdot\mid x,\tau_{<t})
\,\|\,
\pi_T(\cdot\mid c_T,x,\tau_{<t})
\right).
$$

其中 $c_T$ 可以为空、参考答案、跨语言翻译、成功/失败的同伴轨迹，或领域教师标识。这个统一写法揭示了 OPD 系列方法真正的设计空间：**谁当 teacher、teacher 多知道什么、在谁生成的前缀上比较、用什么散度、如何筛选可信 token。**

### 9.1 OPD：从固定教师轨迹转向学生自己的状态分布

GKD 是现代 OPD 的重要起点。Agarwal 等人指出，自回归学生在部署时会访问自己诱导出的前缀，而传统 KD 多在教师或数据前缀上训练，形成 exposure bias。GKD 让学生生成部分或全部训练序列，再查询教师在这些状态上的分布，并允许使用前向/反向 KL 等不同散度。[^gkd]

其优势不是神秘的“teacher 知识注入”，而是更准确的纠错位置：当 student 已在第 $t-1$ 步走偏，teacher 仍可在该错误前缀上对第 $t$ 步提供稠密信号。相较只在序列末尾给 0/1 奖励，OPD 改善了 credit assignment；相较教师自由生成后再做 SFT，它又减轻了训练与推理分布错位。

但最新研究正在修正“OPD 天然稳定”的乐观叙事。Revisiting OPD 指出，常见 sampled-token 近似把全分布匹配压缩成单个采样 token；长轨迹逐渐偏离教师熟悉的流形时，指导会变得不可靠，tokenizer 与特殊 token 不一致还会引入实现偏差。其 top-K 局部支持匹配与特殊 token masking 提供了较稳的修复方向。[^opd-failure] 另一项机制研究把 OPD 定位为“探索催化剂”而非能力上限扩展器，并识别 teacher-student mismatch 与 length exploitation：教师过强不一定更好，按 token 累积的目标还可能被截断或冗长输出利用。[^opd-pathology]

所以，OPD 的合理结论应是：它把监督放回 student 会访问的状态，并提供比结果奖励更密的信号；但信号的**可教性、局部可信度、长度偏差和实现兼容性**决定了它是否优于普通 RLVR 或离策略 KD。

### 9.2 OPSD：同一个模型如何同时成为教师与学生

Self-Distilled Reasoner（SDR）将 teacher-student 间的参数差异改成上下文差异：同一个模型作为 student 时只看问题，作为 teacher 时额外看到参考解或验证轨迹。student 在自己的 rollout 上学习 teacher 的 token 分布。[^sdr] COPSD 则把 privileged context 改造成跨语言信息：student 看低资源语言问题，self-teacher 额外看到英语翻译和参考解，从而把模型自身的高资源推理行为转移到 17 种低资源非洲语言。[^copsd]

OPSD 的价值有三层。第一，不需要常驻一个更大的外部教师，降低显存与工程复杂度。第二，teacher 与 student 共享 tokenizer 和参数支持，减少结构不兼容。第三，“知识差”可由上下文精确控制，适合研究参考答案、检索证据或高资源语言究竟提供了什么。

但“自己教自己”并不保证自我改进。2026 年对 thinking models 的研究报告，privileged self-distillation 在长推理上可能使平均准确率相对下降最多 17%；参考信息会改变高熵分叉位置的 teacher 分布，惩罚 student 本来有价值的回溯、验证和自我修正 token。[^opself-rethink] EGRSD 因而主张根据 teacher entropy 调整 token 权重，而不是平均相信每个位置。[^egrsd] 这组结果把 OPSD 的核心难点从“如何得到参考答案”推进到“在什么位置，privileged teacher 的确定性值得学生服从”。

### 9.3 OPCD 与黑盒 OPD：teacher 可以是上下文，也可以只有文本接口

On-Policy Context Distillation（OPCD）把同策略学习用于“把上下文能力写进参数”：teacher 看到历史成功经验或优化后的 system prompt，student 在自己的轨迹上逼近该 context-conditioned teacher。作者在数学、文本游戏和领域任务中报告，相比离策略方法，它更好保留 OOD 能力，并可做跨尺寸迁移。[^opcd]

若无法访问 teacher logits，GAD 则训练 discriminator 区分 teacher 与 student 的文本输出，再把这个随 student 共同变化的判别器作为在线奖励。[^gad] 它拓宽了黑盒蒸馏的可行性，但也改变了“蒸馏”的含义：student 不再逐 token 匹配 teacher 分布，而是在对抗游戏中逼近可观察行为。因此其稳定性、判别器偏差和高成本 teacher 查询需要与白盒 OPD 分开报告。

### 9.4 MOPD 有两个同名分支，必须消歧

2026 年出现了两篇都缩写为 MOPD 的工作，但它们解决的不是同一个问题。为避免后续笔记混乱，本文分别记作 **MOPD-MT**（Multi-Teacher）与 **MOPD-MR**（Multi-Rollout）。

| 方法 | 扩展的维度 | teacher context / 来源 | 目标 | 主要风险 |
|---|---|---|---|---|
| MOPD-MT | 多领域教师 | 每个领域独立 RL 得到的 specialist teacher | 把数学、代码、工具等能力整合进一个 student | 路由错误、教师冲突、最弱领域遗忘 |
| MOPD-MR | 同问题多条轨迹 | student 的成功与失败 peer rollouts | 让 teacher 比较局部试错，产生更诊断性的信号 | verifier 偏差、peer context 过长、错误轨迹污染 |

MOPD-MT 先从共同 checkpoint 并行训练领域 RL teachers，再按 prompt 领域让 student 生成 on-policy rollout，并由对应 teacher 提供稠密 token 监督。作者在 Qwen3-30B-A3B 上报告其优于 Mix-RL、Cascade RL、Off-Policy Finetune 与参数合并，并已用于 MiMo-V2-Flash 后训练。[^mopd-mt] 它的关键组织价值是把“专家形成”和“能力整合”解耦：不同团队可并行优化教师，最后统一蒸馏，而无需让多领域 reward 在一次 RL 中相互拉扯。

MOPD-MR 则对同一问题采样一组 student rollouts，用 verifier 划分成功和失败，再把其他轨迹作为 teacher 的 peer context。成功轨迹提供可行路径，失败轨迹暴露局部误区；论文消融显示二者混合通常比只看成功示例更有效。[^mopd-mr] 它把每条轨迹独立蒸馏改成**组内对比诊断**，尤其适合数学、代码和工具调用这类可验证任务。

二者可以组合，但不能直接等同。一个自然的统一框架是：先由领域 $d$ 选择 specialist teacher $T_d$，再从同一问题的 rollout group $G_x$ 构造 teacher context：

$$
\pi_{T_d}
\big(\cdot\mid x,\tau_{<t},G_x^{+},G_x^{-}\big).
$$

这会同时引入领域路由误差、verifier 误差和 teacher-student mismatch，因此需要分层消融，不能只报告最终平均分。

### 9.5 OPD 系列对跨语言研究提出了什么新问题

跨语言场景为 OPD 放大了三类风险。其一，teacher 的高概率 token 可能只是英语模板，而非语言无关的推理改进；全分布 KL 会把这种偏好连同能力一起迁移。其二，低资源 student rollout 更容易偏离 teacher 熟悉的语义流形，使“在 student 状态上监督”从优点转为 supervision fidelity decay。其三，目标语言正确、最终答案正确和临床安全可能给出相互冲突的信号。

因此，一个合格的跨语言 OPD 实验至少应对比：固定英语 teacher、同参数 privileged self-teacher、非英语高资源 teacher 与 multi-teacher；同时报告答案正确性、目标语言一致性、语言侵入、tokenizer 膨胀、轨迹长度、teacher-student KL、最弱语言组和 OOD 保留。否则，很难判断模型学到的是推理、翻译，还是更强的英语默认行为。

### 9.6 当前证据能支持什么，仍不能支持什么

把上述文献放在一起，可以形成比“混语有效”“OPD 比 RL 好”更克制的判断。

| 命题 | 当前证据强度 | 依据 | 尚缺的证据 |
|---|---|---|---|
| 多语言流利度不等于多语言推理一致性 | 较强 | 多个数学基准、hidden-state 分析与语言分层结果方向一致 | 更广领域、方言与真实交互验证 |
| 英语常是当前模型的高资源推理枢轴 | 中等至较强 | 测试时扩展、语言混合、latent probing | 非英语强模型上的对照；排除 tokenizer 与数据量因素 |
| 设计良好的 mixed CoT 可优于纯英语或纯本地 CoT | 中等 | 韩语、医学与部分双语研究支持 | 更多语族、严格等 token 预算与人工质量对照 |
| OPD 能减轻 exposure bias 并提供稠密纠错 | 较强 | GKD 已经同行评审，后续多任务结果一致 | 长链稳定性、统一实现与成本核算 |
| OPSD 可用 privileged context 替代外部大教师 | 中等 | SDR、COPSD、OPCD 等预印本给出一致方向 | 强 thinking model 上存在反例；需多架构复现 |
| MOPD 能整合多领域或多轨迹信息 | 初步 | 两篇 2026 预印本及工业报告 | 独立复现、冲突教师、错误 verifier 和最坏组表现 |
| 数学中的跨语言训练收益可直接迁移到医疗 | 较弱 | CURE-Med、Med-CoReasoner 提供起点 | 母语临床专家、大规模真实病例、安全与校准评测 |

这里最关键的研究空白是**因果拆分**。英语推理收益可能来自英语数据更多、token 更短、教师更强、评测模板偏英语，或确有较语言无关的中间推理模块。现有研究分别控制了其中一部分，但尚无单一实验同时固定语义、token 预算、教师质量、脚本、领域知识与输出要求。因此，“英语是模型内部思维语言”仍应被视为有多项观察支持的机制假设，而非已经证明的本体结论。

## 10. 面向本项目的技术路线与研究问题

基于上述文献，一个值得推进的项目不是“让模型尽量用英语推理”，而是构建**可控、可解释、可逆的跨语言推理蒸馏**。

### 10.1 建议的系统框架

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

### 10.2 可发表的研究问题

1. **RQ-A：英语枢轴收益来自哪里？** 在固定题意与输出语言后，比较英语 CoT、native CoT、mixed CoT 和无显式 CoT；再用 activation/probe 测试差异是否发生在中间层。
2. **RQ-B：路由能否优于固定策略？** 训练一个轻量路由器，根据语言资源、脚本、任务类型和不确定性选择推理语言；和 AdaMCoT 的固定候选语言路由作比较。[^adamcot]
3. **RQ-C：蒸馏能否避免英语依赖固化？** 使用英语教师、非英语高资源教师和混合教师分别训练 student，比较低资源 native-only 测试、脚本控制测试和跨域测试。
4. **RQ-D：数学中的机制是否能迁移到医学？** 对同一语言集合，测试 mixed-CoT 是否提升医学结论正确性而不损害语言可理解性；同时增加人工专家复核。
5. **RQ-E：如何量化公平性？** 不只报告平均分，还报告最弱语言、不同脚本、不同资源层之间的最坏组性能与校准差距。

### 10.3 最小可行实验

第一阶段建议从一个中资源语言和两个低资源语言开始，避免一开始铺得过大：

1. 在 PluraMath 或其可复现子集上建立 native、English-pivot、mixed 三个零训练基线。
2. 用同一教师生成三种格式的轨迹，严格控制题目、token 预算、筛选规则和学生参数量。
3. 评估最终答案、目标语言一致性、推理脚本比例、翻译一致性，以及按题目难度分层的表现。
4. 再将同一 recipe 移到 CUREMed-Bench 或另一公开医疗 QA 子集；加入人工复核的小样本，而不把 LLM judge 当作唯一裁判。

这个设计能将“混语有用吗”转化为更精确的问题：**对哪些语言、哪些任务和哪些安全约束，什么形式的混语监督能带来净收益。**

## 11. 未解决问题与研究伦理

### 11.1 英语中心化是能力捷径，也是知识权力分布

英语作为推理枢轴可能是当前训练语料和算力分布下的最佳工程选择，但它不是中性的。若系统只能通过英语获得高质量推理，低资源语言用户就被迫将问题、术语和知识体系投影进英语框架。研究应把 native reasoning 的能力增长与英语枢轴的效用同时当作目标，而不是把后者当成终局。

### 11.2 “可见 CoT”不能自动等于忠实推理

蒸馏长推理轨迹可以改善答案，却不能证明轨迹是模型真实因果过程。对用户可见的解释应以可验证、简明和领域安全为目标；对训练使用的内部轨迹则应接受质量审计，避免把未经验证的教师推测变成学生的确定性知识。

### 11.3 翻译、方言与文化语境不能被压缩为语言代码

同一 ISO 语言代码内部也有地域、书写系统、医学术语和教育背景差异。尤其医疗场景中，语言忠实性不能只用 language ID 衡量，还应考虑术语适配、健康素养与本地临床路径。

### 11.4 数据许可与社区参与

低资源语言的“数据不足”不应成为无边界抓取和未经同意数据合成的理由。真正可持续的路线需要本地研究者、母语者和领域专家参与数据构建、翻译核验、评测设计与收益分配。PluraMath 的母语者核验流程为评测数据提供了一个可复用的最低标准。[^pluramath]

## 12. 结论

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
[^gemma3]: Google DeepMind, “[Gemma 3 Model Card](https://ai.google.dev/gemma/docs/core/model_card_3),” 2025。模型卡宣称支持 140 种以上语言，同时注明部分安全评测仅使用英语。
[^qwen3]: Qwen Team, “[Qwen3: Think Deeper, Act Faster](https://qwenlm.github.io/blog/qwen3/),” 2025。官方列出 119 种语言与方言及其语系分布。
[^qwen25]: Qwen Team, “[Qwen2.5: A Party of Foundation Models](https://qwenlm.github.io/blog/qwen2.5/),” 2024。
[^aya]: Cohere For AI, “[Aya 23: Open Weight Releases to Further Multilingual Progress](https://cohere.com/research/aya/aya-23-technical-report.pdf),” 2024；另见 [Aya Expanse 官方说明](https://docs.cohere.com/v2/docs/aya-expanse)。
[^llama31]: Meta, “[Llama 3.1 Model Card](https://huggingface.co/meta-llama/Llama-3.1-70B),” 2024。
[^mistral2]: Mistral AI, “[Mistral Large 2](https://mistral.ai/news/mistral-large-2407/),” 2024。
[^deepseekr1]: DeepSeek-AI, “[DeepSeek-R1 Model Card](https://huggingface.co/deepseek-ai/DeepSeek-R1),” 2025。
[^cs-survey]: A. Seza Doğruöz et al., “[A Survey of Code-switching: Linguistic and Social Perspectives for Language Technologies](https://aclanthology.org/2021.acl-long.131/),” ACL-IJCNLP, 2021。
[^cs-llm-survey]: Rajvee Sheth et al., “[Beyond Monolingual Assumptions: A Survey on Code-Switched NLP in the Era of Large Language Models across Modalities](https://aclanthology.org/2026.acl-long.386/),” ACL, 2026。
[^structured-attn]: Negar Foroutan et al., “[Breaking the Language Barrier: Improving Cross-Lingual Reasoning with Structured Self-Attention](https://aclanthology.org/2023.findings-emnlp.632/),” Findings of EMNLP, 2023。
[^lost-mix]: Amr Mohamed et al., “[Lost in the Mix: Evaluating LLM Understanding of Code-Switched Text](https://aclanthology.org/2026.acl-long.2080/),” ACL, 2026。
[^ola]: Juhyun Oh et al., “[OLA: Output Language Alignment in Code-Switched LLM Interactions](https://aclanthology.org/2026.acl-long.2162/),” ACL, 2026。
[^clp]: Libo Qin et al., “[Cross-lingual Prompting: Improving Zero-shot Chain-of-Thought Reasoning across Languages](https://aclanthology.org/2023.emnlp-main.163/),” EMNLP, 2023。
[^mcot]: Huiyuan Lai and Malvina Nissim, “[mCoT: Multilingual Instruction Tuning for Reasoning Consistency in Language Models](https://aclanthology.org/2024.acl-long.649/),” ACL, 2024。
[^gkd]: Rishabh Agarwal et al., “[On-Policy Distillation of Language Models: Learning from Self-Generated Mistakes](https://proceedings.iclr.cc/paper_files/paper/2024/hash/5be69a584901a26c521c2b51e40a4c20-Abstract-Conference.html),” ICLR, 2024。
[^opd-failure]: Yuqian Fu et al., “[Revisiting On-Policy Distillation: Empirical Failure Modes and Simple Fixes](https://arxiv.org/abs/2603.25562),” arXiv:2603.25562, 2026。
[^opd-pathology]: Rui Wang et al., “[Demystifying On-Policy Distillation: Roles, Pathologies, and Regulations](https://arxiv.org/abs/2607.13399),” arXiv:2607.13399, 2026。
[^sdr]: Siyan Zhao et al., “[Self-Distilled Reasoner: On-Policy Self-Distillation for Large Language Models](https://arxiv.org/abs/2601.18734),” arXiv:2601.18734, 2026。
[^opself-rethink]: Simran Kaur et al., “[Rethinking On-Policy Self-Distillation for Thinking Models](https://arxiv.org/abs/2607.05184),” arXiv:2607.05184, 2026。
[^egrsd]: Junlong Ke et al., “[Respecting Self-Uncertainty in On-Policy Self-Distillation for Efficient LLM Reasoning](https://arxiv.org/abs/2605.13255),” arXiv:2605.13255, 2026。
[^opcd]: Tianzhu Ye et al., “[On-Policy Context Distillation for Language Models](https://arxiv.org/abs/2602.12275),” arXiv:2602.12275, 2026。
[^gad]: Tianzhu Ye et al., “[Black-Box On-Policy Distillation of Large Language Models](https://arxiv.org/abs/2511.10643),” arXiv:2511.10643, 2025。
[^mopd-mt]: Wenhan Ma et al., “[MOPD: Multi-Teacher On-Policy Distillation for Capability Integration in LLM Post-Training](https://arxiv.org/abs/2606.30406),” arXiv:2606.30406, 2026。
[^mopd-mr]: Weichen Yu et al., “[Multi-Rollout On-Policy Distillation via Peer Successes and Failures](https://arxiv.org/abs/2605.12652),” arXiv:2605.12652, 2026。
