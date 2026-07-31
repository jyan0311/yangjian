# 量化交易｜使用Qlib搭建一套回测系统（二）：开源因子表现回测及系统分析

> 整理对象：`SchemaEvolve/qlib_mining/run_factor_library_reproduction.py` 这条标准因子库回测链路  
> 配套材料：回测记录、启动脚本 `run_standard_factor_backtest.sh`、配置文件 `table1_factor_libraries_local.json`、评测脚本 `evaluator.py`  
> 文档性质：工程拆解 + 实验结果解读  

> 注：本文是对原始笔记的系统整理，重点回答四个问题：这次实验到底跑了什么、结果该怎么看、整套回测系统是怎么串起来的、代码里各个指标是怎么算出来的。

---

## 0. 一句话总览

这套系统并不是在做“单因子 IC 排行榜”，而是在做一条完整流水线：

`标准因子库 -> Qlib 数据集 -> LightGBM 训练 -> 预测打分 -> 信号分析 -> TopkDropout 组合回测 -> 成本后超额收益评估`

也因此，最终比较对象不是某个孤立因子表达式，而是“整套因子库作为模型输入以后，能否在统一交易约束下兑现为稳定超额收益”。

---

## 一、先看结论：这次实验说明了什么

### 1.1 本次实验跑了什么

这次运行的不是自定义因子物化链，也不是 parquet 因子矩阵直接评估链，而是：

- 入口脚本：`run_standard_factor_backtest.sh`
- 主程序：`SchemaEvolve/qlib_mining/run_factor_library_reproduction.py`

它统一评估三套标准因子库：

| 因子库 | 因子数 | 来源 |
| :--- | ---: | :--- |
| `alpha158_20` | 20 | QuantaAlpha 维护的精简版 Alpha158 |
| `alpha158` | 158 | QuantaAlpha 维护的完整 Alpha158 |
| `alpha360` | 360 | Qlib 官方 Alpha360 |

这三组实验使用的是同一套训练、验证、测试与回测参数，因此结果可以直接横向比较。

### 1.2 统一实验口径

| 项目 | 设置 |
| :--- | :--- |
| 股票池 | `csi300` |
| 基准 | `SH000300` |
| 全量数据区间 | `2016-01-01 ~ 2025-12-26` |
| 训练集 | `2016-01-01 ~ 2020-12-31` |
| 验证集 | `2021-01-01 ~ 2021-12-31` |
| 测试集 | `2022-01-01 ~ 2025-12-26` |
| 回测区间 | `2022-01-01 ~ 2025-12-26` |
| 标签 | `Ref($close, -2) / Ref($close, -1) - 1` |
| 模型 | `LGBModel` |
| 策略 | `TopkDropoutStrategy(topk=50, n_drop=5)` |
| 成交价 | `open` |
| 成本 | `open_cost=0.0005`, `close_cost=0.0015`, `min_cost=5` |

### 1.3 三组结果总表

| 因子库 | IC | ICIR | Rank IC / RIC | Rank ICIR / RICIR | AER | IR | MDD | Calmar |
| :--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `alpha158_20` | 0.0051 | 0.0329 | 0.0184 | 0.1177 | 0.0463 | 0.5044 | -0.2219 | 0.2087 |
| `alpha158` | 0.0131 | 0.0821 | 0.0331 | 0.2124 | 0.0144 | 0.2200 | -0.1376 | 0.1048 |
| `alpha360` | 0.0038 | 0.0241 | 0.0236 | 0.1468 | -0.0232 | -0.2998 | -0.2304 | -0.1006 |

补充一个很实际的工程现象：

| 因子库 | 数据初始化耗时 |
| :--- | ---: |
| `alpha158_20` | 26.7s |
| `alpha158` | 161.0s |
| `alpha360` | 397.4s |

因子数越多，特征生成和预处理成本会明显上升。

### 1.4 结果怎么读

先给结论，再看原因：

1. `alpha158` 的信号统计最强，但组合收益不最好。  
2. `alpha158_20` 的单纯 IC 不突出，但组合收益最好。  
3. `alpha360` 在当前配置下没有跑出有效组合 alpha。  

这组结果最重要的启发是：

- “预测强”不等于“投资兑现强”
- 因子数更多不等于系统表现更好
- 回测链路评估的是整套系统，不是单因子排行榜

### 1.5 三组因子库分别意味着什么

#### `alpha158_20`

