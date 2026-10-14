ALTER TABLE `comments` ADD `options` text;--> statement-breakpoint
ALTER TABLE `comments` ADD `read_at` text;--> statement-breakpoint
ALTER TABLE `ideas` ADD `money_note` text;--> statement-breakpoint
ALTER TABLE `own_projects` ADD `stage` text;--> statement-breakpoint
ALTER TABLE `posts` ADD `format` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `idea_id` integer REFERENCES ideas(id);--> statement-breakpoint
UPDATE `comments` SET `read_at` = `created_at` WHERE `created_by` = 'claude';