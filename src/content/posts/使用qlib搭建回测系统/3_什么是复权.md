# 量化数据｜使用Qlib搭建一套回测系统（三）：谈一下“复权”这个细节

> **整理日期**：2026-06-30  
> **笔记性质**：基于本地 `hf_data/cn_data` 的实物检查，并结合 Qlib 官方数据收集、归一化与二进制落盘脚本，对该数据集的**组织结构**、**字段语义**、**编码格式**与**复权口径**进行技术性说明。


```
title: "量化数据｜使用Qlib搭建一套回测系统（三）：谈一下“复权”这个细节"
description: "基于本地 cn_data 目录、Qlib 官方脚本与文档，分析 cn_data 的目录结构、二进制编码、字段语义，以及其复权与标准化处理。"
date: "2026-06-30"
tags: ["Qlib", "Data", "Alpha", "Adjustment", "Backtest"]
featured: false
draft: false
```


---

## 一、结论摘要

| 维度 | 结论 |
| :--- | :--- |
| **数据类型** | `cn_data` 是一份 **Qlib 风格的 A 股日频二进制特征库**，不是原始 CSV，也不是单表型存储。 |
| **价格口径** | `open/high/low/close/vwap` 等价格字段已进入 **adjusted-price** 体系。 |
| **是否复权** | **是**。价格序列已经由 `adjclose` 驱动进行调整。 |
| **是否额外标准化** | **是**。调整后价格进一步按“首个有效交易日 `close = 1`”进行归一化。 |
| **`close.day.bin` 的解释** | 该字段表示**调整后且标准化后的相对价格序列**，不应视为交易所原始收盘价。 |
| **核心经验关系** | 对同一证券，$\text{adjclose} / \text{close}$ 基本稳定；该性质表明 `close` 与 `adjclose` 仅在尺度上不同，而非代表两套独立的原始/复权价格。 |

复权是指对证券的历史成交价格（Open/High/Low/Close）进行系统性修正，以消除因上市公司发生权益分派事件（如送股、转增股本、配股、现金分红）而造成的价格“断层”（Price Gap），从而保证历史价格序列在时间维度上的连续性与可比性。

在复权中常用的一个操作是前复权。前复权是指**以当前（最新）交易日的实际市价为锚定基准点（Anchor Point）**，保持最新价格不变，将历史上所有交易日的价格**按比例向下（或向右）调整**。

**数学口径**：
设 $P_t$ 为 t 时刻的原始实际价格，$F_t$ 为累计复权因子（包含 t 时刻之后所有除权事件的乘积），则前复权价格 $P_{adj}^{forward}(t)$ 的计算公式为：
$$
P_{adj}^{forward}(t) = P_t \times \frac{Current\_Actual\_Price}{P_t \times \prod_{i=t}^{T} Factor_i}
$$

通俗而言，**历史价格全部被“压缩”**，使得整个价格序列与当下的股本口径保持一致。

---

## 二、再谈 cn_data

本结论来自两类证据的交叉验证：本地数据实物检查与 Qlib 官方实现口径。

### 2.1 本地证据

| 文件 / 目录 | 功能 |
| :--- | :--- |
| [hf_data/cn_data](/Users/yangjian/Documents/monash/thu科研助理工作/hf_data/cn_data) | 被分析的数据目录 |
| [hf_data/README.md](/Users/yangjian/Documents/monash/thu科研助理工作/hf_data/README.md) | 本地数据说明；其中 `factor` 被标注为 adjusted factor |
| [dump_bin.py](/Users/yangjian/Documents/monash/thu科研助理工作/代码/stock_alpha_v1/open_source_factor_sources/repos/microsoft_qlib/scripts/dump_bin.py) | Qlib `.bin` 文件的写入逻辑 |
| [collector.py](/Users/yangjian/Documents/monash/thu科研助理工作/代码/stock_alpha_v1/open_source_factor_sources/repos/microsoft_qlib/scripts/data_collector/yahoo/collector.py) | Yahoo 数据的调整与标准化逻辑 |
| [Yahoo README](/Users/yangjian/Documents/monash/thu科研助理工作/代码/stock_alpha_v1/open_source_factor_sources/repos/microsoft_qlib/scripts/data_collector/yahoo/README.md) | 官方文字说明：如何由原始数据归一化到 Qlib 格式 |

### 2.2 官方在线资料

主要参考以下官方路径：

- Qlib Yahoo collector README  
  `https://github.com/microsoft/qlib/blob/main/scripts/data_collector/yahoo/README.md`
- Qlib Yahoo collector  
  `https://github.com/microsoft/qlib/blob/main/scripts/data_collector/yahoo/collector.py`
- Qlib dump_bin  
  `https://github.com/microsoft/qlib/blob/main/scripts/dump_bin.py`

官方说明对日频数据归一化流程给出了两步定义：

1. 使用 `adjclose` 对 `open/high/low/close` 做调整；
2. 再将价格标准化到“首个有效交易日 close 为 1”。

因此，若本地样本与该流程一致，则可判定其并非原始不复权行情。

---

## 三、目录结构

`cn_data` 的顶层组织与 Qlib 约定一致：

```text
cn_data/
├── calendars/
├── instruments/
└── features/
```

这一部分已经在之前的文章讲过了，这里不再赘述。
---

## 四、`.day.bin` 的二进制编码

### 4.1 编码规则

`dump_bin.py` 的核心落盘逻辑为：

```python
np.hstack([date_index, _df[field]]).astype("<f").tofile(...)
```

因此，单个 `.day.bin` 文件的编码形式不是“纯时间序列数组”，而是：

```text
[start_calendar_index] + [aligned float32 series]
```

### 4.2 语义解释

