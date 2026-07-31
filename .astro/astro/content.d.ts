declare module 'astro:content' {
	interface RenderResult {
		Content: import('astro/runtime/server/index.js').AstroComponentFactory;
		headings: import('astro').MarkdownHeading[];
		remarkPluginFrontmatter: Record<string, any>;
	}
	interface Render {
		'.md': Promise<RenderResult>;
	}

	export interface RenderedContent {
		html: string;
		metadata?: {
			imagePaths: Array<string>;
			[key: string]: unknown;
		};
	}
}

declare module 'astro:content' {
	type Flatten<T> = T extends { [K: string]: infer U } ? U : never;

	export type CollectionKey = keyof AnyEntryMap;
	export type CollectionEntry<C extends CollectionKey> = Flatten<AnyEntryMap[C]>;

	export type ContentCollectionKey = keyof ContentEntryMap;
	export type DataCollectionKey = keyof DataEntryMap;

	type AllValuesOf<T> = T extends any ? T[keyof T] : never;
	type ValidContentEntrySlug<C extends keyof ContentEntryMap> = AllValuesOf<
		ContentEntryMap[C]
	>['slug'];

	/** @deprecated Use `getEntry` instead. */
	export function getEntryBySlug<
		C extends keyof ContentEntryMap,
		E extends ValidContentEntrySlug<C> | (string & {}),
	>(
		collection: C,
		// Note that this has to accept a regular string too, for SSR
		entrySlug: E,
	): E extends ValidContentEntrySlug<C>
		? Promise<CollectionEntry<C>>
		: Promise<CollectionEntry<C> | undefined>;

	/** @deprecated Use `getEntry` instead. */
	export function getDataEntryById<C extends keyof DataEntryMap, E extends keyof DataEntryMap[C]>(
		collection: C,
		entryId: E,
	): Promise<CollectionEntry<C>>;

	export function getCollection<C extends keyof AnyEntryMap, E extends CollectionEntry<C>>(
		collection: C,
		filter?: (entry: CollectionEntry<C>) => entry is E,
	): Promise<E[]>;
	export function getCollection<C extends keyof AnyEntryMap>(
		collection: C,
		filter?: (entry: CollectionEntry<C>) => unknown,
	): Promise<CollectionEntry<C>[]>;

	export function getEntry<
		C extends keyof ContentEntryMap,
		E extends ValidContentEntrySlug<C> | (string & {}),
	>(entry: {
		collection: C;
		slug: E;
	}): E extends ValidContentEntrySlug<C>
		? Promise<CollectionEntry<C>>
		: Promise<CollectionEntry<C> | undefined>;
	export function getEntry<
		C extends keyof DataEntryMap,
		E extends keyof DataEntryMap[C] | (string & {}),
	>(entry: {
		collection: C;
		id: E;
	}): E extends keyof DataEntryMap[C]
		? Promise<DataEntryMap[C][E]>
		: Promise<CollectionEntry<C> | undefined>;
	export function getEntry<
		C extends keyof ContentEntryMap,
		E extends ValidContentEntrySlug<C> | (string & {}),
	>(
		collection: C,
		slug: E,
	): E extends ValidContentEntrySlug<C>
		? Promise<CollectionEntry<C>>
		: Promise<CollectionEntry<C> | undefined>;
	export function getEntry<
		C extends keyof DataEntryMap,
		E extends keyof DataEntryMap[C] | (string & {}),
	>(
		collection: C,
		id: E,
	): E extends keyof DataEntryMap[C]
		? Promise<DataEntryMap[C][E]>
		: Promise<CollectionEntry<C> | undefined>;

	/** Resolve an array of entry references from the same collection */
	export function getEntries<C extends keyof ContentEntryMap>(
		entries: {
			collection: C;
			slug: ValidContentEntrySlug<C>;
		}[],
	): Promise<CollectionEntry<C>[]>;
	export function getEntries<C extends keyof DataEntryMap>(
		entries: {
			collection: C;
			id: keyof DataEntryMap[C];
		}[],
	): Promise<CollectionEntry<C>[]>;

	export function render<C extends keyof AnyEntryMap>(
		entry: AnyEntryMap[C][string],
	): Promise<RenderResult>;

	export function reference<C extends keyof AnyEntryMap>(
		collection: C,
	): import('astro/zod').ZodEffects<
		import('astro/zod').ZodString,
		C extends keyof ContentEntryMap
			? {
					collection: C;
					slug: ValidContentEntrySlug<C>;
				}
			: {
					collection: C;
					id: keyof DataEntryMap[C];
				}
	>;
	// Allow generic `string` to avoid excessive type errors in the config
	// if `dev` is not running to update as you edit.
	// Invalid collection names will be caught at build time.
	export function reference<C extends string>(
		collection: C,
	): import('astro/zod').ZodEffects<import('astro/zod').ZodString, never>;