它的相关性指标不算亮眼，但组合收益反而最好：

- `AER = 4.63%`
- `IR = 0.504`
- `Calmar = 0.209`

更合理的解释是：特征维度低、噪声更少、在当前 `LGB + TopkDropout` 固定配置下更稳，更不容易把样本内信号过度拟合成样本外噪声。

#### `alpha158`

它在信号层最强：

- `IC = 0.0131`
- `RIC = 0.0331`
- `RICIR = 0.2124`

但落到组合收益端只得到：

- `AER = 1.44%`
- `IR = 0.220`

这说明更强的横截面预测能力，没有被等比例转化成组合收益。常见原因包括：

- 更多特征带来更多噪声与共线性
- 当前固定超参数不一定适合 158 维输入
- 组合构建阶段的换手、持仓结构、交易成本会稀释预测优势

#### `alpha360`

它在当前配置下表现最弱：

- `AER = -2.32%`
- `IR = -0.300`

这更像是在说明：高维输入本身不是 alpha，未经调参与筛选的高维特征，反而更容易引入不稳定结构。

---

## 二、这套系统到底在做什么

### 2.1 它解决的不是“单因子回测”，而是“因子库级系统评估”

这条链路的本质是：

1. 把一整套因子表达式变成机器学习特征矩阵  
2. 用统一标签训练一个横截面选股模型  
3. 将模型输出转成每日股票打分  
4. 用统一交易规则做组合回测  
5. 同时产出信号层指标与组合层指标  

所以它比较的是：

- 因子库作为特征集合的表达能力
- 因子库与模型参数之间的匹配程度
- 信号穿过交易约束后能否真正落地为收益

### 2.2 整条链路可以压缩成八步

| 步骤 | 输入 | 输出 | 作用 |
| :--- | :--- | :--- | :--- |
| 1 | 因子库定义 | 因子表达式字典 | 确定要评估哪些特征 |
| 2 | `QlibDataLoader` | 原始特征 + 标签 | 取出面板数据 |
| 3 | `DataHandlerLP` | 处理后样本 | 缺失值、Inf、横截面归一化 |
| 4 | `DatasetH` | `train/valid/test` | 按时间切分监督学习样本 |
| 5 | `LGBModel.fit()` | 训练好的模型 | 学习因子到未来收益的映射 |
| 6 | `model.predict()` | 每日股票打分 | 生成测试期信号 |
| 7 | `SigAnaRecord` | `IC / RIC` 序列 | 分析预测能力 |
| 8 | `backtest()` | 收益曲线与风险指标 | 检查投资兑现能力 |

---

## 三、系统结构拆解：每一层分别做了什么

### 3.1 入口脚本层

入口脚本是 `run_standard_factor_backtest.sh`，职责非常纯粹：

- 激活 conda 环境
- 设置 `PYTHONPATH`
- 设置 `QLIB_DATA_DIR`
- 切到项目根目录
- 调用 `run_factor_library_reproduction.py`

它不负责金融逻辑，负责的是“让主程序在正确环境里稳定跑起来”。

### 3.2 配置文件层

核心配置在 `table1_factor_libraries_local.json`，可以拆成六块：

| 模块 | 作用 |
| :--- | :--- |
| `experiment` | 实验名称、输出目录、汇总文件名 |
| `quantaalpha` | QuantaAlpha 路径，用于加载 `alpha158_20` / `alpha158` |
| `factor_sources` | 一次运行评估哪些因子库 |
| `data` | `provider_uri`、市场、时间范围 |
| `dataset` | 标签定义与 `train/valid/test` 划分 |
| `model` / `backtest` | 模型超参数与交易回测参数 |

### 3.3 因子加载层

三套标准因子库虽然走进同一个回测系统，但来源并不完全一样：

- `alpha360`：来自 `qlib.contrib.data.loader.Alpha360DL.get_feature_config()`
- `alpha158_20`、`alpha158`：来自 QuantaAlpha 的 `factor_loader.py`

这说明系统的统一性在“评测框架”，不在“因子定义来源”。

### 3.4 数据集构建层

数据集构建由 `QlibDataLoader + DataHandlerLP + DatasetH` 完成，本质是在做一件事：

把“因子库定义”变成“监督学习样本矩阵”。

流程可以概括成：

1. 因子表达式列表交给 `QlibDataLoader`
2. 标签表达式同时挂进去
3. `DataHandlerLP` 执行预处理
4. `DatasetH` 切分 `train / valid / test`

