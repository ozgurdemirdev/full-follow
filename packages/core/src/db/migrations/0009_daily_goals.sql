CREATE TABLE `daily_goals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_by` text NOT NULL,
	`title` text NOT NULL,
	`target` integer NOT NULL,
	`days` text DEFAULT '1,2,3,4,5,6,7' NOT NULL,
	`channel` text,
	`note` text
);
--> statement-breakpoint
CREATE TABLE `goal_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_by` text NOT NULL,
	`goal_id` integer NOT NULL,
	`date` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`note` text,
	FOREIGN KEY (`goal_id`) REFERENCES `daily_goals`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `goal_logs_day` ON `goal_logs` (`goal_id`,`date`);