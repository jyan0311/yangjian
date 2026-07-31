---
title: "SchemaEvolve｜真实 Alpha 因子与 Schema Plan 的关系"
description: "从 Event、Context、Quality、Direction、Output 五维拆解出发，解释 SchemaEvolve 挖掘的对象与人工常规因子的区别。"
date: "2026-06-16"
category: "量化研究"
series: "Schema Alpha"
status: "draft"
tags: ["SchemaEvolve","Alpha","Factor Design","Schema Plan"]
source: "Obsidian/【科研】量化交易/THU量化交易实习/碎片的知识/真实的alpha因子长什么样子.md"
featured: false
draft: false
---
## 一、为什么拆成这五类？

这五类不是随便分的，对应研究员写因子时脑子里通常会走的 **5 步**：

```text
① 发生了什么？     → Event
② 在什么环境下？   → Context
③ 可不可信？       → Quality
④ 往哪边做？       → Direction
⑤ 信号长什么样？   → Output
```

可以对照一句人话：

> 「**假突破收回**（Event）发生在 **区间上沿**（Context），且有 **成交确认**（Quality），我按 **反转**（Direction）做，信号 **事件发生后逐渐衰减**（Output）。」

再直白一些就是：

当股价向上突破阻力位，但很快又跌回来了，并且成交量明显放大，我认为这是一次失败突破，因此后面价格大概率下跌，所以我要做空（或者减仓），而且这个信号随着时间推移越来越弱。

### 每一维各自管什么、不管什么

| 维度 | 管什么 | 故意不管什么 |
|------|--------|--------------|
| **Event** | 市场客观现象：跳空、假突破、价仓背离、波动扩张… | 不做多/空判断，不做质量过滤 |
| **Context** | 事件发生在哪：区间上沿、VWAP 附近、Pivot 高点… | 不解释方向，不评价好坏 |
| **Quality** | 过滤/确认/衰减/去噪：成交确认、新鲜度衰减… | 不决定做多还是做空 |
| **Direction** | 假设延续还是反转还是震荡 | 不定义事件本身 |
| **Output** | 分数怎么变成可回测 signal：连续值、衰减、只保留最新事件… | 不定义前面逻辑 |

**拆成五类的好处：**

1. **可解释**：每个 plan 都能用一句话描述，不像 GP 搜出来的 `(rank(close,20)-rank(vol,10))/std(ret,5)` 难讲清楚。
2. **可组合搜索**：各维独立采样，能系统性地试「同一事件 × 不同背景 × 不同过滤」。
3. **可训练**：LGBM 能学「event+context 这类组合往往更好」，而不是在纯公式空间里盲搜。
4. **实现有约束**：LLM 只负责「怎么算」，语义边界由 schema 框住，减少乱写。

技术报告里的动机就是：**从公式空间升到语义空间**，让搜索空间大，但每个点仍有交易含义。

---

## 二、这个系统「挖掘」的内容到底是什么？

要分清 **两层**：

### 第 1 层：搜索对象 = Schema Plan（交易假设）

系统 **不是在 1.83 亿个固定公式里选一个**，而是在组合 **语义 plan**，例如：

```text
event.gap_fill_or_hold
| context.range_upper_boundary
| quality.volume_confirmation
| quality.freshness_decay
| direction.reversal
| output.event_decay_signal
```

含义：**「区间上沿的跳空回补/守住，有成交确认，信号随时间衰减，按反转方向做。」**

Bandit 选的是 **哪些 plan 值得让 LLM 去实现**。

### 第 2 层：最终产物 = 可执行 Python 因子函数

LLM 根据 plan 写代码，产出类似：

```python
def F_xxx(quot_df, period=60) -> pd.DataFrame:
    return pd.DataFrame({"signal": ...}, index=quot_df.index)
```

或横截面版：

```python
def F_xxx(panel, period=60) -> pd.DataFrame:  # datetime × symbol
    ...
```

**真正拿去回测、算 IC/Sharpe/ERS20 的是这段代码算出来的 `signal`**，不是 plan 本身。

快照里一个真实例子（横截面 plan 的实现）逻辑是：

- Event：实体扩张 + 收盘推进，横截面 rank  
- Context：相对前收的位置  
- Quality：新鲜度衰减、异常值压缩、横截面自归一化 rank  
- Direction：延续（阳线为正、阴线为负）  
- Output：保留最近一次有效事件的 signal  

所以：**挖掘内容 =「语义假设 + 其代码实现 + 回测 reward」**，三者绑在一起。

---

## 三、人工常规因子 vs 本系统因子

### 人工研究员通常怎么做

