/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        cream: '#FDFBF7',
        'usagi': '#FFE153',
        'usagi-dark': '#F4D03F',
        'accent-coral': '#E76F51',
        'accent-mint': '#2A9D8F',
        'accent-ochre': '#D68C45',
        'accent-blue': '#264653',
        'text-ink': '#1A1A1A',
      },
      fontFamily: {
        // 修复核心：英文用圆体，中文用思源黑体，后备系统字体
        display: ['"M PLUS Rounded 1c"', '"Noto Sans SC"', '"Microsoft YaHei"', 'sans-serif'],
        sans: ['"M PLUS Rounded 1c"', '"Noto Sans SC"', '"Microsoft YaHei"', 'sans-serif'],
      },
      boxShadow: {
        'hard': '4px 4px 0px 0px #1A1A1A',
        'hard-sm': '2px 2px 0px 0px #1A1A1A',
        'hard-lg': '6px 6px 0px 0px #1A1A1A',
      },
      // Typography 配置保留基本结构，但颜色我们将由 Global CSS 强制接管
      typography: (theme) => ({
        DEFAULT: {
          css: {
            color: theme('colors.text-ink'),
            maxWidth: 'none',
            'h1, h2, h3': {
              fontFamily: theme('fontFamily.display'),
              fontWeight: '900', // 标题极粗
              letterSpacing: '0.02em',
            },
            code: {
              color: theme('colors.accent-blue'),
              backgroundColor: '#E0F2F1',
              padding: '0.25rem 0.5rem',
              borderRadius: '0.375rem',
              fontWeight: '600',
            },
          },
        },
      }),
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}