CREATE TABLE `idea_people` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_by` text NOT NULL,
	`idea_id` integer NOT NULL,
	`person_id` integer NOT NULL,
	`interest` text DEFAULT 'anlatildi' NOT NULL,
	`note` text,
	`touch_id` integer,
	FOREIGN KEY (`idea_id`) REFERENCES `ideas`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`touch_id`) REFERENCES `touches`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idea_people_pair` ON `idea_people` (`idea_id`,`person_id`);--> statement-breakpoint
CREATE INDEX `idea_people_person` ON `idea_people` (`person_id`);--> statement-breakpoint
CREATE TABLE `idea_sectors` (
	`idea_id` integer NOT NULL,
	`sector_id` integer NOT NULL,
	`created_at` text NOT NULL,
	`created_by` text NOT NULL,
	PRIMARY KEY(`idea_id`, `sector_id`),
	FOREIGN KEY (`idea_id`) REFERENCES `ideas`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sector_id`) REFERENCES `sectors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `ideas` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_by` text NOT NULL,
	`title` text NOT NULL,
	`problem` text,
	`stage` text DEFAULT 'fikir' NOT NULL,
	`notes` text
);
--> statement-breakpoint
CREATE TABLE `posts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_by` text NOT NULL,
	`platform` text NOT NULL,
	`title` text NOT NULL,
	`url` text,
	`body` text,
	`posted_at` text NOT NULL,
	`refresh_days` integer,
	`refreshed_at` text,
	`idea_id` integer,
	`notes` text,
	FOREIGN KEY (`idea_id`) REFERENCES `ideas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `posts_posted` ON `posts` (`posted_at`);--> statement-breakpoint
CREATE TABLE `templates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_by` text NOT NULL,
	`name` text NOT NULL,
	`kind` text DEFAULT 'ilk' NOT NULL,
	`channel` text,
	`sector_id` integer,
	`body` text NOT NULL,
	FOREIGN KEY (`sector_id`) REFERENCES `sectors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `drafts` ADD `template_id` integer REFERENCES templates(id);--> statement-breakpoint
ALTER TABLE `drafts` ADD `followup_step` integer;--> statement-breakpoint
ALTER TABLE `people` ADD `post_id` integer REFERENCES posts(id);--> statement-breakpoint
CREATE INDEX `people_post` ON `people` (`post_id`);--> statement-breakpoint
ALTER TABLE `touches` ADD `idea_id` integer REFERENCES ideas(id);