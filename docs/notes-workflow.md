# 笔记整理约定

这个站点把 `src/content/posts/` 当成知识库入口。每篇公开笔记建议保留一段 YAML frontmatter，页面会用它完成排序、标签、主题归档和摘要展示。

```yaml
---
title: "文章标题"
description: "一句话说明这篇笔记解决什么问题。"
date: "2026-07-31"
category: "量化 Alpha"
series: "SchemaEvolve 框架理解"
status: "polished"
tags: ["LLM", "Alpha", "实验记录"]
source: "Obsidian/【科研】量化交易/..."
featured: false
draft: false
---
```

## 目录层级

建议把网页发布内容整理成“主题 / 系列 / 单篇文章”的三层结构。文章如果有图片，就给它单独建文件夹，并把正文命名为 `index.md`。

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

- `quant-alpha/`：LLM Alpha 因子挖掘、论文综述、因子评估方法论。
- `qlib-backtest/`：Qlib 数据、回测、特征库、复权和工程链路。
- `schema-evolve/`：SchemaEvolve 算法、工程实现、实验诊断。
- `reproduction/`：论文和开源项目复现命令。
- `multi-agent/`：多智能体框架、交易 Agent、项目拆解。
- `实验记录/`：实验排查、结果复盘、baseline 修复。
- `workbench/`：还没整理成正式文章的过程材料。

## 写作建议

- `title` 尽量使用 `领域｜具体问题`，例如 `量化交易｜Alpha360 未来信息泄露问题的排查与修复`。
- `description` 写给未来的自己，说明“为什么需要重读这篇”。
- `tags` 保持 3 到 6 个，优先使用稳定概念，少用一次性形容词。
- `category` 控制主页“研究主题”归档。
- `series` 控制合集页里的系列归档。
- 临时笔记可以先不写 frontmatter；系统会自动归为 `未整理`，但正式发布前建议补齐。
