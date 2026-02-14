/**
 * MissionControl.tsx - NASA Control Room Dashboard Variant
 *
 * Aesthetic: 1960s-1980s space program mission control
 * Theme: Dark with green/amber terminal displays
 * Typography: Monospace
 * Layout: Modular panel grid
 */

import { useSocket } from '@/hooks/useSocket';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useMemo } from 'react';
import type { Post, VariantProps } from './types';

export function MissionControl({ className, maxPosts = 20 }: VariantProps) {
  const { connected, stats, latestPost } = useSocket();
  const [posts, setPosts] = useState<Post[]>([]);
  const [missionTime, setMissionTime] = useState('00:00:00');

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

  // Format mission elapsed time
  useEffect(() => {
    if (!stats?.duration) {
      setMissionTime('00:00:00');
      return;
    }
    const hours = Math.floor(stats.duration / 3600);
    const minutes = Math.floor((stats.duration % 3600) / 60);
    const seconds = stats.duration % 60;
    setMissionTime(
      `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    );
  }, [stats?.duration]);

  // Format numbers with leading zeros (control room style)
  const formatStat = (num: number, digits: number = 6): string => {
    return String(num).padStart(digits, '0');
  };

  const getSentimentColor = (sentiment: string): string => {
    switch (sentiment) {
      case 'positive':
        return 'text-[#00ff00]'; // Terminal green
      case 'negative':
        return 'text-[#ff0000]'; // Alert red
      case 'neutral':
        return 'text-[#ffbf00]'; // Amber
      default:
        return 'text-[#00ff00]';
    }
  };

  return (
    <div
      className={`mission-control min-h-screen bg-[#1a1a1a] text-[#00ff00] font-mono p-4 ${className || ''}`}
    >
      {/* Header */}
      <div className="border-2 border-[#00ff00] p-4 mb-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-wider">
            MISSION CONTROL - BLUESKY FIREHOSE
          </h1>
          <div className="flex items-center gap-2">
            <span className="text-sm">STATUS:</span>
            <motion.div
              className={`w-3 h-3 rounded-full ${connected ? 'bg-[#00ff00]' : 'bg-[#ff0000]'}`}
              animate={
                !prefersReducedMotion && connected
                  ? { opacity: [1, 0.3, 1] }
                  : {}
              }
              transition={{ duration: 1, repeat: Infinity }}
            />
            <span className="text-sm">{connected ? 'ONLINE' : 'OFFLINE'}</span>
          </div>
        </div>
      </div>

      {/* Main Control Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* Mission Elapsed Time Panel */}
        <div className="border-2 border-[#00ff00] p-4">
          <div className="text-xs mb-2 tracking-wider">MISSION ELAPSED TIME</div>
          <div className="text-4xl font-bold tabular-nums">{missionTime}</div>
          <div className="text-xs mt-2 text-[#ffbf00]">
            RUNNING: {stats?.running ? 'YES' : 'NO'}
          </div>
        </div>

        {/* Total Posts Panel */}
        <div className="border-2 border-[#00ff00] p-4">
          <div className="text-xs mb-2 tracking-wider">TOTAL POSTS RECEIVED</div>
          <motion.div
            className="text-4xl font-bold tabular-nums"
            key={stats?.totalPosts || 0}
            initial={!prefersReducedMotion ? { scale: 1.2 } : {}}
            animate={{ scale: 1 }}
            transition={{ duration: 0.2 }}
          >
            {formatStat(stats?.totalPosts || 0)}
          </motion.div>
          <div className="text-xs mt-2 text-[#ffbf00]">
            IN DB: {formatStat(stats?.inDatabase || 0)}
          </div>
        </div>

        {/* Posts Per Minute Panel */}
        <div className="border-2 border-[#00ff00] p-4">
          <div className="text-xs mb-2 tracking-wider">POSTS PER MINUTE</div>
          <div className="text-4xl font-bold tabular-nums">
            {formatStat(Math.round(stats?.postsPerMinute || 0), 3)}
          </div>
          <div className="text-xs mt-2 text-[#ffbf00]">RATE: NOMINAL</div>
        </div>
      </div>

      {/* Sentiment Analysis Panel */}
      <div className="border-2 border-[#00ff00] p-4 mb-4">
        <div className="text-xs mb-4 tracking-wider">SENTIMENT ANALYSIS</div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="text-xs mb-1">POSITIVE</div>
            <div className="text-3xl font-bold tabular-nums text-[#00ff00]">
              {formatStat(stats?.sentimentCounts?.positive || 0, 4)}
            </div>
            <div className="h-2 bg-[#003300] mt-2">
              <motion.div
                className="h-full bg-[#00ff00]"
                initial={{ width: 0 }}
                animate={{
                  width: stats?.totalPosts
                    ? `${((stats.sentimentCounts?.positive || 0) / stats.totalPosts) * 100}%`
                    : '0%',
                }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>
          <div>
            <div className="text-xs mb-1">NEUTRAL</div>
            <div className="text-3xl font-bold tabular-nums text-[#ffbf00]">
              {formatStat(stats?.sentimentCounts?.neutral || 0, 4)}
            </div>
            <div className="h-2 bg-[#332800] mt-2">
              <motion.div
                className="h-full bg-[#ffbf00]"
                initial={{ width: 0 }}
                animate={{
                  width: stats?.totalPosts
                    ? `${((stats.sentimentCounts?.neutral || 0) / stats.totalPosts) * 100}%`
                    : '0%',
                }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>
          <div>
            <div className="text-xs mb-1">NEGATIVE</div>
            <div className="text-3xl font-bold tabular-nums text-[#ff0000]">
              {formatStat(stats?.sentimentCounts?.negative || 0, 4)}
            </div>
            <div className="h-2 bg-[#330000] mt-2">
              <motion.div
                className="h-full bg-[#ff0000]"
                initial={{ width: 0 }}
                animate={{
                  width: stats?.totalPosts
                    ? `${((stats.sentimentCounts?.negative || 0) / stats.totalPosts) * 100}%`
                    : '0%',
                }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Live Feed Panel */}
      <div className="border-2 border-[#00ff00] p-4">
        <div className="text-xs mb-4 tracking-wider">LIVE TRANSMISSION FEED</div>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          <AnimatePresence mode="popLayout">
            {posts.map((post, index) => (
              <motion.div
                key={post.uri || index}
                initial={!prefersReducedMotion ? { x: -20, opacity: 0 } : {}}
                animate={{ x: 0, opacity: 1 }}
                exit={!prefersReducedMotion ? { x: 20, opacity: 0 } : {}}
                transition={{ duration: 0.3 }}
                className="border border-[#003300] p-3 bg-[#0a0a0a]"
              >
                <div className="flex items-start gap-2">
                  <div
                    className={`w-1.5 h-1.5 rounded-full mt-1.5 ${getSentimentColor(post.sentiment)}`}
                  />
                  <div className="flex-1 text-sm">
                    <div className="text-[#ffbf00] text-xs mb-1">
                      {new Date(post.createdAt).toISOString().replace('T', ' ').split('.')[0]}
                      {' | '}
                      {post.author?.handle || 'unknown'}
                      {post.language && ` | LANG: ${post.language.toUpperCase()}`}
                    </div>
                    <div className={`${getSentimentColor(post.sentiment)} leading-relaxed`}>
                      {post.text}
                    </div>
                    <div className="flex gap-3 mt-2 text-xs text-[#666]">
                      {post.hasImages && <span>IMG</span>}
                      {post.hasVideo && <span>VID</span>}
                      {post.hasLink && <span>LINK</span>}
                      {post.isReply && <span>REPLY</span>}
                      {post.isQuote && <span>QUOTE</span>}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 text-xs text-center text-[#666] tracking-wider">
        MISSION CONTROL SYSTEM v1.0 | CLASSIFIED | AUTHORIZED PERSONNEL ONLY
      </div>
    </div>
  );
}

export default MissionControl;
