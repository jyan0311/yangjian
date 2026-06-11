---
title: "Agent 的学习与实践"
description: "关于多智能体系统中状态合并、序列化与工程实践的整理。"
date: "2026-06-11"
tags: ["LLM", "multi-agent", "notes"]
featured: false
draft: false
---

### 一、 核心模块解析

#### 1. 状态合并工具：`merge_dicts`
```python
def merge_dicts(a: dict[str, Any], b: dict[str, Any]) -> dict[str, Any]:
    return {**a, **b}
```
* **作用**：这是一个 Reducer（归约）函数。在 LangGraph 中，当某个节点返回状态更新时，框架需要知道如何将新数据与旧数据合并。
* **逻辑**：执行字典的浅层合并。`b` 中的键值对会覆盖 `a` 中同名的键，同时保留 `a` 中独有的键。
