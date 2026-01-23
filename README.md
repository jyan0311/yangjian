# Usagi's Digital Garden 🐰

A personal website and digital garden built with **Astro** and **Tailwind CSS**, inspired by the adorable Usagi character from Chiikawa.

## ✨ Features

- 🎨 **Neo-Pop/Kawaii Aesthetic**: Thick borders, hard shadows, and vibrant colors
- 🐰 **Usagi-themed**: Custom color palette (#FFE153, #FFB6C1, #FFFDF5)
- ⚡ **Astro-powered**: Fast, modern static site generation
- 🎭 **Tailwind CSS**: Highly customizable utility-first styling
- 📱 **Responsive**: Beautiful on all devices
- 🚀 **Auto-deployment**: GitHub Actions → GitHub Pages

## 🎨 Color Palette

| Color | Hex | Usage |
|-------|-----|-------|
| Usagi Yellow | `#FFE153` | Primary/accents |
| Soft Pink | `#FFB6C1` | Secondary/cheeks |
| Cream | `#FFFDF5` | Background |
| Deep Brown | `#2D2305` | Text |
| Black | `#000000` | Borders |

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm or pnpm

### Installation

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 📁 Project Structure

```
/
├── public/              # Static assets
│   └── favicon.svg
├── src/
│   ├── layouts/
│   │   └── Layout.astro    # Global layout
│   └── pages/
│       └── index.astro     # Homepage
├── .github/
│   └── workflows/
│       └── deploy.yml      # GitHub Actions
├── astro.config.mjs
├── tailwind.config.mjs
└── package.json
```

## 🌍 Deployment

This site automatically deploys to GitHub Pages when you push to the `main` branch.

### Setup GitHub Pages:

1. Go to your repository's **Settings** → **Pages**
2. Under "Build and deployment", select **GitHub Actions** as the source
3. Push to `main` branch
4. Your site will be live at: `https://[username].github.io/个人主页/`

## 🛠️ Customization

### Update Site Info

Edit `astro.config.mjs`:
```js
export default defineConfig({
  site: 'https://yourusername.github.io',
  base: '/your-repo-name',
});
```

### Modify Colors

Edit `tailwind.config.mjs` under `theme.extend.colors.usagi`.

### Add Content

Create `.md` or `.astro` files in `src/pages/` for new pages.

## 📝 License

MIT License - feel free to use this template for your own digital garden!

## 💖 Credits

- Inspired by **Usagi** from Chiikawa
- Built with [Astro](https://astro.build)
- Styled with [Tailwind CSS](https://tailwindcss.com)
- Font: [M PLUS Rounded 1c](https://fonts.google.com/specimen/M+PLUS+Rounded+1c)

---

Made with 🐰 and ✨ by a Monash AI Student
