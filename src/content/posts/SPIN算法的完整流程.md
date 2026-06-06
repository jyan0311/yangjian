

# SPIN (Online DPO) 算法完整流程分析

## 一、整体架构概览

SPIN 本质上是一个 **Online DPO** 算法——每个训练 step 在线生成 response 对，用 **reward** 判断谁优谁劣（chosen vs rejected），然后用 **DPO loss** 更新 policy。

核心公式（`@/home/jyan0311/mg61_scratch/jyan_scratch/verl/recipe/spin/core_algos.py:131-158`）：

```
L_DPO = -log σ(β · (log π(y_w|x) - log π(y_l|x) - log π_ref(y_w|x) + log π_ref(y_l|x)))
```

其中 `y_w` = chosen，`y_l` = rejected，`π` = 当前 policy，`π_ref` = reference policy。

---

## 二、完整训练流程（[fit_dpo](cci:1://file:///home/jyan0311/mg61_scratch/jyan_scratch/verl/recipe/spin/spin_trainer.py:834:4-1390:50) 主循环）

每个 step 的执行顺序：

```
┌──────────────────────────────────────────────────────────┐
│  Step 1: 生成 response 对                                │
│  对每个 prompt，生成 n=2 个 response（interleave 排列）    │
│  batch.shape = [bsz * 2, seq_len]                        │
├──────────────────────────────────────────────────────────┤
│  Step 2: 计算 policy log-prob                            │
│  用当前 actor 对所有 response 计算 old_log_probs          │
├──────────────────────────────────────────────────────────┤
│  Step 3: 计算 reference log-prob（如果 use_reference_policy）│
│  用 frozen ref model 对所有 response 计算 ref_log_prob    │
├──────────────────────────────────────────────────────────┤
│  Step 4: 计算 reward ★                                   │
│  用 reward_fn 或 RM worker 计算 token_level_rewards       │
├──────────────────────────────────────────────────────────┤
│  Step 5: 确定偏好 (preference) ★                         │
│  用 compute_onlinedpo_pref 把 reward 转成 chosen/rejected │
├──────────────────────────────────────────────────────────┤
│  Step 6: 构造 DPO update batch                           │
│  按 preference 拆分 chosen / rejected，打包成 DataProto   │
├──────────────────────────────────────────────────────────┤
│  Step 7: 更新 actor                                      │
│  调用 update_actor_dpo，在 worker 内计算 DPO loss 并反传  │
└──────────────────────────────────────────────────────────┘
```

---

## 三、Reward 的计算与来源（★ 重点）

### 3.1 Reward 有两个来源，二选一

| 来源 | 条件 | 代码位置 |
|------|------|---------|
| **Reward Model (RM) Worker** | `config.reward_model.enable = True` → `self.use_rm = True` | `/verl/recipe/spin/spin_trainer.py:1117-1119` |
| **Reward Function (reward_fn)** | `self.reward_fn is not None` | `/verl/recipe/spin/spin_trainer.py:1131-1133` |

### 3.2 Reward Model 路径

```python
# spin_trainer.py:1117-1119
if self.use_rm:
    reward_tensor_rm = self.rm_wg.compute_rm_score(batch)
    batch = batch.union(reward_tensor_rm)  # Adds 'rm_scores'
```

**流程**（`@/home/jyan0311/mg61_scratch/jyan_scratch/verl/recipe/spin/fsdp_workers.py:542-598`）：

