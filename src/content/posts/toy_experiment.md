
我需要通过一些 toy experiment 去实现两个目的：

1、 掌握对verl 的了解，熟悉它的sft 训练和 强化学习训练

2、具体的夯实自己对 LLM 的理解



### 第一类：你拥有“绝对正确”的标准答案
**数据格式**：$(x, y)$，即（提示词，人类写的完美回答）。
**应用场景**：监督微调（SFT）、指令微调（Instruction Tuning）。

#### 1. 负对数似然损失 / 交叉熵损失 (NLL / Cross-Entropy Loss)
这是大模型训练最基础、最核心的损失函数。它的本质是“死记硬背”，强迫模型生成的每一个 Token 的概率分布都尽可能贴近人类写的标准答案。

* **数学公式**：
    $$\mathcal{L}_{SFT} = - \mathbb{E}_{(x,y)\sim \mathcal{D}} \left[ \frac{1}{T} \sum_{t=1}^{T} \log \pi_\theta(y_t \mid x, y_{<t}) \right]$$
* **公式解释**：
    * $\pi_\theta$：当前训练的模型。
    * $T$：答案序列的总长度。
    * $y_t$：标准答案中的第 $t$ 个词（Token）。
    * **机制**：最大化在给定问题 $x$ 和前文 $y_{<t}$ 的情况下，生成正确词 $y_t$ 的概率（等价于最小化其负对数）。

---

### 第二类：你拥有“相对好坏”的偏好对
**数据格式**：$(x, y_w, y_l)$，即（提示词，获胜的回答，落败的回答）。
**应用场景**：人类反馈强化学习（RLHF）、偏好对齐（Alignment）。

#### 2. 成对排序损失 (Pairwise Ranking Loss / Bradley-Terry Loss)
如果你不是直接训练大模型，而是想先训练一个**奖励模型（Reward Model, RM）**来模仿人类当裁判，就需要用这个损失函数。

* **数学公式**：
    $$\mathcal{L}_{RM} = - \mathbb{E}_{(x, y_w, y_l)\sim \mathcal{D}} \left[ \log \sigma \left( r_\phi(x, y_w) - r_\phi(x, y_l) \right) \right]$$
* **公式解释**：
    * $r_\phi$：正在训练的奖励模型。
    * $\sigma$：Sigmoid 函数，将分差映射到 $(0, 1)$ 的概率区间。
    * **机制**：强迫奖励模型给好答案 $y_w$ 打的分数，远远高于给差答案 $y_l$ 打的分数。分差越大，Loss 越低。

#### 3. 直接偏好优化损失 (DPO Loss)
如果你想跳过奖励模型，直接用偏好数据微调大模型本身，这是目前业界最常用的方案。

* **数学公式**：
    $$\mathcal{L}_{DPO} = - \mathbb{E}_{(x, y_w, y_l)} \left[ \log \sigma \left( \beta \log \frac{\pi_\theta(y_w \mid x)}{\pi_{ref}(y_w \mid x)} - \beta \log \frac{\pi_\theta(y_l \mid x)}{\pi_{ref}(y_l \mid x)} \right) \right]$$
* **公式解释**：
    * $\pi_\theta$：当前训练的学生模型。
    * $\pi_{ref}$：冻结的参考模型（用来防止模型学崩）。
    * $\beta$：控制模型偏离参考模型程度的惩罚系数。
    * **机制**：通过对比模型现在的输出概率和过去的输出概率，奖励模型提高 $y_w$ 的相对生成概率，惩罚 $y_l$ 的相对生成概率。

#### 4. 几率比偏好损失 (ORPO Loss)
如果你没有经过 SFT 的模型，想直接在 Base 模型上**一步到位**同时完成知识注入和偏好对齐（不需要参考模型 $\pi_{ref}$，省一半显存），就用 ORPO。

* **数学公式**：
    $$\mathcal{L}_{ORPO} = \mathbb{E}_{(x, y_w, y_l)} \left[ \mathcal{L}_{SFT}(y_w) \right] - \lambda \mathbb{E}_{(x, y_w, y_l)} \left[ \log \sigma \left( \log \frac{Odds_\theta(y_w \mid x)}{Odds_\theta(y_l \mid x)} \right) \right]$$
    其中，$Odds_\theta(y \mid x) = \frac{\pi_\theta(y \mid x)}{1 - \pi_\theta(y \mid x)}$
* **公式解释**：
    * 前半部分 $\mathcal{L}_{SFT}(y_w)$：保证模型学会好好说话（以好答案为锚点）。
    * 后半部分（Odds Ratio）：强迫生成好答案的“胜率”远远大于生成烂答案的“胜率”，以此拉开差距。

---

### 第三类：你拥有“非人类标注”的软标签（教师模型输出）
**数据格式**：$(x, p(y|x))$，即（提示词，教师模型输出的概率分布）。
**应用场景**：知识蒸馏（Knowledge Distillation）。

#### 5. Kullback-Leibler 散度损失 (KL Divergence Loss)
当你的标注数据不是确定的文本，而是另一个强大的闭源模型（教师）生成的概率分布时，你希望学生模型的概率分布逼近教师模型。

* **数学公式**（通常使用 Forward KL）：
    $$\mathcal{L}_{KD} = \mathbb{E}_{x} \left[ \sum_{y \in \mathcal{Y}} p_{teacher}(y \mid x) \log \frac{p_{teacher}(y \mid x)}{\pi_\theta(y \mid x)} \right]$$
    在实际计算中，由于教师的分布可以视为常数，它通常退化为软标签的交叉熵：
    $$\mathcal{L}_{Soft-CE} = - \mathbb{E}_{x} \left[ \sum_{y \in \mathcal{Y}} p_{teacher}(y \mid x) \log \pi_\theta(y \mid x) \right]$$
* **公式解释**：
    * $p_{teacher}$：老师给出的各个词的概率（比如“苹果” 90%，“香蕉” 10%）。
    * $\pi_\theta$：学生的概率。
    * **机制**：要求学生不仅学标准答案，连老师犹豫和犯错的概率也要一并模仿。

---

### 💡 总结与选型建议指南

| 你的数据情况 | 你的最终目标 | 推荐选择的 Loss 函数 | 核心特点 |
| :--- | :--- | :--- | :--- |
| **单项高质量文本**（人类专家手写） | 注入领域知识，学会特定格式 | **SFT (Cross-Entropy)** | 最基础，不可或缺，但也容易引发幻觉。 |
| **成对偏好数据**（A 比 B 好） | 训练一个独立裁判 | **RM (Bradley-Terry)** | 配合 PPO 算法使用，上限最高但极难训练。 |
| **成对偏好数据**（A 比 B 好） | 直接微调现有的 SFT 模型 | **DPO** | 业界主流，稳定有效，但需要双倍显存（挂载参考模型）。 |
| **成对偏好数据**（A 比 B 好） | 只有 Base 模型，算力/显存有限 | **ORPO** | 单模型运行，SFT 与对齐二合一，工程极其友好。 |
| **老师的概率分布**（Logprobs） | 把大模型的能力压缩给小模型 | **KL Divergence (KD)** | 适合白盒蒸馏，能学到暗知识（Dark Knowledge）。 |