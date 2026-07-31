---
title: "量化交易｜Alpha360 未来信息泄露问题的排查与修复"
description: "整理 Alpha360 baseline 中“未来信息泄露 / 不可交易时点”的发现、修复与重跑实验：从 Alpha158、Alpha360 的定义出发，说明为什么 Alpha360 更容易出现时点泄露，最后给出修复前后结果对比与推荐使用口径。"
date: "2026-07-18"
tags: ["Qlib", "Alpha", "实验记录"]
featured: false
draft: false
---



# 量化交易｜Alpha360 未来信息泄露问题的排查与修复

> **整理日期**：2026-07-18  
> **笔记性质**：实验记录。整理此前关于 Alpha360 baseline 中“未来信息泄露 / 不可交易时点”的发现、修复和重跑实验，涵盖特征库定义、泄露机理、修复方案、重跑结果与后续使用规范。  
> **统计根目录**：`<PROJECT_ROOT>/verl/FinAgent`（已隐去集群绝对路径与账户信息）

本文从 Alpha158、Alpha360 的定义开始，再说明为什么 Alpha360 更容易出现时点泄露，最后整理修复前后结果和推荐使用口径。

---

## 一、Alpha158 与 Alpha360 是什么

### 1.1 Alpha158

**Alpha158** 是 qlib 官方提供的一组经典日频特征库，对应本地 handler：

| 项目 | 内容 |
|---|---|
| Handler | `qlib.contrib.data.handler.Alpha158` |
| DataLoader | `qlib.contrib.data.loader.Alpha158DL` |
| 特征数量 | 通常为 158 个 |
| 本地代码 | `qlib/qlib/contrib/data/handler.py`、`qlib/qlib/contrib/data/loader.py` |

Alpha158 的特征包括 K 线形态、价格相对量、成交量、滚动均值、滚动标准差、滚动最大/最小、滚动分位等**手工构造因子**。它更像是一组传统 tabular alpha feature。

在本项目的标准 LGBM baseline 中，Alpha158 使用统一协议：

| 项目 | 当前统一口径 |
|---|---|
| 股票池 | `csi300` |
| 训练集 | `2016-01-01` 到 `2020-12-31` |
| 验证集 | `2021-01-01` 到 `2022-12-31` |
| 测试集 | `2023-01-01` 到 `2025-12-26` |
| 回测区间 | `2023-01-01` 到 `2025-12-26` |
| label | `Ref($close, -6) / Ref($close, -1) - 1` |
| 策略 | `TopkDropoutStrategy(topk=50, n_drop=5)` |
| 成交价 | `open` |

### 1.2 Alpha360

**Alpha360** 是 qlib 官方提供的 360 维窗口型原始行情特征，对应本地 handler：

| 项目 | 内容 |
|---|---|
| Handler | `qlib.contrib.data.handler.Alpha360` |
| DataLoader | `qlib.contrib.data.loader.Alpha360DL` |
| 特征数量 | 360 个 |
| 本地代码 | `qlib/qlib/contrib/data/handler.py`、`qlib/qlib/contrib/data/loader.py` |

Alpha360 的特征不是传统手工 alpha 表达式，而是把**最近 60 天的 OHLCV/VWAP 原始行情按最新 close/volume 归一化**后输入模型。

本地 `Alpha360DL.get_feature_config()` 中，360 个特征来自 6 组字段：

| 字段组 | 特征数 | 示例 |
|---|---:|---|
| close | 60 | `Ref($close, i) / $close`、`$close / $close` |
| open | 60 | `Ref($open, i) / $close`、`$open / $close` |
| high | 60 | `Ref($high, i) / $close`、`$high / $close` |
| low | 60 | `Ref($low, i) / $close`、`$low / $close` |
| vwap | 60 | `Ref($vwap, i) / $close`、`$vwap / $close` |
| volume | 60 | `Ref($volume, i) / ($volume + 1e-12)`、`$volume / ($volume + 1e-12)` |

其中尤其需要注意 `OPEN0/HIGH0/LOW0/CLOSE0/VWAP0/VOLUME0` 这些**当天字段**。它们在 t 日收盘后当然是已知的，但在 t 日开盘时并不全部可知。

---

## 二、泄露问题是什么

### 2.1 问题本质

我们此前的 Alpha360 官方模型 baseline 中，模型用 t 日的 Alpha360 特征生成 t 日预测信号，然后回测策略使用 `deal_price=open`。

如果信号没有延迟，那么实际含义是：

