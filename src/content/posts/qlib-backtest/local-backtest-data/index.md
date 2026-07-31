---
title: "量化数据｜本地 BackTestData_pq 数据集整理"
description: "按价格复权、股票状态过滤、收益标签、基准和辅助工具分类整理 BackTestData_pq，说明其在 TradingSystem 回测链路中的作用。"
date: "2026-06-16"
category: "Qlib 回测系统"
series: "本地回测数据与工程链路"
status: "draft"
tags: ["Quant Data","Backtest","Parquet","TradingSystem"]
source: "Obsidian/【科研】量化交易/THU量化交易实习/数据集整理.md"
featured: false
draft: false
---
# 量化交易数据集整理

这个目录 `/data/stock/BackTestData_pq` 是你回测系统的**核心底层数据仓库**。它存储了进行量化回测（尤其是针对 A 股中证 1000 指数）所需要的全部日频基础数据。

这些文件全都是 **Parquet** 格式（列式存储，高效压缩，适合 Pandas 处理），并且绝大多数是以 **“日期（Date）”为行索引、以“股票代码（Stock Code）”为列**的宽表（Panel Data）结构。

下面我按**业务逻辑**帮你分类解读，并说明它们在回测引擎（`TradingSystem`）中分别起什么作用。

---

### 📊 一、价格与复权类（交易核心）
| 文件名 | 字段含义 | 在回测中的作用 |
| :--- | :--- | :--- |
| **`trade_price.parquet`** | **成交价**（通常指收盘价） | 计算每日收益率、计算信号值、判断涨跌停。 |
| **`open_price.parquet`** | **开盘价** | 模拟第二天以开盘价买入/卖出（如果是 T+1 策略）。 |
| **`pre_close.parquet`** | **前收盘价**（昨日收盘价） | 计算当日的**涨跌幅**（`trade_price / pre_close - 1`）。 |
| **`balance_price.parquet`** | **均衡价/均价**（即 `成交额 / 成交量` 的 VWAP） | 用于模拟**大额资金冲击成本**（TWAP 算法需要参考这个来评估滑点）。 |
| **`adjfactor.parquet`** | **复权因子**（后复权或前复权因子） | 将 `trade_price` 复权，消除分红、送股对价格历史连续性的影响，确保回测收益计算准确。 |

---

### 🚦 二、股票状态与过滤类（风控核心）
| 文件名 | 字段含义 | 在回测中的作用 |
| :--- | :--- | :--- |
| **`mask_isopen.parquet`** | **是否交易掩码**（True/False） | 标记股票当天是否**正常交易**（未停牌）。回测时必须过滤掉 `False` 的股票，否则会买入停牌股导致滑点失真。 |
| **`mask_isST.parquet`** | **是否ST掩码**（True/False） | 标记股票是否被**ST（特别处理/风险警示）**。绝大多数机构策略强制过滤掉 ST 股票。 |
| **`stock_pool`** | **股票池列表**（可能是目录或文件） | 定义全市场或特定指数（如中证1000）的成分股列表，用于限定选股范围。 |

---

### 🎯 三、收益与基准类（绩效评估核心）
| 文件名 | 字段含义 | 在回测中的作用 |
| :--- | :--- | :--- |
| **`SpecificRet1.parquet`**<br>**`SpecificRet5.parquet`**<br>**`SpecificRet10.parquet`** | **特定窗口期收益率**<br>（通常为未来 1、5、10 个交易日的收益率） | 这是**因子挖掘的“标签（Label）”**！你的因子（如 `alpha095`）用于预测这些未来收益。回测时，系统也会用它来计算策略的每日盈亏。 |
| **`Benchmark`** | **基准指数数据**（如中证500、沪深300的日频价格） | 用于计算超额收益（Alpha）、夏普比率、最大回撤等业绩指标。 |
| **`zz1000_weight.parquet`** | **中证1000指数成分股权重** | 如果你的策略是“中证1000全市场选股”，这个文件用来限定选股范围，或作为行业/市值中性化的权重参考。 |

---

### 📅 四、辅助工具类
| 文件名 | 字段含义 | 在回测中的作用 |
| :--- | :--- | :--- |
| **`calendar.parquet`** | **交易日历**（所有交易日的日期列表） | 用于对齐回测时间序列，跳过非交易日。 |
| **`name_dict.parquet`** | **股票代码与名称映射表** | 便于输出回测报告时，将代码（如 `000001.SZ`）显示为中文名（如“平安银行”）。 |

---

### 🔗 这些文件在 `TradingSystem` 中是如何协同工作的？

当你运行 `system.run()` 时，引擎内部大致会做这样几件事：

1. **读取数据**：根据 `calendar` 遍历每天的日期。
2. **信号生成**：读取你传入的 `input_file`（因子值 `alpha095`），再结合 `trade_price` 和 `adjfactor` 计算当日信号。
3. **风控过滤**：根据 `mask_isopen` 和 `mask_isST` 剔除停牌和 ST 股票，只保留 `stock_pool` 中符合条件的股票。
4. **交易执行**：根据 `addtwap=True`，结合 `balance_price` 和 `TWAP_PATH`（分钟级数据）模拟当日买卖的滑点成本。
5. **绩效计算**：使用 `trade_price` 和 `pre_close` 计算每日持仓收益，最终与 `Benchmark` 比较输出超额收益曲线。

---

### 🛠️ 如何理解和使用这些 Parquet 文件？

如果你需要调试或验证数据，可以在 Python（在服务器上激活 `backtest` 环境）中这样读取查看：

```python
import pandas as pd

# 读取价格数据，查看前5行（此时数据大概率是 日期 x 股票代码 的二维表）
df = pd.read_parquet('/data/stock/BackTestData_pq/trade_price.parquet')
print(df.head())
print(df.shape)  # 查看有多少天、多少只股票
```

> **提示**：这些 Parquet 文件通常是多级索引或宽表格式。如果直接 `read_parquet` 报错或显示为一列乱码，可能是存储为了 `DataFrame` 的特定格式（如使用 `to_parquet` 时未指定索引）。此时可以尝试：
> ```python
> df = pd.read_parquet('/data/stock/BackTestData_pq/trade_price.parquet', engine='pyarrow')
> df = df.unstack()  # 如果数据是长表格式
> ```

