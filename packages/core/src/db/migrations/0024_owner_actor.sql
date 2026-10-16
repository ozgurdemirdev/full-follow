PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_by` text NOT NULL,
	`title` text NOT NULL,
	`assignee` text DEFAULT 'owner' NOT NULL,
	`due_date` text,
	`due_time` text,
	`kind` text DEFAULT 'gorev' NOT NULL,
	`done_at` text,
	`person_id` integer,
	`company_id` integer,
	`opportunity_id` integer,
	`project_id` integer,
	`idea_id` integer,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`idea_id`) REFERENCES `ideas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_tasks`("id", "created_at", "updated_at", "created_by", "title", "assignee", "due_date", "due_time", "kind", "done_at", "person_id", "company_id", "opportunity_id", "project_id", "idea_id") SELECT "id", "created_at", "updated_at", "created_by", "title", "assignee", "due_date", "due_time", "kind", "done_at", "person_id", "company_id", "opportunity_id", "project_id", "idea_id" FROM `tasks`;--> statement-breakpoint
DROP TABLE `tasks`;--> statement-breakpoint
ALTER TABLE `__new_tasks` RENAME TO `tasks`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
UPDATE `chat_attachments` SET `created_by` = 'owner' WHERE `created_by` = 'ozgur';--> statement-breakpoint
UPDATE `chat_messages` SET `created_by` = 'owner' WHERE `created_by` = 'ozgur';--> statement-breakpoint
UPDATE `chat_sessions` SET `created_by` = 'owner' WHERE `created_by` = 'ozgur';--> statement-breakpoint
UPDATE `comments` SET `created_by` = 'owner' WHERE `created_by` = 'ozgur';--> statement-breakpoint
UPDATE `companies` SET `created_by` = 'owner' WHERE `created_by` = 'ozgur';--> statement-breakpoint
UPDATE `company_sectors` SET `created_by` = 'owner' WHERE `created_by` = 'ozgur';--> statement-breakpoint
UPDATE `company_tags` SET `created_by` = 'owner' WHERE `created_by` = 'ozgur';--> statement-breakpoint
UPDATE `daily_goals` SET `created_by` = 'owner' WHERE `created_by` = 'ozgur';--> statement-breakpoint
UPDATE `drafts` SET `created_by` = 'owner' WHERE `created_by` = 'ozgur';--> statement-breakpoint
UPDATE `events` SET `created_by` = 'owner' WHERE `created_by` = 'ozgur';--> statement-breakpoint
UPDATE `files` SET `created_by` = 'owner' WHERE `created_by` = 'ozgur';--> statement-breakpoint
UPDATE `goal_logs` SET `created_by` = 'owner' WHERE `created_by` = 'ozgur';--> statement-breakpoint
UPDATE `idea_people` SET `created_by` = 'owner' WHERE `created_by` = 'ozgur';--> statement-breakpoint
UPDATE `idea_sectors` SET `created_by` = 'owner' WHERE `created_by` = 'ozgur';--> statement-breakpoint
UPDATE `ideas` SET `created_by` = 'owner' WHERE `created_by` = 'ozgur';--> statement-breakpoint
UPDATE `links` SET `created_by` = 'owner' WHERE `created_by` = 'ozgur';--> statement-breakpoint
UPDATE `notes` SET `created_by` = 'owner' WHERE `created_by` = 'ozgur';--> statement-breakpoint
UPDATE `offers` SET `created_by` = 'owner' WHERE `created_by` = 'ozgur';--> statement-breakpoint
UPDATE `opportunities` SET `created_by` = 'owner' WHERE `created_by` = 'ozgur';--> statement-breakpoint
UPDATE `opportunity_people` SET `created_by` = 'owner' WHERE `created_by` = 'ozgur';--> statement-breakpoint
UPDATE `own_project_sectors` SET `created_by` = 'owner' WHERE `created_by` = 'ozgur';--> statement-breakpoint
UPDATE `own_projects` SET `created_by` = 'owner' WHERE `created_by` = 'ozgur';--> statement-breakpoint
UPDATE `payments` SET `created_by` = 'owner' WHERE `created_by` = 'ozgur';--> statement-breakpoint
UPDATE `people` SET `created_by` = 'owner' WHERE `created_by` = 'ozgur';--> statement-breakpoint
UPDATE `person_sectors` SET `created_by` = 'owner' WHERE `created_by` = 'ozgur';--> statement-breakpoint
UPDATE `person_tags` SET `created_by` = 'owner' WHERE `created_by` = 'ozgur';--> statement-breakpoint
UPDATE `posts` SET `created_by` = 'owner' WHERE `created_by` = 'ozgur';--> statement-breakpoint
UPDATE `projects` SET `created_by` = 'owner' WHERE `created_by` = 'ozgur';--> statement-breakpoint
UPDATE `sectors` SET `created_by` = 'owner' WHERE `created_by` = 'ozgur';--> statement-breakpoint
UPDATE `sources` SET `created_by` = 'owner' WHERE `created_by` = 'ozgur';--> statement-breakpoint
UPDATE `tags` SET `created_by` = 'owner' WHERE `created_by` = 'ozgur';--> statement-breakpoint
UPDATE `tasks` SET `created_by` = 'owner' WHERE `created_by` = 'ozgur';--> statement-breakpoint
UPDATE `templates` SET `created_by` = 'owner' WHERE `created_by` = 'ozgur';--> statement-breakpoint
UPDATE `touches` SET `created_by` = 'owner' WHERE `created_by` = 'ozgur';--> statement-breakpoint
UPDATE `trash` SET `created_by` = 'owner' WHERE `created_by` = 'ozgur';--> statement-breakpoint
UPDATE `settings` SET `updated_by` = 'owner' WHERE `updated_by` = 'ozgur';--> statement-breakpoint
UPDATE `tasks` SET `assignee` = 'owner' WHERE `assignee` = 'ozgur';--> statement-breakpoint
UPDATE `trash` SET `payload` = replace(replace(replace(`payload`, '"created_by":"ozgur"', '"created_by":"owner"'), '"updated_by":"ozgur"', '"updated_by":"owner"'), '"assignee":"ozgur"', '"assignee":"owner"') WHERE `payload` LIKE '%"ozgur"%';--> statement-breakpoint
UPDATE `events` SET `summary` = replace(`summary`, 'Görev eklendi (ozgur):', 'Görev eklendi (owner):') WHERE `type` = 'task.created' AND `summary` LIKE 'Görev eklendi (ozgur):%';