| 步骤 | 旧口径的问题 |
|---|---|
| 特征生成 | t 日 Alpha360 包含 t 日 high/low/close/vwap/volume 等信息 |
| 信号生成 | 模型在 t 日 index 上产生预测 |
| 回测成交 | 同一个 t 日用 open 成交 |
| 泄露点 | t 日开盘前不可能知道 t 日 high/low/close/vwap/volume |

因此，虽然 label 仍然是未来 5 日收益，**真正的问题不是 label 公式，而是“当天完整行情特征”和“当天 open 成交”之间的时点不一致**。

### 2.2 为什么 Alpha360 更敏感

Alpha158 也可能包含当天字段，但 Alpha360 的问题更突出，因为它**系统性保留了每组原始行情的 `0` 日字段**：

| 特征 | t 日开盘时是否完整可知 |
|---|---|
| `$open` | 通常开盘后可知 |
| `$high` | 不可知 |
| `$low` | 不可知 |
| `$close` | 不可知 |
| `$vwap` | 不可知 |
| `$volume` | 不可知 |

也就是说，如果 t 日信号直接在 t 日 open 成交，Alpha360 里大量当天信息都会成为**未来信息**。

---

## 三、修复前实验

### 3.1 修复前运行目录

| 实验 | 路径 |
|---|---|
| Alpha360 官方模型 baseline | `runs/qlib_official_alpha360_model_baselines/qlib_official_alpha360_main` |
| 入口脚本 | `scripts/run_qlib_official_alpha360_model_backtest.sh` |
| Python runner | `scripts/run_qlib_official_alpha360_model_backtest.py` |
| 汇总结果 | `runs/qlib_official_alpha360_model_baselines/qlib_official_alpha360_main/summary.md` |
| 配置记录 | `runs/qlib_official_alpha360_model_baselines/qlib_official_alpha360_main/run_config.json` |

### 3.2 修复前关键配置

修复前结果目录的 `run_config.json` 中，`backtest.exchange_kwargs.deal_price = open`，但 `backtest` 部分**没有记录** `signal_shift_steps`。

当时 `_shift_signal_for_backtest()` 的逻辑是：

```python
shift_steps = int(cfg["backtest"].get("signal_shift_steps", 0))
if shift_steps <= 0:
    return pred
```

所以在缺失 `signal_shift_steps` 时，信号不会顺延，t 日信号会直接用于 t 日 open 成交。**这就是未来信息泄露口径。**

### 3.3 修复前结果

`qlib_official_alpha360_main/summary.md`：

| model | status | IC | Rank IC | annualized_return | information_ratio | max_drawdown |
|---|---|---:|---:|---:|---:|---:|
| xgboost | ok | 0.028362 | 0.037351 | 0.025517 | 0.355575 | -0.103029 |
| gru | ok | 0.045808 | 0.062503 | 0.084819 | 1.124219 | -0.072396 |
| mlp | ok | 0.027452 | 0.040493 | 0.096955 | 1.231078 | -0.081866 |
| transformer | ok | 0.031523 | 0.054643 | 0.065881 | 0.717119 | -0.141607 |
| lstm | ok | 0.040637 | 0.054613 | 0.104474 | 1.392249 | -0.060696 |

这些结果看起来偏强，尤其是 LSTM / MLP / GRU 的组合收益和 IR。结合当时没有 signal shift 的配置，可以判断**这些收益端指标不能作为可交易 baseline**。

---

## 四、修复方案

### 4.1 核心修复：open 成交时信号延迟 1 个交易日

修复后规则：

| 条件 | 处理 |
|---|---|
| `deal_price=open` | `signal_shift_steps=1` |
| `deal_price` 不是 open | 默认可设为 `0`，视具体成交假设而定 |

修复后的语义是：

1. t 日收盘后，Alpha360 的 t 日完整行情特征可知。
2. 模型产生 t 日预测信号。
3. 信号顺延到 t+1 交易日。
4. 组合在 t+1 日 open 成交。

这样就不再使用 t 日尚未发生的行情去决定 t 日开盘交易。

### 4.2 修复代码位置

| 文件 | 作用 |
|---|---|
| `scripts/run_qlib_official_alpha360_model_backtest.py` | Alpha360 官方 XGBoost / MLP / GRU / LSTM / Transformer baseline |
| `scripts/run_qlib_official_lgbm_factor_backtest.py` | Alpha158 / Alpha360 官方 LGBM baseline |
| `schemaevolve_qlib/SchemaEvolve/qlib_mining/run_mined_factor_library_reproduction.py` | 统一 LGBM 因子池回测中的 `_shift_signal_for_backtest` |

