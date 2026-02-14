# Firehose UX Variants

This directory contains 4 completely different UX approaches to visualizing the Bluesky real-time post stream.

## Variants

Each variant is a standalone React component that connects to the same Socket.IO firehose data but presents it with a unique aesthetic and interaction model.

### 1. MissionControl.tsx
**Aesthetic**: NASA control room meets Bloomberg terminal
**Theme**: Dark (#0a0e14)
**Typography**: IBM Plex Mono, Scto Grotesk, Commit Mono
**Colors**: Cyan (#00f0ff), Amber (#ffb800), Green (#00ff88)
**Features**: Modular panels, terminal-inspired, scan-line animations, heartbeat indicator

### 2. CosmicNexus.tsx
**Aesthetic**: Space/nebula data visualization
**Theme**: Deep space (#000000)
**Typography**: Orbitron, Space Grotesk, Share Tech Mono
**Colors**: Cyan (#60efff), Magenta (#ff6b9d), Purple (#a78bfa)
**Features**: Particle system, glowing posts as stars, nebula gradients, constellation patterns

### 3. Editorial.tsx
**Aesthetic**: The New York Times editorial design
**Theme**: Light, classic newspaper
**Typography**: Playfair Display, Lora, Libre Franklin
**Colors**: Black/white with subtle accent borders
**Features**: Article cards, bylines, section headers, columns layout, "above the fold" hierarchy

### 4. RetroArcade.tsx
**Aesthetic**: 8-bit/16-bit gaming nostalgia
**Theme**: Retro gaming palette
**Typography**: Arcade fonts, pixel-style
**Colors**: Bright #ff00ff, #00ffff gaming palette
**Features**: Posts as game sprites, score counters, pixel explosion effects, CRT scanlines, chiptune sounds

## Shared Types

All variants use shared TypeScript types from `types.ts`:
- `FirehosePost` - Real-time post data
- `SentimentData` - Sentiment analysis
- `LanguageStats` - Language distribution
- `HashtagTrend` - Trending hashtags
- `NetworkHealth` - Connection metrics
- `VariantProps` - Common component props

## Socket.IO Integration

Each variant connects to Socket.IO for real-time updates:

```typescript
import { useSocket } from '@/hooks/useSocket';

const { connected, stats, latestPost } = useSocket();
```

Events:
- `post` - New post received
- `stats` - Statistics update (1/sec)

## Implementation Notes

- All variants are lazy-loaded via `VariantRouter.tsx`
- Accessible via `/variants/:variantId` routes
- Each variant is self-contained with its own CSS module
- Variants should be ~300-500 lines of focused component code
- Use Framer Motion or CSS animations for movement
- Ensure WCAG AA accessibility where possible
