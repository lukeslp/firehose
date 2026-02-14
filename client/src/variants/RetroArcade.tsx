/**
 * RetroArcade.tsx - 1980s Arcade Gaming Dashboard Variant
 *
 * Aesthetic: Retro arcade games, pixel art, CRT monitors
 * Theme: Dark with neon colors, pixel fonts
 * Layout: Arcade game UI with score displays
 * Animation: Flash effects, digit flip, scanlines
 */

import { useSocket } from '@/hooks/useSocket';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useMemo } from 'react';
import type { Post, VariantProps } from './types';

export function RetroArcade({ className, maxPosts = 15 }: VariantProps) {
  const { connected, stats, latestPost } = useSocket();
  const [posts, setPosts] = useState<Post[]>([]);
  const [flash, setFlash] = useState(false);

  const prefersReducedMotion = useMemo(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  );

  // Update posts feed with flash effect
  useEffect(() => {
    if (latestPost) {
      setPosts(prev => [latestPost, ...prev].slice(0, maxPosts));
      // Trigger attract mode flash
      if (!prefersReducedMotion) {
        setFlash(true);
        setTimeout(() => setFlash(false), 100);
      }
    }
  }, [latestPost, maxPosts, prefersReducedMotion]);

  // Sentiment to arcade color
  const getSentimentColor = (sentiment: string): string => {
    switch (sentiment) {
      case 'positive':
        return 'text-[#39ff14]'; // Neon green
      case 'negative':
        return 'text-[#ff00ff]'; // Magenta
      case 'neutral':
      default:
        return 'text-[#00ffff]'; // Cyan
    }
  };

  const getSentimentBg = (sentiment: string): string => {
    switch (sentiment) {
      case 'positive':
        return 'bg-[#39ff14]/20';
      case 'negative':
        return 'bg-[#ff00ff]/20';
      case 'neutral':
      default:
        return 'bg-[#00ffff]/20';
    }
  };

  // Format score with pixel art style
  const formatScore = (num: number): string => {
    return String(num).padStart(8, '0');
  };

  return (
    <div
      className={`retro-arcade relative min-h-screen bg-black text-[#39ff14] overflow-hidden ${className || ''}`}
      style={{
        fontFamily:
          '"Press Start 2P", "Courier New", monospace',
      }}
    >
      {/* CRT Scanlines Overlay */}
      <div
        className="absolute inset-0 pointer-events-none z-50"
        style={{
          background:
            'repeating-linear-gradient(0deg, rgba(0,0,0,0.15) 0px, rgba(0,0,0,0.15) 1px, transparent 1px, transparent 2px)',
        }}
      />

      {/* CRT Curve Vignette */}
      <div
        className="absolute inset-0 pointer-events-none z-40"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.3) 100%)',
        }}
      />

      {/* Content */}
      <div className="relative z-10 p-4 md:p-8">
        {/* Arcade Marquee */}
        <div className="border-4 border-[#39ff14] p-4 mb-6 relative">
          {/* Corner decorations (pixel art) */}
          <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-[#ffff00]" />
          <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-[#ffff00]" />
          <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-[#ffff00]" />
          <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-[#ffff00]" />

          <h1
            className="text-center text-2xl md:text-4xl mb-2 tracking-wider"
            style={{
              textShadow: '3px 3px 0 #ff00ff, -2px -2px 0 #00ffff',
            }}
          >
            BLUESKY ARCADE
          </h1>
          <div className="flex items-center justify-center gap-4 text-xs md:text-sm">
            <motion.span
              className={connected ? 'text-[#39ff14]' : 'text-[#ff0000]'}
              animate={
                !prefersReducedMotion
                  ? { opacity: [1, 0.3, 1] }
                  : {}
              }
              transition={{ duration: 0.8, repeat: Infinity }}
            >
              ● {connected ? 'CONNECTED' : 'NO SIGNAL'}
            </motion.span>
            <span className="text-[#ffff00]">INSERT COIN</span>
          </div>
        </div>

        {/* High Score Display */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Total Posts - High Score */}
          <div className="border-4 border-[#39ff14] p-4 bg-[#001100]">
            <div className="text-xs mb-2 text-[#ffff00]">HIGH SCORE</div>
            <motion.div
              className="text-2xl md:text-3xl font-bold tabular-nums"
              key={stats?.totalPosts}
              initial={!prefersReducedMotion ? { scale: 1.5, opacity: 0 } : {}}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              {formatScore(stats?.totalPosts || 0)}
            </motion.div>
            <div className="text-xs mt-2 text-[#00ffff]">
              1UP: {formatScore(stats?.inDatabase || 0)}
            </div>
          </div>

          {/* Posts Per Minute */}
          <div className="border-4 border-[#00ffff] p-4 bg-[#001111]">
            <div className="text-xs mb-2 text-[#ffff00]">COMBO RATE</div>
            <div className="text-2xl md:text-3xl font-bold tabular-nums text-[#00ffff]">
              {String(Math.round(stats?.postsPerMinute || 0)).padStart(3, '0')}
            </div>
            <div className="text-xs mt-2 text-[#39ff14]">PER MIN</div>
          </div>

          {/* Connection Status */}
          <div className="border-4 border-[#ff00ff] p-4 bg-[#110011]">
            <div className="text-xs mb-2 text-[#ffff00]">PLAYER STATUS</div>
            <motion.div
              className="text-lg md:text-xl text-[#ff00ff]"
              animate={
                !prefersReducedMotion && stats?.running
                  ? { opacity: [1, 0.5, 1] }
                  : {}
              }
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              {stats?.running ? '▶ ACTIVE' : '■ PAUSED'}
            </motion.div>
            <div className="text-xs mt-2 text-[#39ff14]">
              TIME: {Math.floor((stats?.duration || 0) / 60)}:
              {String((stats?.duration || 0) % 60).padStart(2, '0')}
            </div>
          </div>
        </div>

        {/* Power-ups (Sentiment Stats) */}
        <div className="border-4 border-[#ffff00] p-4 mb-6 bg-[#111100]">
          <div className="text-xs mb-3 text-[#ffff00]">POWER-UPS COLLECTED</div>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-xs mb-1 text-[#39ff14]">POSITIVE ↑</div>
              <motion.div
                className="text-2xl font-bold text-[#39ff14]"
                key={stats?.sentimentCounts?.positive}
                animate={
                  !prefersReducedMotion
                    ? {
                        textShadow: [
                          '0 0 10px #39ff14',
                          '0 0 20px #39ff14',
                          '0 0 10px #39ff14',
                        ],
                      }
                    : {}
                }
                transition={{ duration: 1, repeat: Infinity }}
              >
                {formatScore(stats?.sentimentCounts?.positive || 0).slice(-4)}
              </motion.div>
            </div>
            <div className="text-center">
              <div className="text-xs mb-1 text-[#00ffff]">NEUTRAL →</div>
              <div className="text-2xl font-bold text-[#00ffff]">
                {formatScore(stats?.sentimentCounts?.neutral || 0).slice(-4)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs mb-1 text-[#ff00ff]">NEGATIVE ↓</div>
              <motion.div
                className="text-2xl font-bold text-[#ff00ff]"
                key={stats?.sentimentCounts?.negative}
                animate={
                  !prefersReducedMotion
                    ? {
                        textShadow: [
                          '0 0 10px #ff00ff',
                          '0 0 20px #ff00ff',
                          '0 0 10px #ff00ff',
                        ],
                      }
                    : {}
                }
                transition={{ duration: 1, repeat: Infinity }}
              >
                {formatScore(stats?.sentimentCounts?.negative || 0).slice(-4)}
              </motion.div>
            </div>
          </div>
        </div>

        {/* Game Feed */}
        <div className="border-4 border-[#39ff14] p-4 bg-[#001100] relative">
          {/* Flash overlay for new posts */}
          {flash && (
            <div className="absolute inset-0 bg-white animate-pulse pointer-events-none z-20" />
          )}

          <div className="text-xs mb-4 text-[#ffff00] flex items-center justify-between">
            <span>INCOMING TRANSMISSIONS</span>
            <motion.span
              animate={!prefersReducedMotion ? { opacity: [1, 0, 1] } : {}}
              transition={{ duration: 1, repeat: Infinity }}
            >
              ▼
            </motion.span>
          </div>

          <div className="space-y-3 max-h-[500px] overflow-y-auto text-xs">
            <AnimatePresence mode="popLayout">
              {posts.map((post, index) => (
                <motion.div
                  key={post.uri || index}
                  initial={
                    !prefersReducedMotion
                      ? { x: -50, opacity: 0, scale: 0.9 }
                      : {}
                  }
                  animate={{ x: 0, opacity: 1, scale: 1 }}
                  exit={
                    !prefersReducedMotion
                      ? { x: 50, opacity: 0, scale: 0.9 }
                      : {}
                  }
                  transition={{ duration: 0.2 }}
                  className={`border-2 ${
                    post.sentiment === 'positive'
                      ? 'border-[#39ff14]'
                      : post.sentiment === 'negative'
                        ? 'border-[#ff00ff]'
                        : 'border-[#00ffff]'
                  } p-3 ${getSentimentBg(post.sentiment)} relative`}
                >
                  {/* Pixel corner decoration */}
                  <div
                    className={`absolute top-0 left-0 w-2 h-2 ${
                      post.sentiment === 'positive'
                        ? 'bg-[#39ff14]'
                        : post.sentiment === 'negative'
                          ? 'bg-[#ff00ff]'
                          : 'bg-[#00ffff]'
                    }`}
                  />

                  <div className="flex items-start gap-2">
                    <motion.div
                      className={`text-lg flex-shrink-0 ${getSentimentColor(post.sentiment)}`}
                      animate={
                        !prefersReducedMotion
                          ? { opacity: [1, 0.3, 1] }
                          : {}
                      }
                      transition={{ duration: 1.2, repeat: Infinity }}
                    >
                      {post.sentiment === 'positive'
                        ? '↑'
                        : post.sentiment === 'negative'
                          ? '↓'
                          : '→'}
                    </motion.div>
                    <div className="flex-1">
                      <div className="mb-1 text-[#ffff00]">
                        {post.author?.handle || 'ANON'}{' '}
                        <span className="text-[#666]">
                          {new Date(post.createdAt)
                            .toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                            .replace(/\s/g, '')}
                        </span>
                      </div>
                      <div className={`leading-relaxed ${getSentimentColor(post.sentiment)}`}>
                        {post.text.length > 150
                          ? post.text.slice(0, 150) + '...'
                          : post.text}
                      </div>
                      <div className="flex gap-2 mt-2 text-[#666]">
                        {post.hasImages && <span>[IMG]</span>}
                        {post.hasVideo && <span>[VID]</span>}
                        {post.hasLink && <span>[URL]</span>}
                        {post.isReply && <span>[RE]</span>}
                        {post.language && (
                          <span className="text-[#ffff00]">
                            [{post.language.toUpperCase()}]
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6 text-xs">
          <motion.div
            className="text-[#ffff00]"
            animate={!prefersReducedMotion ? { opacity: [1, 0.3, 1] } : {}}
            transition={{ duration: 2, repeat: Infinity }}
          >
            PRESS START • © 2026 ARCADE SYSTEMS INC • ALL RIGHTS RESERVED
          </motion.div>
        </div>
      </div>
    </div>
  );
}

export default RetroArcade;
