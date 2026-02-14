/**
 * Editorial.tsx - NYT-Inspired Print Dashboard Variant
 *
 * Aesthetic: Classic newspaper editorial design
 * Theme: White/cream background with serif typography
 * Layout: Multi-column text, posts as headlines
 * Animation: Minimal (print-inspired)
 */

import { useSocket } from '@/hooks/useSocket';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useMemo } from 'react';
import type { Post, VariantProps } from './types';

export function Editorial({ className, maxPosts = 30 }: VariantProps) {
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

  // Format date in newspaper style
  const formatDate = () => {
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    };
    return now.toLocaleDateString('en-US', options);
  };

  // Sentiment to editorial style
  const getSentimentStyle = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return 'border-l-emerald-600';
      case 'negative':
        return 'border-l-red-700';
      default:
        return 'border-l-slate-600';
    }
  };

  return (
    <div
      className={`editorial min-h-screen bg-[#f9f7f4] text-black ${className || ''}`}
      style={{ fontFamily: 'Georgia, Garamond, serif' }}
    >
      {/* Masthead */}
      <div className="border-b-4 border-black py-6 px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <h1
              className="text-6xl font-bold mb-1"
              style={{ fontFamily: 'Georgia, serif', letterSpacing: '0.02em' }}
            >
              The Bluesky Chronicle
            </h1>
            <div className="flex items-center justify-center gap-4 text-sm border-t border-b border-black py-2 mt-3">
              <span>{formatDate()}</span>
              <span className="h-4 w-px bg-black" />
              <span className="flex items-center gap-2">
                Connection Status:
                <span
                  className={`inline-block w-2 h-2 rounded-full ${connected ? 'bg-emerald-600' : 'bg-red-600'}`}
                />
                {connected ? 'Live' : 'Offline'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Section - Newspaper Facts Box */}
      <div className="max-w-7xl mx-auto px-8 py-8">
        <div className="border-2 border-black bg-white p-6">
          <h2
            className="text-2xl font-bold mb-4 text-center border-b-2 border-black pb-2"
            style={{ fontFamily: 'Georgia, serif' }}
          >
            Live Statistics
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-xs uppercase tracking-wider text-gray-600 mb-1">
                Total Posts
              </div>
              <motion.div
                className="text-4xl font-bold"
                key={stats?.totalPosts}
                initial={!prefersReducedMotion ? { opacity: 0 } : {}}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                {(stats?.totalPosts || 0).toLocaleString()}
              </motion.div>
              <div className="text-xs text-gray-500 mt-1">
                {(stats?.inDatabase || 0).toLocaleString()} archived
              </div>
            </div>

            <div className="text-center">
              <div className="text-xs uppercase tracking-wider text-gray-600 mb-1">
                Posts/Min
              </div>
              <div className="text-4xl font-bold">
                {Math.round(stats?.postsPerMinute || 0)}
              </div>
              <div className="text-xs text-gray-500 mt-1">current rate</div>
            </div>

            <div className="text-center">
              <div className="text-xs uppercase tracking-wider text-emerald-700 mb-1">
                Positive
              </div>
              <div className="text-4xl font-bold text-emerald-700">
                {(stats?.sentimentCounts?.positive || 0).toLocaleString()}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {stats?.totalPosts
                  ? Math.round(
                      (stats.sentimentCounts?.positive / stats.totalPosts) * 100
                    )
                  : 0}
                %
              </div>
            </div>

            <div className="text-center">
              <div className="text-xs uppercase tracking-wider text-red-700 mb-1">
                Negative
              </div>
              <div className="text-4xl font-bold text-red-700">
                {(stats?.sentimentCounts?.negative || 0).toLocaleString()}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {stats?.totalPosts
                  ? Math.round(
                      (stats.sentimentCounts?.negative / stats.totalPosts) * 100
                    )
                  : 0}
                %
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Ornamental Divider */}
      <div className="max-w-7xl mx-auto px-8 mb-6">
        <div className="flex items-center justify-center gap-4">
          <div className="flex-1 h-px bg-black" />
          <div className="text-xl">❦</div>
          <div className="flex-1 h-px bg-black" />
        </div>
      </div>

      {/* Headlines Section */}
      <div className="max-w-7xl mx-auto px-8 pb-12">
        <h2
          className="text-3xl font-bold mb-6 border-b-2 border-black pb-2"
          style={{ fontFamily: 'Georgia, serif' }}
        >
          Live Feed
        </h2>

        <div className="columns-1 md:columns-2 lg:columns-3 gap-6 space-y-6">
          <AnimatePresence mode="popLayout">
            {posts.map((post, index) => (
              <motion.article
                key={post.uri || index}
                initial={!prefersReducedMotion ? { opacity: 0, y: 20 } : {}}
                animate={{ opacity: 1, y: 0 }}
                exit={!prefersReducedMotion ? { opacity: 0, x: -20 } : {}}
                transition={{ duration: 0.4 }}
                className={`break-inside-avoid mb-6 border-l-4 ${getSentimentStyle(post.sentiment)} pl-4 bg-white p-4`}
              >
                {/* Byline */}
                <div className="text-xs uppercase tracking-wider text-gray-600 mb-2 flex items-center gap-2">
                  <span className="font-semibold">
                    {post.author?.handle || 'Anonymous'}
                  </span>
                  <span>•</span>
                  <span>
                    {new Date(post.createdAt).toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </span>
                  {post.language && (
                    <>
                      <span>•</span>
                      <span className="uppercase">{post.language}</span>
                    </>
                  )}
                </div>

                {/* Headline/Content */}
                <p
                  className="text-base leading-relaxed mb-3"
                  style={{
                    fontFamily: 'Georgia, Garamond, serif',
                    hyphens: 'auto',
                  }}
                >
                  {post.text}
                </p>

                {/* Metadata Tags */}
                {(post.hasImages ||
                  post.hasVideo ||
                  post.hasLink ||
                  post.isReply ||
                  post.isQuote) && (
                  <div className="flex flex-wrap gap-2 text-xs pt-2 border-t border-gray-300">
                    {post.hasImages && (
                      <span className="px-2 py-0.5 bg-gray-200 text-gray-700 rounded">
                        Photo
                      </span>
                    )}
                    {post.hasVideo && (
                      <span className="px-2 py-0.5 bg-gray-200 text-gray-700 rounded">
                        Video
                      </span>
                    )}
                    {post.hasLink && (
                      <span className="px-2 py-0.5 bg-gray-200 text-gray-700 rounded">
                        Link
                      </span>
                    )}
                    {post.isReply && (
                      <span className="px-2 py-0.5 bg-gray-200 text-gray-700 rounded">
                        Reply
                      </span>
                    )}
                    {post.isQuote && (
                      <span className="px-2 py-0.5 bg-gray-200 text-gray-700 rounded">
                        Quote
                      </span>
                    )}
                  </div>
                )}

                {/* Sentiment Indicator */}
                <div
                  className={`text-xs mt-2 ${
                    post.sentiment === 'positive'
                      ? 'text-emerald-700'
                      : post.sentiment === 'negative'
                        ? 'text-red-700'
                        : 'text-gray-600'
                  }`}
                >
                  Tone:{' '}
                  {post.sentiment.charAt(0).toUpperCase() +
                    post.sentiment.slice(1)}
                </div>
              </motion.article>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Footer - Print Credit */}
      <div className="border-t-4 border-black py-6 px-8 bg-black text-white">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-sm" style={{ fontFamily: 'Georgia, serif' }}>
            The Bluesky Chronicle • All Times Local • Real-time Social Network
            Analysis
          </p>
          <p className="text-xs text-gray-400 mt-2">
            "All the News That's Fit to Stream"
          </p>
        </div>
      </div>
    </div>
  );
}

export default Editorial;
