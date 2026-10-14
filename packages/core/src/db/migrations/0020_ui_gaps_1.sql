ALTER TABLE `companies` ADD `city` text;--> statement-breakpoint
ALTER TABLE `opportunities` ADD `stage_since` text;--> statement-breakpoint
ALTER TABLE `people` ADD `influence` text;--> statement-breakpoint
CREATE INDEX `events_type_created` ON `events` (`type`,`created_at`);--> statement-breakpoint
UPDATE `opportunities` SET `stage_since` = COALESCE((SELECT MAX(`created_at`) FROM `events` WHERE `events`.`type` = 'opp.stage' AND `events`.`opportunity_id` = `opportunities`.`id`), `created_at`);
