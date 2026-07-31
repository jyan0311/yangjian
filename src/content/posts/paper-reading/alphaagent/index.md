---
title: "论文复现｜AlphaAgent KDD 2025 完整复现流程"
description: "整理 AlphaAgent 论文复现的关键流程：切换 legacy-main、创建 conda 环境、准备 Qlib/CSI500 数据、配置 LLM 与运行 mine/backtest。"
date: "2026-06-18"
category: "论文复现"
series: "Alpha 因子挖掘复现命令"
status: "seed"
tags: ["AlphaAgent","Qlib","Reproduction","Command"]
source: "Obsidian/【科研】量化交易/论文复现命令/AlphaAgent复现.md"
featured: false
draft: false
---
看起来 shell 后端暂时不可用（你终端里正在跑 `srun` 交互作业）。不过我已经掌握了 `legacy-main` 的 README、`.env.example`、`pyproject.toml`（CLI 入口 `alphaagent = alphaagent.app.cli:app`，子命令 `mine/backtest/ui`）以及数据准备脚本 `prepare_cn_data.py` 的全部关键信息，足以给你完整复现命令了。

下面是从**创建 conda 环境**开始的完整复现流程。

---

# AlphaAgent (KDD 2025) 完整复现指南

> ⚠️ **最重要的一步（否则会白忙）**：官方仓库的 `main` 分支已经被作者**替换成了另一套完全不同的"A股因子研究框架"（Tushare/DSL/FactorZoo）**，它**无法复现论文实验**。论文的真正复现代码在 **`legacy-main` 分支**（基于 RD-Agent/Qlib + CoSTEER）。你本地这个 `AlphaAgent` 目录当前就是 `main`，必须先切到 `legacy-main`。

## 0. 切换到论文复现分支

```bash
cd /home/jyan0311/mg61_scratch/jyan_scratch/verl/FinAgent/AlphaAgent

# 拉取并切到论文复现分支（保险起见先 fetch）
git fetch origin legacy-main
git checkout legacy-main
```

如果你想保留当前 `main` 不动、单独另建一份复现目录（推荐，避免污染现有工作区）：

```bash
cd /home/jyan0311/mg61_scratch/jyan_scratch/verl/FinAgent
git clone https://github.com/RndmVariableQ/AlphaAgent AlphaAgent-repro
cd AlphaAgent-repro
git checkout legacy-main
```

## 1. 创建 conda 环境

论文/官方 CI 验证过 Python 3.10 和 3.11。

```bash
conda create -n alphaagent python=3.10 -y
conda activate alphaagent
```

## 2. 安装 AlphaAgent 本体

```bash
# 在 legacy-main 仓库根目录下
pip install -e .
```

## 3. 安装并准备 Qlib（回测框架）

论文回测用的是微软 **Qlib**。

```bash
# 回到上一级目录，单独 clone qlib
cd ..
git clone https://github.com/microsoft/qlib.git
cd qlib
pip install .
cd ..
```

## 4. 数据准备（A股 CSI500，用 baostock 拉取并转成 Qlib 格式）

论文里：
- **CSI 500** 来自 **Baostock**；数据只用 OHLCV（`$open,$high,$low,$close,$volume`）
- 训练 2015-01～2019-12 / 验证 2020 / 测试 2021-01～2025-01

```bash
# 回到 AlphaAgent(legacy-main) 仓库根目录
cd AlphaAgent   # 或 AlphaAgent-repro

# (1) 从 baostock 下载 2015-01-01 至今的A股原始日线
python prepare_cn_data.py

# (2) 转成 Qlib bin 格式（注意确认路径）
cd ../qlib
python scripts/dump_bin.py dump_all \
  --include_fields open,high,low,close,preclose,volume,amount,turn,factor \
  --csv_path  ~/.qlib/qlib_data/cn_data/raw_data_now \
  --qlib_dir ~/.qlib/qlib_data/cn_data \
  --date_field_name date \
  --symbol_field_name code

# (3) 生成交易日历
python scripts/data_collector/future_calendar_collector.py \
  --qlib_dir ~/.qlib/qlib_data/cn_data/ --region cn

# (4) 下载 CSI500 股票池（论文用 CSI500）
python scripts/data_collector/cn_index/collector.py \
  --index_name CSI500 --qlib_dir ~/.qlib/qlib_data/cn_data/ --method parse_instruments

cd ../AlphaAgent
```

