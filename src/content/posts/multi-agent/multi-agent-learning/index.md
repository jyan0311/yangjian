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

### 2. 输入与输出
* **输入**:
  * `state` (`AgentState`): 包含当前执行上下文的字典状对象。期望包含 `data` (含 `end_date`, `tickers`, `analyst_signals`) 和 `metadata` (含 `show_reasoning`)。
  * `agent_id` (`str`): 智能体标识符，默认为 `"sentiment_analyst_agent"`。
* **输出**:
  * 返回一个字典，包含:
    * `messages`: 包含分析结果的 `HumanMessage` 列表（供 LangChain 后续节点读取）。
    * `data`: 更新后的数据字典，其中 `analyst_signals` 被写入了该智能体的分析结果


### 3. 核心执行流程 (Step-by-Step)

1. **初始化与参数提取**: 从 `state` 中提取 `end_date`, `tickers` 和 API Key。初始化空的 `sentiment_analysis` 字典。
2. **遍历股票代码 (`for ticker in tickers`)**:
   * **步骤 A: 获取内部交易数据**
     * 调用 `get_insider_trades` 获取最多 1000 条记录。
     * 提取 `transaction_shares`（交易股数）。
     * **逻辑**: 股数 `< 0` (通常为卖出) 标记为 `"bearish"` (看跌)，否则 (买入或授予) 标记为 `"bullish"` (看涨)。
   * **步骤 B: 获取公司新闻数据**
     * 调用 `get_company_news` 获取最多 100 条记录。
     * 提取新闻的 `sentiment` 字段。
     * **逻辑**: `"negative"` -> `"bearish"`, `"positive"` -> `"bullish"`, 其他 -> `"neutral"`。
   * **步骤 C: 信号加权与合并**
     * 设定权重：内部交易 `0.3`，新闻 `0.7`。
     * 分别计算加权后的看涨和看跌信号总数。
   * **步骤 D: 决策与置信度计算**
     * 比较加权后的看涨和看跌总数，决定 `overall_signal`。
     * 置信度公式: `(max(加权看涨, 加权看跌) / 总加权信号数) * 100`。若无信号，置信度为 0。
   * **步骤 E: 构建推理过程 (Reasoning)**
     * 生成一个详细的嵌套字典，记录内部交易和新闻的具体指标（总数、看涨/看跌数、权重、加权后的值），以及最终的综合分析结论。这对于 LLM 后续生成可解释的报告至关重要。
   * **步骤 F: 状态更新与进度报告**
     * 将结果存入 `sentiment_analysis[ticker]`。
     * 调用 `progress.update_status` 更新 UI 或日志进度。
3. **循环结束后**:
   * 将完整的 `sentiment_analysis` 序列化为 JSON，包装进 `HumanMessage`。
   * 如果 `state["metadata"]["show_reasoning"]` 为真，则在控制台打印推理过程。
   * 将结果写入 `state["data"]["analyst_signals"][agent_id]`。
   * 返回更新后的 `messages` 和 `data`。

---

### 4. 关键算法与逻辑解析

* **信号映射逻辑**:
  ```python
  # 内部交易: 卖出(<0)看跌，其他(>=0)看涨
  np.where(transaction_shares < 0, "bearish", "bullish")
  
  # 新闻情感: 嵌套的 np.where 实现三分类映射
  np.where(sentiment == "negative", "bearish", 
           np.where(sentiment == "positive", "bullish", "neutral"))
  ```
* **加权计分逻辑**:
  不是对最终信号加权，而是对**信号的数量**进行加权。例如，如果有 10 条看涨新闻和 2 条看跌内部交易：
  `bullish_signals = (0 * 0.3) + (10 * 0.7) = 7.0`
  `bearish_signals = (2 * 0.3) + (0 * 0.7) = 0.6`
  最终判定为看涨。


  ### 5. 代码优点 (Strengths)
1. **结构化推理 (Structured Reasoning)**: 生成的 `reasoning` 字典非常详细，包含了原始指标和加权指标。这符合现代 Agentic Workflow 的最佳实践，使得 LLM 能够基于确凿的数据指标生成高质量的分析报告，而不是盲目猜测。
2. **进度追踪 (Progress Tracking)**: 细粒度的 `progress.update_status` 调用，非常适合长耗时的 API 请求场景，便于前端或日志监控。
3. **防御性编程 (部分)**: 在计算置信度时，检查了 `total_weighted_signals > 0`，避免了除以零的错误。使用了 `max(len(...), 1)` 防止分母为零。
