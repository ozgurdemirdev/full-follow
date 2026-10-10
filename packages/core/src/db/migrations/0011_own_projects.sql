CREATE TABLE `own_project_sectors` (
	`own_project_id` integer NOT NULL,
	`sector_id` integer NOT NULL,
	`created_at` text NOT NULL,
	`created_by` text NOT NULL,
	PRIMARY KEY(`own_project_id`, `sector_id`),
	FOREIGN KEY (`own_project_id`) REFERENCES `own_projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sector_id`) REFERENCES `sectors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `own_project_sectors_sector` ON `own_project_sectors` (`sector_id`);--> statement-breakpoint
CREATE TABLE `own_projects` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_by` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'aktif' NOT NULL,
	`sellable` text DEFAULT 'belki' NOT NULL,
	`sellable_note` text,
	`notes` text
);
--> statement-breakpoint
CREATE INDEX `own_projects_status` ON `own_projects` (`status`);--> statement-breakpoint
ALTER TABLE `ideas` ADD `own_project_id` integer REFERENCES own_projects(id);--> statement-breakpoint
ALTER TABLE `ideas` ADD `priority` text DEFAULT 'orta' NOT NULL;--> statement-breakpoint
ALTER TABLE `ideas` ADD `position` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `ideas` ADD `done_at` text;--> statement-breakpoint
CREATE INDEX `ideas_own_project` ON `ideas` (`own_project_id`,`priority`,`position`);