1. 把 `input_ids`/`attention_mask`/`position_ids` 传入 RM model
2. RM model 做 forward，输出一个 **sequence-level score** `[bsz]`
3. [_expand_to_token_level](cci:1://file:///home/jyan0311/mg61_scratch/jyan_scratch/verl/recipe/spin/fsdp_workers.py:460:4-473:33) 把 score 扩展为 `[bsz, seq_len]` 的 `rm_scores`（只在最后一个有效 token 处有值，其余为 0）
4. 返回 `DataProto(tensors={"rm_scores": token_level_scores})`

### 3.3 Reward Function 路径（更常用）

```python
# spin_trainer.py:1131-1133
reward_result = self.reward_fn(batch, return_dict=True)
reward_tensor = reward_result["reward_tensor"]
```

**`reward_fn` 的构造**（`@/home/jyan0311/mg61_scratch/jyan_scratch/verl/recipe/spin/main_spin.py:137-145`）：

```python
compute_score = get_custom_reward_fn(config)  # 从外部 .py 文件动态加载
reward_fn = reward_manager_cls(
    tokenizer=tokenizer,
    num_examine=0,
    compute_score=compute_score,
    reward_fn_key=config.data.reward_fn_key,
)
```

**[reward_fn.__call__](cci:1://file:///home/jyan0311/mg61_scratch/jyan_scratch/verl/verl/workers/reward_manager/naive.py:45:4-121:32) 的内部逻辑**（`@/home/jyan0311/mg61_scratch/jyan_scratch/verl/verl/workers/reward_manager/naive.py:46-122`）：

1. 先检查 `batch` 里有没有 `rm_scores`（如果 RM 已算过就直接用）
2. 对每条数据：
   - decode `prompt` 和 `response` 为文本
   - 从 `non_tensor_batch` 取出 `ground_truth` 和 `data_source`
   - 调用 `compute_score(data_source, solution_str, ground_truth, extra_info)` → 得到一个标量 `score`
3. 把 `score` 放到 `reward_tensor[i, valid_response_length - 1]`（**只在 response 最后一个有效 token 处赋值**）
4. 返回 `{"reward_tensor": reward_tensor, "reward_extra_info": ...}`

**`compute_score` 是什么？** 它是从 `config.reward.custom_reward_function.path` 动态加载的外部 Python 函数，通常是：
- 数学题的规则判题器（判断 answer 是否正确）
- 代码题的测试用例执行器
- 或者任何自定义的打分逻辑

### 3.4 Reward 的最终形态

无论走哪条路径，最终都得到 `token_level_rewards`，shape 为 `[bsz * n, seq_len]`：

```python
# spin_trainer.py:1143
batch.batch["token_level_rewards"] = reward_tensor
```

**关键特征**：reward 是 **sparse** 的——只在 response 的最后一个有效 token 处有非零值，其余位置为 0。

---

## 四、从 Reward 到 Preference（★ 核心转换）

```python
# spin_trainer.py:1151
batch = compute_onlineDPO_pref(batch)  # Adds 'preferences' key
```

**[compute_onlinedpo_pref](cci:1://file:///home/jyan0311/mg61_scratch/jyan_scratch/verl/recipe/spin/core_algos.py:58:0-127:33) 的逻辑**（`@/home/jyan0311/mg61_scratch/jyan_scratch/verl/recipe/spin/core_algos.py:59-128`）：

1. **计算 sequence-level score**：`scores = (token_level_rewards * response_mask).sum(dim=-1)`
   - 因为 reward 是 sparse 的（只在最后一个 token），所以 sum 就等于那个唯一非零值
2. **按 pair 分组**：`score_pairs = scores.view(-1, 2)` → shape `[num_pairs, 2]`
   - 每个 prompt 生成了 2 个 response（`n=2`，interleave 排列），所以每相邻两条是一对
3. **比较得分**：`winner_indices = torch.argmax(score_pairs, dim=1)`
   - 得分高的那个是 **chosen**，低的是 **rejected**
4. **生成 boolean mask**：`preferences[i] = True` 表示第 i 条是 chosen

**举例**：
```
prompt 0: response_A (score=0.8), response_B (score=0.3)
→ preferences = [True, False]  → A 是 chosen，B 是 rejected

prompt 1: response_C (score=0.2), response_D (score=0.9)
→ preferences = [False, True]  → D 是 chosen，C 是 rejected
```

---

## 五、从 Preference 到 DPO Loss

### 5.1 构造 DPO Batch

```python
# spin_trainer.py:1170-1252
preferences_mask = batch.batch["preferences"]       # True = chosen
not_preferences_mask = ~preferences_mask            # True = rejected

chosen_input_ids = batch.batch["input_ids"][preferences_mask]
rejected_input_ids = batch.batch["input_ids"][not_preferences_mask]
# ... 同理 attention_mask, labels, position_ids, reference_logps ...
```

Labels 的构造（`@/home/jyan0311/mg61_scratch/jyan_scratch/verl/recipe/spin/spin_trainer.py:1191-1195`）：

```python
prompt_len = self.config.data.max_prompt_length
chosen_labels = chosen_input_ids.clone()
chosen_labels[:, :prompt_len] = -100   # prompt 部分不计算 loss
```

### 5.2 计算 DPO Loss

在 worker 内部（旧版走 [dp_actor.py](cci:7://file:///home/jyan0311/mg61_scratch/jyan_scratch/verl/recipe/spin/dp_actor.py:0:0-0:0)，新版走 [spin_dpo_loss](cci:1://file:///home/jyan0311/mg61_scratch/jyan_scratch/verl/recipe/spin_new/losses.py:8:0-74:24)），最终调用：

```python
# core_algos.py:131-158
loss = compute_online_dpo_loss(
    policy_chosen_logps,      # log π(y_chosen | x)
    policy_rejected_logps,    # log π(y_rejected | x)
    reference_chosen_logps,   # log π_ref(y_chosen | x)
    reference_rejected_logps, # log π_ref(y_rejected | x)
    beta, label_smoothing, loss_type, reference_free,
)
```

**Sigmoid DPO Loss**：
```
logits = (log π_chosen - log π_rejected) - (log π_ref_chosen - log π_ref_rejected)
loss = -log σ(β · logits)
```

直觉：让 policy 相对于 reference，**更倾向于 chosen 而非 rejected**。

---

## 六、[spin_new](cci:9://file:///home/jyan0311/mg61_scratch/jyan_scratch/verl/recipe/spin_new:0:0-0:0) 当前是否使用了 Reward？

**❌ 没有。** 

`@/home/jyan0311/mg61_scratch/jyan_scratch/verl/recipe/spin_new/main_spin.py:97-98`：

```python
reward_fn = None
val_reward_fn = None
```

这导致 `spin_trainer.py:1123-1129` 走入 fallback：

```python
if self.reward_fn is None:
    reward_tensor = batch.batch.get(
        "rm_scores", torch.zeros_like(batch.batch["response_mask"])
    )
```

而 `use_rm=False`（`main_spin.py:75-79` 显式禁止），所以 `rm_scores` 也不存在，最终 `reward_tensor` **全为 0**。

**后果**：
- 所有 response 的 score 都是 0
- [compute_onlinedpo_pref](cci:1://file:///home/jyan0311/mg61_scratch/jyan_scratch/verl/recipe/spin/core_algos.py:58:0-127:33) 中 `argmax` 在全 0 的 pair 上随机选一个作为 chosen（实际上总是选第一个，因为 `argmax` 在相等时返回较小索引）
- DPO loss 计算时 chosen 和 rejected 实际上是随机的，**训练目标无意义**

---

## 七、总结：Reward 在 SPIN 中的角色

```
                    ┌─────────────────┐
                    │   Reward 来源    │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
        Reward Model    Reward Function   (None = 全 0)
        (rm_scores)     (compute_score)
              │              │
              └──────┬───────┘
                     ▼
           token_level_rewards
           [bsz*2, seq_len] (sparse)
                     │
                     ▼
          compute_onlinedpo_pref()
          sum → score_pairs → argmax → preference mask
                     │
                     ▼
              chosen / rejected 拆分
                     │
                     ▼
              compute_online_dpo_loss()
              π_chosen vs π_rejected
              π_ref_chosen vs π_ref_rejected
                     │
                     ▼
                 DPO Loss → 反传更新 actor
```

**Reward 的唯一作用**：决定同一 prompt 的两个 response 中谁是 chosen、谁是 rejected。它不直接参与 loss 计算——DPO loss 只用 policy 和 ref 的 log-prob。

**[spin_new](cci:9://file:///home/jyan0311/mg61_scratch/jyan_scratch/verl/recipe/spin_new:0:0-0:0) 当前状态**：reward = 0 → preference 随机 → 训练无效。需要接入 `reward_fn` 或 RM 才能真正工作。



# actor update 是怎么计算出来的











### [update_actor(batch_td)](cci:1://file:///home/jyan0311/mg61_scratch/jyan_scratch/verl/verl/workers/engine_workers.py:644:4-649:59) 完整调用链

```
Trainer (driver 进程)
  │
  ▼
① RayWorkerGroup.update_actor(batch_td)        ← Ray RPC 调度
  │  dispatch: 按 DP rank 切分 TensorDict
  │  execute: ray.remote 调用每个 worker actor
  ▼
② ActorRolloutRefWorker.update_actor(data)      ← 每个 GPU 上的 Ray actor
  │  @register(dispatch_mode=make_nd_compute_dataproto_dispatch_fn(mesh_name="actor"))
  │  代码: self.actor.train_mini_batch(data=data)
  ▼
③ TrainingWorker.train_mini_batch(data)         ← 训练 worker
  │  从 TensorDict 中取出 mini_batch_size, epochs 等
  │  创建 dataloader 迭代器
  │  for mini_batch_td in dataloader:
  ▼
④ TrainingWorker.train_batch(mini_batch_td)     ← 单个 mini-batch 训练
  │  注入工程参数 (use_remove_padding, micro_batch_size 等)
  │  self.engine.train_batch(data, loss_function=self.loss_fn)
  ▼
⑤ BaseEngine.train_batch(data, loss_function)   ← FSDP/Megatron 引擎
  │  前向传播 → 计算 loss → 反向传播 → optimizer step
  │  loss_function = spin_loss (之前通过 set_loss_fn 注入)
  ▼
⑥ spin_loss(td, config)                        ← 我们注入的 SPIN loss
  │  从 td 取 input_ids, is_real, reference_logps
  │  前向得到 logits → 计算 policy log probs
  │  计算 SPIN loss: -log σ(β * [(π_real - π_gen) - (π_ref_real - π_ref_gen)])
  │  返回 {"loss": loss, "metrics": {...}}
  ▼
⑤' 返回 output → all_reduce loss → 收集 metrics
④' 返回 TensorDict(metrics) 
③' 收集所有 mini-batch 的 metrics → 聚合
②' .cpu() 返回给 driver
①' RayWorkerGroup 收集所有 worker 的结果 → 合并
  ▼
返回 TensorDict (含 metrics)
```

### 关键节点详解

#### ① [RayWorkerGroup.update_actor](cci:1://file:///home/jyan0311/mg61_scratch/jyan_scratch/verl/verl/workers/engine_workers.py:644:4-649:59) — Ray 调度层

`@/home/jyan0311/mg61_scratch/jyan_scratch/verl/verl/workers/engine_workers.py:645-650`：

```python
@register(dispatch_mode=make_nd_compute_dataproto_dispatch_fn(mesh_name="actor"))
def update_actor(self, data: TensorDict) -> TensorDict:
    output = self.actor.train_mini_batch(data=data)
    return output.cpu() if output is not None else None
```

`@register` 装饰器做了两件事：
- **dispatch**：按 DP rank 将 `TensorDict` 切分，每个 worker 拿到自己的分片
- **collect**：收集所有 worker 的输出，合并为一个 `TensorDict`

[RayWorkerGroup](cci:2://file:///home/jyan0311/mg61_scratch/jyan_scratch/verl/verl/single_controller/ray/base.py:411:0-903:31) 在 [__init__](cci:1://file:///home/jyan0311/mg61_scratch/jyan_scratch/verl/recipe/SPIN_VERL/main_spin.py:43:4-45:25) 时通过 `_bind_worker_method` 把 [update_actor](cci:1://file:///home/jyan0311/mg61_scratch/jyan_scratch/verl/verl/workers/engine_workers.py:644:4-649:59) 绑定为动态方法，调用时自动走 Ray RPC。

#### ③ [train_mini_batch](cci:1://file:///home/jyan0311/mg61_scratch/jyan_scratch/verl/verl/workers/engine_workers.py:234:4-322:21) — Mini-batch 切分

`@/home/jyan0311/mg61_scratch/jyan_scratch/verl/verl/workers/engine_workers.py:236-323`：

```python
def train_mini_batch(self, data: TensorDict) -> TensorDict:
    mini_batch_size = tu.pop(data, key="mini_batch_size", default=None)
    num_mini_batch = tu.pop(data, key="num_mini_batch", default=None)
    epochs = tu.pop(data, key="epochs", default=1)
    
    dataloader = tu.make_iterator(data, mini_batch_size=..., epochs=epochs, ...)
    
    for batch_idx, mini_batch_td in enumerate(dataloader):
        actor_output = self.train_batch(mini_batch_td)  # ← 单 mini-batch 训练
        output_lst.append(actor_output)
    
    # 聚合所有 mini-batch 的 metrics
    return aggregated_output
```

这些参数（`mini_batch_size`, `epochs` 等）是在 [_pack_spin_update_batch](cci:1://file:///home/jyan0311/mg61_scratch/jyan_scratch/verl/recipe/SPIN_VERL/spin_trainer.py:403:4-459:17) 中通过 `tu.assign_non_tensor` 写入 TensorDict 的。

#### ⑤ [engine.train_batch](cci:1://file:///home/jyan0311/mg61_scratch/jyan_scratch/verl/verl/workers/engine_workers.py:324:4-378:27) — 实际训练

```python
output = self.engine.train_batch(data, loss_function=self.loss_fn)
```

FSDP 引擎内部：
1. **前向传播**：`input_ids` → model → `logits`
2. **调用 `loss_fn(td)`**：即 [spin_loss(td, config)](cci:1://file:///home/jyan0311/mg61_scratch/jyan_scratch/verl/recipe/SPIN_VERL/losses.py:27:0-105:24)，从 logits 计算 policy log probs + SPIN loss
3. **反向传播**：`loss.backward()`
4. **梯度裁剪** + **optimizer step**
5. 返回 `{"loss": loss, "metrics": {...}}`

#### ⑥ [spin_loss](cci:1://file:///home/jyan0311/mg61_scratch/jyan_scratch/verl/recipe/SPIN_VERL/losses.py:27:0-105:24) — 我们注入的 loss

```python
# init_workers 中注入:
spin_loss_fn = partial(spin_loss, config=self.config)
self.actor_rollout_wg.set_loss_fn(spin_loss_fn)

# set_loss_fn 最终存到 TrainingWorker.loss_fn:
def set_loss_fn(self, loss_fn):
    self.loss_fn = loss_fn
```

[engine.train_batch](cci:1://file:///home/jyan0311/mg61_scratch/jyan_scratch/verl/verl/workers/engine_workers.py:324:4-378:27) 调用 `self.loss_fn(td)` 时，实际执行 [spin_loss(td, config=self.config)](cci:1://file:///home/jyan0311/mg61_scratch/jyan_scratch/verl/recipe/SPIN_VERL/losses.py:27:0-105:24)，计算 SPIN 特有的 loss。