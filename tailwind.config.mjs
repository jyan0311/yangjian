/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        // --- 核心底色 ---
        cream: '#FDFBF7',           // 米色/奶油色纸张底色 (Paper Texture)
        
        // --- 乌萨奇专属色 (修正版) ---
        'usagi': '#FFE153',         // 高能量亮黄 (还原角色原本毛色)
        'usagi-dark': '#F4D03F',    // 稍深一点的黄色 (用于阴影或层次)

        // --- 复古强调色 (完全对应你的美术指导) ---
        'accent-coral': '#E76F51',  // 珊瑚红 (Coral Red)
        'accent-mint': '#2A9D8F',   // 薄荷绿 (Mint Green)
        'accent-ochre': '#D68C45',  // 赭石色/焦橙 (Burnt Orange) - 之前缺失的
        'accent-blue': '#264653',   // 岩石蓝 (Rock Blue) - 之前缺失的，用于重色对比

        // --- 轮廓线 ---
        'text-ink': '#1A1A1A',      // 柔和的纯黑 (用于描边和文字)
      },
      fontFamily: {
        // 主标题：复古衬线体 (体现权威与优雅)
        display: ['"Dela Gothic One"', 'serif'],
        // 正文/副标题：几何感无衬线体 (清晰易读)
        sans: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        // 漫画硬阴影 (Hard Shadows)
        'hard': '4px 4px 0px 0px #1A1A1A',
        'hard-sm': '2px 2px 0px 0px #1A1A1A',
        'hard-lg': '6px 6px 0px 0px #1A1A1A',
        'hard-xl': '8px 8px 0px 0px #1A1A1A',
      },
      borderWidth: {
        '3': '3px', // 统一的粗描边
      },
      animation: {
        'wiggle-fast': 'wiggle-fast 0.5s ease-in-out infinite',
        'bounce-wild': 'bounce-wild 1s ease-in-out infinite',
        'float': 'float 4s ease-in-out infinite',
      },
      keyframes: {
        'wiggle-fast': {
          '0%, 100%': { transform: 'rotate(-3deg)' },
          '50%': { transform: 'rotate(3deg)' },
        },
        'bounce-wild': {
          '0%, 100%': { transform: 'translateY(0) scale(1)' },
          '50%': { transform: 'translateY(-15px) scale(1.05)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
    },
  },
  plugins: [],
}