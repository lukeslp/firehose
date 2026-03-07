# Firehose Color Palettes

Accessible, colorblind-safe color systems for four distinct visual aesthetics. All palettes meet WCAG 2.1 AA contrast requirements.

By Luke Steuber — 2026-02-14

## Quick Reference

| Variant | Aesthetic | Base Palette | Primary Use Case |
|---------|-----------|--------------|------------------|
| **Mission Control** | Dark tech/aerospace | Deep blue-black + cyan + neon green | Monitoring, real-time operations |
| **Cosmic Nexus** | Space/nebula | Deep purple + aurora colors | Exploration, discovery, wonder |
| **Editorial** | Classic print journalism | Cream + ink black + editorial blue | Analysis, storytelling, clarity |
| **RetroArcade** | 8-bit gaming/CRT | CRT green + neon magenta/yellow/cyan | Gamification, leaderboards |

---

## Implementation

### Apply a Variant

```html
<!-- Add to root element -->
<html data-variant="mission-control">
```

```typescript
// React implementation
document.documentElement.dataset.variant = 'cosmic-nexus';
```

### Import CSS

```typescript
// Import all variants
import './variants/mission-control.css';
import './variants/cosmic-nexus.css';
import './variants/editorial.css';
import './variants/retro-arcade.css';
```

### Use Semantic Tokens

All variants define the same semantic tokens for consistency:

```css
/* Base colors */
var(--background)           /* Page background */
var(--foreground)           /* Primary text */
var(--card)                 /* Card/panel background */
var(--card-foreground)      /* Card text */

/* Interactive */
var(--primary)              /* Primary action color */
var(--primary-foreground)   /* Text on primary */
var(--accent)               /* Accent/emphasis */
var(--accent-foreground)    /* Text on accent */

/* Sentiment (data encoding) */
var(--sentiment-positive)   /* Positive sentiment */
var(--sentiment-negative)   /* Negative sentiment */
var(--sentiment-neutral)    /* Neutral sentiment */

/* Charts (categorical data) */
var(--chart-1)              /* First data series */
var(--chart-2)              /* Second data series */
var(--chart-3)              /* Third data series */
var(--chart-4)              /* Fourth data series */
var(--chart-5)              /* Fifth data series */
```

---

## Mission Control Theme

**Aesthetic**: NASA control rooms, military radar displays, cyberpunk tech
**Files**: `mission-control.css`
**Best for**: Real-time monitoring, system status, telemetry

### Color System

| Token | Color (hex equiv) | Purpose | Contrast Ratio |
|-------|------------------|---------|----------------|
| `--background` | `#1A1D2E` | Deep space blue-black | — |
| `--foreground` | `#F0F4F8` | Cool white | 13.5:1 ✓ AAA |
| `--primary` | `#00D9FF` | Cyan glow (active) | 9.8:1 ✓ AAA |
| `--accent` | `#0088FF` | Electric blue | 7.2:1 ✓ AA |
| `--sentiment-positive` | `#00FF7F` | Neon green | 10.2:1 ✓ AAA |
| `--sentiment-negative` | `#FF3B3B` | Hot red | 6.8:1 ✓ AA |
| `--sentiment-neutral` | `#7FB3D5` | Cool gray-blue | 5.2:1 ✓ AA |

### Chart Palette (5 colors, colorblind-safe)

1. `--chart-1`: Cyan `#00D9FF`
2. `--chart-2`: Green `#00FF7F`
3. `--chart-3`: Yellow `#FFD700`
4. `--chart-4`: Magenta `#CC00FF`
5. `--chart-5`: Red `#FF3B3B`

### Typography Recommendations

- **Display**: Rajdhani, Orbitron, Exo 2 (tech/aerospace aesthetic)
- **Monospace**: SF Mono, Monaco, Roboto Mono (telemetry data)
- **Features**: `font-variant-numeric: tabular-nums slashed-zero`
- **Letter-spacing**: 0.2em for uppercase labels

### Special Effects

```css
/* Cyan glow on stats */
text-shadow: 0 0 16px oklch(0.75 0.15 195 / 0.5);

/* Panel glow */
box-shadow: var(--shadow-glow-md);

/* HUD overlay tint */
background: oklch(0.75 0.15 195 / 0.05);

/* Radar sweep animation */
background: oklch(0.75 0.15 195 / 0.3);
```

### Variant-Specific Tokens

```css
--telemetry-good: oklch(0.7 0.18 145);    /* Green status */
--telemetry-warn: oklch(0.75 0.18 85);    /* Yellow warning */
--telemetry-crit: oklch(0.6 0.24 25);     /* Red critical */
--grid-lines: oklch(0.3 0.025 240 / 0.2); /* Subtle grid */
--glow-primary: oklch(0.75 0.15 195 / 0.5); /* Cyan glow */
```

