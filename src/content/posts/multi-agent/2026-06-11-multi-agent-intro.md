---
title: "多智能体（Multi-Agent）入门与实践"
description: "关于多智能体系统、协作与竞赛，及如何在项目中组织相关文章。"
date: "2026-06-11"
tags: ["LLM", "multi-agent", "research"]
featured: false
draft: false
---

本文是放在 `posts/multi-agent` 目录下的示例文章，用来记录多智能体（Multi-Agent）相关的笔记与实践。你可以把一系列关于协作、对抗、通信协议、任务分配、以及在 LLM 中的多智能体实验都放在这个子目录下。

## 为何放在子目录？

- 组织更清晰：把同一主题的文章集中，便于浏览与归档。
- 路由层级：默认情况下，文章路径会包含子目录（例如 `/posts/multi-agent/your-article`），更利于 SEO 与结构化。

## 如何撰写文章（模版）

1. 在 `src/content/posts/multi-agent/` 下新建一个 Markdown 文件，例如 `2026-06-11-my-experiment.md`。
2. 在文件顶部写入 frontmatter：`title`, `description`, `date`, `tags`。
3. 使用标准 Markdown 或 MDX 内容书写正文，可以插入图片放在 `public/images/` 并用相对 URL 引用。

## 示例小节

这是一个示例段落，说明如何记录实验设置、超参、以及关键结论。

---

你现在可以把更多多智能体文章放进这个文件夹，访问路径将会是 `/posts/multi-agent/<filename-without-ext>`。
