CREATE TABLE `notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_by` text NOT NULL,
	`person_id` integer NOT NULL,
	`body` text NOT NULL,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `notes_person` ON `notes` (`person_id`);--> statement-breakpoint
CREATE TABLE `sectors` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_by` text NOT NULL,
	`name` text NOT NULL,
	`parent_id` integer,
	FOREIGN KEY (`parent_id`) REFERENCES `sectors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sectors_parent` ON `sectors` (`parent_id`);--> statement-breakpoint
ALTER TABLE `people` ADD `instagram` text;--> statement-breakpoint
ALTER TABLE `people` ADD `linkedin` text;--> statement-breakpoint
ALTER TABLE `people` ADD `sector_id` integer REFERENCES sectors(id);--> statement-breakpoint
CREATE INDEX `people_sector` ON `people` (`sector_id`);--> statement-breakpoint
CREATE INDEX `people_referred` ON `people` (`referred_by_id`);--> statement-breakpoint
ALTER TABLE `touches` ADD `expects_reply` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `touches_happened` ON `touches` (`happened_at`);--> statement-breakpoint
-- mevcut giden mesajlar cevap bekliyor sayılır
UPDATE `touches` SET `expects_reply` = 1 WHERE `direction` = 'giden' AND `kind` = 'mesaj';