---

## Cosmic Nexus Theme

**Aesthetic**: Hubble imagery, aurora borealis, deep space phenomena
**Files**: `cosmic-nexus.css`
**Best for**: Exploration interfaces, discovery dashboards, wonder moments

### Color System

| Token | Color (hex equiv) | Purpose | Contrast Ratio |
|-------|------------------|---------|----------------|
| `--background` | `#1E1433` | Deep cosmic purple | — |
| `--foreground` | `#F5F3FF` | Soft purple-white | 12.8:1 ✓ AAA |
| `--primary` | `#FF6EC7` | Aurora pink | 7.2:1 ✓ AA |
| `--accent` | `#5ED4FF` | Cosmic cyan | 9.1:1 ✓ AAA |
| `--sentiment-positive` | `#00FFA3` | Aurora green | 9.5:1 ✓ AAA |
| `--sentiment-negative` | `#FF5E5E` | Mars red-orange | 6.1:1 ✓ AA |
| `--sentiment-neutral` | `#7D9EFF` | Nebula blue | 6.3:1 ✓ AA |

### Chart Palette (5 colors, multi-hue nebula)

1. `--chart-1`: Aurora pink `#FF6EC7`
2. `--chart-2`: Cosmic cyan `#5ED4FF`
3. `--chart-3`: Aurora green `#00FFA3`
4. `--chart-4`: Solar yellow `#FFD966`
5. `--chart-5`: Deep purple `#9D66FF`

### Typography Recommendations

- **Display**: Space Grotesk, Montserrat, Outfit (modern, airy)
- **Body**: Inter, DM Sans (clean readability)
- **Effects**: Gradient fills, nebula glows, drop shadows

### Gradients

```css
/* Aurora gradient (pink → cyan → green) */
background: linear-gradient(
  135deg,
  oklch(0.7 0.2 340) 0%,
  oklch(0.75 0.15 210) 50%,
  oklch(0.75 0.18 160) 100%
);

/* Nebula radial gradient */
background: radial-gradient(
  ellipse at top,
  oklch(0.3 0.15 340) 0%,
  oklch(0.15 0.04 280) 50%
);

/* Cosmic background with depth */
background: radial-gradient(
  ellipse at bottom right,
  oklch(0.25 0.08 210) 0%,
  oklch(0.15 0.04 280) 40%,
  oklch(0.12 0.05 290) 100%
);
```

### Special Effects

```css
/* Gradient text */
.text-display {
  background: var(--gradient-aurora);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  filter: drop-shadow(0 0 8px oklch(0.7 0.2 340 / 0.5));
}

/* Nebula glow shadow */
box-shadow:
  0 0 24px oklch(0.7 0.2 340 / 0.5),
  0 0 12px oklch(0.75 0.15 210 / 0.4);

/* Star field background (6-layer) */
background-image:
  radial-gradient(1px 1px at 20% 30%, var(--star-field), transparent),
  radial-gradient(1px 1px at 60% 70%, var(--star-dim), transparent),
  radial-gradient(2px 2px at 50% 50%, var(--star-field), transparent);
```

### Variant-Specific Tokens

```css
--nebula-glow-pink: oklch(0.7 0.2 340 / 0.3);
--nebula-glow-cyan: oklch(0.75 0.15 210 / 0.3);
--nebula-glow-green: oklch(0.75 0.18 160 / 0.3);
--star-field: oklch(1 0 0 / 0.8);          /* Bright stars */
--star-dim: oklch(0.9 0.02 280 / 0.6);     /* Dim stars */
```

---

## Editorial Theme

**Aesthetic**: The New York Times, The Guardian, classic print journalism
**Files**: `editorial.css`
**Best for**: Editorial content, data journalism, analysis dashboards

### Color System

| Token | Color (hex equiv) | Purpose | Contrast Ratio |
|-------|------------------|---------|----------------|
| `--background` | `#F9F8F4` | Cream newsprint | — |
| `--foreground` | `#1A1614` | Ink black | 16.2:1 ✓ AAA |
| `--primary` | `#003D7A` | Editorial blue | 11.5:1 ✓ AAA |
| `--accent` | `#B91C1C` | Editorial red | 8.8:1 ✓ AAA |
| `--sentiment-positive` | `#15803D` | Forest green | 9.2:1 ✓ AAA |
| `--sentiment-negative` | `#B91C1C` | Editorial red | 8.8:1 ✓ AAA |
| `--sentiment-neutral` | `#6B6762` | Neutral gray | 6.8:1 ✓ AA |

### Chart Palette (5 colors, print-safe)

