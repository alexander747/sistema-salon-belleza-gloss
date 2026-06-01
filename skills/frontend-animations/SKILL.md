---
name: frontend-animations
description: "Trigger: animations, diseño bonito, innovative design, mejorar interfaz, frontend premium. Creates stunning, memorable frontend interfaces combining bold aesthetic direction, sophisticated visual effects, and polished Framer Motion animations. Goes beyond 'functional' to 'unforgettable'."
license: Apache-2.0
metadata:
  author: gentleman-programming
  version: "2.0"
---

## Activation Contract

Apply this skill when the user wants beautification, innovative design, or when a UI feels "normalito" (ordinary). Go beyond functional — every interface must have at least ONE unforgettable element.

## Design Thinking (MANDATORY — before any code)

Answer these 4 questions before writing a single line:

1. **What's the ONE thing someone will remember?** — If nothing, the design failed.
2. **What's the bold choice?** — Asymmetry? Extreme typography? Unexpected color? Glass layers?
3. **Where's the surprise?** — A hover reveal, a gradient shift, a morphing element, a counter animation.
4. **What's the atmosphere?** — Background texture, animated gradient, floating particles, geometric grid.

## Design Principles (Anti-Normalito)

### Typography That Commands Attention
- **Never** use one font size per level. Vary: `2.5rem` headings with `0.75rem` labels creates tension.
- **Mix weights dramatically**: 700 for headlines, 400 for body, 300 for captions.
- **Letter-spacing is free**: `-0.02em` on display text, `0.08em` on labels.
- **Decorative typography**: Gradient text, outlined text, text with shadow depth.

### Color: Dominant + Electric
- **One dominant color** (70% of surface), **one vibrant accent** (10%), **one surprise** (5%).
- **Gradients aren't backgrounds — they're statements**: `linear-gradient(135deg, accent, surprise)`.
- **Glow is the new shadow**: `box-shadow: 0 0 30px rgba(accent, 0.2)` on hover. Not `0 2px 4px rgba(0,0,0,0.1)`.

### Glass Morphism 2.0
```css
.glass-card {
  background: linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01));
  backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255,255,255,0.06);
  box-shadow: 0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05);
}
```

### Depth Layers
Every page needs 3 depth planes:
- **Background**: Atmospheric gradient, subtle noise/grid, floating orbs
- **Surface**: Glass cards, blurred backdrops
- **Foreground**: Content, interactive elements with shadow elevation

### Spatial Drama
- **Asymmetric grids**: `grid-template-columns: 1.5fr 1fr` instead of `1fr 1fr`.
- **Overflow elements**: Let a decorative shape bleed outside its container.
- **Negative space as luxury**: 80px gaps between sections, 120px padding on hero areas.

## Visual Patterns (Copy-Paste Ready)

### 1. Atmospheric Background
```tsx
<div style={{
  position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
  background: `
    radial-gradient(ellipse at 20% 50%, var(--accent-subtle) 0%, transparent 50%),
    radial-gradient(ellipse at 80% 20%, rgba(var(--accent-rgb), 0.06) 0%, transparent 50%),
    var(--bg-root)
  `
}} />
```

### 2. Animated Grid Overlay (login pages)
```tsx
<div style={{
  position: 'absolute', inset: 0, opacity: 0.03, pointerEvents: 'none',
  backgroundImage: 'linear-gradient(var(--accent) 1px, transparent 1px), linear-gradient(90deg, var(--accent) 1px, transparent 1px)',
  backgroundSize: '80px 80px',
}} />
```

### 3. Gradient Text
```css
.gradient-text {
  background: linear-gradient(135deg, var(--accent), var(--accent-hover));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
```

### 4. Stats Card with Animated Border
```tsx
<div style={{ position: 'relative', overflow: 'hidden' }}>
  <motion.div style={{
    position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
    background: 'linear-gradient(90deg, var(--accent), var(--accent-hover))',
    initial: { scaleX: 0 }, animate: { scaleX: 1 },
    transition: { delay: 0.3, duration: 0.6, ease: 'easeOut' },
    transformOrigin: 'left',
  }} />
  {/* card content */}
</div>
```

