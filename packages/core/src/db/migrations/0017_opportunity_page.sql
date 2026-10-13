CREATE TABLE `files` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_by` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` integer NOT NULL,
	`name` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`stored_name` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `files_target` ON `files` (`target_type`,`target_id`);--> statement-breakpoint
CREATE TABLE `offers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_by` text NOT NULL,
	`opportunity_id` integer NOT NULL,
	`version` integer NOT NULL,
	`offered_at` text NOT NULL,
	`amount` integer NOT NULL,
	`items` text DEFAULT '[]' NOT NULL,
	`note` text,
	`accepted_at` text,
	`file_id` integer,
	FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`file_id`) REFERENCES `files`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `offers_opp` ON `offers` (`opportunity_id`,`version`);--> statement-breakpoint
CREATE UNIQUE INDEX `offers_one_accepted` ON `offers` (`opportunity_id`) WHERE "offers"."accepted_at" IS NOT NULL;--> statement-breakpoint
CREATE TABLE `opportunity_people` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_by` text NOT NULL,
	`opportunity_id` integer NOT NULL,
	`person_id` integer NOT NULL,
	`role` text DEFAULT 'diger' NOT NULL,
	`note` text,
	FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `opp_people_pair` ON `opportunity_people` (`opportunity_id`,`person_id`);--> statement-breakpoint
CREATE INDEX `opp_people_person` ON `opportunity_people` (`person_id`);