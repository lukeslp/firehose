import { integer, sqliteTable, text, real } from "drizzle-orm/sqlite-core";

/**
 * Core user table backing auth flow.
 */
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  openId: text("openId").notNull().unique(),
  name: text("name"),
  email: text("email"),
  loginMethod: text("loginMethod"),
  role: text("role", { enum: ["user", "admin"] }).default("user").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  lastSignedIn: integer("lastSignedIn", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Main posts table with enhanced metadata for corpus analysis
 */
export const posts = sqliteTable("posts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  text: text("text").notNull(),
  authorDid: text("authorDid"),
  authorHandle: text("authorHandle"),
  sentiment: text("sentiment", { enum: ["positive", "negative", "neutral"] }).notNull(),
  sentimentScore: real("sentimentScore").notNull(),
  timestamp: integer("timestamp", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  uri: text("uri").notNull().unique(),
  cid: text("cid"),
  replyParent: text("replyParent"),
  replyRoot: text("replyRoot"),
  embedType: text("embedType"),
  hasImages: integer("hasImages", { mode: "boolean" }).default(false),
  hasVideo: integer("hasVideo", { mode: "boolean" }).default(false),
  hasLink: integer("hasLink", { mode: "boolean" }).default(false),
  isQuote: integer("isQuote", { mode: "boolean" }).default(false),
  quoteUri: text("quoteUri"),
  language: text("language"),
  charCount: integer("charCount"),
  wordCount: integer("wordCount"),
  hashtags: text("hashtags"), // JSON array
  mentions: text("mentions"), // JSON array
  links: text("links"), // JSON array
  facets: text("facets"), // JSON array
  collectionWindow: text("collectionWindow"), // Collection time window (02:00, 08:00, 13:00, 19:00)
});

export type Post = typeof posts.$inferSelect;
export type InsertPost = typeof posts.$inferInsert;

/**
 * Hourly aggregations for time-series analysis
 */
export const statsHourly = sqliteTable("statsHourly", {
  hourTimestamp: integer("hourTimestamp", { mode: "timestamp" }).primaryKey(),
  postsCount: integer("postsCount").default(0).notNull(),
  positiveCount: integer("positiveCount").default(0).notNull(),
  negativeCount: integer("negativeCount").default(0).notNull(),
  neutralCount: integer("neutralCount").default(0).notNull(),
  avgSentiment: real("avgSentiment").default(0).notNull(),
  uniqueAuthors: integer("uniqueAuthors").default(0).notNull(),
});

export type StatsHourly = typeof statsHourly.$inferSelect;
export type InsertStatsHourly = typeof statsHourly.$inferInsert;

/**
 * Daily aggregations for historical trends
 */
export const statsDaily = sqliteTable("statsDaily", {
  date: integer("date", { mode: "timestamp" }).primaryKey(),
  postsCount: integer("postsCount").default(0).notNull(),
  positiveCount: integer("positiveCount").default(0).notNull(),
  negativeCount: integer("negativeCount").default(0).notNull(),
  neutralCount: integer("neutralCount").default(0).notNull(),
  avgSentiment: real("avgSentiment").default(0).notNull(),
  uniqueAuthors: integer("uniqueAuthors").default(0).notNull(),
});

export type StatsDaily = typeof statsDaily.$inferSelect;
export type InsertStatsDaily = typeof statsDaily.$inferInsert;

/**
 * Global all-time statistics
 */
export const statsGlobal = sqliteTable("statsGlobal", {
  id: integer("id").primaryKey().default(1),
  totalPosts: integer("totalPosts").default(0).notNull(),
  totalPositive: integer("totalPositive").default(0).notNull(),
  totalNegative: integer("totalNegative").default(0).notNull(),
  totalNeutral: integer("totalNeutral").default(0).notNull(),
  firstPostTimestamp: integer("firstPostTimestamp", { mode: "timestamp" }),
  lastPostTimestamp: integer("lastPostTimestamp", { mode: "timestamp" }),
});

export type StatsGlobal = typeof statsGlobal.$inferSelect;
export type InsertStatsGlobal = typeof statsGlobal.$inferInsert;

/**
 * Language statistics
 */
export const statsLanguage = sqliteTable("statsLanguage", {
  language: text("language").primaryKey(),
  postsCount: integer("postsCount").default(0).notNull(),
  positiveCount: integer("positiveCount").default(0).notNull(),
  negativeCount: integer("negativeCount").default(0).notNull(),
  neutralCount: integer("neutralCount").default(0).notNull(),
  lastUpdated: integer("lastUpdated", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export type StatsLanguage = typeof statsLanguage.$inferSelect;
export type InsertStatsLanguage = typeof statsLanguage.$inferInsert;

/**
 * Hashtag statistics
 */
export const statsHashtag = sqliteTable("statsHashtag", {
  hashtag: text("hashtag").primaryKey(),
  postsCount: integer("postsCount").default(0).notNull(),
  positiveCount: integer("positiveCount").default(0).notNull(),
  negativeCount: integer("negativeCount").default(0).notNull(),
  neutralCount: integer("neutralCount").default(0).notNull(),
  lastSeen: integer("lastSeen", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export type StatsHashtag = typeof statsHashtag.$inferSelect;
export type InsertStatsHashtag = typeof statsHashtag.$inferInsert;

/**
 * Author interaction matrix for network visualization
 */
export const authorInteractions = sqliteTable("authorInteractions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sourceDid: text("sourceDid").notNull(),
  targetDid: text("targetDid").notNull(),
  interactionType: text("interactionType").notNull(),
  count: integer("count").default(1).notNull(),
  lastInteraction: integer("lastInteraction", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export type AuthorInteraction = typeof authorInteractions.$inferSelect;
export type InsertAuthorInteraction = typeof authorInteractions.$inferInsert;

/**
 * Firehose sessions tracking
 */
export const sessions = sqliteTable("sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  startTime: integer("startTime", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  endTime: integer("endTime", { mode: "timestamp" }),
  postsProcessed: integer("postsProcessed").default(0).notNull(),
  keywordFilters: text("keywordFilters"), // JSON array
  status: text("status", { enum: ["running", "stopped"] }).default("running").notNull(),
});

export type Session = typeof sessions.$inferSelect;
export type InsertSession = typeof sessions.$inferInsert;