### 3.5 预处理层

训练阶段处理器：

```json
[
  {"class": "Fillna", "kwargs": {"fields_group": "feature"}},
  {"class": "ProcessInf"},
  {"class": "DropnaLabel"},
  {"class": "CSRankNorm", "kwargs": {"fields_group": "feature"}},
  {"class": "CSRankNorm", "kwargs": {"fields_group": "label"}}
]
```

推理阶段处理器：

```json
[
  {"class": "Fillna", "kwargs": {"fields_group": "feature"}},
  {"class": "ProcessInf"},
  {"class": "CSRankNorm", "kwargs": {"fields_group": "feature"}},
  {"class": "CSRankNorm", "kwargs": {"fields_group": "label"}}
]
```

这几步分别对应：

- `Fillna(feature)`：补特征缺失值
- `ProcessInf`：清理除零等造成的正负无穷
- `DropnaLabel`：训练时去掉标签为空样本
- `CSRankNorm(feature)`：把每日横截面特征压成排序空间
- `CSRankNorm(label)`：把标签也压到横截面排序空间

这一步很关键，因为它说明这条链路的建模哲学是“横截面排序问题”，而不是传统意义上的绝对收益回归。

### 3.6 模型训练层

模型使用 `LGBModel`，核心参数包括：

- `loss = mse`
- `learning_rate = 0.1`
- `max_depth = 8`
- `num_leaves = 210`
- `subsample = 0.8789`
- `colsample_bytree = 0.8879`
- `lambda_l1 = 205.6999`
- `lambda_l2 = 580.9768`
- `min_child_samples = 100`
- `num_boost_round = 500`
- `early_stopping_round = 50`

从实际日志看，最佳轮数反而随着维度升高而更早停止：

| 因子库 | 最佳轮数 |
| :--- | ---: |
| `alpha158_20` | 85 |
| `alpha158` | 14 |
| `alpha360` | 19 |

这通常意味着：大因子库没有带来更持久的有效学习，反而更快进入“验证集不再提升”的状态。

### 3.7 信号分析层

模型训练后，程序会做两件事：

1. `model.predict(dataset)` 生成每日股票分数  
2. `SigAnaRecord(...).generate()` 生成信号分析结果  

最重要的产物是：

- `sig_analysis/ic.pkl`
- `sig_analysis/ric.pkl`

后续表里的 `IC / ICIR / RIC / RICIR` 都是从这两个 artifact 汇总出来的。

### 3.8 组合回测层

组合回测调用的是 Qlib 的 `backtest()`，策略为：

- `TopkDropoutStrategy`
- `topk = 50`
- `n_drop = 5`

含义可以直白理解成：

- 每天持有打分最高的 50 只股票
- 每次最多替换 5 只，降低换手

交易约束包括：

- 用 `open` 成交
- 有买卖成本
- 有最低手续费
- 有涨跌停阈值限制

这一步把“预测分数”变成了“真实交易语境下的收益表现”。

### 3.9 预检查与输出层

正式运行前，程序会先做 `preflight_qlib_data()`，检查：

- `data`
- `train`
- `valid`
- `test`
- `backtest`

这些区间里是否都有：

- 非空交易日历
- 非空股票池

最终输出产物分为三层：

| 层级 | 文件 | 作用 |
| :--- | :--- | :--- |
| 单因子库指标 | `<source>_metrics.json` | 保存该因子库各项指标 |
| 单因子库曲线 | `<source>_cumulative_excess.csv` | 保存累计超额收益曲线 |
| 全局汇总 | `factor_library_metrics.json`、`preflight_qlib_data.json` | 统一汇总与覆盖检查 |

---

## 四、指标是怎么来的：从代码视角统一口径

### 4.1 两条指标计算路径

项目里有两条相关实现路径：

- 标准因子库回测路径：`run_factor_library_reproduction.py`
- parquet 因子矩阵评估路径：`evaluator.py`

它们的核心思想是一致的：

- `IC / RIC` 衡量预测能力
- `AER / IR / MDD / Calmar` 衡量投资兑现能力

### 4.2 标签定义

标签来自配置：

```text
Ref($close, -2) / Ref($close, -1) - 1
```

可以把它理解为：在时点 `t`，用当前因子去预测未来一期收益。

因此后续所有相关性指标，本质上都是在衡量：

“模型输出分数”和“未来收益标签”之间的横截面关系。

