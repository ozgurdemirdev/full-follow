CREATE TABLE `comments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_by` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` integer NOT NULL,
	`body` text NOT NULL,
	`parent_id` integer,
	`resolved_at` text,
	FOREIGN KEY (`parent_id`) REFERENCES `comments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `comments_target` ON `comments` (`target_type`,`target_id`);--> statement-breakpoint
CREATE INDEX `comments_parent` ON `comments` (`parent_id`);--> statement-breakpoint
CREATE TABLE `companies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_by` text NOT NULL,
	`name` text NOT NULL,
	`website` text,
	`notes` text
);
--> statement-breakpoint
CREATE TABLE `drafts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_by` text NOT NULL,
	`person_id` integer NOT NULL,
	`opportunity_id` integer,
	`project_id` integer,
	`channel` text NOT NULL,
	`body` text NOT NULL,
	`status` text DEFAULT 'bekliyor' NOT NULL,
	`reject_note` text,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`person_id` integer,
	`opportunity_id` integer,
	`project_id` integer,
	`summary` text NOT NULL,
	`data` text,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `events_person` ON `events` (`person_id`);--> statement-breakpoint
CREATE INDEX `events_opp` ON `events` (`opportunity_id`);--> statement-breakpoint
CREATE INDEX `events_project` ON `events` (`project_id`);--> statement-breakpoint
CREATE TABLE `opportunities` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_by` text NOT NULL,
	`title` text NOT NULL,
	`person_id` integer NOT NULL,
	`source_id` integer NOT NULL,
	`stage` text DEFAULT 'bulundu' NOT NULL,
	`estimated_value` integer,
	`lost_reason` text,
	`next_follow_up_at` text,
	`closed_at` text,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `opps_stage` ON `opportunities` (`stage`,`position`);--> statement-breakpoint
CREATE INDEX `opps_person` ON `opportunities` (`person_id`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_by` text NOT NULL,
	`project_id` integer NOT NULL,
	`milestone` text NOT NULL,
	`expected_amount` integer NOT NULL,
	`due_date` text,
	`paid_amount` integer DEFAULT 0 NOT NULL,
	`paid_at` text,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `payments_project` ON `payments` (`project_id`);--> statement-breakpoint
CREATE INDEX `payments_paid_at` ON `payments` (`paid_at`);--> statement-breakpoint
CREATE TABLE `people` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_by` text NOT NULL,
	`name` text NOT NULL,
	`company_id` integer,
	`email` text,
	`phone` text,
	`handle` text,
	`referred_by_id` integer,
	`next_follow_up_at` text,
	`notes` text,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`referred_by_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `people_follow_up` ON `people` (`next_follow_up_at`);--> statement-breakpoint
CREATE TABLE `person_tags` (
	`person_id` integer NOT NULL,
	`tag` text NOT NULL,
	`created_at` text NOT NULL,
	`created_by` text NOT NULL,
	PRIMARY KEY(`person_id`, `tag`),
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_by` text NOT NULL,
	`name` text NOT NULL,
	`opportunity_id` integer,
	`person_id` integer NOT NULL,
	`stage` text DEFAULT 'pesinat' NOT NULL,
	`price` integer DEFAULT 0 NOT NULL,
	`started_at` text,
	`delivered_at` text,
	`maintenance_fee` integer,
	FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `projects_opportunity` ON `projects` (`opportunity_id`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sources` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_by` text NOT NULL,
	`name` text NOT NULL,
	`kind` text DEFAULT 'diger' NOT NULL,
	`notes` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sources_name` ON `sources` (`name`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_by` text NOT NULL,
	`title` text NOT NULL,
	`assignee` text DEFAULT 'ozgur' NOT NULL,
	`due_date` text,
	`done_at` text,
	`person_id` integer,
	`opportunity_id` integer,
	`project_id` integer,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `touches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_by` text NOT NULL,
	`person_id` integer NOT NULL,
	`opportunity_id` integer,
	`project_id` integer,
	`channel` text NOT NULL,
	`direction` text NOT NULL,
	`kind` text DEFAULT 'mesaj' NOT NULL,
	`summary` text NOT NULL,
	`outcome` text,
	`happened_at` text NOT NULL,
	`draft_id` integer,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`draft_id`) REFERENCES `drafts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `touches_person` ON `touches` (`person_id`,`happened_at`);