	type ReturnTypeOrOriginal<T> = T extends (...args: any[]) => infer R ? R : T;
	type InferEntrySchema<C extends keyof AnyEntryMap> = import('astro/zod').infer<
		ReturnTypeOrOriginal<Required<ContentConfig['collections'][C]>['schema']>
	>;

	type ContentEntryMap = {
		"posts": {
"AFAC比赛.md": {
	id: "AFAC比赛.md";
  slug: "afac比赛";
  body: string;
  collection: "posts";
  data: InferEntrySchema<"posts">
} & { render(): Render[".md"] };
"ORPO_Distill.md": {
	id: "ORPO_Distill.md";
  slug: "orpo_distill";
  body: string;
  collection: "posts";
  data: InferEntrySchema<"posts">
} & { render(): Render[".md"] };
"SPIN算法的完整流程.md": {
	id: "SPIN算法的完整流程.md";
  slug: "spin算法的完整流程";
  body: string;
  collection: "posts";
  data: InferEntrySchema<"posts">
} & { render(): Render[".md"] };
"llm-rlhf-active-learning.md": {
	id: "llm-rlhf-active-learning.md";
  slug: "llm-rlhf-active-learning";
  body: string;
  collection: "posts";
  data: InferEntrySchema<"posts">
} & { render(): Render[".md"] };
"multi-agent/TradeAgents.md": {
	id: "multi-agent/TradeAgents.md";
  slug: "multi-agent/tradeagents";
  body: string;
  collection: "posts";
  data: InferEntrySchema<"posts">
} & { render(): Render[".md"] };
"multi-agent/agent的学习.md": {
	id: "multi-agent/agent的学习.md";
  slug: "multi-agent/agent的学习";
  body: string;
  collection: "posts";
  data: InferEntrySchema<"posts">
} & { render(): Render[".md"] };
"multi-agent/multi_agent学习.md": {
	id: "multi-agent/multi_agent学习.md";
  slug: "multi-agent/multi_agent学习";
  body: string;
  collection: "posts";
  data: InferEntrySchema<"posts">
} & { render(): Render[".md"] };
"multi-agent/开源项目学习和整理.md": {
	id: "multi-agent/开源项目学习和整理.md";
  slug: "multi-agent/开源项目学习和整理";
  body: string;
  collection: "posts";
  data: InferEntrySchema<"posts">
} & { render(): Render[".md"] };
"python-web-scraping.md": {
	id: "python-web-scraping.md";
  slug: "python-web-scraping";
  body: string;
  collection: "posts";
  data: InferEntrySchema<"posts">
} & { render(): Render[".md"] };
"qlib-backtest/local-backtest-data/index.md": {
	id: "qlib-backtest/local-backtest-data/index.md";
  slug: "qlib-backtest/local-backtest-data";
  body: string;
  collection: "posts";
  data: InferEntrySchema<"posts">
} & { render(): Render[".md"] };
"quant-alpha/alpha-mining-evolution-review/index.md": {
	id: "quant-alpha/alpha-mining-evolution-review/index.md";
  slug: "quant-alpha/alpha-mining-evolution-review";
  body: string;
  collection: "posts";
  data: InferEntrySchema<"posts">
} & { render(): Render[".md"] };
"quant-alpha/factor-evaluation/specific-return/index.md": {
	id: "quant-alpha/factor-evaluation/specific-return/index.md";
  slug: "quant-alpha/factor-evaluation/specific-return";
  body: string;
  collection: "posts";
  data: InferEntrySchema<"posts">
} & { render(): Render[".md"] };
"quant-alpha/mcts-alpha-jungle/index.md": {
	id: "quant-alpha/mcts-alpha-jungle/index.md";
  slug: "quant-alpha/mcts-alpha-jungle";
  body: string;
  collection: "posts";
  data: InferEntrySchema<"posts">
} & { render(): Render[".md"] };
"quant_alpha/FactorEngine.md": {
	id: "quant_alpha/FactorEngine.md";
  slug: "quant_alpha/factorengine";
  body: string;
  collection: "posts";
  data: InferEntrySchema<"posts">
} & { render(): Render[".md"] };
"quant_alpha/lijian_MCTS_alpha.md": {
	id: "quant_alpha/lijian_MCTS_alpha.md";
  slug: "quant_alpha/lijian_mcts_alpha";
  body: string;
  collection: "posts";
  data: InferEntrySchema<"posts">
} & { render(): Render[".md"] };
"quant_alpha/qlib完整算法流程.md": {
	id: "quant_alpha/qlib完整算法流程.md";
  slug: "quant_alpha/qlib完整算法流程";
  body: string;
  collection: "posts";
  data: InferEntrySchema<"posts">
} & { render(): Render[".md"] };
"quant_alpha/quantaAlpha的代码实现复盘.md": {
	id: "quant_alpha/quantaAlpha的代码实现复盘.md";
  slug: "quant_alpha/quantaalpha的代码实现复盘";
  body: string;
  collection: "posts";
  data: InferEntrySchema<"posts">
} & { render(): Render[".md"] };
"quant_alpha/一文讲清什么是agent_因子挖掘.md": {
	id: "quant_alpha/一文讲清什么是agent_因子挖掘.md";
  slug: "quant_alpha/一文讲清什么是agent_因子挖掘";
  body: string;
  collection: "posts";
  data: InferEntrySchema<"posts">
} & { render(): Render[".md"] };
"quant_alpha/什么是好因子（crypto实证）.md": {
	id: "quant_alpha/什么是好因子（crypto实证）.md";
  slug: "quant_alpha/什么是好因子crypto实证";
  body: string;
  collection: "posts";
  data: InferEntrySchema<"posts">
} & { render(): Render[".md"] };
"quant_alpha/什么是好因子（股票实证）.md": {
	id: "quant_alpha/什么是好因子（股票实证）.md";
  slug: "quant_alpha/什么是好因子股票实证";
  body: string;
  collection: "posts";
  data: InferEntrySchema<"posts">
} & { render(): Render[".md"] };
"quant_alpha/什么样的因子是好因子.md": {
	id: "quant_alpha/什么样的因子是好因子.md";
  slug: "quant_alpha/什么样的因子是好因子";
  body: string;
  collection: "posts";
  data: InferEntrySchema<"posts">
} & { render(): Render[".md"] };
"quant_alpha/从agent进化角度挖掘alpha.md": {
	id: "quant_alpha/从agent进化角度挖掘alpha.md";
  slug: "quant_alpha/从agent进化角度挖掘alpha";
  body: string;
  collection: "posts";
  data: InferEntrySchema<"posts">
} & { render(): Render[".md"] };
"quant_alpha/梳理agent因子挖掘.md": {
	id: "quant_alpha/梳理agent因子挖掘.md";
  slug: "quant_alpha/梳理agent因子挖掘";
  body: string;
  collection: "posts";
  data: InferEntrySchema<"posts">
} & { render(): Render[".md"] };
"quant_alpha/碎片_什么是物化.md": {
	id: "quant_alpha/碎片_什么是物化.md";
  slug: "quant_alpha/碎片_什么是物化";
  body: string;
  collection: "posts";
  data: InferEntrySchema<"posts">
} & { render(): Render[".md"] };
"quant_alpha/股票回测数据.md": {
	id: "quant_alpha/股票回测数据.md";
  slug: "quant_alpha/股票回测数据";
  body: string;
  collection: "posts";
  data: InferEntrySchema<"posts">
} & { render(): Render[".md"] };
"quant_alpha/重新思考什么样的因子是好因子.md": {
	id: "quant_alpha/重新思考什么样的因子是好因子.md";
  slug: "quant_alpha/重新思考什么样的因子是好因子";
  body: string;
  collection: "posts";
  data: InferEntrySchema<"posts">
} & { render(): Render[".md"] };
"reproduction/alphaagent/index.md": {
	id: "reproduction/alphaagent/index.md";
  slug: "reproduction/alphaagent";
  body: string;
  collection: "posts";
  data: InferEntrySchema<"posts">
} & { render(): Render[".md"] };
"reproduction/graphalpha/index.md": {
	id: "reproduction/graphalpha/index.md";
  slug: "reproduction/graphalpha";
  body: string;
  collection: "posts";
  data: InferEntrySchema<"posts">
} & { render(): Render[".md"] };
"schema-evolve/experiment-diagnostics/bandit-factor-generalization/index.md": {
	id: "schema-evolve/experiment-diagnostics/bandit-factor-generalization/index.md";
  slug: "schema-evolve/experiment-diagnostics/bandit-factor-generalization";
  body: string;
  collection: "posts";
  data: InferEntrySchema<"posts">
} & { render(): Render[".md"] };
"schema-evolve/framework/index.md": {
	id: "schema-evolve/framework/index.md";
  slug: "schema-evolve/framework";
  body: string;
  collection: "posts";
  data: InferEntrySchema<"posts">
} & { render(): Render[".md"] };
"schema-evolve/lgbm-reward-model/index.md": {
	id: "schema-evolve/lgbm-reward-model/index.md";
  slug: "schema-evolve/lgbm-reward-model";
  body: string;
  collection: "posts";
  data: InferEntrySchema<"posts">
} & { render(): Render[".md"] };
"schema-evolve/schema-plan-vs-factor/index.md": {
	id: "schema-evolve/schema-plan-vs-factor/index.md";
  slug: "schema-evolve/schema-plan-vs-factor";
  body: string;
  collection: "posts";
  data: InferEntrySchema<"posts">
} & { render(): Render[".md"] };
"toy_experiment.md": {
	id: "toy_experiment.md";
  slug: "toy_experiment";
  body: string;
  collection: "posts";
  data: InferEntrySchema<"posts">
} & { render(): Render[".md"] };
"不确定性衡量.md": {
	id: "不确定性衡量.md";
  slug: "不确定性衡量";
  body: string;
  collection: "posts";
  data: InferEntrySchema<"posts">
} & { render(): Render[".md"] };
"使用qlib搭建回测系统/1_qlib量价数据分析.md": {
	id: "使用qlib搭建回测系统/1_qlib量价数据分析.md";
  slug: "使用qlib搭建回测系统/1_qlib量价数据分析";
  body: string;
  collection: "posts";
  data: InferEntrySchema<"posts">
} & { render(): Render[".md"] };
"使用qlib搭建回测系统/2_qlib量价回测系统.md": {
	id: "使用qlib搭建回测系统/2_qlib量价回测系统.md";
  slug: "使用qlib搭建回测系统/2_qlib量价回测系统";
  body: string;
  collection: "posts";
  data: InferEntrySchema<"posts">
} & { render(): Render[".md"] };
"使用qlib搭建回测系统/3_什么是复权.md": {
	id: "使用qlib搭建回测系统/3_什么是复权.md";
  slug: "使用qlib搭建回测系统/3_什么是复权";
  body: string;
  collection: "posts";
  data: InferEntrySchema<"posts">
} & { render(): Render[".md"] };
"实验记录/alpha360未来信息泄露问题.md": {
	id: "实验记录/alpha360未来信息泄露问题.md";
  slug: "实验记录/alpha360未来信息泄露问题";
  body: string;
  collection: "posts";
  data: InferEntrySchema<"posts">
} & { render(): Render[".md"] };
"工作笔记/第一周-因子挖掘输出分析.md": {
	id: "工作笔记/第一周-因子挖掘输出分析.md";
  slug: "工作笔记/第一周-因子挖掘输出分析";
  body: string;
  collection: "posts";
  data: InferEntrySchema<"posts">
} & { render(): Render[".md"] };
"工作笔记/第一周.md": {
	id: "工作笔记/第一周.md";
  slug: "工作笔记/第一周";
  body: string;
  collection: "posts";
  data: InferEntrySchema<"posts">
} & { render(): Render[".md"] };
"论文_EasyDistill.md": {
	id: "论文_EasyDistill.md";
  slug: "论文_easydistill";
  body: string;
  collection: "posts";
  data: InferEntrySchema<"posts">
} & { render(): Render[".md"] };
"论文_balckdistll_DAIL.md": {
	id: "论文_balckdistll_DAIL.md";
  slug: "论文_balckdistll_dail";
  body: string;
  collection: "posts";
  data: InferEntrySchema<"posts">
} & { render(): Render[".md"] };
"论文_onpolicydistillation.md": {
	id: "论文_onpolicydistillation.md";
  slug: "论文_onpolicydistillation";
  body: string;
  collection: "posts";
  data: InferEntrySchema<"posts">
} & { render(): Render[".md"] };
"论文_什么是ORPO.md": {
	id: "论文_什么是ORPO.md";
  slug: "论文_什么是orpo";
  body: string;
  collection: "posts";
  data: InferEntrySchema<"posts">
} & { render(): Render[".md"] };
"论文_使用MCTS模拟得到优质路径后进行ORPO.md": {
	id: "论文_使用MCTS模拟得到优质路径后进行ORPO.md";
  slug: "论文_使用mcts模拟得到优质路径后进行orpo";
  body: string;
  collection: "posts";
  data: InferEntrySchema<"posts">
} & { render(): Render[".md"] };
"论文_微软使用GAN的思路做黑盒蒸馏.md": {
	id: "论文_微软使用GAN的思路做黑盒蒸馏.md";
  slug: "论文_微软使用gan的思路做黑盒蒸馏";
  body: string;
  collection: "posts";
  data: InferEntrySchema<"posts">
} & { render(): Render[".md"] };
"资料_LLM领域的全景视图.md": {
	id: "资料_LLM领域的全景视图.md";
  slug: "资料_llm领域的全景视图";
  body: string;
  collection: "posts";
  data: InferEntrySchema<"posts">
} & { render(): Render[".md"] };
"闲谈_agent4fin.md": {
	id: "闲谈_agent4fin.md";
  slug: "闲谈_agent4fin";
  body: string;
  collection: "posts";
  data: InferEntrySchema<"posts">
} & { render(): Render[".md"] };
};

	};

	type DataEntryMap = {
		
	};

	type AnyEntryMap = ContentEntryMap & DataEntryMap;

	export type ContentConfig = typeof import("../../src/content/config.js");
}
