# 笔记整理约定

这个站点把 `src/content/posts/` 当成知识库入口，不是 `src/posts/`。研究主题由 `src/content/posts/` 下的第一级文件夹决定；每篇公开笔记建议保留一段 YAML frontmatter，页面会用它完成排序、关键词、系列归档和摘要展示。

```yaml
---
title: "文章标题"
description: "一句话说明这篇笔记解决什么问题。"
date: "2026-07-31"
series: "SchemaEvolve 框架理解"
status: "polished"
tags: ["LLM", "Alpha", "实验记录"]
source: "Obsidian/【科研】量化交易/..."
featured: false
draft: false
---
```

## 三个概念

- 第一级文件夹：研究主题，数量要少而稳定，用来生成首页“研究主题”和合集页一级分组。
- `series`：主题下的一组连续笔记，用来把一个项目、论文线或实验线收拢起来。
- `tags`：关键词索引，用来描述方法、数据集、模型、工具；不要用它承担主题分类。

## 目录层级

建议把网页发布内容整理成“主题 / 系列 / 单篇文章”的三层结构。文章如果有图片，就给它单独建文件夹，并把正文命名为 `index.md`。如果只是很短的单篇笔记，也可以暂时保留为 `.md` 文件，等图片和材料变多后再迁移成文件夹。

```text
src/content/posts/
├── quant-alpha/
│   ├── llm-factor-mining-review/
│   │   └── index.md
│   ├── mcts-alpha-jungle/
│   │   └── index.md
│   └── factor-evaluation/
│       ├── good-factor-stock.md
│       └── good-factor-crypto.md
├── qlib-backtest/
│   └── build-backtest-system/
│       ├── 01-data-eda/
│       │   ├── index.md
│       │   └── images/
│       ├── 02-factor-library-backtest/
│       │   └── index.md
│       └── 03-adjusted-price/
│           └── index.md
├── schema-evolve/
│   ├── framework/
│   │   └── index.md
│   ├── lgbm-reward-model/
│   │   └── index.md
│   └── experiment-diagnostics/
│       └── bandit-factor-generalization.md
├── reproduction/
│   ├── graphalpha/
│   │   └── index.md
│   └── alphaagent/
│       └── index.md
└── workbench/
    └── 2026-06-week-1/
        └── index.md
```

## 发布状态

- `seed`：从 Obsidian 前移过来的原始材料，可以公开但还没完全重写。
- `draft`：已经整理过结构，但论证、引用或图片还没最终确认。
- `polished`：适合推到 GitHub Pages 的正式文章。

## 推荐分类

- `quant-alpha/`：量化 Alpha、LLM 因子挖掘、论文综述、因子评估方法论。
- `schema-evolve/`：SchemaEvolve 算法、工程实现、实验诊断。
- `qlib-backtest/`：Qlib 数据、回测、特征库、复权和工程链路。
- `llm-research/`：LLM 对齐、蒸馏、推理、主动学习、论文阅读。
- `multi-agent/`：多智能体框架、交易 Agent、项目拆解。
- `reproduction/`：论文和开源项目复现命令。
- `experiments/`：实验排查、结果复盘、baseline 修复。
- `afac/`：AFAC 等科研竞赛材料。
- `engineering/`：工程工具、爬虫、脚本和非研究主线技术笔记。
- `workbench/`：还没整理成正式文章的过程材料。

## 写作建议

- 新文章优先写到 `src/content/posts/<研究主题文件夹>/<系列或文章>/index.md`。
- 图片放在文章同级的 `images/` 文件夹里，例如 `src/content/posts/quant-alpha/mcts-alpha-jungle/images/flow.png`。
- `title` 尽量使用 `领域｜具体问题`，例如 `量化交易｜Alpha360 未来信息泄露问题的排查与修复`。
- `description` 写给未来的自己，说明“为什么需要重读这篇”。
- `tags` 保持 3 到 6 个，优先使用稳定概念，少用一次性形容词。
- 研究主题由第一级文件夹控制，不需要再写 `category`。
- `series` 控制合集页里的系列归档。
- 临时笔记可以先不写 frontmatter；系统会自动归为 `未整理`，但正式发布前建议补齐。
