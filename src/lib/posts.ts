import type { CollectionEntry } from 'astro:content';

export type PostEntry = CollectionEntry<'posts'>;

export const basePath = () => {
  const base = import.meta.env.BASE_URL;
  return base.endsWith('/') ? base : `${base}/`;
};

export const formatDate = (date?: string) => {
  if (!date || date === '1970-01-01') return 'Undated';
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(date));
};

export const slugifyTag = (tag: string) =>
  tag
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');

export const getPostUrl = (post: PostEntry) => `${basePath()}posts/${post.slug}`;

export const getTagUrl = (tag: string) => `${basePath()}tags/${slugifyTag(tag)}`;

export const isPublicPost = (post: PostEntry) => !post.data.draft;

export const isRenderablePost = (post: PostEntry) => !post.id.toLowerCase().endsWith('/readme.md');

const topicLabels: Record<string, string> = {
  competition: '科研竞赛',
  INTJ: 'INTJ',
  'llm-research': 'LLM 研究',
  'multi-agent': '多智能体',
  'qlib-backtest': 'Qlib 回测系统',
  'quant-research': '量化研究',
  'paper-reading': '论文阅读',
};

export const topicOrder = [
  'LLM 研究',
  'Qlib 回测系统',
  '多智能体',
  '论文阅读',
  '科研竞赛',
  'INTJ',
];

const tagAliases = new Map(
  [
    ['reading-notes', '论文阅读'],
    ['读论文', '论文阅读'],
    ['paper-reading', '论文阅读'],
    ['research', '研究'],
    ['notes', '笔记'],
    ['multi-agent', 'Multi-Agent'],
    ['quant data', 'Quant Data'],
    ['experiment', '实验'],
    ['backtest', 'Backtest'],
    ['reproduction', '复现'],
    ['command', '命令'],
    ['distillation', 'Knowledge Distillation'],
  ].map(([from, to]) => [from.toLowerCase(), to]),
);

const navigationTagStoplist = new Set([
  '笔记',
  '研究',
  '未整理',
  'notes',
  'research',
  '合集',
]);

export const sortByDateDesc = (posts: PostEntry[]) =>
  [...posts].sort((a, b) => {
    const aTime = new Date(a.data.date || '1970-01-01').getTime();
    const bTime = new Date(b.data.date || '1970-01-01').getTime();
    return bTime - aTime;
  });

export const getPrimaryTopic = (post: PostEntry) => {
  const topLevelFolder = post.id.split('/')[0];
  return topicLabels[topLevelFolder] || '未分类';
};

export const normalizeTag = (tag: string) => {
  const trimmed = tag.trim();
  const normalizedKey = trimmed.toLowerCase().replace(/[_\s]+/g, '-');
  return tagAliases.get(trimmed.toLowerCase()) || tagAliases.get(normalizedKey) || trimmed;
};

export const getPostTags = (post: PostEntry) =>
  [
    ...new Map(
      (post.data.tags || [])
        .map(normalizeTag)
        .filter(Boolean)
        .map((tag) => [slugifyTag(tag), tag]),
    ).values(),
  ];

export const getAllTags = (posts: PostEntry[]) =>
  [
    ...posts
      .flatMap(getPostTags)
      .reduce<Map<string, string>>((tags, tag) => {
        const slug = slugifyTag(tag);
        if (!tags.has(slug)) tags.set(slug, tag);
        return tags;
      }, new Map())
      .values(),
  ].sort((a, b) => a.localeCompare(b, 'zh-CN'));

export const getNavigationTags = (posts: PostEntry[], limit = 24) =>
  [
    ...posts
      .flatMap(getPostTags)
      .filter((tag) => !navigationTagStoplist.has(tag))
      .reduce<Map<string, { tag: string; count: number }>>((tags, tag) => {
        const slug = slugifyTag(tag);
        const current = tags.get(slug);
        tags.set(slug, { tag, count: (current?.count || 0) + 1 });
        return tags;
      }, new Map())
      .values(),
  ]
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, 'zh-CN'))
    .slice(0, limit);

export const getTopicGroups = (posts: PostEntry[]) =>
  sortByDateDesc(posts).reduce<Record<string, PostEntry[]>>((groups, post) => {
    const topic = getPrimaryTopic(post);
    groups[topic] ||= [];
    groups[topic].push(post);
    return groups;
  }, {});

export const getTopicEntries = (posts: PostEntry[]) =>
  Object.entries(getTopicGroups(posts)).sort(
    ([aTopic, aPosts], [bTopic, bPosts]) =>
      (topicOrder.indexOf(aTopic) === -1 ? 999 : topicOrder.indexOf(aTopic)) -
        (topicOrder.indexOf(bTopic) === -1 ? 999 : topicOrder.indexOf(bTopic)) ||
      bPosts.length - aPosts.length ||
      aTopic.localeCompare(bTopic, 'zh-CN'),
  );

export const getPostDescription = (post: PostEntry) =>
  post.data.description || '这是一篇尚未整理摘要的原始笔记。';

export const getSeriesName = (post: PostEntry) => {
  if (post.data.series) return post.data.series;

  const id = post.id;
  const title = post.data.title || '';
  const firstTag = post.data.tags?.[0];

  if (id.startsWith('qlib-backtest/')) return 'Qlib 数据与回测链路';
  if (id.startsWith('multi-agent/')) return '多智能体系统学习';
  if (id.startsWith('competition/')) return '科研竞赛材料';
  if (id.startsWith('paper-reading/')) return '论文阅读与复现';

  if (id.startsWith('quant-research/')) {
    if (title.includes('好因子') || title.includes('特异性收益')) return '因子评估方法论';
    if (title.includes('quanta') || title.includes('Qlib') || title.includes('算法流程')) return 'QuantaAlpha 代码与实验';
    if (title.includes('MCTS') || title.includes('agent') || title.includes('Alpha')) return 'LLM Alpha 因子挖掘论文';
    return '量化研究札记';
  }

  if (firstTag === 'LLM' || title.includes('Distill') || title.includes('ORPO') || title.startsWith('论文_')) return 'LLM 论文阅读';
  if (firstTag === 'AFAC') return 'AFAC 比赛材料';
  if (firstTag === 'Web' || firstTag === 'Python') return '工程工具笔记';
  return '单篇笔记';
};

export const getSeriesGroups = (posts: PostEntry[]) =>
  sortByDateDesc(posts).reduce<Record<string, PostEntry[]>>((groups, post) => {
    const series = getSeriesName(post);
    groups[series] ||= [];
    groups[series].push(post);
    return groups;
  }, {});