当前 `scripts/run_qlib_official_alpha360_model_backtest.py` 中，`_base_config()` 会根据成交价自动设置：

```python
deal_price = os.environ.get("BACKTEST_DEAL_PRICE", "open")
default_shift = "1" if deal_price == "open" else "0"
...
"signal_shift_steps": int(os.environ.get("BACKTEST_SIGNAL_SHIFT_STEPS", default_shift))
```

`_shift_signal_for_backtest()` 会把 prediction signal 的 datetime level 向后移动对应交易日数。

---

## 五、修复后重跑实验

### 5.1 Alpha360 官方模型修复后重跑

| 实验 | 路径 |
|---|---|
| 修复后 Alpha360 官方模型重跑 | `runs/qlib_official_alpha360_model_baselines/qlib_official_alpha360_no_xgb_shift1_retry` |
| 汇总结果 | `runs/qlib_official_alpha360_model_baselines/qlib_official_alpha360_no_xgb_shift1_retry/summary.md` |
| 配置记录 | `runs/qlib_official_alpha360_model_baselines/qlib_official_alpha360_no_xgb_shift1_retry/run_config.json` |
| 日志 | `logs/qlib_official_alpha360_no_xgb_shift1_retry.log` |

修复后 `run_config.json` 明确记录：

| 项目 | 值 |
|---|---|
| `deal_price` | `open` |
| `signal_shift_steps` | `1` |
| train | `2016-01-01` 到 `2020-12-31` |
| valid | `2021-01-01` 到 `2022-12-31` |
| test | `2023-01-01` 到 `2025-12-26` |
| backtest | `2023-01-01` 到 `2025-12-26` |
| label | `Ref($close, -6) / Ref($close, -1) - 1` |

修复后结果：

| model | status | IC | Rank IC | annualized_return | information_ratio | max_drawdown |
|---|---|---:|---:|---:|---:|---:|
| gru | ok | 0.031077 | 0.056516 | 0.037398 | 0.460964 | -0.132153 |
| mlp | ok | 0.023570 | 0.038964 | 0.051625 | 0.590142 | -0.114727 |
| transformer | ok | 0.028993 | 0.050700 | 0.061496 | 0.692959 | -0.120321 |
| lstm | ok | 0.038010 | 0.058726 | 0.051439 | 0.631789 | -0.115200 |

### 5.2 修复前后对比

| model | 修复前 IR | 修复后 IR | 变化 | 修复前年化收益 | 修复后年化收益 | 变化 |
|---|---:|---:|---:|---:|---:|---:|
| gru | 1.124219 | 0.460964 | -0.663255 | 0.084819 | 0.037398 | -0.047421 |
| mlp | 1.231078 | 0.590142 | -0.640936 | 0.096955 | 0.051625 | -0.045331 |
| transformer | 0.717119 | 0.692959 | -0.024159 | 0.065881 | 0.061496 | -0.004385 |
| lstm | 1.392249 | 0.631789 | -0.760460 | 0.104474 | 0.051439 | -0.053036 |

**结论**：修复后，Alpha360 官方深度模型 baseline 的收益端显著变得更保守。GRU、MLP、LSTM 的 IR 和年化收益下降明显，这符合“**修复前收益端包含不可交易时点优势**”的判断。

---

## 六、Alpha158 / Alpha360 LGBM 统一 baseline

除 Alpha360 官方深度模型外，我们还用 qlib 官方 handler 跑了 Alpha158 / Alpha360 的 LGBM baseline 和参数 sweep。

### 6.1 官方参数 LGBM clean run

| 实验 | 路径 |
|---|---|
| clean LGBM baseline | `runs/standard_factor_official_lgbm_qlib_clean` |
| Alpha158 metrics | `runs/standard_factor_official_lgbm_qlib_clean/alpha158/alpha158_metrics.json` |
| Alpha360 metrics | `runs/standard_factor_official_lgbm_qlib_clean/alpha360/alpha360_metrics.json` |

结果：

| source | IC | Rank IC | annualized_return | information_ratio | max_drawdown |
|---|---:|---:|---:|---:|---:|
| Alpha158 | 0.023521 | 0.037874 | 0.010169 | 0.120317 | -0.189602 |
| Alpha360 | 0.023232 | 0.033331 | 0.003817 | 0.047147 | -0.125020 |

### 6.2 LGBM 参数 sweep

| 实验 | 路径 |
|---|---|
| sweep 目录 | `runs/standard_lgbm_sweep_official_handler_all` |
| 汇总文件 | `runs/standard_lgbm_sweep_official_handler_all/sweep_summary.csv` |

结果：

