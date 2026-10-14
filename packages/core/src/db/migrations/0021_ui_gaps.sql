ALTER TABLE `comments` ADD `options` text;--> statement-breakpoint
ALTER TABLE `comments` ADD `read_at` text;--> statement-breakpoint
ALTER TABLE `companies` ADD `city` text;--> statement-breakpoint
ALTER TABLE `ideas` ADD `money_note` text;--> statement-breakpoint
ALTER TABLE `opportunities` ADD `stage_since` text;--> statement-breakpoint
ALTER TABLE `own_projects` ADD `stage` text;--> statement-breakpoint
ALTER TABLE `people` ADD `influence` text;--> statement-breakpoint
ALTER TABLE `posts` ADD `format` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `idea_id` integer REFERENCES ideas(id);--> statement-breakpoint
CREATE INDEX `events_type_created` ON `events` (`type`,`created_at`);--> statement-breakpoint
UPDATE `opportunities` SET `stage_since` = COALESCE((SELECT MAX(`created_at`) FROM `events` WHERE `events`.`type` = 'opp.stage' AND `events`.`opportunity_id` = `opportunities`.`id`), `created_at`);--> statement-breakpoint
UPDATE `comments` SET `read_at` = `created_at` WHERE `created_by` = 'claude';
