/**
 * Firehose Dashboard Variants - Barrel Exports
 *
 * This file provides a central export point for all dashboard variant components.
 * Each variant offers a unique visual aesthetic while maintaining consistent
 * Socket.IO integration and functionality.
 *
 * Available Variants:
 * - MissionControl: NASA control room aesthetic (dark, monospace, panel-based)
 * - CosmicNexus: Space/nebula theme (gradient, glowing particles, floating posts)
 * - Editorial: NYT-inspired print (serif, multi-column, minimal animation)
 * - RetroArcade: 1980s arcade gaming (pixel art, neon, CRT scanlines)
 *
 * Usage:
 * ```tsx
 * import { MissionControl, CosmicNexus, Editorial, RetroArcade } from '@/variants';
 *
 * function App() {
 *   return <MissionControl maxPosts={20} />;
 * }
 * ```
 */

export { MissionControl } from './MissionControl';
export { CosmicNexus } from './CosmicNexus';
export { Editorial } from './Editorial';
export { RetroArcade } from './RetroArcade';

export type {
  FirehosePost,
  FirehoseStats,
  VariantProps,
  ThemeConfig,
  AnimationConfig,
  SentimentData,
  LanguageStats,
  HashtagTrend,
  NetworkHealth,
  TimelineDataPoint,
  ContentTypeStats,
  SocketEventHandlers,
  // Legacy aliases
  Post,
} from './types';

/**
 * Metadata for each variant
 */
export const VARIANT_METADATA = {
  missionControl: {
    id: 'mission-control',
    name: 'Mission Control',
    description: 'NASA control room aesthetic with panel-based layout',
    theme: 'dark',
    typography: 'monospace',
    animations: 'moderate',
  },
  cosmicNexus: {
    id: 'cosmic-nexus',
    name: 'Cosmic Nexus',
    description: 'Space nebula theme with glowing particles',
    theme: 'dark-gradient',
    typography: 'sans-serif',
    animations: 'high',
  },
  editorial: {
    id: 'editorial',
    name: 'Editorial',
    description: 'NYT-inspired print design with serif typography',
    theme: 'light',
    typography: 'serif',
    animations: 'minimal',
  },
  retroArcade: {
    id: 'retro-arcade',
    name: 'Retro Arcade',
    description: '1980s arcade gaming with pixel art and CRT effects',
    theme: 'dark',
    typography: 'pixel',
    animations: 'arcade',
  },
} as const;

/**
 * Type guard to check if a string is a valid variant ID
 */
export function isValidVariantId(
  id: string
): id is keyof typeof VARIANT_METADATA {
  return id in VARIANT_METADATA;
}
