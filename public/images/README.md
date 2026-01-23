# Images for Usagi's House

## Character Images Needed

To complete the **full character integration**, you need to add Usagi character images:

### Required Images:

1. **`/public/images/usagi-yelling.png`** (or `.jpg`)
   - Size: 300x300px minimum
   - A transparent PNG of Usagi with excited/yelling expression
   - This will appear in the hero section (bottom right)

2. **`/public/images/usagi-running.png`** (or `.jpg`)
   - Size: 200x200px minimum  
   - Usagi in a running or peeking pose
   - This will peek from behind a cloud

### How to Add Images:

1. Place images in `/public/images/` folder
2. Update `src/pages/index.astro` lines where you see the placeholders:

```astro
<!-- Replace this placeholder: -->
<div class="w-full h-full flex items-center justify-center">
  <div class="text-6xl mb-2">🐰</div>
</div>

<!-- With actual image: -->
<img 
  src="/images/usagi-yelling.png" 
  class="w-full h-full object-cover" 
  alt="Usagi yelling with excitement" 
/>
```

### Image Guidelines:

- **Format**: PNG with transparency preferred
- **Style**: Should match the flat, cartoon aesthetic
- **Border**: The CSS already applies thick black borders
- **Size**: Keep under 500KB for fast loading

### Where to Find Usagi Images:

- Official Chiikawa merchandise
- Fan art (with permission)
- Your own illustrations
- Use AI tools like Midjourney/DALL-E to generate in the style

---

**Note**: The site currently uses emoji placeholders (🐰) which look good but lack the authentic Usagi personality. Adding real character images will elevate this to a true character-driven digital garden!
