import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

// https://astro.build/config
export default defineConfig({
  site: 'https://yangjian.github.io',
  base: '/个人主页',
  integrations: [tailwind()],
});
