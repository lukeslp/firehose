# Firehose Color Palettes — Quick Reference Card

## Apply a Variant

```typescript
// Set variant globally
document.documentElement.dataset.variant = 'mission-control';
// Options: 'mission-control' | 'cosmic-nexus' | 'editorial' | 'retro-arcade'
```

## Color Tokens (All Variants)

```css
/* Use these tokens instead of hardcoded colors */

/* Base */
var(--background)           /* Page background */
var(--foreground)           /* Primary text */
var(--card)                 /* Card background */
var(--border)               /* Border color */

/* Interactive */
var(--primary)              /* Primary action */
var(--accent)               /* Emphasis */
var(--destructive)          /* Danger/delete */

/* Data Encoding */
var(--sentiment-positive)   /* Positive sentiment */
var(--sentiment-negative)   /* Negative sentiment */
var(--sentiment-neutral)    /* Neutral sentiment */
var(--chart-1) through var(--chart-5)  /* 5 categorical colors */
```

## Variant Comparison

| Aspect | Mission Control | Cosmic Nexus | Editorial | RetroArcade |
|--------|----------------|--------------|-----------|-------------|
| **Base** | Dark blue-black | Deep purple | Cream | CRT green-black |
| **Accent** | Cyan glow | Aurora pink | Editorial red | Neon yellow |
| **Contrast** | 13.5:1 | 12.8:1 | 16.2:1 | 14.2:1 |
| **Typography** | Monospace tech | Modern sans | Classic serif | Pixel fonts |
| **Effects** | Glows, grids | Nebula, stars | Print rules | Scanlines, neon |
| **Best for** | Monitoring | Exploration | Analysis | Gamification |

## Sentiment Colors

```css
/* Mission Control */
--sentiment-positive: #00FF7F;  /* Neon green */
--sentiment-negative: #FF3B3B;  /* Hot red */
--sentiment-neutral:  #7FB3D5;  /* Cool blue */

/* Cosmic Nexus */
--sentiment-positive: #00FFA3;  /* Aurora green */
--sentiment-negative: #FF5E5E;  /* Mars red */
--sentiment-neutral:  #7D9EFF;  /* Nebula blue */

/* Editorial */
--sentiment-positive: #15803D;  /* Forest green */
--sentiment-negative: #B91C1C;  /* Editorial red */
--sentiment-neutral:  #6B6762;  /* Neutral gray */

/* RetroArcade */
--sentiment-positive: #00FF66;  /* Power-up green */
--sentiment-negative: #FF3333;  /* Damage red */
--sentiment-neutral:  #33AAFF;  /* Health blue */
```

## Chart Palettes (5 colors each)

```css
/* Mission Control: Tech */
#00D9FF  #00FF7F  #FFD700  #CC00FF  #FF3B3B

/* Cosmic Nexus: Nebula */
#FF6EC7  #5ED4FF  #00FFA3  #FFD966  #9D66FF

/* Editorial: Print */
#003D7A  #B91C1C  #15803D  #A67C00  #3D2B5F

/* RetroArcade: 8-bit */
#FF00FF  #00CCFF  #FFFF00  #00FF66  #FF3333
```

## Typography

```css
/* Mission Control */
--font-display: 'Rajdhani', 'Orbitron', sans-serif;
--font-mono: 'SF Mono', 'Monaco', monospace;

/* Cosmic Nexus */
--font-display: 'Space Grotesk', 'Montserrat', sans-serif;
--font-body: 'Inter', 'DM Sans', sans-serif;

/* Editorial */
--font-serif-display: 'Playfair Display', Georgia, serif;
--font-serif: 'Merriweather', Georgia, serif;

/* RetroArcade */
--font-pixel: 'Press Start 2P', monospace;  /* 12px minimum */
--font-mono: 'VT323', monospace;            /* Body text */
```

## Special Effects

```css
/* Mission Control: Cyan glow */
text-shadow: 0 0 16px var(--crt-glow);

/* Cosmic Nexus: Nebula glow */
box-shadow: 0 0 24px var(--nebula-glow-pink);

/* Editorial: Headline rule */
border-bottom: 2px solid var(--headline-underline);

/* RetroArcade: Neon shadow */
text-shadow: 0 0 12px var(--neon-glow-yellow);
```

## Accessibility

✓ All variants meet WCAG 2.1 AA (4.5:1 normal text, 3:1 large)
✓ Colorblind-safe (tested with protanopia, deuteranopia)
✓ Motion-safe (respects `prefers-reduced-motion`)

## Files

```
variants/
├── mission-control.css   (Dark tech theme)
├── cosmic-nexus.css      (Space nebula theme)
├── editorial.css         (Print journalism theme)
├── retro-arcade.css      (8-bit gaming theme)
├── COLOR_PALETTES.md     (Full documentation)
└── QUICK_REFERENCE.md    (This file)
```

## Import

```typescript
import './variants/mission-control.css';
import './variants/cosmic-nexus.css';
import './variants/editorial.css';
import './variants/retro-arcade.css';
```

---

**Author**: Luke Steuber (Color Architect)
**Date**: 2026-02-14
**Project**: Bluesky Firehose Dashboard
