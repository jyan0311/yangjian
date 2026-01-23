/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        // Usagi's signature color palette
        usagi: {
          yellow: '#FFE153',    // High-energy Usagi Yellow (Primary)
          pink: '#FFB6C1',      // Soft Pink for cheeks/accents
          cream: '#FFFDF5',     // Warm off-white/cream background
          brown: '#2D2305',     // Deep brown for text/borders
          black: '#000000',     // Pure black for sharp lines
        },
      },
      fontFamily: {
        // Rounded kawaii fonts
        sans: ['"M PLUS Rounded 1c"', '"Varela Round"', 'ui-rounded', 'system-ui', 'sans-serif'],
        rounded: ['"M PLUS Rounded 1c"', 'ui-rounded', 'sans-serif'],
      },
      boxShadow: {
        // Hard Neo-Pop shadows (no blur!)
        'neo': '4px 4px 0px 0px #000000',
        'neo-sm': '2px 2px 0px 0px #000000',
        'neo-lg': '6px 6px 0px 0px #000000',
        'neo-xl': '8px 8px 0px 0px #000000',
        'neo-pink': '4px 4px 0px 0px #FFB6C1',
        'neo-yellow': '4px 4px 0px 0px #FFE153',
      },
      dropShadow: {
        'neo': '4px 4px 0px #000000',
        'neo-sm': '2px 2px 0px #000000',
      },
      borderWidth: {
        '3': '3px',
        '5': '5px',
      },
      animation: {
        'bounce-slow': 'bounce 2s infinite',
        'wiggle': 'wiggle 1s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
      },
      keyframes: {
        wiggle: {
          '0%, 100%': { transform: 'rotate(-3deg)' },
          '50%': { transform: 'rotate(3deg)' },
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
