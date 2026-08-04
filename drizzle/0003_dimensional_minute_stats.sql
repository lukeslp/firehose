CREATE TABLE `statsMinuteLanguage` (
	`minuteTimestamp` integer NOT NULL,
	`language` text NOT NULL,
	`postsCount` integer DEFAULT 0 NOT NULL,
	`positiveCount` integer DEFAULT 0 NOT NULL,
	`negativeCount` integer DEFAULT 0 NOT NULL,
	`neutralCount` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`minuteTimestamp`, `language`)
);
--> statement-breakpoint
CREATE TABLE `statsMinuteContentType` (
	`minuteTimestamp` integer NOT NULL,
	`contentType` text NOT NULL,
	`postsCount` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`minuteTimestamp`, `contentType`)
);
--> statement-breakpoint
CREATE TABLE `statsMinuteLabel` (
	`minuteTimestamp` integer NOT NULL,
	`label` text NOT NULL,
	`postsCount` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`minuteTimestamp`, `label`)
);