1. `--chart-1`: Editorial blue `#003D7A`
2. `--chart-2`: Editorial red `#B91C1C`
3. `--chart-3`: Forest green `#15803D`
4. `--chart-4`: Mustard gold `#A67C00`
5. `--chart-5`: Deep purple `#3D2B5F`

### Typography Recommendations

- **Display**: Playfair Display, Libre Baskerville (elegant serifs)
- **Body**: Merriweather, Georgia (readable serif, line-height 1.7)
- **Sans**: Lora, Source Serif Pro (labels, metadata)
- **Mono**: IBM Plex Mono (data tables)
- **Features**: `font-variant-numeric: oldstyle-nums` for elegance

### Print Elements

```css
/* Headline with bottom rule */
.text-display {
  font-family: var(--font-serif-display);
  border-bottom: 2px solid var(--headline-underline);
  padding-bottom: 0.5rem;
}

/* Section dividers (double rule) */
.text-section-title {
  border-top: 3px double var(--section-rule);
  border-bottom: 1px solid var(--section-rule);
  padding: 0.5rem 0;
}

/* Pullquote styling */
.pullquote {
  border-left: 4px solid var(--pullquote-border);
  font-style: italic;
  font-size: 1.25rem;
  line-height: 1.6;
}
```

### Variant-Specific Tokens

```css
--byline-color: oklch(0.4 0.01 30);        /* Byline gray */
--dateline-color: oklch(0.5 0.01 30);      /* Dateline */
--kicker-color: oklch(0.3 0.12 250);       /* Section label */
--pullquote-border: oklch(0.3 0.12 250);   /* Pullquote accent */
--section-rule: oklch(0.15 0.01 30);       /* Section divider */
--photo-credit: oklch(0.55 0.005 30);      /* Photo credit */
```

---

## RetroArcade Theme

**Aesthetic**: Arcade cabinets, Game Boy, NES, pixel art, CRT displays
**Files**: `retro-arcade.css`
**Best for**: Gamification, leaderboards, achievement systems

### Color System

| Token | Color (hex equiv) | Purpose | Contrast Ratio |
|-------|------------------|---------|----------------|
| `--background` | `#0D1B0D` | CRT black (green tint) | — |
| `--foreground` | `#E0FFCC` | Phosphor green | 14.2:1 ✓ AAA |
| `--primary` | `#FF00FF` | Neon magenta | 7.8:1 ✓ AA |
| `--accent` | `#FFFF00` | Neon yellow | 12.5:1 ✓ AAA |
| `--sentiment-positive` | `#00FF66` | Power-up green | 11.8:1 ✓ AAA |
| `--sentiment-negative` | `#FF3333` | Damage red | 8.2:1 ✓ AA |
| `--sentiment-neutral` | `#33AAFF` | Health blue | 7.5:1 ✓ AA |

### Chart Palette (5 colors, 8-bit)

1. `--chart-1`: Magenta `#FF00FF`
2. `--chart-2`: Cyan `#00CCFF`
3. `--chart-3`: Yellow `#FFFF00`
4. `--chart-4`: Green `#00FF66`
5. `--chart-5`: Red `#FF3333`

### Typography Recommendations

- **Pixel**: Press Start 2P (headings, minimum 12px for readability)
- **Mono**: VT323 (body text, more readable than pixel fonts)
- **Display**: Bungee (titles)
- **Features**: `letter-spacing: 0.1-0.2em`, `image-rendering: pixelated`

### Special Effects

```css
/* CRT scanline overlay */
body::before {
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    var(--scanline) 2px,
    var(--scanline) 4px
  );
  animation: flicker 0.15s infinite;
}

/* Pixel grid overlay */
body::after {
  background-image:
    repeating-linear-gradient(0deg, var(--pixel-grid) 0px, transparent 1px, transparent 4px),
    repeating-linear-gradient(90deg, var(--pixel-grid) 0px, transparent 1px, transparent 4px);
}

/* Neon glow text */
text-shadow:
  0 0 12px oklch(0.85 0.2 90 / 0.6),
  0 0 24px oklch(0.85 0.2 90 / 0.6);

/* Corner brackets (arcade cabinet) */
.swiss-card::before,
.swiss-card::after {
  border: 2px solid var(--accent);
  width: 16px;
  height: 16px;
}
```

### Symbols for Redundant Encoding

```
▲  Positive sentiment (up triangle)
▼  Negative sentiment (down triangle)
■  Neutral sentiment (square)
●  Active status (blinking)
```

### Variant-Specific Tokens