| preset | source | IC | Rank IC | annualized_return | information_ratio | max_drawdown |
|---|---|---:|---:|---:|---:|---:|
| official | alpha158 | 0.023521 | 0.037874 | 0.010169 | 0.120317 | -0.189602 |
| official | alpha360 | 0.023232 | 0.033331 | 0.003817 | 0.047147 | -0.125020 |
| slower_regularized | alpha158 | 0.030350 | 0.048295 | 0.022604 | 0.264417 | -0.172381 |
| slower_regularized | alpha360 | 0.021345 | 0.031784 | -0.013615 | -0.169728 | -0.126125 |
| shallow_fast | alpha158 | 0.030245 | 0.047100 | 0.014792 | 0.177792 | -0.146399 |
| shallow_fast | alpha360 | 0.021510 | 0.032444 | 0.008712 | 0.108506 | -0.106980 |
| deep_low_lr | alpha158 | 0.031535 | 0.048700 | 0.030466 | 0.373752 | -0.141198 |
| deep_low_lr | alpha360 | 0.026384 | 0.038730 | 0.018680 | 0.236916 | -0.110075 |
| low_regularization | alpha158 | 0.034672 | 0.050377 | 0.043620 | 0.547450 | -0.158790 |
| low_regularization | alpha360 | 0.023193 | 0.029247 | 0.029946 | 0.402428 | -0.088606 |

从 sweep 看，Alpha360 不是完全无效，但**在同一 LGBM 框架下通常弱于 Alpha158，且对参数更敏感**。

---

## 七、实验结论

### 7.1 关于未来信息泄露

修复前的 Alpha360 官方模型 baseline 存在**不可交易时点问题**：Alpha360 t 日特征包含 t 日完整 OHLCV/VWAP 信息，但信号被用于 t 日 open 成交。这个口径会让模型在回测中使用开盘时尚不可知的信息。

修复后的正确口径是：**`deal_price=open` 时必须设置 `signal_shift_steps=1`**。

### 7.2 关于 Alpha360 的真实表现

修复后，Alpha360 官方深度模型的收益指标明显下降，但**仍有一定预测能力**。LSTM / Transformer / MLP / GRU 的 Rank IC 仍为正，说明 Alpha360 并不是完全失效；只是修复后不再享受不可交易时点优势。

LGBM sweep 中，Alpha360 的最佳收益端表现来自 `low_regularization`：

| 指标 | Alpha360 low_regularization |
|---|---:|
| IC | 0.023193 |
| Rank IC | 0.029247 |
| annualized_return | 0.029946 |
| information_ratio | 0.402428 |
| max_drawdown | -0.088606 |

### 7.3 关于 Alpha158 与 Alpha360 对比

在当前本地统一协议下，**Alpha158 的整体表现更稳**：

| 对比 | 结论 |
|---|---|
| 预测指标 | Alpha158 的 Rank IC 通常高于 Alpha360 |
| 收益指标 | Alpha158 的最佳 IR 高于 Alpha360 |
| 特征风险 | Alpha360 更容易因为当天 OHLCV 字段造成时点错误 |
| 建模难度 | Alpha360 更高维、更依赖模型和参数 |

---

## 八、后续使用规范

以后所有使用 Alpha360、Alpha158、AlphaPROBE、QuantaAlpha、RD-Agent 因子的回测，如果成交价是 open，都应遵守：

```bash
BACKTEST_SIGNAL_SHIFT_STEPS=1
BACKTEST_DEAL_PRICE=open
```

如果某个实验故意设置 `BACKTEST_SIGNAL_SHIFT_STEPS=0`，必须在报告中明确说明它**不是可交易口径**，只能作为“信号同日分析”或消融对照。

推荐优先引用这些修复后结果：

| 用途 | 推荐文件 |
|---|---|
| Alpha360 官方深度模型 | `runs/qlib_official_alpha360_model_baselines/qlib_official_alpha360_no_xgb_shift1_retry/summary.md` |
| Alpha158/Alpha360 官方 LGBM clean baseline | `runs/standard_factor_official_lgbm_qlib_clean/*/*_metrics.json` |
| Alpha158/Alpha360 LGBM sweep | `runs/standard_lgbm_sweep_official_handler_all/sweep_summary.csv` |
| 统一协议配置 | `scripts/shared_eval_protocol.json` |

**不建议**继续引用 `runs/qlib_official_alpha360_model_baselines/qlib_official_alpha360_main` 的收益端指标作为主结果，因为该 run 的配置没有记录 `signal_shift_steps=1`，其 open 成交口径存在未来信息泄露风险。
