import { eq, desc, and, gte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import {
  InsertUser,
  users,
  posts,
  InsertPost,
  statsGlobal,
  statsHourly,
  statsDaily,
  statsLanguage,
  statsHashtag,
  authorInteractions,
  sessions,
  InsertSession
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;
let _sqlite: Database.Database | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const dbPath = process.env.DATABASE_URL;
      console.log("[Database] Connecting to SQLite at:", dbPath);
      _sqlite = new Database(dbPath);

      // Enable WAL mode for better concurrent read/write performance
      // Critical for 5M posts/day throughput
      _sqlite.pragma('journal_mode = WAL');
      _sqlite.pragma('synchronous = NORMAL');
      _sqlite.pragma('cache_size = -64000'); // 64MB cache
      _sqlite.pragma('temp_store = MEMORY');
      console.log("[Database] WAL mode enabled for high-throughput writes");

      _db = drizzle(_sqlite);
      console.log("[Database] Connected successfully");
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
      _sqlite = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Partial<InsertUser> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onConflictDoUpdate({
      target: users.openId,
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// === Posts Management ===

export async function insertPost(post: InsertPost) {
  const db = await getDb();
  if (!db) return null;

  try {
    // Use onConflictDoNothing to silently skip duplicates
    await db.insert(posts).values(post).onConflictDoNothing();
    return post;
  } catch (error) {
    console.error("[Database] Failed to insert post:", error);
    throw error;
  }
}

export async function getRecentPosts(limit: number = 50, sentiment?: string) {
  const db = await getDb();
  if (!db) return [];

  if (sentiment && ['positive', 'negative', 'neutral'].includes(sentiment)) {
    return await db.select().from(posts)
      .where(eq(posts.sentiment, sentiment as any))
      .orderBy(desc(posts.timestamp))
      .limit(limit);
  }

  return await db.select().from(posts).orderBy(desc(posts.timestamp)).limit(limit);
}

export async function getPostsInTimeRange(startTime: Date, endTime: Date) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(posts)
    .where(and(
      gte(posts.timestamp, startTime),
      sql`${posts.timestamp} <= ${endTime}`
    ))
    .orderBy(desc(posts.timestamp));
}

// === Global Statistics ===

export async function getGlobalStats() {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(statsGlobal).where(eq(statsGlobal.id, 1)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getPostsCount() {
  const db = await getDb();
  if (!db) return 0;

  try {
    const result = await db.select({ count: sql<number>`count(*)` }).from(posts);
    return result[0]?.count || 0;
  } catch (error) {
    console.error("[Database] Failed to count posts:", error);
    return 0;
  }
}

export async function updateGlobalStats(stats: {
  totalPosts?: number;
  totalPositive?: number;
  totalNegative?: number;
  totalNeutral?: number;
  lastPostTimestamp?: Date;
}) {
  const db = await getDb();
  if (!db) return;

  const existing = await getGlobalStats();
  
  if (!existing) {
    await db.insert(statsGlobal).values({
      id: 1,
      totalPosts: stats.totalPosts || 0,
      totalPositive: stats.totalPositive || 0,
      totalNegative: stats.totalNegative || 0,
      totalNeutral: stats.totalNeutral || 0,
      firstPostTimestamp: stats.lastPostTimestamp,
      lastPostTimestamp: stats.lastPostTimestamp,
    });
  } else {
    await db.update(statsGlobal)
      .set({
        totalPosts: stats.totalPosts !== undefined ? stats.totalPosts : existing.totalPosts,
        totalPositive: stats.totalPositive !== undefined ? stats.totalPositive : existing.totalPositive,
        totalNegative: stats.totalNegative !== undefined ? stats.totalNegative : existing.totalNegative,
        totalNeutral: stats.totalNeutral !== undefined ? stats.totalNeutral : existing.totalNeutral,
        lastPostTimestamp: stats.lastPostTimestamp || existing.lastPostTimestamp,
      })
      .where(eq(statsGlobal.id, 1));
  }
}

// === Hourly Statistics ===

export async function getRecentHourlyStats(hours: number = 24) {
  const db = await getDb();
  if (!db) return [];

  const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
  
  return await db.select().from(statsHourly)
    .where(gte(statsHourly.hourTimestamp, cutoffTime))
    .orderBy(statsHourly.hourTimestamp);
}

// === Language Statistics ===

export async function getTopLanguages(limit: number = 10) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(statsLanguage)
    .orderBy(desc(statsLanguage.postsCount))
    .limit(limit);
}

export async function updateLanguageStats(language: string, sentiment: string) {
  const db = await getDb();
  if (!db) return;

  const existing = await db.select().from(statsLanguage)
    .where(eq(statsLanguage.language, language))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(statsLanguage).values({
      language,
      postsCount: 1,
      positiveCount: sentiment === 'positive' ? 1 : 0,
      negativeCount: sentiment === 'negative' ? 1 : 0,
      neutralCount: sentiment === 'neutral' ? 1 : 0,
      lastUpdated: new Date(),
    });
  } else {
    const current = existing[0];
    await db.update(statsLanguage)
      .set({
        postsCount: current.postsCount + 1,
        positiveCount: current.positiveCount + (sentiment === 'positive' ? 1 : 0),
        negativeCount: current.negativeCount + (sentiment === 'negative' ? 1 : 0),
        neutralCount: current.neutralCount + (sentiment === 'neutral' ? 1 : 0),
        lastUpdated: new Date(),
      })
      .where(eq(statsLanguage.language, language));
  }
}

// === Hashtag Statistics ===

export async function getTopHashtags(limit: number = 20) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(statsHashtag)
    .orderBy(desc(statsHashtag.postsCount))
    .limit(limit);
}

export async function updateHashtagStats(hashtag: string, sentiment: string) {
  const db = await getDb();
  if (!db) return;

  const existing = await db.select().from(statsHashtag)
    .where(eq(statsHashtag.hashtag, hashtag))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(statsHashtag).values({
      hashtag,
      postsCount: 1,
      positiveCount: sentiment === 'positive' ? 1 : 0,
      negativeCount: sentiment === 'negative' ? 1 : 0,
      neutralCount: sentiment === 'neutral' ? 1 : 0,
      lastSeen: new Date(),
    });
  } else {
    const current = existing[0];
    await db.update(statsHashtag)
      .set({
        postsCount: current.postsCount + 1,
        positiveCount: current.positiveCount + (sentiment === 'positive' ? 1 : 0),
        negativeCount: current.negativeCount + (sentiment === 'negative' ? 1 : 0),
        neutralCount: current.neutralCount + (sentiment === 'neutral' ? 1 : 0),
        lastSeen: new Date(),
      })
      .where(eq(statsHashtag.hashtag, hashtag));
  }
}

// === Session Management ===

export async function createSession(filters?: string[]) {
  const db = await getDb();
  if (!db) return null;

  const session: InsertSession = {
    startTime: new Date(),
    postsProcessed: 0,
    keywordFilters: filters ? JSON.stringify(filters) : null,
    status: 'running',
  };

  const result = await db.insert(sessions).values(session);
  return result;
}

export async function updateSession(sessionId: number, data: {
  postsProcessed?: number;
  status?: 'running' | 'stopped';
  endTime?: Date;
}) {
  const db = await getDb();
  if (!db) return;

  await db.update(sessions)
    .set(data)
    .where(eq(sessions.id, sessionId));
}

export async function getActiveSession() {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(sessions)
    .where(eq(sessions.status, 'running'))
    .orderBy(desc(sessions.startTime))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}