> S&P 500 的复现需要用 Yahoo Finance（`yfinance`）数据，官方 README 主要给了 A 股（CSI500）的流程；美股部分需你自行按 Qlib 的美股数据流程准备，README 未提供现成脚本。

## 5. 配置 LLM（`.env`）

```bash
cp .env.example .env
```

然后编辑 `.env`，关键项：

```dotenv
USE_LOCAL=True                 # 本地环境运行（不用 Docker），必须加
OPENAI_BASE_URL=<你的base_url>
OPENAI_API_KEY=<你的key>
REASONING_MODEL=<推理模型>      # idea/factor agent 用，如 o3-mini / deepseek-reasoner
CHAT_MODEL=<对话模型>           # 调试因子/生成反馈用，如 deepseek-v3
EMBEDDING_MODEL=text-embedding-3-small
FACTOR_MINING_TIMEOUT=10800
```

> 论文原文用的是 **GPT-3.5-turbo**（消融里还比较了 Qwen-Plus、DeepSeek-R1）。想严格对齐论文就把 `REASONING_MODEL`/`CHAT_MODEL` 设成对应模型。

## 6. 运行 AlphaAgent（挖因子，闭环进化）

```bash
# 方式一：CLI
alphaagent mine --potential_direction "<你的市场假设，如 momentum-reversal in small caps>"

# 方式二：等价的脚本入口
dotenv run -- python alphaagent/app/qlib_rd_loop/factor_mining.py --potential_direction "<你的市场假设>"
```

论文的实验设定（对齐用）：每个方法跑 **20 次独立 trial，每个 trial 5 轮进化**，把每个 trial 的最优因子存入 alpha zoo，最终取最优组合。

## 7. 多因子回测（把挖到的因子跑回测）

因子写进一个 csv：

```csv
factor_name,factor_expression
MACD_Factor,"MACD($close)"
RSI_Factor,"RSI($close)"
```

```bash
alphaagent backtest --factor_path "<你的因子csv路径>"
```

回测配置文件位置：
- 基线：`alphaagent/scenarios/qlib/experiment/factor_template/conf.yaml`
- 新因子组合：`alphaagent/scenarios/qlib/experiment/factor_template/conf_cn_combined.yaml`
- 论文回测细节：LightGBM（max_depth=4）+ 4 个基础 alpha 拼接，Top-50 选股 / 剔除最差 5 只（top-k dropout），CSI500 手续费买 0.0005 卖 0.0015。

**改 train/val/test 区间或换市场后，务必清缓存**，否则用的是旧缓存：

```bash
rm -r ./pickle_cache/*
rm -r ./git_ignore_folder/*
# 换市场时还要删除:
# alphaagent/scenarios/qlib/experiment/factor_data_template/ 下的 daily_pv_all.h5 和 daily_pv_debug.h5
```

## 8. 查看运行日志（UI，可选）

```bash
alphaagent ui --port 19899 --log_dir log/
```

---

## 关键提醒

1. **分支是成败关键**：不要在当前 `main` 上复现，一定用 `legacy-main`。
2. **需要 LLM API**：`mine` 会大量调用 LLM，没有可用 API key 跑不起来；想严格对齐论文用 GPT-3.5-turbo，成本/效果权衡可换 DeepSeek。
3. **结果有随机性**：LLM 有随机性，论文表 2 是 20 trials × 5 轮的最优组合结果，单次运行不一定复现出 `AR=11%` 这种数字，需要多 trial 聚合。
4. **美股 S&P500** 复现 README 没给现成数据脚本，需自行用 Qlib 美股流程 + yfinance 补齐。

---

**下一步建议**：等你的 `srun` 交互作业结束、shell 后端恢复后，我可以帮你实际执行第 0～2 步（切分支、建环境、`pip install -e .`），并读一下 `alphaagent/app/cli.py` 和 `prepare_cn_data.py` 确认参数细节（比如 `mine` 是 `--potential_direction` 还是 `--direction`，README 两处写法不一致，需要以代码为准）。要我现在就继续吗？
