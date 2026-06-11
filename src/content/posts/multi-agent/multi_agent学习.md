---
title: "多智能体（Multi-Agent）ai-hedge-fund解析和学习"
description: "拆解一个成熟的github项目，学习如何搭建一个完整的multi-agent 系统"
date: "2026-06-11"
tags: ["LLM", "multi-agent", "research"]
featured: false
draft: false
---

# ai-hedge-fund

在它的这个项目中，每个agent 并不是一个 langchain agent 的那种 ReAct 的循环，而是一个纯函数。

让我们以 `sentiment.py` 这个函数进行分析，它整体是一个 **情绪分析代理（Sentiment Analyst Agent）** ，它属于一个多代理系统的一部分（基于LangGraph框架）。

# 函数目的

分析指定股票（`tickers`）在某个截止日期(`end_date`) 之前的市场情绪它会综合考虑：
- 内部人交易（Insider Trades）：高管/大股东买卖股票行为。
- 公司新闻（Company News）：新闻的情感倾向（正面/负面/中性）。

最终为每个股票生成一个交易信号（bullish / bearish / neutral）和置信度，并将结果存入全局的状态，供其他代理（比如交易决策）进行调用和使用。

**架构角色**： LangChain Graph 中的一个节点（NODE），接收 `AgentState`， 返回更新后的状态和消息。

# 输入和输出分析。

输入:
state (AgentState): 包含当前执行上下文的字典状对象。期望包含 data (含 end_date, tickers, analyst_signals) 和 metadata (含 show_reasoning)。
agent_id (str): 智能体标识符，默认为 "sentiment_analyst_agent"。
输出:
返回一个字典，包含:
messages: 包含分析结果的 HumanMessage 列表（供 LangChain 后续节点读取）。
data: 更新后的数据字典，其中 analyst_signals 被写入了该智能体的分析结果。