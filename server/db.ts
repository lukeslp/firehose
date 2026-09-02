import { eq, desc, and, gte, lt, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import {
  InsertUser,
  users,
  posts,
  InsertPost,
  statsGlobal,
  statsMinute,
  statsMinuteLanguage,
  statsMinuteContentType,
  statsMinuteLabel,
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
let _connectionAttempted = false;

export async function getDb() {
  if (!_db && !_connectionAttempted && process.env.DATABASE_URL) {
    _connectionAttempted = true;
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
      _sqlite.exec(`
        CREATE TABLE IF NOT EXISTS statsMinute (
          minuteTimestamp INTEGER PRIMARY KEY NOT NULL,
          postsCount INTEGER DEFAULT 0 NOT NULL,
          positiveCount INTEGER DEFAULT 0 NOT NULL,
          negativeCount INTEGER DEFAULT 0 NOT NULL,
          neutralCount INTEGER DEFAULT 0 NOT NULL
        );
        CREATE TABLE IF NOT EXISTS statsMinuteLanguage (
          minuteTimestamp INTEGER NOT NULL,
          language TEXT NOT NULL,
          postsCount INTEGER DEFAULT 0 NOT NULL,
          positiveCount INTEGER DEFAULT 0 NOT NULL,
          negativeCount INTEGER DEFAULT 0 NOT NULL,
          neutralCount INTEGER DEFAULT 0 NOT NULL,
          PRIMARY KEY (minuteTimestamp, language)
        );
        CREATE TABLE IF NOT EXISTS statsMinuteContentType (
          minuteTimestamp INTEGER NOT NULL,
          contentType TEXT NOT NULL,
          postsCount INTEGER DEFAULT 0 NOT NULL,
          PRIMARY KEY (minuteTimestamp, contentType)
        );
        CREATE TABLE IF NOT EXISTS statsMinuteLabel (
          minuteTimestamp INTEGER NOT NULL,
          label TEXT NOT NULL,
          postsCount INTEGER DEFAULT 0 NOT NULL,
          PRIMARY KEY (minuteTimestamp, label)
        );
      `);
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

export type MinuteSentimentCounts = {
  total: number;
  positive: number;
  neutral: number;
  negative: number;
};

export type MinuteContentType = 'text' | 'image' | 'video' | 'link';

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

// === Minute history for the live dashboard ===

export async function upsertMinuteBucket(minuteTimestamp: Date, counts: MinuteSentimentCounts) {
  const db = await getDb();
  if (!db) return;

  await db.insert(statsMinute).values({
    minuteTimestamp,
    postsCount: counts.total,
    positiveCount: counts.positive,
    neutralCount: counts.neutral,
    negativeCount: counts.negative,
  }).onConflictDoUpdate({
    target: statsMinute.minuteTimestamp,
    set: {
      postsCount: counts.total,
      positiveCount: counts.positive,
      neutralCount: counts.neutral,
      negativeCount: counts.negative,
    },
  });
}

export async function getMinuteTimeline(minutes: number = 60) {
  const db = await getDb();
  if (!db) return [];
  const cutoff = new Date(Date.now() - minutes * 60_000);
  return db.select().from(statsMinute)
    .where(gte(statsMinute.minuteTimestamp, cutoff))
    .orderBy(statsMinute.minuteTimestamp);
}

export async function getMinuteCoverage() {
  const db = await getDb();
  if (!db) return { bucketCount: 0, minutesAvailable: 0, oldestTimestamp: null };

  const rows = await db.select({
    bucketCount: sql<number>`COUNT(*)`,
    oldestTs: sql<number | null>`MIN(${statsMinute.minuteTimestamp})`,
  }).from(statsMinute);
  const row = rows[0];
  const bucketCount = Number(row?.bucketCount ?? 0);
  const oldestTimestamp = row?.oldestTs == null ? null : new Date(Number(row.oldestTs) * 1000);
  const minutesAvailable = oldestTimestamp
    ? Math.max(0, Math.floor((Date.now() - oldestTimestamp.getTime()) / 60_000))
    : 0;

  return { bucketCount, minutesAvailable, oldestTimestamp };
}

export async function upsertMinuteBucketsByLanguage(
  minuteTimestamp: Date,
  buckets: Map<string, MinuteSentimentCounts>,
) {
  if (buckets.size === 0) return;
  const db = await getDb();
  if (!db) return;

  for (const [language, counts] of Array.from(buckets.entries())) {
    await db.insert(statsMinuteLanguage).values({
      minuteTimestamp,
      language,
      postsCount: counts.total,
      positiveCount: counts.positive,
      neutralCount: counts.neutral,
      negativeCount: counts.negative,
    }).onConflictDoUpdate({
      target: [statsMinuteLanguage.minuteTimestamp, statsMinuteLanguage.language],
      set: {
        postsCount: counts.total,
        positiveCount: counts.positive,
        neutralCount: counts.neutral,
        negativeCount: counts.negative,
      },
    });
  }
}

export async function upsertMinuteBucketsByContentType(
  minuteTimestamp: Date,
  buckets: Map<MinuteContentType, number>,
) {
  if (buckets.size === 0) return;
  const db = await getDb();
  if (!db) return;

  for (const [contentType, postsCount] of Array.from(buckets.entries())) {
    await db.insert(statsMinuteContentType).values({
      minuteTimestamp,
      contentType,
      postsCount,
    }).onConflictDoUpdate({
      target: [statsMinuteContentType.minuteTimestamp, statsMinuteContentType.contentType],
      set: { postsCount },
    });
  }
}

export async function upsertMinuteBucketsByLabel(minuteTimestamp: Date, buckets: Map<string, number>) {
  if (buckets.size === 0) return;
  const db = await getDb();
  if (!db) return;

  for (const [label, postsCount] of Array.from(buckets.entries())) {
    await db.insert(statsMinuteLabel).values({ minuteTimestamp, label, postsCount })
      .onConflictDoUpdate({
        target: [statsMinuteLabel.minuteTimestamp, statsMinuteLabel.label],
        set: { postsCount },
      });
  }
}

export async function getMinuteTimelineByLanguage(minutes: number = 60, top: number = 10) {
  const db = await getDb();
  if (!db) return [];
  const cutoff = new Date(Date.now() - minutes * 60_000);
  const topRows = await db.select({
    language: statsMinuteLanguage.language,
    total: sql<number>`SUM(${statsMinuteLanguage.postsCount})`,
  }).from(statsMinuteLanguage)
    .where(gte(statsMinuteLanguage.minuteTimestamp, cutoff))
    .groupBy(statsMinuteLanguage.language)
    .orderBy(desc(sql`SUM(${statsMinuteLanguage.postsCount})`))
    .limit(top);
  const selected = new Set(topRows.map(row => row.language));
  if (selected.size === 0) return [];
  const rows = await db.select().from(statsMinuteLanguage)
    .where(gte(statsMinuteLanguage.minuteTimestamp, cutoff))
    .orderBy(statsMinuteLanguage.minuteTimestamp);

  return Array.from(selected).map(language => ({
    language,
    series: rows.filter(row => row.language === language).map(row => ({
      minuteTimestamp: row.minuteTimestamp,
      postsCount: row.postsCount,
      positiveCount: row.positiveCount,
      neutralCount: row.neutralCount,
      negativeCount: row.negativeCount,
    })),
  }));
}

export async function getMinuteTimelineByContentType(minutes: number = 60) {
  const db = await getDb();
  if (!db) return [];
  const cutoff = new Date(Date.now() - minutes * 60_000);
  const rows = await db.select().from(statsMinuteContentType)
    .where(gte(statsMinuteContentType.minuteTimestamp, cutoff))
    .orderBy(statsMinuteContentType.minuteTimestamp);
  const grouped = new Map<string, Array<{ minuteTimestamp: Date; postsCount: number }>>();
  for (const row of rows) {
    const series = grouped.get(row.contentType) ?? [];
    series.push({ minuteTimestamp: row.minuteTimestamp, postsCount: row.postsCount });
    grouped.set(row.contentType, series);
  }
  return Array.from(grouped.entries()).map(([contentType, series]) => ({ contentType, series }));
}

export async function getMinuteTimelineByLabel(minutes: number = 60, top: number = 10) {
  const db = await getDb();
  if (!db) return [];
  const cutoff = new Date(Date.now() - minutes * 60_000);
  const topRows = await db.select({
    label: statsMinuteLabel.label,
    total: sql<number>`SUM(${statsMinuteLabel.postsCount})`,
  }).from(statsMinuteLabel)
    .where(gte(statsMinuteLabel.minuteTimestamp, cutoff))
    .groupBy(statsMinuteLabel.label)
    .orderBy(desc(sql`SUM(${statsMinuteLabel.postsCount})`))
    .limit(top);
  const selected = new Set(topRows.map(row => row.label));
  if (selected.size === 0) return [];
  const rows = await db.select().from(statsMinuteLabel)
    .where(gte(statsMinuteLabel.minuteTimestamp, cutoff))
    .orderBy(statsMinuteLabel.minuteTimestamp);

  return Array.from(selected).map(label => ({
    label,
    series: rows.filter(row => row.label === label).map(row => ({
      minuteTimestamp: row.minuteTimestamp,
      postsCount: row.postsCount,
    })),
  }));
}

export async function purgeOldMinuteBuckets(retentionHours: number = 48) {
  const db = await getDb();
  if (!db) return;
  const cutoff = new Date(Date.now() - retentionHours * 60 * 60_000);
  await Promise.all([
    db.delete(statsMinute).where(lt(statsMinute.minuteTimestamp, cutoff)),
    db.delete(statsMinuteLanguage).where(lt(statsMinuteLanguage.minuteTimestamp, cutoff)),
    db.delete(statsMinuteContentType).where(lt(statsMinuteContentType.minuteTimestamp, cutoff)),
    db.delete(statsMinuteLabel).where(lt(statsMinuteLabel.minuteTimestamp, cutoff)),
  ]);
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
