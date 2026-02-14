# Firehose Dashboard Variants

This directory contains 4 complete React dashboard variants for the Bluesky Firehose real-time analytics application. Each variant provides a unique visual aesthetic while maintaining consistent Socket.IO integration and functionality.

## Architecture

All variants follow a consistent architecture pattern:

```
variants/
├── types.ts                 # Shared TypeScript interfaces
├── MissionControl.tsx       # NASA control room variant
├── CosmicNexus.tsx         # Space/nebula variant
├── Editorial.tsx           # NYT-inspired print variant
├── RetroArcade.tsx         # 1980s arcade gaming variant
├── index.ts                # Barrel exports + metadata
└── README.md               # This file
```

## Variants

### 1. MissionControl - NASA Control Room

**Aesthetic**: 1960s-1980s space program mission control
**Theme**: Dark (#1a1a1a) with terminal green (#00ff00) and amber (#ffbf00)
**Typography**: Monospace (Courier New, Consolas)
**Layout**: Panel-based grid like control room monitors

**Features**:
- Odometer-style numeric displays with leading zeros
- Blinking status indicators (CSS animation)
- "Mission elapsed time" counter
- Panel-based layout with borders
- Sentiment color coding (green/amber/red)

**Animations**:
- Blinking connection status dot
- Slide-in for new posts
- Scale pulse for stats updates
- Horizontal progress bars for sentiment

### 2. CosmicNexus - Space/Nebula Theme

**Aesthetic**: Deep space, cosmic nebulae
**Theme**: Purple/blue gradient with glowing elements
**Typography**: Sans-serif
**Layout**: Posts as floating glowing cards

**Features**:
- 50-particle drift background
- Posts with sentiment-based glow effects (green/red/blue)
- Gradient backgrounds (purple → indigo → purple)
- Glassmorphism cards with backdrop blur
- Glow shadows on all interactive elements

**Animations**:
- Particle drift (random path, 20-30s duration)
- Posts fade in with scale/opacity
- Pulse glow on stats panels
- Hover scale on cards
- Text shadow pulse on header

### 3. Editorial - NYT-Inspired Print

**Aesthetic**: Classic newspaper editorial design
**Theme**: Off-white (#f9f7f4) background with black text
**Typography**: Serif (Georgia, Garamond)
**Layout**: Multi-column text, posts as headlines

**Features**:
- Newspaper masthead with date
- Posts formatted as headlines with bylines
- Multi-column layout (responsive: 1/2/3 columns)
- Ornamental dividers (❦)
- Stats presented as "newspaper facts" boxes
- Print-inspired borders and spacing

**Animations**:
- Minimal fade-in for new content
- Opacity transitions only
- Respects print aesthetic (no flashy effects)

### 4. RetroArcade - 1980s Gaming

**Aesthetic**: Retro arcade games, CRT monitors
**Theme**: Black with neon colors (green/cyan/magenta/yellow)
**Typography**: Pixel/bitmap fonts (Press Start 2P)
**Layout**: Arcade game UI with score displays

**Features**:
- CRT scanline overlay (repeating gradient)
- Radial vignette for screen curvature
- Pixel art corner decorations
- "HIGH SCORE" style stats displays
- Flash effect on new posts (attract mode)
- Neon text shadows and glows

**Animations**:
- Blink/flash on new posts
- Score counter with scale pulse
- CRT scanlines (static overlay)
- Neon glow pulse on stats
- Slide in/out for posts

## Socket.IO Integration

All variants use the same Socket.IO integration pattern via the `useSocket()` hook:

```typescript
import { useSocket } from '@/hooks/useSocket';

function MyVariant() {
  const { connected, stats, latestPost } = useSocket();

  // connected: boolean (Socket.IO connection state)
  // stats: FirehoseStats (emitted every 1 second)
  // latestPost: Post (emitted on every new post)
}
```

### Socket.IO Events

- `connect`: Connection established
- `disconnect`: Connection lost
- `stats`: Stats update (every 1 second)
- `post`: New post received

### Data Structures

See `types.ts` for full TypeScript interfaces:

- `FirehoseStats`: Aggregate metrics (total posts, rate, sentiment counts)
- `Post`: Individual post with metadata (text, author, sentiment, language, etc.)

## Accessibility

All variants include:

- **Reduced Motion Support**: Checks `prefers-reduced-motion` media query
- **Keyboard Navigation**: No mouse-only interactions
- **Semantic HTML**: Proper heading hierarchy, landmarks
- **ARIA Labels**: Screen reader support
- **Color Contrast**: WCAG 2.1 AA compliant (4.5:1 text, 3:1 UI)

### Reduced Motion

When `prefers-reduced-motion: reduce` is detected:
- All Framer Motion animations are disabled
- CSS animations are simplified or removed
- Static layouts are used instead of animated ones

## Usage

### Basic Usage

```typescript
import { MissionControl } from '@/variants';

function App() {
  return <MissionControl />;
}
```

### With Props

```typescript
import { CosmicNexus } from '@/variants';

function App() {
  return (
    <CosmicNexus
      maxPosts={30}
      className="custom-wrapper"
    />
  );
}
```

### Variant Switcher

```typescript
import { MissionControl, CosmicNexus, Editorial, RetroArcade } from '@/variants';
import { useState } from 'react';

function App() {
  const [variant, setVariant] = useState('mission-control');

  const variants = {
    'mission-control': MissionControl,
    'cosmic-nexus': CosmicNexus,
    'editorial': Editorial,
    'retro-arcade': RetroArcade,
  };

  const Component = variants[variant];

  return (
    <div>
      <select onChange={e => setVariant(e.target.value)}>
        <option value="mission-control">Mission Control</option>
        <option value="cosmic-nexus">Cosmic Nexus</option>
        <option value="editorial">Editorial</option>
        <option value="retro-arcade">Retro Arcade</option>
      </select>
      <Component maxPosts={20} />
    </div>
  );
}
```

## Props Interface

All variants accept the same `VariantProps` interface:

```typescript
interface VariantProps {
  className?: string;    // Additional CSS classes
  maxPosts?: number;     // Max posts in feed (default varies by variant)
}
```

## Performance

### Optimization Strategies

1. **Post Buffering**: Only keep `maxPosts` in memory (default: 15-30)
2. **Memoization**: `useMemo` for expensive calculations (particle positions, etc.)
3. **AnimatePresence**: Framer Motion for efficient enter/exit animations
4. **Conditional Rendering**: Skip animations if `prefersReducedMotion` is true
5. **CSS Animations**: Persistent effects (blink, scanlines) use CSS, not JS

### Target Performance

- **60fps animations** (verified via Chrome DevTools Performance tab)
- **LCP < 2.5s** (Largest Contentful Paint)
- **FID < 100ms** (First Input Delay)
- **CLS < 0.1** (Cumulative Layout Shift)

## Dependencies

All variants use:

- `react` ^19.1.1
- `framer-motion` ^12.23.22
- `socket.io-client` ^4.8.1
- `tailwindcss` ^4.1.14

No additional dependencies required.

## Testing

### Manual Testing Checklist

- [ ] Socket.IO connection works
- [ ] Stats update every second
- [ ] New posts appear in real-time
- [ ] Animations run at 60fps
- [ ] Reduced motion is respected
- [ ] Keyboard navigation works
- [ ] Screen reader announces updates
- [ ] Color contrast passes WCAG AA
- [ ] Responsive on mobile
- [ ] TypeScript compiles without errors

### TypeScript Check

```bash
cd /home/coolhand/html/firehose
pnpm check
```

### Build Test

```bash
pnpm build
```

## Troubleshooting

### Posts not appearing

- Check Socket.IO connection: `connected` should be `true`
- Verify firehose is running: `sm status firehose`
- Check browser console for Socket.IO errors

### Animations janky/stuttering

- Check Performance tab in Chrome DevTools
- Verify `prefersReducedMotion` detection
- Reduce `maxPosts` to lower DOM element count
- Check for excessive re-renders (React DevTools Profiler)

### TypeScript errors

- Ensure all types are imported from `./types`
- Check `useSocket()` hook is available
- Verify Framer Motion types are installed

## Future Enhancements

Potential additions:

- [ ] Language filtering UI
- [ ] Sentiment filtering UI
- [ ] Export to image/PDF
- [ ] Custom theme builder
- [ ] Keyboard shortcuts
- [ ] Touch gestures for mobile
- [ ] WebGL particle effects (CosmicNexus)
- [ ] Audio feedback (RetroArcade)

## Credits

Created by Luke Steuber (2026-02-14)
Part of the Bluesky Firehose project
License: MIT
