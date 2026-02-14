/**
 * DashboardPro.tsx - Professional analytics dashboard variant
 *
 * Aesthetic: Bloomberg Terminal meets Tableau
 * Theme: Data-dense, charts, metrics, professional
 * Typography: System fonts, clear hierarchy
 * Layout: Grid of panels, real-time charts, compact info
 */

import { useSocket } from '@/hooks/useSocket';
import { useState, useEffect, useMemo } from 'react';
import type { FirehosePost, VariantProps } from './types';
import { MediaDisplay } from '@/components/MediaDisplay';

export function DashboardPro({ className }: VariantProps) {
  const { connected, stats, latestPost } = useSocket();
  const [posts, setPosts] = useState<FirehosePost[]>([]);
  const maxPosts = 50; // More posts for data-dense view

  // Filter state
  const [selectedLanguage, setSelectedLanguage] = useState<string>('all');
  const [keywordFilter, setKeywordFilter] = useState<string>('');

  // Analytics state
  const [postsPerSecond, setPostsPerSecond] = useState<number[]>([]);

  // Update posts feed
  useEffect(() => {
    if (latestPost) {
      setPosts(prev => [latestPost, ...prev].slice(0, maxPosts));

      // Track posts per second for sparkline
      const now = Math.floor(Date.now() / 1000);
      setPostsPerSecond(prev => {
        const updated = [...prev];
        updated[now] = (updated[now] || 0) + 1;
        // Keep last 60 seconds
        const cutoff = now - 60;
        Object.keys(updated).forEach(key => {
          if (parseInt(key) < cutoff) delete updated[parseInt(key)];
        });
        return updated;
      });
    }
  }, [latestPost, maxPosts]);

  // Filter posts
  const filteredPosts = useMemo(() => {
    return posts.filter(post => {
      if (selectedLanguage !== 'all' && post.language !== selectedLanguage) {
        return false;
      }
      if (keywordFilter && !post.text.toLowerCase().includes(keywordFilter.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [posts, selectedLanguage, keywordFilter]);

  // Analytics calculations
  const analytics = useMemo(() => {
    const positive = filteredPosts.filter(p => p.sentiment === 'positive').length;
    const negative = filteredPosts.filter(p => p.sentiment === 'negative').length;
    const neutral = filteredPosts.filter(p => p.sentiment === 'neutral').length;
    const total = filteredPosts.length || 1;

    const withMedia = filteredPosts.filter(p => p.hasImages || p.hasVideo).length;
    const withLinks = filteredPosts.filter(p => p.hasLink).length;
    const replies = filteredPosts.filter(p => p.isReply).length;

    return {
      sentimentPercent: {
        positive: ((positive / total) * 100).toFixed(1),
        negative: ((negative / total) * 100).toFixed(1),
        neutral: ((neutral / total) * 100).toFixed(1),
      },
      mediaPercent: ((withMedia / total) * 100).toFixed(1),
      linksPercent: ((withLinks / total) * 100).toFixed(1),
      repliesPercent: ((replies / total) * 100).toFixed(1),
    };
  }, [filteredPosts]);

  const getSentimentColor = (sentiment: string): string => {
    switch (sentiment) {
      case 'positive':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'negative':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'neutral':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  return (
    <div
      className={`dashboard-pro min-h-screen bg-gray-100 text-gray-900 ${className || ''}`}
    >
      {/* Top Bar */}
      <header className="bg-gray-900 text-white sticky top-0 z-10 shadow-lg">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-lg font-bold tracking-tight">
                BLUESKY ANALYTICS PRO
              </h1>
              <div className="flex items-center gap-2 text-xs">
                <div
                  className={`w-2 h-2 rounded-full ${
                    connected ? 'bg-green-500' : 'bg-red-500'
                  } animate-pulse`}
                />
                <span className="uppercase tracking-wider">
                  {connected ? 'LIVE' : 'OFFLINE'}
                </span>
              </div>
            </div>
            <div className="text-xs text-gray-400">
              {new Date().toLocaleString()}
            </div>
          </div>
        </div>
      </header>

      {/* Main Dashboard Grid */}
      <main className="p-4">
        {/* KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-4">
          {/* Total Posts */}
          <div className="bg-white p-4 shadow">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">
              Total Posts
            </div>
            <div className="text-2xl font-bold tabular-nums text-gray-900">
              {(stats?.totalPosts || 0).toLocaleString()}
            </div>
            <div className="text-xs text-green-600 mt-1">
              ↑ {Math.round(stats?.postsPerMinute || 0)}/min
            </div>
          </div>

          {/* Filtered View */}
          <div className="bg-white p-4 shadow">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">
              Filtered
            </div>
            <div className="text-2xl font-bold tabular-nums text-gray-900">
              {filteredPosts.length}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {((filteredPosts.length / posts.length) * 100 || 0).toFixed(1)}% visible
            </div>
          </div>

          {/* Positive Sentiment */}
          <div className="bg-white p-4 shadow">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">
              Positive
            </div>
            <div className="text-2xl font-bold tabular-nums text-green-600">
              {analytics.sentimentPercent.positive}%
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {stats?.sentimentCounts?.positive || 0} posts
            </div>
          </div>

          {/* Negative Sentiment */}
          <div className="bg-white p-4 shadow">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">
              Negative
            </div>
            <div className="text-2xl font-bold tabular-nums text-red-600">
              {analytics.sentimentPercent.negative}%
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {stats?.sentimentCounts?.negative || 0} posts
            </div>
          </div>

          {/* Media Posts */}
          <div className="bg-white p-4 shadow">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">
              Media
            </div>
            <div className="text-2xl font-bold tabular-nums text-purple-600">
              {analytics.mediaPercent}%
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Images/Videos
            </div>
          </div>

          {/* Engagement */}
          <div className="bg-white p-4 shadow">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">
              Replies
            </div>
            <div className="text-2xl font-bold tabular-nums text-blue-600">
              {analytics.repliesPercent}%
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Conversations
            </div>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="bg-white p-4 shadow mb-4">
          <div className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3">
            Filters
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Language */}
            <div>
              <label className="text-xs text-gray-600 block mb-1">Language</label>
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className="w-full px-2 py-1.5 bg-white border border-gray-300 text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="all">All Languages</option>
                <option value="en">EN</option>
                <option value="es">ES</option>
                <option value="fr">FR</option>
                <option value="de">DE</option>
                <option value="ja">JA</option>
                <option value="pt">PT</option>
              </select>
            </div>

            {/* Keyword */}
            <div>
              <label className="text-xs text-gray-600 block mb-1">Keyword</label>
              <input
                type="text"
                value={keywordFilter}
                onChange={(e) => setKeywordFilter(e.target.value)}
                placeholder="Filter..."
                className="w-full px-2 py-1.5 bg-white border border-gray-300 text-sm placeholder:text-gray-400 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Posts Table */}
        <div className="bg-white shadow">
          <div className="p-3 border-b border-gray-200 flex items-center justify-between">
            <div className="text-xs font-bold text-gray-700 uppercase tracking-wider">
              Live Feed
            </div>
            <div className="text-xs text-gray-500">
              Showing {filteredPosts.length} of {posts.length}
            </div>
          </div>
          <div className="overflow-auto max-h-[600px]">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Time
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Author
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Content
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Sentiment
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Meta
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredPosts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-gray-400 text-sm">
                      No posts match your filters
                    </td>
                  </tr>
                ) : (
                  filteredPosts.map((post, index) => (
                    <tr key={post.uri || index} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-xs text-gray-500 tabular-nums whitespace-nowrap">
                        {new Date(post.createdAt).toLocaleTimeString()}
                      </td>
                      <td className="px-3 py-2 text-xs font-medium text-gray-900 whitespace-nowrap">
                        @{(post.author?.handle || 'anon').slice(0, 15)}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-700 max-w-md">
                        <div className="line-clamp-2 mb-1">{post.text}</div>
                        {(post.images || post.videos) && (
                          <MediaDisplay
                            images={post.images}
                            videos={post.videos}
                            variant="compact"
                            sensitive={post.sensitive}
                            className="mt-1"
                          />
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 text-xs font-medium rounded border ${getSentimentColor(
                            post.sentiment
                          )}`}
                        >
                          {post.sentiment}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">
                        <div className="flex gap-2">
                          {post.hasImages && <span title="Has images">🖼️</span>}
                          {post.hasVideo && <span title="Has video">🎥</span>}
                          {post.hasLink && <span title="Has link">🔗</span>}
                          {post.isReply && <span title="Reply">💬</span>}
                          {post.images?.some(img => !img.alt) && (
                            <span title="Missing alt text" className="text-red-600">⚠️</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

export default DashboardPro;
