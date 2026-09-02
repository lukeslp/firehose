CREATE TABLE IF NOT EXISTS `statsMinute` (
	`minuteTimestamp` integer PRIMARY KEY NOT NULL,
	`postsCount` integer DEFAULT 0 NOT NULL,
	`positiveCount` integer DEFAULT 0 NOT NULL,
	`negativeCount` integer DEFAULT 0 NOT NULL,
	`neutralCount` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `statsMinuteLanguage` (
	`minuteTimestamp` integer NOT NULL,
	`language` text NOT NULL,
	`postsCount` integer DEFAULT 0 NOT NULL,
	`positiveCount` integer DEFAULT 0 NOT NULL,
	`negativeCount` integer DEFAULT 0 NOT NULL,
	`neutralCount` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`minuteTimestamp`, `language`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `statsMinuteContentType` (
	`minuteTimestamp` integer NOT NULL,
	`contentType` text NOT NULL,
	`postsCount` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`minuteTimestamp`, `contentType`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `statsMinuteLabel` (
	`minuteTimestamp` integer NOT NULL,
	`label` text NOT NULL,
	`postsCount` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`minuteTimestamp`, `label`)
);