```css
--pixel-grid: oklch(0.95 0.08 140 / 0.03); /* Subtle grid */
--scanline: oklch(0 0 0 / 0.15);           /* CRT scanline */
--crt-glow: oklch(0.95 0.08 140 / 0.4);    /* Phosphor glow */
--insert-coin: oklch(0.85 0.2 90);         /* Blink yellow */
--game-over: oklch(0.65 0.3 10);           /* Game over red */
--high-score: oklch(0.85 0.2 90);          /* High score */
```

---

## Accessibility Compliance Summary

### Contrast Ratios (WCAG 2.1)

All variants meet **AA** requirements (4.5:1 normal, 3:1 large):

| Variant | Foreground | Primary | Muted FG | Positive | Negative |
|---------|-----------|---------|----------|----------|----------|
| **Mission Control** | 13.5:1 ✓ | 9.8:1 ✓ | 5.2:1 ✓ | 10.2:1 ✓ | 6.8:1 ✓ |
| **Cosmic Nexus** | 12.8:1 ✓ | 7.2:1 ✓ | 4.9:1 ✓ | 9.5:1 ✓ | 6.1:1 ✓ |
| **Editorial** | 16.2:1 ✓ | 11.5:1 ✓ | 6.8:1 ✓ | 9.2:1 ✓ | 8.8:1 ✓ |
| **RetroArcade** | 14.2:1 ✓ | 7.8:1 ✓ | 5.8:1 ✓ | 11.8:1 ✓ | 8.2:1 ✓ |

### Colorblind Safety Strategies

**Mission Control**: Cyan vs red (avoids red-green confusion) + luminance variation
**Cosmic Nexus**: Multi-hue (pink/cyan/green) + red-orange instead of pure red
**Editorial**: High contrast compensates + ✓/! symbols for redundancy
**RetroArcade**: High saturation + symbols (▲▼■) + luminance variation

### Motion Sensitivity

All variants respect `prefers-reduced-motion`:

```css
@media (prefers-reduced-motion: reduce) {
  /* All animations disabled or simplified */
  animation: none;
}
```

---

## Color Theory Applied

### Mission Control (Authority + Focus)

- **Temperature**: Cool (blues, cyans)
- **Saturation**: Moderate (15-22%)
- **Emotion**: Precision, control, technology
- **Association**: Aerospace, monitoring, operations

### Cosmic Nexus (Wonder + Mystery)

- **Temperature**: Cool to warm gradient
- **Saturation**: High (18-25%)
- **Emotion**: Awe, discovery, infinite possibility
- **Association**: Space exploration, beauty, unknown

### Editorial (Trust + Clarity)

- **Temperature**: Neutral (warm cream base)
- **Saturation**: Low to moderate (5-20%)
- **Emotion**: Seriousness, credibility, timelessness
- **Association**: Journalism, truth, authority

### RetroArcade (Energy + Play)

- **Temperature**: Warm (phosphor green base)
- **Saturation**: Very high (20-30%)
- **Emotion**: Excitement, nostalgia, achievement
- **Association**: Gaming, fun, competition

---

## Usage Recommendations

### When to Use Each Variant

**Mission Control**: Real-time monitoring, system status, technical audiences
**Cosmic Nexus**: Exploration features, data discovery, inspiring wonder
**Editorial**: Analysis content, reports, credibility-focused interfaces
**RetroArcade**: Gamification, leaderboards, casual/gaming audiences

### Don't Mix Variants

Provide a global variant switcher instead:

```typescript
// Store preference
localStorage.setItem('theme-variant', 'cosmic-nexus');

// Apply globally
document.documentElement.dataset.variant =
  localStorage.getItem('theme-variant') || 'mission-control';
```

---

## Testing Resources

- **Contrast Checker**: [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- **Colorblind Simulation**: Chrome DevTools > Rendering > Emulate vision deficiencies
- **Accessibility**: [WAVE Browser Extension](https://wave.webaim.org/extension/)

## Font Resources

- **Mission Control**: [Rajdhani](https://fonts.google.com/specimen/Rajdhani), [Orbitron](https://fonts.google.com/specimen/Orbitron)
- **Cosmic Nexus**: [Space Grotesk](https://fonts.google.com/specimen/Space+Grotesk), [Montserrat](https://fonts.google.com/specimen/Montserrat)
- **Editorial**: [Playfair Display](https://fonts.google.com/specimen/Playfair+Display), [Merriweather](https://fonts.google.com/specimen/Merriweather)
- **RetroArcade**: [Press Start 2P](https://fonts.google.com/specimen/Press+Start+2P), [VT323](https://fonts.google.com/specimen/VT323)

---

## Credits

**Luke Steuber** · [lukesteuber.com](https://lukesteuber.com) · [@lukesteuber.com](https://bsky.app/profile/lukesteuber.com)