### 4.3 IC 与 ICIR

`IC` 和 `ICIR` 来自 `sig_analysis/ic.pkl`。

定义可以写成：

```text
IC = mean(IC_t)
ICIR = mean(IC_t) / std(IC_t)
```

其中 `IC_t` 是某个交易日上，股票横截面中：

- 模型预测分数
- 未来收益标签

之间的 Pearson 相关系数。

### 4.4 RIC、Rank IC 与 RICIR

`RIC` 来自 `sig_analysis/ric.pkl`，在这套代码里：

- `RIC = Rank IC`
- `RICIR = Rank ICIR`

定义与 `IC` 平行，只是把 Pearson 改成 Spearman：

```text
RIC = mean(RIC_t)
RICIR = mean(RIC_t) / std(RIC_t)
```

对于横截面选股，`RIC` 通常比 `IC` 更贴近策略目标，因为组合更关心排序是否正确，而不是线性拟合是否强。

### 4.5 如果手动重算，横截面相关是怎么做的

在 parquet 因子矩阵评估链路里，逻辑是显式写出来的：

1. 逐交易日遍历
2. 取这一天所有股票的特征值 `x`
3. 取这一天所有股票的标签值 `y`
4. 去掉缺失
5. 如果有效股票数不足 3，跳过
6. 计算 `x` 和 `y` 的横截面相关系数

因此：

- `method="pearson"` 时得到 `IC` 日序列
- `method="spearman"` 时得到 `RIC` 日序列

### 4.6 收益序列是怎么构造的

组合回测后，程序会从 `report_df` 里取三列：

- `return`
- `bench`
- `cost`

然后构造日度超额收益：

```text
excess_t = return_t - bench_t - cost_t
```

这是后续收益风险指标的核心输入。

### 4.7 AER、IR、MDD、Calmar

这几个指标都是围绕 `excess` 算的：

| 指标 | 含义 |
| :--- | :--- |
| `AER` | 年化超额收益，本质上等于 `annualized_return` |
| `IR` | 超额收益的信息比率 |
| `MDD` | 累计超额收益曲线的最大回撤 |
| `Calmar` | `annualized_return / abs(max_drawdown)` |

需要特别记住一点：

`AER` 不是组合原始收益，而是相对基准、扣掉交易成本之后的超额收益年化。

### 4.8 SR 为什么和 IR 不一样

这套脚本还单独计算了 `SR`，但它和 `IR` 不是一回事：

- `SR`：基于组合原始日收益 `portfolio_return`
- `IR`：基于成本后超额收益 `excess`

也就是说：

```text
SR = mean(portfolio_return_t) / std(portfolio_return_t) * sqrt(252)
IR = mean(excess_t) / std(excess_t) * sqrt(252)
```

一个看组合自身波动收益比，一个看相对基准的超额稳定性。

### 4.9 累计超额收益曲线怎么存

程序输出的 `cumulative_excess_return` 是简单累加：

```text
cumulative_excess_return_t = sum_{s<=t}(excess_s)
```

它应该理解成“累计日超额收益和”，不是严格意义上的复利净值曲线。

---

## 五、这套回测系统最值得记住的几个判断

### 5.1 信号层和组合层不是一回事

最容易误读的地方，是把 `IC / RIC` 直接等同于 `AER / IR`。

实际上这套系统至少有两个评估层：

| 层 | 代表指标 | 回答的问题 |
| :--- | :--- | :--- |
| 信号层 | `IC`、`RIC`、`ICIR`、`RICIR` | 模型打分是否能正确排序股票 |
| 组合层 | `AER`、`IR`、`MDD`、`Calmar` | 这个排序经过交易规则后能否兑现收益 |

所以：

- 信号强，不一定收益强
- 预测对，不一定组合赚

### 5.2 更多因子不一定更好

这次实验非常典型地说明了：

- 因子增多会提升表达能力
- 但也会显著提高噪声、计算成本和不稳定性
- 在固定模型与固定交易规则下，小而精的因子库可能更容易兑现收益

### 5.3 这是一条“系统配置敏感”的链路

最终结果不只由因子定义决定，还会被这些因素强烈影响：

- 标签定义
- 数据预处理方式
- LightGBM 超参数
- `topk / n_drop`
- 股票池
- benchmark
- 交易成本

因此不能把一组结果简单理解为“某因子库本身绝对更好”，更准确的说法应该是：

“在当前系统配置下，它表现更好。”

---


