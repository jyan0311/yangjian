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

export const isRenderablePost = (post: PostEntry) => post.id.toLowerCase() !== 'readme.md';

export const sortByDateDesc = (posts: PostEntry[]) =>
  [...posts].sort((a, b) => {
    const aTime = new Date(a.data.date || '1970-01-01').getTime();
    const bTime = new Date(b.data.date || '1970-01-01').getTime();
    return bTime - aTime;
  });

export const getPrimaryTopic = (post: PostEntry) => {
  const pathTopic = post.id.split('/').slice(0, -1).join('/');
  const firstTag = post.data.tags?.[0];

  if (pathTopic === 'quant_alpha') return '量化 Alpha';
  if (pathTopic === 'multi-agent') return '多智能体';
  if (pathTopic === '使用qlib搭建回测系统') return 'Qlib 回测系统';
  if (pathTopic === '实验记录') return '实验记录';
  if (pathTopic === '工作笔记') return '工作笔记';
  if (firstTag === 'LLM') return 'LLM 研究';
  if (firstTag === 'Qlib') return 'Qlib 回测系统';
  if (firstTag === 'AFAC') return '科研竞赛';
  return firstTag || '未分类';
};

export const getAllTags = (posts: PostEntry[]) =>
  [
    ...posts
      .flatMap((post) => post.data.tags || [])
      .reduce<Map<string, string>>((tags, tag) => {
        const slug = slugifyTag(tag);
        if (!tags.has(slug)) tags.set(slug, tag);
        return tags;
      }, new Map())
      .values(),
  ].sort((a, b) => a.localeCompare(b, 'zh-CN'));

export const getTopicGroups = (posts: PostEntry[]) =>
  sortByDateDesc(posts).reduce<Record<string, PostEntry[]>>((groups, post) => {
    const topic = getPrimaryTopic(post);
    groups[topic] ||= [];
    groups[topic].push(post);
    return groups;
  }, {});

export const getPostDescription = (post: PostEntry) =>
  post.data.description || '这是一篇尚未整理摘要的原始笔记。';
