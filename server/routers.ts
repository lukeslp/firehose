import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { posts } from "../drizzle/schema";
import {
  getRecentPosts,
  getGlobalStats,
  getPostsCount,
  getTopLanguages,
  getTopHashtags,
  getRecentHourlyStats,
  getPostsInTimeRange,
  getDb
} from "./db";
import { getFirehoseService } from "./firehose";

const firehoseService = getFirehoseService();

export const appRouter = router({
  system: systemRouter,
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  firehose: router({
    // Get current statistics
    stats: publicProcedure.query(async () => {
      const stats = firehoseService.getStats();
      const postsCount = await getPostsCount();
      
      return {
        ...stats,
        inDatabase: postsCount,
      };
    }),

    // Export posts as CSV
    exportCSV: publicProcedure
      .input(z.object({
        sentiment: z.enum(['positive', 'negative', 'neutral']).optional(),
        language: z.string().optional(),
        limit: z.number().default(1000),
      }).optional())
      .query(async ({ input }) => {
        const filters = input || { limit: 1000 };
        const posts = await getRecentPosts(filters.limit || 1000, filters.sentiment);
        
        // Filter by language if specified
        const filteredPosts = filters.language
          ? posts.filter(p => p.language === filters.language)
          : posts;
        
        // Generate CSV header
        const headers = [
          'Timestamp',
          'Author Handle',
          'Text',
          'Sentiment',
          'Sentiment Score',
          'Language',
          'Hashtags',
          'Has Images',
          'Has Video',
          'Has Link',
          'URI'
        ];
        
        // Generate CSV rows
        const rows = filteredPosts.map(post => [
          post.timestamp?.toISOString() || '',
          post.authorHandle || '',
          `"${(post.text || '').replace(/"/g, '""')}"`, // Escape quotes
          post.sentiment || '',
          post.sentimentScore?.toString() || '',
          post.language || '',
          `"${(post.hashtags || '').replace(/"/g, '""')}"`,
          post.hasImages ? 'Yes' : 'No',
          post.hasVideo ? 'Yes' : 'No',
          post.hasLink ? 'Yes' : 'No',
          post.uri || ''
        ]);
        
        // Combine into CSV string
        const csv = [headers, ...rows]
          .map(row => row.join(','))
          .join('\n');
        
        return {
          csv,
          count: filteredPosts.length,
        };
      }),

    // Get recent posts from memory
    recentPosts: publicProcedure
      .input(z.object({
        limit: z.number().min(1).max(100).default(50),
      }))
      .query(({ input }) => {
        return firehoseService.getRecentPosts(input.limit);
      }),

    // Get timeline data for last 60 minutes (for chart initialization)
    timelineData: publicProcedure.query(async () => {
      const now = new Date();
      const sixtyMinutesAgo = new Date(now.getTime() - 60 * 60 * 1000);

      const posts = await getPostsInTimeRange(sixtyMinutesAgo, now);

      // Return only timestamp and sentiment to minimize payload
      return posts.map(post => ({
        timestamp: post.timestamp?.getTime() || Date.now(),
        sentiment: post.sentiment as 'positive' | 'negative' | 'neutral'
      }));
    }),
  }),

  posts: router({
    // Get posts from database
    list: publicProcedure
      .input(z.object({
        limit: z.number().min(1).max(100).default(50),
        sentiment: z.enum(['positive', 'negative', 'neutral']).optional(),
      }))
      .query(async ({ input }) => {
        return await getRecentPosts(input.limit, input.sentiment);
      }),
  }),

  stats: router({
    // Get global statistics
    global: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) return { totalPosts: 0, totalPositive: 0, totalNegative: 0, totalNeutral: 0 };
      
      // Get actual count from posts table
      const countResult = await db.select({ count: sql`COUNT(*)` }).from(posts);
      const totalPosts = Number(countResult[0]?.count || 0);
      
      // Get sentiment counts
      const sentimentCounts = await db.select({
        sentiment: posts.sentiment,
        count: sql`COUNT(*)`
      }).from(posts).groupBy(posts.sentiment);
      
      const stats = {
        totalPosts,
        totalPositive: sentimentCounts.find(s => s.sentiment === 'positive')?.count || 0,
        totalNegative: sentimentCounts.find(s => s.sentiment === 'negative')?.count || 0,
        totalNeutral: sentimentCounts.find(s => s.sentiment === 'neutral')?.count || 0,
      };
      
      return stats;
    }),

    // Get hourly statistics
    hourly: publicProcedure
      .input(z.object({
        hours: z.number().min(1).max(168).default(24),
      }))
      .query(async ({ input }) => {
        return await getRecentHourlyStats(input.hours);
      }),

    // Get top languages
    languages: publicProcedure
      .input(z.object({
        limit: z.number().min(1).max(50).default(10),
      }))
      .query(async ({ input }) => {
        return await getTopLanguages(input.limit);
      }),

    // Get top hashtags
    hashtags: publicProcedure
      .input(z.object({
        limit: z.number().min(1).max(50).default(20),
      }))
      .query(async ({ input }) => {
        return await getTopHashtags(input.limit);
      }),

    // Get content type breakdown
    contentTypes: publicProcedure.query(async () => {
      const stats = firehoseService.getStats();
      const recentPosts = firehoseService.getRecentPosts(1000);
      
      let textOnly = 0;
      let withImages = 0;
      let withVideo = 0;
      let withLinks = 0;
      let totalChars = 0;
      let totalWords = 0;
      
      recentPosts.forEach(post => {
        totalChars += post.text.length;
        totalWords += post.text.split(/\s+/).length;
        
        if (post.hasVideo) withVideo++;
        else if (post.hasImages) withImages++;
        else if (post.hasLink) withLinks++;
        else textOnly++;
      });
      
      return {
        textOnly,
        withImages,
        withVideo,
        withLinks,
        avgPostLength: recentPosts.length > 0 ? Math.round(totalChars / recentPosts.length) : 0,
        avgWordCount: recentPosts.length > 0 ? Math.round(totalWords / recentPosts.length) : 0,
      };
    }),

    // Get sentiment by keyword/topic
    sentimentByKeyword: publicProcedure
      .input(z.object({
        keyword: z.string().min(1),
      }))
      .query(async ({ input }) => {
        const recentPosts = firehoseService.getRecentPosts(1000);
        const keyword = input.keyword.toLowerCase();
        
        const filtered = recentPosts.filter(post => 
          post.text.toLowerCase().includes(keyword)
        );
        
        let positive = 0;
        let negative = 0;
        let neutral = 0;
        let totalChars = 0;
        let totalWords = 0;
        
        filtered.forEach(post => {
          if (post.sentiment === 'positive') positive++;
          else if (post.sentiment === 'negative') negative++;
          else neutral++;
          
          totalChars += post.text.length;
          totalWords += post.text.split(/\s+/).length;
        });
        
        return {
          keyword,
          totalPosts: filtered.length,
          sentimentCounts: { positive, negative, neutral },
          avgPostLength: filtered.length > 0 ? Math.round(totalChars / filtered.length) : 0,
          avgWordCount: filtered.length > 0 ? Math.round(totalWords / filtered.length) : 0,
          recentPosts: filtered.slice(0, 20),
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;