| 环节 | 人工做法 |
|------|----------|
| 假设 | 自己想到：「20 日动量可能有效」「ROE/PE 估值」 |
| 公式 | 手写：`close/close.shift(20)-1`、`EPS/Price` |
| 搜索 | 改窗口、改组合，范围有限 |
| 产出 | 一个明确公式，如 Alpha191 的 `alpha_001` |

典型人工因子例子：

- **动量**：`(close - close_20d) / close_20d`
- **反转**：`-1 * (close - close_5d) / close_5d`
- **估值**：`EP = 1/PE`
- **波动**：`std(return, 20)`

特点：**公式固定、含义清楚、产能靠人**。

### SchemaEvolve 挖出来的是什么

| 环节 | 系统做法 |
|------|----------|
| 假设 | 从 schema 库 **组合** plan，Bandit + LGBM 引导 |
| 公式 | LLM **在语义约束下生成**，同一 plan 每次实现可能略有不同 |
| 搜索 | 名义 ~1.83 亿 plan，再经 scorer 压缩到有效流形 |
| 产物 | `plan_key` + `F_xxx.py` + 回测指标 + reward |

**不是**先有一个闭式公式库再枚举，而是：

```text
语义 plan（可读的假设）
    → LLM 实现（具体 OHLCV/OI 怎么算）
    → signal 矩阵
    → 与 label 算 IC / PnL / ERS20
```

### 核心区别（一张表）

| 维度 | 人工常规因子 | SchemaEvolve |
|------|-------------|----------------|
| **搜索单位** | 公式/算子 | 交易语义 plan |
| **谁写代码** | 研究员 | LLM（受 schema + 静态/leak 检查约束） |
| **可解释性** | 公式即解释 | plan 是自然语言级解释，代码是实现细节 |
| **搜索规模** | 有限（人力） | 很大（组合 + Bandit） |
| **因子形态** | 多为截面 rank、时序差分等标准形 | 偏 **事件驱动 + 情境 + 过滤**，期货还有 OI、carry |
| **输出** | 通常一个 float 序列 | 经 Output 约束的 signal（衰减、有界、最新事件等） |
| **验证** | 人工回测 + 经验 | 统一 pipeline：leak check → 回测 → reward → LGBM 迭代 |

### 能不能对应到「常规因子」？

**部分能，但不是一一对应。**

- 若 plan 选「价格动量类 event + 延续 direction + 有界连续 output」，LLM 可能实现成 **类似动量** 的东西。  
- 若 plan 选「假突破 + 区间上沿 + 反转 + 事件衰减」，则更像 **事件型技术因子**，不太像标准 Alpha191 单行公式。  
- 横截面 topic 下，还会挖 **同一时刻多品种相对比较** 的因子（类似「截面 rank 动量」，但 event 定义更细）。

所以：**常规因子多是「一个统计量」；SchemaEvolve 因子多是「一个完整交易故事 + 实现」**。

---

## 四、用一条链路串起来

```text
人工：
  「我觉得反转有效」 → 手写 -ret_5d → 回测

SchemaEvolve：
  event.fake_break_reclaim          （假突破收回）
  + context.range_upper_boundary    （区间上沿）
  + quality.volume_confirmation     （成交确认）
  + direction.reversal              （反转）
  + output.event_decay_signal       （衰减信号）
      ↓ Bandit 选中这个 plan
      ↓ LLM 写成 F_xxx.py
      ↓ 产出 signal → ERS20 / Sharpe → reward
      ↓ 高 reward 的 event+context 组合被 LGBM 记住，下轮多挖这类
```

**五维拆分的本质**：把研究员脑中的「因子设计模板」显式化，让机器能在 **假设层** 搜索，而不是在 **公式字符层** 乱拼。

---

## 五、和你之前看的 A 股数据的联系

你之前 EDA 的 `BackTestData_pq`、`FactorRequireDataBase` 是 **另一套回测/因子生产体系**（Barra、通联行情、JoinQuant191 等）。SchemaEvolve 快照默认是 **期货 OHLCV+OI** 数据；若迁到 A 股，需要换 schema（少 OI/carry，多行业、横截面、涨跌停等），但 **五维 grammar 不变**——变的只是词库里的 event/context/quality 条目。

---

如果你希望，我可以把这段「五维理解 + 与人工因子对比」整理进 `SchemaEvolve_算法逻辑整理.md` 第 3 章，作为 3.0 导读。



# 让GPT 进行更进一步的解释

这句话实际上是在描述一个**量化交易 Alpha 因子模板**，而且是一个非常经典的 **Price Action（价格行为）反转因子**。

它把一个交易逻辑拆成了四部分：

```text
Event      （发生了什么）
Context    （发生在哪里）
Quality    （质量怎么样）
Direction  （做多还是做空）
Output     （信号如何衰减）
```

---

## 先翻译成人话

原句：

