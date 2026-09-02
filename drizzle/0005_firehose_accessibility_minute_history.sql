CREATE TABLE IF NOT EXISTS `statsMinuteAccessibility` (
	`minuteTimestamp` integer PRIMARY KEY NOT NULL,
	`imagePosts` integer DEFAULT 0 NOT NULL,
	`images` integer DEFAULT 0 NOT NULL,
	`imagesWithAlt` integer DEFAULT 0 NOT NULL,
	`fullyDescribedImagePosts` integer DEFAULT 0 NOT NULL,
	`altCharacters` integer DEFAULT 0 NOT NULL,
	`altWords` integer DEFAULT 0 NOT NULL
);
