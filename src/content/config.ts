import { defineCollection, z } from 'astro:content';

const posts = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string().default('未命名笔记'),
    description: z.string().default('这是一篇尚未整理摘要的原始笔记。'),
    date: z.string().default('1970-01-01'),
    tags: z.array(z.string()).default(['未整理']),
    featured: z.boolean().optional(),
    draft: z.boolean().default(false),
  }),
});

export const collections = {
  posts,
};
