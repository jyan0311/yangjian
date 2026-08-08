# 插图清单

本文暂不直接复制论文页面中的图表，以避免分辨率、排版与版权问题。可在发布前按下列位置补入经授权的原图，或据原论文数据自行重绘。

| 位置 | 推荐图 | 用途 | 来源 |
|---|---|---|---|
| “原生支持多少语言”小节 | 模型语言覆盖的四层能力矩阵 | 区分可编码、语言能力、推理能力、对齐与领域能力 | 建议按正文定义原创绘制 |
| “语码转换”小节 | 四类混语现象的二维图 | 区分自然语码转换、设计的混合推理、语言侵入与输出错配 | 参考 2021/2026 code-switching surveys 与 OLA，原创绘制 |
| 正文“数学推理”开头 | 多语言覆盖与资源等级图 | 说明评测偏差不是抽象概念 | PluraMath Figure 1 / Table 1 |
| “语言混合”小节 | 输入语言、隐藏层脚本、CoT 脚本关系图 | 展示英语/拉丁脚本 pivot 的机制假设 | Language Mixing in Reasoning Language Models |
| “医疗推理”小节 | 数据构建 - code-switching SFT - 课程 GRPO 流程图 | 展示 CURE-Med 的训练链 | CURE-Med Figure 1 |
| “OPD 到 MOPD”小节 | OPD/OPSD/MOPD 统一框架 | 展示 student rollout、privileged context、multi-teacher 和 peer rollout 的差异 | 根据 GKD、SDR、COPSD、两类 MOPD 原创重绘 |
| “技术路线”小节 | 本文提出的路由 - 蒸馏 - 评测流程图 | 汇总项目研究路线 | 建议原创绘制 |

插图文件可放在本目录下，以语义化文件名命名，例如 `language-capability-matrix.png`、`code-switching-taxonomy.png`、`pluramath-coverage.png`、`opd-family.png`、`cure-med-pipeline.png`。文章中使用相对路径引用。

## 原创图的建议结构

### `code-switching-taxonomy.png`

横轴为“是否由系统主动设计”，纵轴为“是否满足用户语言预期”。四个象限分别放置自然语码转换、混合推理、语言侵入和输出语言错配。不要把 code-switching 与 failure 画成同义词。

### `opd-family.png`

从左到右固定画出 `prompt -> student rollout -> teacher scoring -> update`。用不同颜色表示四类变化：标准 OPD 更换外部 teacher；OPSD 给同参数 teacher privileged context；MOPD-MT 按领域路由多个 teacher；MOPD-MR 给 teacher 成功/失败 peer trajectories。图注需明确两个 MOPD 是同名不同方法。
