/**
 * CosmicNexus.tsx - Space/Nebula Dashboard Variant
 *
 * Aesthetic: Deep space, cosmic nebulae
 * Theme: Purple/blue gradients with glowing elements
 * Layout: Posts as floating glowing orbs/cards
 * Animation: Particle drift, glow effects
 */

import { useSocket } from '@/hooks/useSocket';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useMemo } from 'react';
import type { Post, VariantProps } from './types';

export function CosmicNexus({ className, maxPosts = 20 }: VariantProps) {
  const { connected, stats, latestPost } = useSocket();
  const [posts, setPosts] = useState<Post[]>([]);

  const prefersReducedMotion = useMemo(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  );

  // Update posts feed
  useEffect(() => {
    if (latestPost) {
      setPosts(prev => [latestPost, ...prev].slice(0, maxPosts));
    }
  }, [latestPost, maxPosts]);

  // Sentiment to glow color mapping
  const getSentimentGlow = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return {
          shadow: 'shadow-[0_0_20px_rgba(16,185,129,0.6)]',
          border: 'border-emerald-500/50',
          bg: 'bg-gradient-to-br from-emerald-900/30 to-emerald-950/30',
        };
      case 'negative':
        return {
          shadow: 'shadow-[0_0_20px_rgba(239,68,68,0.6)]',
          border: 'border-red-500/50',
          bg: 'bg-gradient-to-br from-red-900/30 to-red-950/30',
        };
      case 'neutral':
      default:
        return {
          shadow: 'shadow-[0_0_20px_rgba(59,130,246,0.6)]',
          border: 'border-blue-500/50',
          bg: 'bg-gradient-to-br from-blue-900/30 to-blue-950/30',
        };
    }
  };

  // Create particle positions (static)
  const particles = useMemo(() => {
    return Array.from({ length: 50 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 3 + 1,
      duration: Math.random() * 10 + 20,
      delay: Math.random() * 5,
    }));
  }, []);

  return (
    <div
      className={`cosmic-nexus relative min-h-screen overflow-hidden bg-gradient-to-br from-purple-950 via-indigo-950 to-purple-900 text-white ${className || ''}`}
    >
      {/* Particle Background */}
      <div className="absolute inset-0 overflow-hidden">
        {!prefersReducedMotion &&
          particles.map(particle => (
            <motion.div
              key={particle.id}
              className="absolute rounded-full bg-white/40"
              style={{
                left: `${particle.x}%`,
                top: `${particle.y}%`,
                width: `${particle.size}px`,
                height: `${particle.size}px`,
                filter: 'blur(1px)',
              }}
              animate={{
                x: [0, Math.random() * 100 - 50, 0],
                y: [0, Math.random() * 100 - 50, 0],
                opacity: [0.2, 0.6, 0.2],
              }}
              transition={{
                duration: particle.duration,
                repeat: Infinity,
                delay: particle.delay,
                ease: 'linear',
              }}
            />
          ))}
      </div>

      {/* Content Container */}
      <div className="relative z-10 p-8">
        {/* Header */}
        <div className="text-center mb-12">
          <motion.h1
            className="text-5xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent mb-4"
            animate={
              !prefersReducedMotion
                ? {
                    textShadow: [
                      '0 0 20px rgba(168, 85, 247, 0.5)',
                      '0 0 40px rgba(236, 72, 153, 0.5)',
                      '0 0 20px rgba(168, 85, 247, 0.5)',
                    ],
                  }
                : {}
            }
            transition={{ duration: 3, repeat: Infinity }}
          >
            Cosmic Nexus
          </motion.h1>
          <div className="flex items-center justify-center gap-3">
            <motion.div
              className={`w-4 h-4 rounded-full ${connected ? 'bg-emerald-400' : 'bg-red-400'}`}
              style={{ boxShadow: connected ? '0 0 20px rgba(16,185,129,0.8)' : '0 0 20px rgba(239,68,68,0.8)' }}
              animate={
                !prefersReducedMotion
                  ? { scale: [1, 1.2, 1], opacity: [0.8, 1, 0.8] }
                  : {}
              }
              transition={{ duration: 2, repeat: Infinity }}
            />
            <span className="text-lg text-purple-200">
              {connected ? 'Connected to the Nexus' : 'Nexus Offline'}
            </span>
          </div>
        </div>

        {/* Stats Constellation */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {/* Total Posts */}
          <motion.div
            className="rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-900/40 to-purple-950/40 backdrop-blur-sm p-6 shadow-[0_0_30px_rgba(168,85,247,0.3)]"
            whileHover={!prefersReducedMotion ? { scale: 1.05 } : {}}
            transition={{ duration: 0.3 }}
          >
            <div className="text-purple-300 text-sm mb-2">Total Signals</div>
            <motion.div
              className="text-4xl font-bold text-purple-100"
              key={stats?.totalPosts}
              initial={!prefersReducedMotion ? { scale: 1.3, opacity: 0 } : {}}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              {(stats?.totalPosts || 0).toLocaleString()}
            </motion.div>
            <div className="text-xs text-purple-400 mt-2">
              {(stats?.inDatabase || 0).toLocaleString()} archived
            </div>
          </motion.div>

          {/* Posts Per Minute */}
          <motion.div
            className="rounded-2xl border border-blue-500/30 bg-gradient-to-br from-blue-900/40 to-blue-950/40 backdrop-blur-sm p-6 shadow-[0_0_30px_rgba(59,130,246,0.3)]"
            whileHover={!prefersReducedMotion ? { scale: 1.05 } : {}}
            transition={{ duration: 0.3 }}
          >
            <div className="text-blue-300 text-sm mb-2">Signal Rate</div>
            <div className="text-4xl font-bold text-blue-100">
              {Math.round(stats?.postsPerMinute || 0)}
            </div>
            <div className="text-xs text-blue-400 mt-2">per minute</div>
          </motion.div>

          {/* Positive Sentiment */}
          <motion.div
            className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-900/40 to-emerald-950/40 backdrop-blur-sm p-6 shadow-[0_0_30px_rgba(16,185,129,0.3)]"
            whileHover={!prefersReducedMotion ? { scale: 1.05 } : {}}
            transition={{ duration: 0.3 }}
          >
            <div className="text-emerald-300 text-sm mb-2">Positive Energy</div>
            <div className="text-4xl font-bold text-emerald-100">
              {(stats?.sentimentCounts?.positive || 0).toLocaleString()}
            </div>
            <div className="text-xs text-emerald-400 mt-2">
              {stats?.totalPosts
                ? Math.round((stats.sentimentCounts?.positive / stats.totalPosts) * 100)
                : 0}
              %
            </div>
          </motion.div>

          {/* Negative Sentiment */}
          <motion.div
            className="rounded-2xl border border-red-500/30 bg-gradient-to-br from-red-900/40 to-red-950/40 backdrop-blur-sm p-6 shadow-[0_0_30px_rgba(239,68,68,0.3)]"
            whileHover={!prefersReducedMotion ? { scale: 1.05 } : {}}
            transition={{ duration: 0.3 }}
          >
            <div className="text-red-300 text-sm mb-2">Negative Energy</div>
            <div className="text-4xl font-bold text-red-100">
              {(stats?.sentimentCounts?.negative || 0).toLocaleString()}
            </div>
            <div className="text-xs text-red-400 mt-2">
              {stats?.totalPosts
                ? Math.round((stats.sentimentCounts?.negative / stats.totalPosts) * 100)
                : 0}
              %
            </div>
          </motion.div>
        </div>

        {/* Floating Posts Feed */}
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-semibold text-purple-200 mb-6 text-center">
            Live Transmissions
          </h2>
          <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
            <AnimatePresence mode="popLayout">
              {posts.map((post, index) => {
                const glowStyle = getSentimentGlow(post.sentiment);
                return (
                  <motion.div
                    key={post.uri || index}
                    initial={
                      !prefersReducedMotion
                        ? { scale: 0, opacity: 0, y: -50 }
                        : {}
                    }
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={
                      !prefersReducedMotion
                        ? { scale: 0, opacity: 0, x: 100 }
                        : {}
                    }
                    transition={{ duration: 0.5, type: 'spring' }}
                    whileHover={
                      !prefersReducedMotion
                        ? { scale: 1.02, y: -5 }
                        : {}
                    }
                    className={`rounded-xl border ${glowStyle.border} ${glowStyle.bg} ${glowStyle.shadow} backdrop-blur-sm p-5`}
                  >
                    <div className="flex items-start gap-3">
                      <motion.div
                        className={`w-3 h-3 rounded-full flex-shrink-0 mt-1 ${
                          post.sentiment === 'positive'
                            ? 'bg-emerald-400'
                            : post.sentiment === 'negative'
                              ? 'bg-red-400'
                              : 'bg-blue-400'
                        }`}
                        style={{
                          boxShadow:
                            post.sentiment === 'positive'
                              ? '0 0 10px rgba(16,185,129,0.8)'
                              : post.sentiment === 'negative'
                                ? '0 0 10px rgba(239,68,68,0.8)'
                                : '0 0 10px rgba(59,130,246,0.8)',
                        }}
                        animate={
                          !prefersReducedMotion
                            ? { opacity: [1, 0.5, 1] }
                            : {}
                        }
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                      <div className="flex-1">
                        <div className="text-sm text-purple-300 mb-2 flex items-center gap-2">
                          <span className="font-semibold">
                            {post.author?.handle || 'unknown'}
                          </span>
                          <span className="text-purple-500">•</span>
                          <span className="text-xs">
                            {new Date(post.createdAt).toLocaleTimeString()}
                          </span>
                          {post.language && (
                            <>
                              <span className="text-purple-500">•</span>
                              <span className="text-xs uppercase">
                                {post.language}
                              </span>
                            </>
                          )}
                        </div>
                        <p className="text-purple-50 leading-relaxed mb-3">
                          {post.text}
                        </p>
                        <div className="flex gap-2 text-xs text-purple-400">
                          {post.hasImages && (
                            <span className="px-2 py-1 rounded bg-purple-500/20">
                              Image
                            </span>
                          )}
                          {post.hasVideo && (
                            <span className="px-2 py-1 rounded bg-purple-500/20">
                              Video
                            </span>
                          )}
                          {post.hasLink && (
                            <span className="px-2 py-1 rounded bg-purple-500/20">
                              Link
                            </span>
                          )}
                          {post.isReply && (
                            <span className="px-2 py-1 rounded bg-purple-500/20">
                              Reply
                            </span>
                          )}
                          {post.isQuote && (
                            <span className="px-2 py-1 rounded bg-purple-500/20">
                              Quote
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CosmicNexus;
