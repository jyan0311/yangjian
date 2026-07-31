---
title: "论文复现｜GraphAlpha 使用本地 Qlib 数据的复现命令"
description: "整理 GraphAlpha 使用 hf_data/cn_data 构建 qlib panel、检查数据与运行第一层 LLM 评估的命令，避免错误读取默认 ~/.qlib 数据。"
date: "2026-06-18"
category: "论文复现"
series: "Alpha 因子挖掘复现命令"
status: "seed"
tags: ["GraphAlpha","Qlib","Reproduction","Command"]
source: "Obsidian/【科研】量化交易/论文复现命令/GraphAlpha.md"
featured: false
draft: false
---
你判断是对的：这个命令确实依赖 `cn_data`，但你当前项目里已经有本地 qlib 格式数据，不应该去 `~/.qlib/qlib_data/cn_data` 找。

我检查了你的目录，`hf_data/cn_data` 是标准 qlib provider 结构：

```text
hf_data/cn_data/
  calendars/day.txt
  instruments/csi300.txt
  features/<instrument>/*.day.bin
```

我已经用它实际生成成功了：

```json
{
  "rows": 1386532,
  "n_instruments": 622,
  "first_date": "2016-01-04",
  "last_date": "2025-12-31",
  "label_coverage": 0.9829228607778255
}
```

所以正确命令应该是：

```bash
cd /fs04/scratch2/mg61/jyan_scratch/verl/FinAgent

PY=/scratch/mg61/jyan0311/conda/envs/quantaalpha/bin/python

PYTHONPATH=GraphAlpha $PY -m graphalpha.panel build \
  --provider-uri hf_data/cn_data \
  --market csi300 \
  --start-time 2016-01-01 \
  --end-time 2025-12-31 \
  --output GraphAlpha/data/panel_qlib_csi300.parquet \
  --label-col label_1d_open_to_open
```

检查生成结果：

```bash
PYTHONPATH=GraphAlpha $PY -m graphalpha.panel inspect \
  GraphAlpha/data/panel_qlib_csi300.parquet
```

然后 GraphAlpha 第一层评估可以这样跑：

```bash
export OPENAI_API_KEY="你的 key"

PYTHONPATH=GraphAlpha:AlphaAgent $PY -m graphalpha.cli \
  --baseline alpha158_20 \
  --baseline-limit 20 \
  --llm-model gpt-5.4 \
  --llm-base-url http://47.74.0.65/v1 \
  --llm-api-key-env OPENAI_API_KEY \
  --llm-expand-seeds \
  --panel GraphAlpha/data/panel_qlib_csi300.parquet \
  --label-col label_1d_open_to_open \
  --shared-protocol scripts/shared_eval_protocol.json \
  --run-dir GraphAlpha/runs/alpha158_20_first_layer_llm \
  --max-experiments 20 \
  --export-pool GraphAlpha/runs/alpha158_20_first_layer_llm/graphalpha_pool.json
```

这里有个环境细节：我发现 `conda run -n quantaalpha` 在当前 shell 下实际落到了 base Python，而且没有 `qlib`；但绝对路径 `/scratch/mg61/jyan0311/conda/envs/quantaalpha/bin/python` 是正确的，里面有 `qlib 0.9.7`。所以我建议你用上面这种 `$PY` 写法，最稳。

`hf_data/daily_pv.h5` 也有数据，但它不是这条 qlib panel 构建命令的入口。当前 GraphAlpha 的 panel builder 是按 qlib provider 读字段和表达式的，因此应该优先使用 `hf_data/cn_data`。
