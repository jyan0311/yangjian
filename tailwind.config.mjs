/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        // Retro Comic Book Palette
        cream: '#FDFBF7',           // Cream Paper Background
        'usagi-yellow': '#F4D03F',  // Mustard Yellow (Primary)
        'accent-coral': '#E76F51',  // Coral Red (Highlights)
        'accent-mint': '#2A9D8F',   // Mint Green (Decor)
        'text-ink': '#1A1A1A',      // Soft Black (Ink/Borders)
      },
      fontFamily: {
        // Giant Retro Serif for titles
        display: ['"Dela Gothic One"', 'serif'],
        // Geometric sans for body
        sans: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        // Hard Drop Shadows (Comic Style)
        'hard': '4px 4px 0px 0px #1A1A1A',
        'hard-sm': '2px 2px 0px 0px #1A1A1A',
        'hard-lg': '6px 6px 0px 0px #1A1A1A',
        'hard-xl': '8px 8px 0px 0px #1A1A1A',
      },
      borderWidth: {
        '3': '3px',
      },
      animation: {
        // Usagi's chaotic movements
        'wiggle-fast': 'wiggle-fast 0.5s ease-in-out infinite',
        'bounce-wild': 'bounce-wild 1s ease-in-out infinite',
        'float': 'float 4s ease-in-out infinite',
        'float-delayed': 'float 5s ease-in-out 1.5s infinite',
      },
      keyframes: {
        'wiggle-fast': {
          '0%, 100%': { transform: 'rotate(-5deg)' },
          '50%': { transform: 'rotate(5deg)' },
        },
        'bounce-wild': {
          '0%, 100%': { transform: 'translateY(0) scale(1)' },
          '50%': { transform: 'translateY(-25px) scale(1.05)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-15px)' },
        },
      },
    },
  },
  plugins: [],
}
