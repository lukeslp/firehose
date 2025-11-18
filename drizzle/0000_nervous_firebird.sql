CREATE TABLE `authorInteractions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sourceDid` text NOT NULL,
	`targetDid` text NOT NULL,
	`interactionType` text NOT NULL,
	`count` integer DEFAULT 1 NOT NULL,
	`lastInteraction` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `posts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`text` text NOT NULL,
	`authorDid` text,
	`authorHandle` text,
	`sentiment` text NOT NULL,
	`sentimentScore` real NOT NULL,
	`timestamp` integer NOT NULL,
	`createdAt` integer NOT NULL,
	`uri` text NOT NULL,
	`cid` text,
	`replyParent` text,
	`replyRoot` text,
	`embedType` text,
	`hasImages` integer DEFAULT false,
	`hasVideo` integer DEFAULT false,
	`hasLink` integer DEFAULT false,
	`isQuote` integer DEFAULT false,
	`quoteUri` text,
	`language` text,
	`charCount` integer,
	`wordCount` integer,
	`hashtags` text,
	`mentions` text,
	`links` text,
	`facets` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `posts_uri_unique` ON `posts` (`uri`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`startTime` integer NOT NULL,
	`endTime` integer,
	`postsProcessed` integer DEFAULT 0 NOT NULL,
	`keywordFilters` text,
	`status` text DEFAULT 'running' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `statsDaily` (
	`date` integer PRIMARY KEY NOT NULL,
	`postsCount` integer DEFAULT 0 NOT NULL,
	`positiveCount` integer DEFAULT 0 NOT NULL,
	`negativeCount` integer DEFAULT 0 NOT NULL,
	`neutralCount` integer DEFAULT 0 NOT NULL,
	`avgSentiment` real DEFAULT 0 NOT NULL,
	`uniqueAuthors` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `statsGlobal` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`totalPosts` integer DEFAULT 0 NOT NULL,
	`totalPositive` integer DEFAULT 0 NOT NULL,
	`totalNegative` integer DEFAULT 0 NOT NULL,
	`totalNeutral` integer DEFAULT 0 NOT NULL,
	`firstPostTimestamp` integer,
	`lastPostTimestamp` integer
);
--> statement-breakpoint
CREATE TABLE `statsHashtag` (
	`hashtag` text PRIMARY KEY NOT NULL,
	`postsCount` integer DEFAULT 0 NOT NULL,
	`positiveCount` integer DEFAULT 0 NOT NULL,
	`negativeCount` integer DEFAULT 0 NOT NULL,
	`neutralCount` integer DEFAULT 0 NOT NULL,
	`lastSeen` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `statsHourly` (
	`hourTimestamp` integer PRIMARY KEY NOT NULL,
	`postsCount` integer DEFAULT 0 NOT NULL,
	`positiveCount` integer DEFAULT 0 NOT NULL,
	`negativeCount` integer DEFAULT 0 NOT NULL,
	`neutralCount` integer DEFAULT 0 NOT NULL,
	`avgSentiment` real DEFAULT 0 NOT NULL,
	`uniqueAuthors` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `statsLanguage` (
	`language` text PRIMARY KEY NOT NULL,
	`postsCount` integer DEFAULT 0 NOT NULL,
	`positiveCount` integer DEFAULT 0 NOT NULL,
	`negativeCount` integer DEFAULT 0 NOT NULL,
	`neutralCount` integer DEFAULT 0 NOT NULL,
	`lastUpdated` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`openId` text NOT NULL,
	`name` text,
	`email` text,
	`loginMethod` text,
	`role` text DEFAULT 'user' NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`lastSignedIn` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_openId_unique` ON `users` (`openId`);