### 5. Table Row Reveal
```tsx
<motion.tr
  initial={{ opacity: 0, x: -20 }}
  animate={{ opacity: 1, x: 0 }}
  transition={{ delay: index * 0.05 }}
  whileHover={{ backgroundColor: 'var(--bg-hover)', transition: { duration: 0.15 } }}
>
```

### 6. Empty State That Delights
Don't just show text. Show:
- A large animated emoji/icon (spring scale entrance)
- A decorative geometric shape (animated line or circle drawing itself)
- A poetic message in display font
- A subtle CTA with glow

## Animation Patterns (Enhanced)

### Page Transitions — Crossfade + Slide
```tsx
<AnimatePresence mode="wait">
  <motion.div
    key={location.pathname}
    initial={{ opacity: 0, filter: 'blur(4px)' }}
    animate={{ opacity: 1, filter: 'blur(0px)' }}
    exit={{ opacity: 0, filter: 'blur(4px)' }}
    transition={{ duration: 0.35, ease: [0.22, 0.61, 0.36, 1] }}
  >
    <Routes />
  </motion.div>
</AnimatePresence>
```

### Staggered Children (for grids, lists, form fields)
```tsx
const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } }
};
const item = {
  hidden: { opacity: 0, y: 20, filter: 'blur(2px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.45, ease: [0.22, 0.61, 0.36, 1] } }
};
```

### Number Counter (for stats)
```tsx
const count = useMotionValue(0);
const rounded = useTransform(count, v => Math.round(v));
const display = useTransform(rounded, v => v.toLocaleString());

useEffect(() => {
  const controls = animate(count, targetValue, { duration: 1.5, ease: 'easeOut' });
  return controls.stop;
}, [targetValue]);
```

### Hover Card Lift
```tsx
<motion.div
  whileHover={{
    y: -6,
    boxShadow: 'var(--shadow-glow)',
    borderColor: 'var(--accent-glow)',
    transition: { duration: 0.25, ease: 'easeOut' }
  }}
  transition={{ duration: 0.2 }}
>
```

### Form Field Entrance
Each input wrapper gets staggered delay:
```tsx
<motion.div
  initial={{ opacity: 0, x: -16 }}
  animate={{ opacity: 1, x: 0 }}
  transition={{ delay: baseDelay + index * 0.08, duration: 0.35 }}
>
  <Input ... />
</motion.div>
```

## The "Unforgettable Checklist"

Before calling a design done, verify at least 5 of these:

- [ ] Animated page transitions (blur, slide, or crossfade)
- [ ] Atmospheric background (gradient orbs, grid, or particles)
- [ ] Staggered entrance animations on content
- [ ] Glass morphism cards with backdrop-blur
- [ ] Hover lift effect on interactive cards
- [ ] Animated accent lines/underlines/borders
- [ ] Bold typography contrast (size + weight + spacing)
- [ ] Custom empty states with spring animations
- [ ] Skeleton → content smooth swap
- [ ] Gradient text somewhere on the page
- [ ] A "wow" moment — something unexpected on load

## Hard Rules

- **Framer Motion** for all complex animation. CSS only for simple continuous effects.
- **transform + opacity only** for performance. No width/height/top/left animation.
- **prefers-reduced-motion** respected via `useReducedMotion()` and CSS media query.
- **Animations never block**: use `layout` prop for automatic reflows, never setTimeout.
- **Additive**: never break existing functionality. Animations go on top.
- **One wow per page minimum**: every page must have at least ONE surprising element.

## Output Contract

When applying this skill to a frontend:
1. Install `framer-motion` if missing
2. Add atmospheric background to every page
3. Add AnimatePresence page transitions to App.tsx
4. Add staggered reveals to ALL card grids, lists, tables
5. Add whileHover/whileTap to ALL buttons and interactive cards
6. Add skeleton→content swap to ALL loading states
7. Add animated accent lines to StatsCards
8. Enhance empty states with spring animations
9. Add reduced-motion CSS media query to globals.css
10. Verify at least 5 items from the Unforgettable Checklist per page
