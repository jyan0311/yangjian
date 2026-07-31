# 笔记整理约定

这个站点把 `src/content/posts/` 当成知识库入口。每篇公开笔记建议保留一段 YAML frontmatter，页面会用它完成排序、标签、主题归档和摘要展示。

```yaml
---
title: "文章标题"
description: "一句话说明这篇笔记解决什么问题。"
date: "2026-07-31"
tags: ["LLM", "Alpha", "实验记录"]
featured: false
draft: false
---
```

## 推荐分类

- `quant_alpha/`：LLM Alpha 因子挖掘、论文综述、因子评估方法论。
- `使用qlib搭建回测系统/`：Qlib 数据、回测、特征库、复权和工程链路。
- `multi-agent/`：多智能体框架、交易 Agent、项目拆解。
- `实验记录/`：实验排查、结果复盘、baseline 修复。
- `工作笔记/`：还没整理成正式文章的过程材料。

## 写作建议

- `title` 尽量使用 `领域｜具体问题`，例如 `量化交易｜Alpha360 未来信息泄露问题的排查与修复`。
- `description` 写给未来的自己，说明“为什么需要重读这篇”。
- `tags` 保持 3 到 6 个，优先使用稳定概念，少用一次性形容词。
- 临时笔记可以先不写 frontmatter；系统会自动归为 `未整理`，但正式发布前建议补齐。
