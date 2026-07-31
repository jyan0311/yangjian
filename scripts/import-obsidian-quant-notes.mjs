import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const workspaceRoot = path.resolve(import.meta.dirname, '..');
const obsidianRoot = '/Users/yangjian/Library/Mobile Documents/iCloud~md~obsidian/Documents/icloud同步笔记本/【科研】量化交易';
const postsRoot = path.join(workspaceRoot, 'src/content/posts');

const imports = [
  {
    source: 'THU量化交易实习/3_完整的算法框架搭建.md',
    target: 'quant-research/framework/index.md',
    title: 'SchemaEvolve｜框架算法逻辑整理',
    description: '从 LLM agent、Bandit Selector、Leak Checker、Backtest Engine 与 reward buffer 的协作关系出发，整理 SchemaEvolve 的完整算法框架与数据流。',
    date: '2026-06-16',
    category: 'SchemaEvolve',
    series: 'SchemaEvolve 框架理解',
    status: 'polished',
    tags: ['SchemaEvolve', 'LLM', 'Alpha', 'Bandit', 'Backtest'],
  },
  {
    source: 'THU量化交易实习/4_完整的理解LGBM在这个算法的定位.md',
    target: 'quant-research/lgbm-reward-model/index.md',
    title: 'SchemaEvolve｜LGBM Reward Model 在算法中的定位',
    description: '说明 SchemaEvolve 中 LGBM 不是收益预测模型，而是面向 schema plan 的 reward scorer；系统梳理其输入、标签、输出、训练方式与 bandit 选择链路。',
    date: '2026-06-16',
    category: 'SchemaEvolve',
    series: 'SchemaEvolve 框架理解',
    status: 'polished',
    tags: ['SchemaEvolve', 'LightGBM', 'Reward Model', 'Bandit'],
  },
  {
    source: 'THU量化交易实习/项目内容和进度/跑实验/【分析】挖掘出来的因子表现差.md',
    target: 'quant-research/experiment-diagnostics/bandit-factor-generalization/index.md',
    title: 'SchemaEvolve｜Bandit 挖掘因子样本外泛化诊断',
    description: '复盘一次 target_valid=500 的 bandit 因子挖掘实验：流程正常但 2021 valid 与 2022-2025 test 泛化偏弱，问题集中在样本内 reward 与样本外筛选口径不一致。',
    date: '2026-06-18',
    category: 'SchemaEvolve',
    series: 'SchemaEvolve 实验诊断',
    status: 'draft',
    tags: ['SchemaEvolve', 'Alpha', 'Experiment', 'Generalization', 'Backtest'],
  },
  {
    source: 'THU量化交易实习/数据集整理.md',
    target: 'qlib-backtest/local-backtest-data/index.md',
    title: '量化数据｜本地 BackTestData_pq 数据集整理',
    description: '按价格复权、股票状态过滤、收益标签、基准和辅助工具分类整理 BackTestData_pq，说明其在 TradingSystem 回测链路中的作用。',
    date: '2026-06-16',
    category: 'Qlib 回测系统',
    series: '本地回测数据与工程链路',
    status: 'draft',
    tags: ['Quant Data', 'Backtest', 'Parquet', 'TradingSystem'],
  },
  {
    source: 'THU量化交易实习/论文阅读/AAAI_Navigating_the_alpha_jungle.md',
    target: 'quant-research/mcts-alpha-jungle/index.md',
    title: '量化交易｜Navigating the Alpha Jungle 论文学习笔记',
    description: '学习 LLM + MCTS 公式型 Alpha 因子挖掘框架，重点整理虚拟扩展、多维反馈、相对排序评估与频繁子树避免机制。',
    date: '2026-06-17',
    category: '量化 Alpha',
    series: 'LLM Alpha 因子挖掘论文',
    status: 'polished',
    tags: ['LLM', 'Alpha', 'MCTS', '读论文'],
  },
  {
    source: '论文复现命令/GraphAlpha.md',
    target: 'paper-reading/graphalpha/index.md',
    title: '论文复现｜GraphAlpha 使用本地 Qlib 数据的复现命令',
    description: '整理 GraphAlpha 使用 hf_data/cn_data 构建 qlib panel、检查数据与运行第一层 LLM 评估的命令，避免错误读取默认 ~/.qlib 数据。',
    date: '2026-06-18',
    category: '论文复现',
    series: 'Alpha 因子挖掘复现命令',
    status: 'seed',
    tags: ['GraphAlpha', 'Qlib', 'Reproduction', 'Command'],
  },
  {
    source: '论文复现命令/AlphaAgent复现.md',
    target: 'paper-reading/alphaagent/index.md',
    title: '论文复现｜AlphaAgent KDD 2025 完整复现流程',
    description: '整理 AlphaAgent 论文复现的关键流程：切换 legacy-main、创建 conda 环境、准备 Qlib/CSI500 数据、配置 LLM 与运行 mine/backtest。',
    date: '2026-06-18',
    category: '论文复现',
    series: 'Alpha 因子挖掘复现命令',
    status: 'seed',
    tags: ['AlphaAgent', 'Qlib', 'Reproduction', 'Command'],
  },
  {
    source: 'THU量化交易实习/碎片的知识/什么是特异性收益和其计算方法.md',
    target: 'quant-research/factor-evaluation/specific-return/index.md',
    title: '量化基础｜什么是特异性收益及其计算方法',
    description: '解释特异性收益、纯 Alpha 与残差收益的含义，梳理 Barra 风险模型下剔除市场、行业和风格暴露后的收益计算逻辑。',
    date: '2026-06-16',
    category: '量化 Alpha',
    series: '因子评估方法论',
    status: 'draft',
    tags: ['Alpha', 'Specific Return', 'Barra', 'Factor Evaluation'],
  },
  {
    source: 'THU量化交易实习/碎片的知识/真实的alpha因子长什么样子.md',
    target: 'quant-research/schema-plan-vs-factor/index.md',
    title: 'SchemaEvolve｜真实 Alpha 因子与 Schema Plan 的关系',
    description: '从 Event、Context、Quality、Direction、Output 五维拆解出发，解释 SchemaEvolve 挖掘的对象与人工常规因子的区别。',
    date: '2026-06-16',
    category: 'SchemaEvolve',
    series: 'SchemaEvolve 框架理解',
    status: 'draft',
    tags: ['SchemaEvolve', 'Alpha', 'Factor Design', 'Schema Plan'],
  },
];

const hasFrontmatter = (content) => content.trimStart().startsWith('---');

const frontmatterFor = (item) => [
  '---',
  `title: ${JSON.stringify(item.title)}`,
  `description: ${JSON.stringify(item.description)}`,
  `date: ${JSON.stringify(item.date)}`,
  `category: ${JSON.stringify(item.category)}`,
  `series: ${JSON.stringify(item.series)}`,
  `status: ${JSON.stringify(item.status)}`,
  `tags: ${JSON.stringify(item.tags)}`,
  `source: ${JSON.stringify(`Obsidian/【科研】量化交易/${item.source}`)}`,
  'featured: false',
  'draft: false',
  '---',
  '',
].join('\n');

for (const item of imports) {
  const sourcePath = path.join(obsidianRoot, item.source);
  const targetPath = path.join(postsRoot, item.target);
  const original = await readFile(sourcePath, 'utf8');
  const content = hasFrontmatter(original) ? original : `${frontmatterFor(item)}${original.trimStart()}`;

  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, content.endsWith('\n') ? content : `${content}\n`);
  console.log(`${item.source} -> ${path.relative(workspaceRoot, targetPath)}`);
}
