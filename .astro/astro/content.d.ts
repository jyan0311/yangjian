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
"afac/baseline-framework/index.md": {
	id: "afac/baseline-framework/index.md";
  slug: "afac/baseline-framework";
  body: string;
  collection: "posts";
  data: InferEntrySchema<"posts">
} & { render(): Render[".md"] };
"engineering/python-web-scraping/index.md": {
	id: "engineering/python-web-scraping/index.md";
  slug: "engineering/python-web-scraping";
  body: string;
  collection: "posts";
  data: InferEntrySchema<"posts">
} & { render(): Render[".md"] };
"experiments/alpha360-future-leakage/index.md": {
	id: "experiments/alpha360-future-leakage/index.md";
  slug: "experiments/alpha360-future-leakage";
  body: string;
  collection: "posts";
  data: InferEntrySchema<"posts">
} & { render(): Render[".md"] };
"llm-research/dail-imitation-learning/index.md": {
	id: "llm-research/dail-imitation-learning/index.md";
  slug: "llm-research/dail-imitation-learning";
  body: string;
  collection: "posts";
  data: InferEntrySchema<"posts">
} & { render(): Render[".md"] };
"llm-research/easydistill/index.md": {
	id: "llm-research/easydistill/index.md";
  slug: "llm-research/easydistill";
  body: string;
  collection: "posts";
  data: InferEntrySchema<"posts">
} & { render(): Render[".md"] };
"llm-research/gad-black-box-distillation/index.md": {
	id: "llm-research/gad-black-box-distillation/index.md";
  slug: "llm-research/gad-black-box-distillation";
  body: string;
  collection: "posts";
  data: InferEntrySchema<"posts">
} & { render(): Render[".md"] };
"llm-research/llm-landscape/index.md": {
	id: "llm-research/llm-landscape/index.md";
  slug: "llm-research/llm-landscape";
  body: string;
  collection: "posts";
  data: InferEntrySchema<"posts">
} & { render(): Render[".md"] };
"llm-research/on-policy-distillation/index.md": {
	id: "llm-research/on-policy-distillation/index.md";
  slug: "llm-research/on-policy-distillation";
  body: string;
  collection: "posts";
  data: InferEntrySchema<"posts">
} & { render(): Render[".md"] };
"llm-research/orpo-distill/index.md": {
	id: "llm-research/orpo-distill/index.md";
  slug: "llm-research/orpo-distill";
  body: string;
  collection: "posts";
  data: InferEntrySchema<"posts">
} & { render(): Render[".md"] };
"llm-research/orpo-introduction/index.md": {
	id: "llm-research/orpo-introduction/index.md";
  slug: "llm-research/orpo-introduction";
  body: string;
  collection: "posts";
  data: InferEntrySchema<"posts">
} & { render(): Render[".md"] };
"llm-research/rlhf-active-learning/index.md": {
	id: "llm-research/rlhf-active-learning/index.md";
  slug: "llm-research/rlhf-active-learning";
  body: string;
  collection: "posts";
  data: InferEntrySchema<"posts">
} & { render(): Render[".md"] };
"llm-research/sipf-process-feedback/index.md": {
	id: "llm-research/sipf-process-feedback/index.md";
  slug: "llm-research/sipf-process-feedback";
  body: string;
  collection: "posts";
  data: InferEntrySchema<"posts">
} & { render(): Render[".md"] };
"llm-research/spin-online-dpo/index.md": {
	id: "llm-research/spin-online-dpo/index.md";
  slug: "llm-research/spin-online-dpo";
  body: string;
  collection: "posts";
  data: InferEntrySchema<"posts">
} & { render(): Render[".md"] };
"llm-research/toy-experiment/index.md": {
	id: "llm-research/toy-experiment/index.md";
  slug: "llm-research/toy-experiment";
  body: string;
  collection: "posts";
  data: InferEntrySchema<"posts">
} & { render(): Render[".md"] };
"llm-research/uncertainty-estimation/index.md": {
	id: "llm-research/uncertainty-estimation/index.md";
  slug: "llm-research/uncertainty-estimation";
  body: string;
  collection: "posts";
  data: InferEntrySchema<"posts">
} & { render(): Render[".md"] };
"multi-agent/agent-learning/index.md": {
	id: "multi-agent/agent-learning/index.md";
  slug: "multi-agent/agent-learning";
  body: string;
  collection: "posts";
  data: InferEntrySchema<"posts">
} & { render(): Render[".md"] };
"multi-agent/multi-agent-learning/index.md": {
	id: "multi-agent/multi-agent-learning/index.md";
  slug: "multi-agent/multi-agent-learning";
  body: string;
  collection: "posts";
  data: InferEntrySchema<"posts">
} & { render(): Render[".md"] };
"multi-agent/open-source-projects/index.md": {
	id: "multi-agent/open-source-projects/index.md";
  slug: "multi-agent/open-source-projects";
  body: string;
  collection: "posts";
  data: InferEntrySchema<"posts">
} & { render(): Render[".md"] };
"multi-agent/tradingagents/index.md": {
	id: "multi-agent/tradingagents/index.md";
  slug: "multi-agent/tradingagents";
  body: string;
  collection: "posts";
  data: InferEntrySchema<"posts">
} & { render(): Render[".md"] };
"qlib-backtest/build-backtest-system/01-data-eda/index.md": {
	id: "qlib-backtest/build-backtest-system/01-data-eda/index.md";
  slug: "qlib-backtest/build-backtest-system/01-data-eda";
  body: string;
  collection: "posts";
  data: InferEntrySchema<"posts">
} & { render(): Render[".md"] };
"qlib-backtest/build-backtest-system/02-factor-backtest/index.md": {
	id: "qlib-backtest/build-backtest-system/02-factor-backtest/index.md";
  slug: "qlib-backtest/build-backtest-system/02-factor-backtest";
  body: string;
  collection: "posts";
  data: InferEntrySchema<"posts">
} & { render(): Render[".md"] };
"qlib-backtest/build-backtest-system/03-adjusted-price/index.md": {
	id: "qlib-backtest/build-backtest-system/03-adjusted-price/index.md";
  slug: "qlib-backtest/build-backtest-system/03-adjusted-price";
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
"quant-alpha/agent-evolution-alpha/index.md": {
	id: "quant-alpha/agent-evolution-alpha/index.md";
  slug: "quant-alpha/agent-evolution-alpha";
  body: string;
  collection: "posts";
  data: InferEntrySchema<"posts">
} & { render(): Render[".md"] };
"quant-alpha/agent-factor-mining-notes/index.md": {
	id: "quant-alpha/agent-factor-mining-notes/index.md";
  slug: "quant-alpha/agent-factor-mining-notes";
  body: string;
  collection: "posts";
  data: InferEntrySchema<"posts">
} & { render(): Render[".md"] };
"quant-alpha/agent-factor-mining-primer/index.md": {
	id: "quant-alpha/agent-factor-mining-primer/index.md";
  slug: "quant-alpha/agent-factor-mining-primer";
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
"quant-alpha/backtest-data/index.md": {
	id: "quant-alpha/backtest-data/index.md";
  slug: "quant-alpha/backtest-data";
  body: string;
  collection: "posts";
  data: InferEntrySchema<"posts">
} & { render(): Render[".md"] };
"quant-alpha/factor-evaluation/good-factor-crypto/index.md": {
	id: "quant-alpha/factor-evaluation/good-factor-crypto/index.md";
  slug: "quant-alpha/factor-evaluation/good-factor-crypto";
  body: string;
  collection: "posts";
  data: InferEntrySchema<"posts">
} & { render(): Render[".md"] };
"quant-alpha/factor-evaluation/good-factor-principles/index.md": {
	id: "quant-alpha/factor-evaluation/good-factor-principles/index.md";
  slug: "quant-alpha/factor-evaluation/good-factor-principles";
  body: string;
  collection: "posts";
  data: InferEntrySchema<"posts">
} & { render(): Render[".md"] };
"quant-alpha/factor-evaluation/good-factor-stock/index.md": {
	id: "quant-alpha/factor-evaluation/good-factor-stock/index.md";
  slug: "quant-alpha/factor-evaluation/good-factor-stock";
  body: string;
  collection: "posts";
  data: InferEntrySchema<"posts">
} & { render(): Render[".md"] };
"quant-alpha/factor-evaluation/rethinking-good-factor/index.md": {
	id: "quant-alpha/factor-evaluation/rethinking-good-factor/index.md";
  slug: "quant-alpha/factor-evaluation/rethinking-good-factor";
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
"quant-alpha/factorengine/index.md": {
	id: "quant-alpha/factorengine/index.md";
  slug: "quant-alpha/factorengine";
  body: string;
  collection: "posts";
  data: InferEntrySchema<"posts">
} & { render(): Render[".md"] };
"quant-alpha/lijian-mcts-alpha/index.md": {
	id: "quant-alpha/lijian-mcts-alpha/index.md";
  slug: "quant-alpha/lijian-mcts-alpha";
  body: string;
  collection: "posts";
  data: InferEntrySchema<"posts">
} & { render(): Render[".md"] };
"quant-alpha/materialization/index.md": {
	id: "quant-alpha/materialization/index.md";
  slug: "quant-alpha/materialization";
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
"quant-alpha/qlib-algorithm-flow/index.md": {
	id: "quant-alpha/qlib-algorithm-flow/index.md";
  slug: "quant-alpha/qlib-algorithm-flow";
  body: string;
  collection: "posts";
  data: InferEntrySchema<"posts">
} & { render(): Render[".md"] };
"quant-alpha/quant-agent-overview/index.md": {
	id: "quant-alpha/quant-agent-overview/index.md";
  slug: "quant-alpha/quant-agent-overview";
  body: string;
  collection: "posts";
  data: InferEntrySchema<"posts">
} & { render(): Render[".md"] };
"quant-alpha/quantaalpha-code-review/index.md": {
	id: "quant-alpha/quantaalpha-code-review/index.md";
  slug: "quant-alpha/quantaalpha-code-review";
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
"workbench/week-1-factor-output/index.md": {
	id: "workbench/week-1-factor-output/index.md";
  slug: "workbench/week-1-factor-output";
  body: string;
  collection: "posts";
  data: InferEntrySchema<"posts">
} & { render(): Render[".md"] };
"workbench/week-1/index.md": {
	id: "workbench/week-1/index.md";
  slug: "workbench/week-1";
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