> 「假突破收回（Event）发生在区间上沿（Context），且有成交确认（Quality），我按反转（Direction）做，信号事件发生后逐渐衰减（Output）。」

意思是：

> 当股价向上突破阻力位，但很快又跌回来了，并且成交量明显放大，我认为这是一次失败突破，因此后面价格大概率下跌，所以我要做空（或者减仓），而且这个信号随着时间推移越来越弱。

---

# 第一步：理解 Event（发生了什么）

## 假突破收回

假设某股票长期在：

```text
90 ~ 100
```

之间震荡。

```text
100
────────────────
       ↑ 阻力位

95

90
────────────────
```

某天：

```text
100
────────────────
       ↑
       │
       │
      103

95

90
────────────────
```

看起来突破了。

很多人会认为：

```text
突破阻力位
=
上涨开始
```

于是追进去买。

---

结果下午：

```text
100
────────────────
      ×
     99

95

90
────────────────
```

收盘又跌回100以下。

这就是：

```text
False Breakout
```

或者：

```text
Fake Breakout
```

假突破。

---

# 为什么是假突破？

市场行为学解释：

很多人在：

```text
100
```

挂止损。

或者：

```text
100
```

挂突破买单。

于是主力：

```text
先拉过100
```

把单子吃掉。

然后：

```text
开始卖出
```

价格跌回区间。

于是：

```text
追涨的人被套
```

后面容易继续下跌。

---

# 第二步：Context（发生在哪里）

不是所有假突破都有意义。

例如：

### 情况1

在区间中央

```text
90 ──────── 100

     95
```

突然冲一下又回来。

没意义。

---

### 情况2

在区间上沿

```text
100
────────────────
      ↑
     假突破

90
────────────────
```

就有意义。

因为：

```text
100
```

是大家共同关注的阻力位。

所以：

```text
假突破 + 阻力位
```

远比：

```text
假突破 + 区间中间
```

更有效。

---

# 第三步：Quality（成交确认）

为什么还要成交确认？

因为有些突破只是：

```text
偶然成交
```

没有意义。

---

例如：

### 弱信号

```text
突破100

成交量没变化
```

可能只是随机波动。

---

### 强信号

```text
突破100

成交量暴增

然后跌回来
```

说明：

很多资金参与了。

市场真的进行了：

```text
多空博弈
```

但最终：

```text
空方赢了
```

因此信号更强。

---

量化里常见写法：

```python
volume_today
/
volume_ma20
```

或者：

```python
turnover_rank
```

作为 Quality。

---

# 第四步：Direction（反转）

这是最关键的。

面对假突破有两种理解：

---

## Momentum

认为：

```text
突破就是强
```

继续做多。

---

## Reversal

认为：

```text
突破失败
```

说明上涨动能耗尽。

应该做空。

---

这句话里：

```text
Direction = Reversal
```

表示：

```text
假突破
→
看空
```

---

# 第五步：Output（逐渐衰减）

很多新人犯的错误：

```text
今天出现信号

未来30天都一样看待
```

实际上不合理。

---

例如：

### 第1天

刚出现假突破

预测力：

```text
100%
```

---

### 第5天

市场已经消化

预测力：

```text
50%
```

---

### 第20天

几乎没意义

预测力：

```text
0%
```

---

因此：

```python
signal_t = signal_0 * exp(-t / tau)
```

或者：

```python
signal_t = signal_0 * 0.95^t
```

逐渐衰减。

---

# 如果写成量化因子

这个逻辑可能变成：

```python
event =
(
    high > rolling_max_20
)
&
(
    close < rolling_max_20
)

context =
(
    close_rank_20 > 0.8
)

quality =
(
    volume / volume_ma20 > 1.5
)

alpha =
- event
* context
* quality
```

然后：

```python
alpha =
decay_linear(alpha, 5)
```

或者：

```python
alpha =
ts_decay_exp_window(alpha, 10)
```

---

# 为什么这种模板很重要？

你最近在做：

* QuantSkill
* PandaAI
* Alpha因子自动生成
* Agent生成交易策略

实际上很多因子平台都在把因子拆成：

```text
Event
↓
Context
↓
Quality
↓
Direction
↓
Output
```

这样的 DSL（领域特定语言）。

因为：

```text
Event = 发生了什么
Context = 在什么环境下发生
Quality = 信号质量
Direction = 看涨还是看跌
Output = 如何映射成仓位
```

这样 Agent 就能自动组合出大量 Alpha。

你看到的这句话，本质上就是一个已经结构化的 Alpha 描述：

```text
[Event]
假突破收回

[Context]
区间上沿

[Quality]
放量确认

[Direction]
反转做空

[Output]
指数衰减
```

这已经非常接近一个可自动生成代码的量化因子定义了。
