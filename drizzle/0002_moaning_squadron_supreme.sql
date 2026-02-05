CREATE INDEX `idx_posts_timestamp` ON `posts` (`timestamp`);--> statement-breakpoint
CREATE INDEX `idx_posts_sentiment` ON `posts` (`sentiment`);--> statement-breakpoint
CREATE INDEX `idx_posts_language` ON `posts` (`language`);--> statement-breakpoint
CREATE INDEX `idx_posts_collection_window` ON `posts` (`collectionWindow`);--> statement-breakpoint
CREATE INDEX `idx_posts_author_did` ON `posts` (`authorDid`);--> statement-breakpoint
CREATE INDEX `idx_posts_timestamp_sentiment` ON `posts` (`timestamp`,`sentiment`);--> statement-breakpoint
CREATE INDEX `idx_posts_corpus` ON `posts` (`timestamp`,`language`,`collectionWindow`);