| 位置 | 语义 |
| :--- | :--- |
| 第 1 个 `float32` | 该证券首个有效交易日在 `calendars/day.txt` 中的整数索引 |
| 其余 `float32` | 该字段按完整交易日历对齐后的时间序列值 |



1. `.day.bin` 读取时必须跳过首元素；否则会将日历索引误解为价格或成交量。  
2. 时间序列已经对齐到全市场公共日历，因此允许出现 `NaN`。  
3. `NaN` 的来源通常包括停牌、缺失观测或证券自身尚未进入有效覆盖期。

### 4.3 本地样例

以 `sh601318` 为例：

- `close.day.bin` 首元素解码为 `518`
- `day.txt[518] = 2007-03-01`

这表明该证券的有效起点与交易日历索引严格对齐，符合 Qlib 的写入规范。

---

## 五、字段语义

### 5.1 价格类字段

| 字段 | 语义判定 |
| :--- | :--- |
| `open` | 调整后且标准化后的开盘价 |
| `high` | 调整后且标准化后的最高价 |
| `low` | 调整后且标准化后的最低价 |
| `close` | 调整后且标准化后的收盘价 |
| `vwap` | 与上述价格字段处于同一标准化尺度下的成交均价 |
| `adjclose` | 保留绝对尺度的 adjusted close |

### 5.2 非价格字段

| 字段 | 语义判定 |
| :--- | :--- |
| `factor` | 由 `adjclose / close` 派生的调整因子，并随归一化流程进入当前尺度体系 |
| `change` | 单日变化率；首日可为 `NaN` |
| `volume` | 经 Qlib 调整流程处理后的量字段，不应机械等同于交易所原始成交量 |
| `amount` | 经同一流水线处理后的金额字段，更适合作为研究特征字段而非结算口径金额 |

需要特别指出的是：在 Qlib 的 `YahooNormalize1d.adjusted_price` 实现中，`volume` 与价格字段的调整方向相反，即价格乘以 `factor`，而 `volume` 除以 `factor`。因此量价字段在“是否保留原始交易所数值”这一问题上的口径并不相同。

---

## 六、复权与标准化逻辑

### 6.1 官方实现

Qlib 的日频 Yahoo 归一化逻辑可概括为两步：

#### 第一步：价格调整

```python
df["factor"] = df["adjclose"] / df["close"]
...
if _col == "volume":
    df[_col] = df[_col] / df["factor"]
else:
    df[_col] = df[_col] * df["factor"]
```

该步骤表明：

- `adjclose` 被用作价格调整锚；
- `open/high/low/close` 会被映射到 adjusted-price 尺度；
- `volume` 则按相反方向调整，以保持量价乘积关系的一致性。

#### 第二步：首日归一化

在 `_manual_adj_data` 中，官方注释为：

```python
# manual adjust data: All fields (except change) are standardized according to the close of the first day
```

即：

- 除 `adjclose` 与 `change` 外，字段会按首个有效交易日的 `close` 再做一次归一化；
- 归一化后，首日 `close` 被压缩为 1，其他价格字段转化为相对价格尺度。

### 6.2 本地样例验证

以 `sh600000` 为例：

| 日序 | `close` | `adjclose` | `factor` | `adjclose / close` |
| :--- | ---: | ---: | ---: | ---: |
| 0 | 1.0000 | 10.72 | 0.14535 | 10.72 |
| 1 | 0.9841 | 10.55 | 0.14537 | 10.72 |
| 2 | 0.9711 | 10.41 | 0.14537 | 10.72 |

以 `sz000001` 为例：

| 日序 | `close` | `adjclose` | `factor` | `adjclose / close` |
| :--- | ---: | ---: | ---: | ---: |
| 0 | 1.0000 | 163.10 | 0.15337 | 163.10 |
| 1 | 0.9908 | 161.60 | 0.15338 | 163.10 |
| 2 | 1.0000 | 163.10 | 0.15337 | 163.10 |

### 6.3 其他数据接口

在优矿提供的数据服务中，原始数据和复权后的数据是分别提供的：

原始数据：MktEqudGet

复权后数据：MktEqudAdjAfGet


## 七、最终结论

### 7.1 数据内容

`hf_data/cn_data` 是一份 **Qlib 标准二进制日频数据库**，包含：

- 公共交易日历；
- 指数/证券池成员区间定义；
- 按证券代码组织的字段级 `.day.bin` 文件。

### 7.2 编码格式

每个 `.day.bin` 文件均为 `float32` 二进制流，其首元素为日历起始索引，其余元素为按公共交易日历对齐后的字段时间序列。

### 7.3 价格口径

价格字段已由 `adjclose` 驱动进入 adjusted-price 体系，并进一步按首个有效交易日 `close = 1` 进行归一化。因此：

$$
\texttt{close.day.bin} \neq \text{raw exchange close}
$$

更准确的解释应为：

$$
\texttt{close.day.bin} = \text{normalized adjusted close}
$$

### 7.4 一句话总结

> `hf_data/cn_data` 不是原始不复权行情，而是 **Qlib 风格的、经 `adjclose` 调整并进一步首日归一化的日频特征库**。


最终列一个回测过程中的数据推荐构成：

| 数据类型           | 推荐                                        |
| -------------- | ----------------------------------------- |
| OHLC（开高低收）     | ✅ 使用复权价格（通常前复权）                           |
| VWAP           | ✅ 与价格保持一致（采用相应调整后的价格）                     |
| 成交量（Volume）    | ✅ 短期可使用原始值；一般长期研究若涉及股本变化影响较大的长期研究需要调整|
| 成交额（Amount）    | ✅ 原始值                                     |
| 换手率（Turnover）  | ✅ 原始值                                     |
| 市值（Market Cap） | ✅ 原始值（按当日股本计算）                            |
