# 本周待办
1、找两个baselinne 对比，100 valid ，取20或者150 

## 任务拆解：
## 实验数据设定
总体上的实验设置与 QuantaAlpha 对齐，使用CSI300 。

Train ：2016-01-01 — 2020-12-31
Valid ：2021-01-01 — 2021-12-31
Test： 2022-01-01 — 2025-12-26（~966 交易日）
horizon：次日收益率 or 5日收益率

这两个 horizon 都做一下

我们最终主表的 评估测试详情：
（1） 使用 LGBM 对挖掘出来的单因子进行回归，针对组合的 IC、ICIR、RANKIC、RANKICIR 和 策略的指标 IR、ARR、MDD等进行回测。

（2）在Train 数据集上进行单因子的挖掘，在 Valid 数据集上评估因子的表现，制定最终进入Test 的标准。

（3）在Test 数据集上额外训练一个 LGBM 树模型进行评估。

（4） 策略层是在 2022-2025 上，进行 TopkDropout（topk=50，n_drop=5)

可以从三层数据三层消费的角度进行分析，L1 是进行数据的物化和因子的计算，L2 是进行预处理，L2.5 是做LGBM 的训练。


### 针对 基础因子的回测
这里要针对所有的基础因子都进行相同参数、相同配置下的一个系统性的回测。




# 消融实验

2、 论证收敛到一个局部流行。  event+context ，论证搜索过程本身是有用的。 收敛起决定性因素是 课程吗（变异）。如果不放 schedule 会快速收敛

	3、增加schedule 会增加多样性。

	4、把 diversity 加入到 reward 中。易 建议 从selection 入手。



5、 论证因子语法的合理性。去掉一个 部分组件，观察成功率或者。


# 常用的代码指令

我的完整流程是通过 qlib 进行构建的。

cd /data/yangjian/SchemaEvolve_framework_snapshot_20260616

mv SchemaEvolve/qlib_mining/runs/qlib_bandit_1d_hs300_stock_fs_main \
   SchemaEvolve/qlib_mining/runs/qlib_bandit_1d_hs300_stock_fs_main.bad_$(date +%Y%m%d_%H%M%S)

export FACTOR_IMPL_API_KEY="sk-9f5ec52d3cae64245288a6c2d0404299b9df70d073c802a9534a66d8400e8d72"

/data/yangjian/conda_envs/backtest/bin/python \
  SchemaEvolve/qlib_mining/run_bandit_training.py \
  --config SchemaEvolve/qlib_mining/configs/stock_alpha_hs300_qlib.json


## 这里应该是从头进行重新的挖掘。

1、 先跑，然后找两个开源的baseline 进行分析和调研。


# 主图的复现进程

1、调研 QuantaAlpha 的实验内容和实验方式

2、先选择最容仪的 Factor Libraries 进行复现，这里直接调用了 QuantaAlpha 的论文代码，但是他们的代码里有个 bug ，alpha 360 中只使用了 66 个因子，所以是 其他两个使用的他们的代码，然后360 是直接调用了qlib。

* 工程性妥协

问题： 当前从 qlib 下载的数据只到 2020， 但是回测需要使用到 2025 的数据，因此选择去hf 下载 QuantaAlpha 的数据 

链接：https://huggingface.co/datasets/QuantaAlpha/qlib_csi300

hf download QuantaAlpha/qlib_csi300 \
  --repo-type dataset \
  --local-dir ./hf_data


  

目前完成的进度


未来1-2周计划：

1、本周完成因子挖掘和回测pipeline搭建，正式启动因子挖掘和回测；针对不需要挖掘的 alpha158 和  alpha360 进行回测；

2、